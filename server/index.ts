import express from 'express'
import cors from 'cors'
import { Client, types } from 'pg'
import path from 'path'
import type Database from 'better-sqlite3'

// Lakebase stores TCA and CDM times as UTC in `timestamp without time zone`
// columns. node-postgres would read those in the process's local time zone, so
// parse them as UTC explicitly (correct on a laptop as well as in the app).
types.setTypeParser(1114, (v: string) => new Date(v.replace(' ', 'T') + 'Z'))

// ─── Local dev mode (SQLite) ─────────────────────────────────────────────────
// better-sqlite3 has native bindings and is only needed for local dev. It is
// loaded lazily (tsc emits a deferred require for this dynamic import), so
// production (PGHOST set) never loads the native module and the deployed
// Databricks App never depends on a platform-specific .node binary.
const isLocalMode = !process.env.PGHOST
let localDb: Database.Database | null = null
const localDbReady: Promise<void> = isLocalMode
  ? import('./db/local').then(({ createLocalDb }) => {
      localDb = createLocalDb()
      console.log('[local] Running in LOCAL mode with SQLite -- no Postgres/Databricks required')
    })
  : Promise.resolve()

// ─── PG auth helper: prefer forwarded user token, fallback to M2M ────────────
let _lastForwardedToken: string | null = null
// PG_AUTH_MODE=sp: always connect as the app service principal (PGUSER falls back to its client id)
const pgSpMode = process.env.PG_AUTH_MODE === 'sp'
function getPgPassword(req?: express.Request): string | Promise<string> {
  if (pgSpMode) return getM2MToken()
  const forwarded = req?.headers?.['x-forwarded-access-token'] as string | undefined
  if (forwarded) {
    _lastForwardedToken = forwarded
    return forwarded
  }
  if (_lastForwardedToken) return _lastForwardedToken
  if (process.env.PGPASSWORD) return process.env.PGPASSWORD
  return getM2MToken()
}

// ─── TLE parsing helpers ──────────────────────────────────────────────────────
function parseTleToOrbitalParams(line1: string, line2: string) {
  const fields = line2.trim().split(/\s+/)
  const inclination = parseFloat(fields[2])
  const raan = parseFloat(fields[3])
  const eccentricity = parseFloat('0.' + fields[4])
  const argOfPerigee = parseFloat(fields[5])
  const meanAnomaly = parseFloat(fields[6])
  const meanMotion = parseFloat(fields[7].substring(0, 11))
  const mu = 398600.4418
  const n_rad_s = (meanMotion * 2 * Math.PI) / 86400
  const semiMajorAxis = Math.pow(mu / (n_rad_s * n_rad_s), 1 / 3)
  const altitudeKm = semiMajorAxis - 6371
  const velocityKms = Math.sqrt(mu / semiMajorAxis)
  const epochYear = parseInt(line1.substring(18, 20))
  const epochDay = parseFloat(line1.substring(20, 32))
  const year = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear
  const epochDate = new Date(year, 0, 1)
  epochDate.setDate(epochDate.getDate() + Math.floor(epochDay) - 1)
  epochDate.setSeconds(epochDate.getSeconds() + (epochDay % 1) * 86400)
  return {
    inclination,
    raan,
    eccentricity,
    argOfPerigee,
    trueAnomaly: meanAnomaly,
    semiMajorAxis,
    altitudeKm,
    velocityKms,
    epoch: epochDate.toISOString(),
    meanMotion,
    bstar: parseFloat(line1.substring(53, 61).replace('-', 'e-').replace('+', 'e+')) || 0,
  }
}

// Fetch TLE — read from Lakebase first (stored from Space-Track GP data), external fallback
async function fetchTle(
  noradId: string
): Promise<{ name: string; line1: string; line2: string } | null> {
  // Local mode: read from SQLite first, then try external APIs
  if (localDb) {
    const row = localDb
      .prepare(
        'SELECT name, tle_line1, tle_line2 FROM satellites WHERE norad_id = ? AND tle_line1 IS NOT NULL'
      )
      .get(noradId) as { name: string; tle_line1: string; tle_line2: string } | undefined
    if (row && row.tle_line1) return { name: row.name, line1: row.tle_line1, line2: row.tle_line2 }
    // Fall through to external APIs even in local mode
  }

  // Try Lakebase first (fastest, no network dependency)
  if (!isLocalMode) {
    try {
      const password = await getPgPassword()
      const client = new Client({
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'orbitwatch',
        user:
          process.env.PGUSER || process.env.DATABRICKS_CLIENT_ID || 'will.yuponce@databricks.com',
        password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      })
      await client.connect()
      try {
        const result = await client.query(
          'SELECT name, tle_line1, tle_line2 FROM satellites WHERE norad_id = $1 AND tle_line1 IS NOT NULL',
          [noradId]
        )
        if (result.rows.length > 0 && result.rows[0].tle_line1) {
          return {
            name: result.rows[0].name,
            line1: result.rows[0].tle_line1,
            line2: result.rows[0].tle_line2,
          }
        }
      } finally {
        await client.end().catch(() => {})
      }
    } catch {
      /* fall through to external sources */
    }
  }
  // Fallback: Celestrak
  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (resp.ok) {
      const text = await resp.text()
      const lines = text
        .trim()
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
      if (lines.length >= 3) return { name: lines[0], line1: lines[1], line2: lines[2] }
    }
  } catch {
    /* fall through */
  }
  // Fallback: tle.ivanstanojevic.me
  try {
    const url = `https://tle.ivanstanojevic.me/api/tle/${noradId}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    const data = (await resp.json()) as { name: string; line1: string; line2: string }
    if (data.line1 && data.line2) return { name: data.name, line1: data.line1, line2: data.line2 }
  } catch {
    /* ignore */
  }
  return null
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// M2M OAuth token cache
let m2mToken: { value: string; expiresAt: number } | null = null

async function getM2MToken(): Promise<string> {
  if (isLocalMode) return 'local-dev-token'

  // Return cached token if still valid (refresh 5 min early)
  if (m2mToken && Date.now() < m2mToken.expiresAt - 5 * 60 * 1000) {
    return m2mToken.value
  }

  const host = process.env.DATABRICKS_HOST
  const clientId = process.env.DATABRICKS_CLIENT_ID
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET

  if (!host || !clientId || !clientSecret) {
    throw new Error('Missing DATABRICKS_HOST, DATABRICKS_CLIENT_ID, or DATABRICKS_CLIENT_SECRET')
  }

  const baseUrl = host.startsWith('http') ? host : `https://${host}`
  const resp = await fetch(`${baseUrl}/oidc/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'all-apis',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`M2M token fetch failed: ${resp.status} ${body}`)
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number }
  m2mToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  console.log('[m2m] Fetched new OAuth token, expires in', data.expires_in, 's')
  return m2mToken.value
}

async function query(req: express.Request, sql: string, params: unknown[] = []) {
  if (localDb) {
    return localQuery(localDb, sql, params)
  }
  const password = await getPgPassword(req)
  const client = new Client({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'orbitwatch',
    user: process.env.PGUSER || process.env.DATABRICKS_CLIENT_ID || 'will.yuponce@databricks.com',
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
  })
  await client.connect()
  try {
    return await client.query(sql, params)
  } finally {
    await client.end().catch(() => {})
  }
}

function localQuery(
  db: Database.Database,
  sql: string,
  params: unknown[] = []
): { rows: Record<string, unknown>[]; rowCount: number } {
  // Convert Postgres $1, $2, ... placeholders to SQLite ? placeholders
  // Must reorder params if $N references are not sequential or repeated
  const paramRefs: number[] = []
  const sqliteSql = sql.replace(/\$(\d+)/g, (_match, num) => {
    paramRefs.push(parseInt(num))
    return '?'
  })

  // Build the reordered params array based on $N references
  let reorderedParams: unknown[]
  if (paramRefs.length > 0) {
    reorderedParams = paramRefs.map(n => params[n - 1])
  } else {
    reorderedParams = params
  }

  // Rewrite Postgres-specific SQL for SQLite compatibility
  let fixedSql = sqliteSql

  // Replace LATERAL JOIN with a correlated subquery
  // Pattern: LEFT JOIN LATERAL ( SELECT ... FROM table WHERE col = ref ORDER BY ... LIMIT 1 ) alias ON true
  fixedSql = fixedSql.replace(
    /LEFT\s+JOIN\s+LATERAL\s*\(\s*SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*(\S+)\s+ORDER\s+BY\s+(\w+)\s+DESC\s+LIMIT\s+1\s*\)\s+(\w+)\s+ON\s+true/gi,
    (_m, table, col, ref, orderCol, alias) => {
      return `LEFT JOIN ${table} ${alias} ON ${alias}.${col} = ${ref} AND ${alias}.id = (SELECT id FROM ${table} WHERE ${col} = ${ref} ORDER BY ${orderCol} DESC LIMIT 1)`
    }
  )

  // Replace COUNT(*) FILTER (WHERE cond) with SUM(CASE WHEN cond THEN 1 ELSE 0 END)
  fixedSql = fixedSql.replace(
    /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi,
    (_m, cond) => `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`
  )

  // Remove NULLS LAST (SQLite sorts NULLs first by default for ASC, last for DESC -- close enough)
  fixedSql = fixedSql.replace(/\s+NULLS\s+LAST/gi, '')

  const trimmed = fixedSql.trim().toUpperCase()
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')

  if (isSelect) {
    const rows = db.prepare(fixedSql).all(...reorderedParams) as Record<string, unknown>[]
    return { rows, rowCount: rows.length }
  } else {
    // Check for RETURNING clause
    const hasReturning = /RETURNING\s+/i.test(fixedSql)
    if (hasReturning) {
      // SQLite doesn't support RETURNING in older versions, simulate it
      const sqlNoReturning = fixedSql.replace(/\s+RETURNING\s+.*/i, '')
      const result = db.prepare(sqlNoReturning).run(...reorderedParams)
      // Re-query the affected row
      const tableMatch = sql.match(/(?:INSERT\s+INTO|UPDATE)\s+(\w+)/i)
      if (tableMatch) {
        const tableName = tableMatch[1]
        if (trimmed.startsWith('INSERT')) {
          const rows = db
            .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
            .all(result.lastInsertRowid) as Record<string, unknown>[]
          return { rows, rowCount: result.changes }
        } else {
          // UPDATE ... WHERE id = ? RETURNING * -- get the id from params
          const idMatch = sql.match(/WHERE\s+id\s*=\s*\$(\d+)/i)
          if (idMatch) {
            const idParam = params[parseInt(idMatch[1]) - 1]
            const rows = db
              .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
              .all(idParam) as Record<string, unknown>[]
            return { rows, rowCount: result.changes }
          }
        }
      }
      return { rows: [], rowCount: result.changes }
    } else {
      const result = db.prepare(fixedSql).run(...reorderedParams)
      return { rows: [], rowCount: result.changes }
    }
  }
}

// ─── Conjunction event helpers ────────────────────────────────────────────────
type Row = Record<string, unknown>

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// TCA is stored as UTC. Time filters bind an ISO timestamp parameter, so the
// same SQL works on Lakebase (Postgres) and in local SQLite mode.
function nowIso(offsetHours = 0): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString()
}

// "Miss 43 m · Pc (ML) 1:248" style label; meters under 1 km, km above.
function missLabel(missM: number | null, pc: number | null): string {
  if (missM === null || !(missM > 0)) return ''
  const miss = missM < 1000 ? `${Math.round(missM)} m` : `${(missM / 1000).toFixed(1)} km`
  const odds = pc && pc > 0 ? `1:${Math.round(1 / pc).toLocaleString()}` : 'N/A'
  return `Miss ${miss} · Pc (ML) ${odds}`
}

interface PcPoint {
  createdAt: string
  pc: number | null
  missDistanceM: number | null
}

function parsePcHistory(v: unknown): PcPoint[] {
  let arr: unknown = v
  if (typeof v === 'string') {
    try {
      arr = JSON.parse(v)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map(h => {
      const o = (h ?? {}) as Row
      return {
        createdAt: String(o.created_at ?? o.createdAt ?? ''),
        pc: num(o.pc),
        missDistanceM: num(o.miss_distance_m ?? o.missDistanceM),
      }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// conjunction_events holds one row per physical event (its latest CDM), plus
// the number of CDM updates and the Pc history across them.
const CONJ_COLUMNS = `
  ce.id, ce.cdm_id, ce.tca, ce.miss_distance_km, ce.miss_distance_m,
  ce.raw_pc, ce.ml_pc, ce.risk_tier,
  ce.maneuver_recommended, ce.maneuver_window_open, ce.maneuver_window_close,
  ce.status, ce.created_at, ce.event_key, ce.cdm_count, ce.first_pc, ce.max_pc, ce.pc_history,
  sa.id as sat_a_id, sa.name as sat_a_name, sa.norad_id as sat_a_norad, sa.operator as sat_a_operator,
  sb.id as sat_b_id, sb.name as sat_b_name, sb.norad_id as sat_b_norad, sb.operator as sat_b_operator`
const CONJ_FROM = `
  FROM conjunction_events ce
  JOIN satellites sa ON ce.satellite_a_id = sa.id
  JOIN satellites sb ON ce.satellite_b_id = sb.id`

// "passed" is derived at read time: once TCA is behind us the event is no
// longer actionable, whatever status was stored when it was loaded.
function toEvent(row: Row, nowMs = Date.now()) {
  const tcaMs = new Date(row.tca as string).getTime()
  const passed = Number.isFinite(tcaMs) && tcaMs < nowMs
  const missM = num(row.miss_distance_m)
  return {
    id: String(row.id),
    cdmId: row.cdm_id,
    tca: row.tca,
    missDistanceKm: missM !== null ? missM / 1000 : num(row.miss_distance_km),
    missDistanceM: missM,
    rawPc: num(row.raw_pc) ?? undefined,
    mlPc: num(row.ml_pc),
    riskTier: row.risk_tier,
    maneuverRecommended: passed ? false : Boolean(row.maneuver_recommended),
    maneuverWindowOpen: row.maneuver_window_open,
    maneuverWindowClose: row.maneuver_window_close,
    status: passed ? 'passed' : row.status,
    hoursToTca: Number.isFinite(tcaMs) ? (tcaMs - nowMs) / 3_600_000 : null,
    eventKey: row.event_key ?? null,
    cdmCount: num(row.cdm_count) ?? 1,
    firstPc: num(row.first_pc),
    maxPc: num(row.max_pc),
    pcHistory: parsePcHistory(row.pc_history),
    satelliteA: {
      id: String(row.sat_a_id),
      name: row.sat_a_name,
      noradId: row.sat_a_norad,
      operator: row.sat_a_operator,
    },
    satelliteB: {
      id: String(row.sat_b_id),
      name: row.sat_b_name,
      noradId: row.sat_b_norad,
      operator: row.sat_b_operator,
    },
  }
}

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await query(req, 'SELECT 1')
    res.json({ status: 'ok', db: 'connected' })
  } catch (err: unknown) {
    res
      .status(500)
      .json({ status: 'error', db: 'disconnected', message: errMessage(err).substring(0, 200) })
  }
})

// GET /api/conjunctions - one row per conjunction event
//   ?status=active (default): upcoming events (TCA in the future), riskiest first
//   ?status=passed&since_hours=24: events whose TCA passed in that window, latest first
//   ?status=all: everything (stored statuses such as resolved or maneuvered also work)
//   ?norad_ids=25544,45678 limits to events involving those objects
app.get('/api/conjunctions', async (req, res) => {
  try {
    const { status = 'active', limit = 50, norad_ids, since_hours = 24 } = req.query
    const noradList =
      typeof norad_ids === 'string'
        ? norad_ids
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
    const params: unknown[] = [Math.min(Math.max(Number(limit) || 50, 1), 500)]
    const conditions: string[] = []
    if (status === 'active') {
      params.push(nowIso())
      conditions.push(`ce.tca >= $${params.length}`)
    } else if (status === 'passed') {
      params.push(nowIso(), nowIso(-(Number(since_hours) || 24)))
      conditions.push(`ce.tca < $${params.length - 1} AND ce.tca >= $${params.length}`)
    } else if (status !== 'all') {
      params.push(String(status))
      conditions.push(`ce.status = $${params.length}`)
    }
    if (noradList.length > 0) {
      const placeholders = noradList.map((_, i) => `$${params.length + 1 + i}`).join(',')
      params.push(...noradList)
      conditions.push(`(sa.norad_id IN (${placeholders}) OR sb.norad_id IN (${placeholders}))`)
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const order = status === 'passed' ? 'ce.tca DESC' : 'ce.ml_pc DESC NULLS LAST, ce.tca ASC'
    const result = await query(
      req,
      `
      SELECT ${CONJ_COLUMNS}
      ${CONJ_FROM}
      ${whereClause}
      ORDER BY ${order}
      LIMIT $1
    `,
      params
    )

    const nowMs = Date.now()
    const events = result.rows.map(row => toEvent(row, nowMs))

    res.json(events)
  } catch (err) {
    console.error('Error fetching conjunctions:', err)
    res.status(500).json({ error: 'Failed to fetch conjunctions' })
  }
})

// GET /api/conjunctions/:id - single conjunction with recommendations
app.get('/api/conjunctions/:id', async (req, res) => {
  try {
    const { id } = req.params
    // Try cdm_id first (Space-Track CDM IDs are large numbers like 1372680015),
    // fall back to serial id only for small numbers
    const isSmallNumeric = /^\d+$/.test(id) && parseInt(id) < 100000
    const whereClause = isSmallNumeric ? 'ce.id = $1' : 'ce.cdm_id = $1'
    const eventResult = await query(
      req,
      `
      SELECT ${CONJ_COLUMNS}
      ${CONJ_FROM}
      WHERE ${whereClause}
    `,
      [id]
    )

    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = eventResult.rows[0]
    const recResult = await query(
      req,
      `SELECT * FROM ai_recommendations WHERE conjunction_id = $1 ORDER BY priority ASC`,
      [row.id]
    )

    // Fetch TLEs for both satellites in parallel
    const [tleA, tleB] = await Promise.all([fetchTle(row.sat_a_norad), fetchTle(row.sat_b_norad)])
    const orbitalA = tleA ? parseTleToOrbitalParams(tleA.line1, tleA.line2) : null
    const orbitalB = tleB ? parseTleToOrbitalParams(tleB.line1, tleB.line2) : null

    const event = toEvent(row)
    res.json({
      ...event,
      satelliteA: { ...event.satelliteA, tle: tleA, orbitalParams: orbitalA },
      satelliteB: { ...event.satelliteB, tle: tleB, orbitalParams: orbitalB },
      aiRecommendations: recResult.rows.map(r => ({
        id: String(r.id),
        type: r.type,
        priority: r.priority,
        description: r.description,
        confidence: r.confidence,
        timestamp: row.tca,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch conjunction' })
  }
})

// GET /api/satellites
app.get('/api/satellites', async (req, res) => {
  try {
    const result = await query(
      req,
      `
      SELECT s.*, oe.altitude_km, oe.velocity_kms, oe.inclination, oe.eccentricity,
             oe.raan, oe.arg_of_perigee, oe.mean_anomaly, oe.semi_major_axis
      FROM satellites s
      LEFT JOIN LATERAL (
        SELECT * FROM orbital_elements WHERE satellite_id = s.id ORDER BY epoch DESC LIMIT 1
      ) oe ON true
      ORDER BY s.name
    `
    )
    res.json(
      result.rows.map(r => ({
        id: String(r.id),
        noradId: r.norad_id,
        name: r.name,
        operator: r.operator,
        constellation: r.constellation,
        category: r.category,
        altitude: r.altitude_km,
        velocity: r.velocity_kms,
        selected: false,
        orbitalParams: {
          semiMajorAxis: r.semi_major_axis,
          eccentricity: r.eccentricity,
          inclination: r.inclination,
          raan: r.raan,
          argOfPerigee: r.arg_of_perigee,
          trueAnomaly: r.mean_anomaly,
        },
        tle: r.tle_line1 && r.tle_line2 ? { line1: r.tle_line1, line2: r.tle_line2 } : null,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch satellites' })
  }
})

// GET /api/metrics/:noradId — orbital elements for a satellite as TelemetryData
app.get('/api/metrics/:noradId', async (req, res) => {
  try {
    const result = await query(
      req,
      `
      SELECT s.name, s.norad_id, oe.altitude_km, oe.velocity_kms,
             oe.inclination, oe.eccentricity, oe.raan, oe.mean_motion, oe.bstar, oe.epoch
      FROM orbital_elements oe
      JOIN satellites s ON oe.satellite_id = s.id
      WHERE s.norad_id = $1
      ORDER BY oe.epoch DESC LIMIT 1
    `,
      [req.params.noradId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const r = result.rows[0]
    res.json([
      {
        parameter: 'Altitude',
        value: r.altitude_km != null ? Number(r.altitude_km).toFixed(1) : '--',
        unit: 'km',
        status: 'normal',
      },
      {
        parameter: 'Velocity',
        value: r.velocity_kms != null ? Number(r.velocity_kms).toFixed(3) : '--',
        unit: 'km/s',
        status: 'normal',
      },
      {
        parameter: 'Inclination',
        value: r.inclination != null ? Number(r.inclination).toFixed(2) : '--',
        unit: '°',
        status: 'normal',
      },
      {
        parameter: 'Eccentricity',
        value: r.eccentricity != null ? Number(r.eccentricity).toFixed(6) : '--',
        unit: '',
        status: Number(r.eccentricity) > 0.01 ? 'warning' : 'normal',
      },
      {
        parameter: 'RAAN',
        value: r.raan != null ? Number(r.raan).toFixed(2) : '--',
        unit: '°',
        status: 'normal',
      },
      {
        parameter: 'Mean Motion',
        value: r.mean_motion != null ? Number(r.mean_motion).toFixed(4) : '--',
        unit: 'rev/day',
        status: 'normal',
      },
      {
        parameter: 'BSTAR Drag',
        value: r.bstar != null ? Number(r.bstar).toExponential(2) : '--',
        unit: '',
        status: r.bstar != null && Math.abs(Number(r.bstar)) > 0.001 ? 'warning' : 'normal',
      },
    ])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch metrics' })
  }
})

// GET /api/recommendations — AI recommendations, optionally filtered by ?norad_ids=
app.get('/api/recommendations', async (req, res) => {
  try {
    const { norad_ids } = req.query
    const noradList =
      typeof norad_ids === 'string'
        ? norad_ids
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
    // Upcoming events only: advice on a conjunction whose TCA has passed is moot.
    const params: unknown[] = [nowIso()]
    let noradFilter = 'WHERE ce.tca >= $1'
    if (noradList.length > 0) {
      const placeholders = noradList.map((_, i) => `$${i + 2}`).join(',')
      params.push(...noradList)
      noradFilter += ` AND (sa.norad_id IN (${placeholders}) OR sb.norad_id IN (${placeholders}))`
    }
    const result = await query(
      req,
      `
      SELECT ar.id, ar.type, ar.priority, ar.description, ar.confidence, ar.created_at,
             ce.cdm_id, ce.tca, ce.miss_distance_km, ce.risk_tier,
             sa.name as sat_a_name, sb.name as sat_b_name
      FROM ai_recommendations ar
      JOIN conjunction_events ce ON ar.conjunction_id = ce.id
      JOIN satellites sa ON ce.satellite_a_id = sa.id
      JOIN satellites sb ON ce.satellite_b_id = sb.id
      ${noradFilter}
      ORDER BY
        CASE ar.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        ce.tca ASC
      LIMIT 20
    `,
      params
    )
    res.json(
      result.rows.map(r => ({
        id: String(r.id),
        timestamp: r.tca,
        type: r.type,
        priority: r.priority,
        description: r.description,
        confidence: r.confidence,
        relatedEventId: r.cdm_id,
        affectedObjects: [r.sat_a_name, r.sat_b_name],
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
})

// GET /api/tracking-network
app.get('/api/tracking-network', async (req, res) => {
  try {
    const result = await query(req, 'SELECT * FROM tracking_network ORDER BY data_quality DESC')
    res.json(
      result.rows.map(r => ({
        sensorId: r.sensor_id,
        sensorName: r.sensor_name,
        sensorType: r.sensor_type,
        location: r.location,
        lastContact: r.last_contact,
        dataQuality: r.data_quality,
        trackingObjects: r.tracking_objects,
        status: r.status,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tracking network' })
  }
})

// GET /api/analytics/risk-summary
app.get('/api/analytics/risk-summary', async (req, res) => {
  try {
    // Upcoming events only: a conjunction whose TCA has passed is not a risk.
    const result = await query(
      req,
      `
      SELECT
        risk_tier,
        COUNT(*) as count,
        AVG(ml_pc) as avg_pc,
        MIN(miss_distance_km) as min_miss_distance,
        MIN(miss_distance_m) as min_miss_distance_m
      FROM conjunction_events
      WHERE status = 'active' AND tca >= $1
      GROUP BY risk_tier
    `,
      [nowIso()]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch risk summary' })
  }
})

// GET /api/pipeline-status
app.get('/api/pipeline-status', async (req, res) => {
  try {
    const result = await query(
      req,
      'SELECT MAX(updated_at) as last_updated FROM conjunction_events'
    )
    res.json({ lastUpdated: result.rows[0]?.last_updated || null, status: 'live' })
  } catch {
    res.json({ lastUpdated: null, status: 'unknown' })
  }
})

const DEFAULT_CHAT_MODEL = 'databricks-claude-sonnet-5-5'
const chatModel = () => process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL

// Run one overview query; a missing optional table (for example the ML copy
// before its first load) degrades that tile instead of failing the page.
async function optionalRows(
  req: express.Request,
  sql: string,
  params: unknown[] = []
): Promise<Row[]> {
  try {
    return (await query(req, sql, params)).rows as Row[]
  } catch (err) {
    console.warn('[overview] query skipped:', errMessage(err).substring(0, 160))
    return []
  }
}

function eventBrief(row: Row | undefined) {
  if (!row) return null
  const e = toEvent(row)
  return {
    id: e.id,
    tca: e.tca,
    satA: e.satelliteA.name,
    satB: e.satelliteB.name,
    riskTier: e.riskTier,
    rawPc: e.rawPc ?? null,
    mlPc: e.mlPc,
    missDistanceM: e.missDistanceM ?? (e.missDistanceKm !== null ? e.missDistanceKm * 1000 : null),
  }
}

// GET /api/overview - live mission summary for the home page and header chips
app.get('/api/overview', async (req, res) => {
  try {
    const now = nowIso()
    const dayAgo = nowIso(-24)
    const upcoming = `${CONJ_FROM} WHERE ce.tca >= $1 AND ce.status = 'active'`
    // The counts query is required: if Lakebase is unreachable the request
    // fails (500) instead of reporting zero events. Other tiles are optional.
    const [counts, next, closest, highest, sats, anomalies, fresh, model] = await Promise.all([
      query(
        req,
        `
        SELECT
          SUM(CASE WHEN tca >= $1 THEN 1 ELSE 0 END) AS upcoming,
          SUM(CASE WHEN tca >= $1 AND risk_tier = 'red' THEN 1 ELSE 0 END) AS red,
          SUM(CASE WHEN tca >= $1 AND risk_tier = 'amber' THEN 1 ELSE 0 END) AS amber,
          SUM(CASE WHEN tca >= $1 AND risk_tier = 'green' THEN 1 ELSE 0 END) AS green,
          SUM(CASE WHEN tca < $1 AND tca >= $2 THEN 1 ELSE 0 END) AS passed24h,
          SUM(CASE WHEN tca >= $1 AND maneuver_recommended THEN 1 ELSE 0 END) AS maneuver
        FROM conjunction_events WHERE status = 'active'`,
        [now, dayAgo]
      ),
      optionalRows(req, `SELECT ${CONJ_COLUMNS} ${upcoming} ORDER BY ce.tca ASC LIMIT 1`, [now]),
      optionalRows(
        req,
        `SELECT ${CONJ_COLUMNS} ${upcoming}
        ORDER BY COALESCE(ce.miss_distance_m, ce.miss_distance_km * 1000) ASC LIMIT 1`,
        [now]
      ),
      optionalRows(
        req,
        `SELECT ${CONJ_COLUMNS} ${upcoming} ORDER BY ce.raw_pc DESC NULLS LAST LIMIT 1`,
        [now]
      ),
      optionalRows(req, 'SELECT COUNT(*) AS n FROM satellites'),
      optionalRows(
        req,
        `
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN severity IN ('critical', 'high') THEN 1 ELSE 0 END) AS critical_high
        FROM anomaly_events WHERE status <> 'resolved'`
      ),
      optionalRows(
        req,
        'SELECT MAX(cdm_created_at) AS data_as_of, MAX(created_at) AS loaded_at FROM conjunction_events'
      ),
      optionalRows(req, 'SELECT * FROM ml_model_summary ORDER BY trained_at DESC LIMIT 1'),
    ])
    const c = (counts.rows[0] ?? {}) as Row
    const m = model[0]
    res.json({
      dataAsOf: fresh[0]?.data_as_of ?? null,
      lastLoadedAt: fresh[0]?.loaded_at ?? null,
      objectsTracked: num(sats[0]?.n) ?? 0,
      events: {
        upcoming: num(c.upcoming) ?? 0,
        red: num(c.red) ?? 0,
        amber: num(c.amber) ?? 0,
        green: num(c.green) ?? 0,
        passed24h: num(c.passed24h) ?? 0,
        maneuverRecommended: num(c.maneuver) ?? 0,
      },
      nextTca: eventBrief(next[0]),
      closestApproach: eventBrief(closest[0]),
      highestPc: eventBrief(highest[0]),
      anomalies: {
        total: num(anomalies[0]?.total) ?? 0,
        criticalHigh: num(anomalies[0]?.critical_high) ?? 0,
      },
      model: m
        ? {
            name: m.model_name ?? null,
            version: m.model_version != null ? String(m.model_version) : null,
            trainedAt: m.trained_at ?? null,
            r2: num(m.r2_log_scale),
            mae: num(m.mae),
            nTraining: num(m.n_training_samples),
            nScored: num(m.total_scored),
          }
        : null,
      chatModel: chatModel(),
    })
  } catch (err) {
    console.error('GET /api/overview error:', err)
    res.status(500).json({ error: 'Failed to build overview' })
  }
})

// POST /api/maneuver-plans
app.post('/api/maneuver-plans', async (req, res) => {
  try {
    const {
      conjunctionId,
      satelliteId,
      deltaVMs,
      executionTime,
      fuelCostKg,
      postManeuverPc,
      maneuverType,
    } = req.body
    const result = await query(
      req,
      `
      INSERT INTO maneuver_plans (conjunction_id, satellite_id, delta_v_ms, execution_time, fuel_cost_kg, post_maneuver_pc, maneuver_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        conjunctionId,
        satelliteId,
        deltaVMs,
        executionTime,
        fuelCostKg,
        postManeuverPc,
        maneuverType || 'in-track',
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save maneuver plan' })
  }
})

// GET /api/anomalies — anomaly events, optionally filtered by ?norad_ids=
app.get('/api/anomalies', async (req, res) => {
  try {
    const { norad_ids } = req.query
    const noradList =
      typeof norad_ids === 'string'
        ? norad_ids
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
    let noradFilter = ''
    const params: unknown[] = []
    if (noradList.length > 0) {
      const placeholders = noradList.map((_, i) => `$${i + 1}`).join(',')
      params.push(...noradList)
      noradFilter = `WHERE ae.norad_id IN (${placeholders})`
    }
    const result = await query(
      req,
      `
      SELECT
        ae.id, ae.norad_id, ae.satellite_name, ae.anomaly_type, ae.severity,
        ae.detected_at, ae.parameter_name, ae.expected_value, ae.observed_value,
        ae.deviation_sigma, ae.anomaly_score, ae.description, ae.status
      FROM anomaly_events ae
      ${noradFilter}
      ORDER BY
        CASE ae.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        ae.detected_at DESC
      LIMIT 50
    `,
      params
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET /api/anomalies error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/anomalies/:id
app.get('/api/anomalies/:id', async (req, res) => {
  try {
    const result = await query(req, 'SELECT * FROM anomaly_events WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error('GET /api/anomalies/:id error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// PATCH /api/anomalies/:id/status — update anomaly status
app.patch('/api/anomalies/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    if (!['active', 'investigating', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    const result = await query(
      req,
      'UPDATE anomaly_events SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    )
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'Database error' })
  }
})

// ─── Agentic AI Chat ─────────────────────────────────────────────────────────

const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_conjunctions',
      description:
        'Query upcoming conjunction events (TCA in the future), one row per event. Returns satellite pairs, Space-Track (18 SDS) and ML collision probabilities, miss distance in meters (miss_distance_m), risk tier, TCA, and how many CDM updates the event has had.',
      parameters: {
        type: 'object',
        properties: {
          risk_tier: {
            type: 'string',
            enum: ['red', 'amber', 'green'],
            description: 'Filter by risk tier',
          },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ml_predictions',
      description:
        'Get XGBoost ML model predictions that recalibrate raw collision probabilities. Shows raw vs ML Pc, calibration ratio, and risk tier changes.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_satellite_info',
      description:
        'Get orbital parameters for a satellite by NORAD ID. Returns altitude, velocity, inclination, eccentricity, RAAN, and other orbital elements.',
      parameters: {
        type: 'object',
        properties: {
          norad_id: { type: 'string', description: 'NORAD catalog ID of the satellite' },
        },
        required: ['norad_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_maneuver',
      description:
        'Calculate a collision avoidance maneuver for a conjunction. Estimates delta-V, fuel cost, and post-maneuver collision probability.',
      parameters: {
        type: 'object',
        properties: {
          conjunction_id: { type: 'string', description: 'Conjunction event ID or CDM ID' },
          maneuver_type: {
            type: 'string',
            enum: ['in-track', 'radial', 'cross-track'],
            description: 'Type of maneuver (default: in-track)',
          },
          lead_time_hours: {
            type: 'number',
            description: 'Hours before TCA to execute (default: 24)',
          },
        },
        required: ['conjunction_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_risk_summary',
      description:
        'Get aggregate risk statistics across all tracked conjunctions — counts by risk tier, average collision probability, closest approach.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  pgPassword: string
): Promise<string> {
  const pgClient = new Client({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'orbitwatch',
    user: process.env.PGUSER || process.env.DATABRICKS_CLIENT_ID || 'will.yuponce@databricks.com',
    password: pgPassword,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
  })
  await pgClient.connect()
  try {
    switch (toolName) {
      case 'query_conjunctions': {
        const tier = args.risk_tier as string | undefined
        const limit = (args.limit as number) || 10
        const params: unknown[] = [limit]
        let filter = ''
        if (tier) {
          params.push(tier)
          filter = `WHERE ce.risk_tier = $2`
        }
        params.push(nowIso())
        const upcoming = `ce.tca >= $${params.length}`
        filter = filter ? `${filter} AND ${upcoming}` : `WHERE ${upcoming}`
        const r = await pgClient.query(
          `
          SELECT ce.id, ce.cdm_id, ce.tca, ce.miss_distance_m, ce.raw_pc, ce.ml_pc, ce.risk_tier,
                 ce.maneuver_recommended, ce.cdm_count, ce.first_pc,
                 sa.name as sat_a, sa.norad_id as norad_a,
                 sb.name as sat_b, sb.norad_id as norad_b
          FROM conjunction_events ce
          JOIN satellites sa ON ce.satellite_a_id = sa.id
          JOIN satellites sb ON ce.satellite_b_id = sb.id
          ${filter} ORDER BY ce.ml_pc DESC NULLS LAST LIMIT $1
        `,
          params
        )
        return JSON.stringify(r.rows)
      }
      case 'get_ml_predictions': {
        const limit = (args.limit as number) || 10
        // ML scores are copied into Lakebase by db/reverse_etl.py.
        const r = await pgClient.query(
          `
          SELECT sat_1_name, sat_2_name, tca, miss_distance_m, raw_pc, ml_pc, calibration_ratio,
                 raw_risk_tier, ml_risk_tier, risk_changed
          FROM ml_predictions WHERE tca >= $2 ORDER BY ml_pc DESC NULLS LAST LIMIT $1
        `,
          [limit, nowIso()]
        )
        return JSON.stringify(r.rows)
      }
      case 'get_satellite_info': {
        const noradId = args.norad_id as string
        const r = await pgClient.query(
          `
          SELECT s.name, s.norad_id, s.category, s.operator, s.constellation,
                 oe.altitude_km, oe.velocity_kms, oe.inclination, oe.eccentricity,
                 oe.raan, oe.semi_major_axis, oe.mean_motion, oe.epoch
          FROM satellites s
          LEFT JOIN LATERAL (SELECT * FROM orbital_elements WHERE satellite_id = s.id ORDER BY epoch DESC LIMIT 1) oe ON true
          WHERE s.norad_id = $1
        `,
          [noradId]
        )
        return r.rows.length > 0
          ? JSON.stringify(r.rows[0])
          : JSON.stringify({ error: 'Satellite not found' })
      }
      case 'calculate_maneuver': {
        const conjId = args.conjunction_id as string
        const maneuverType = (args.maneuver_type as string) || 'in-track'
        const leadTimeH = (args.lead_time_hours as number) || 24
        const isSmall = /^\d+$/.test(conjId) && parseInt(conjId) < 100000
        const where = isSmall ? 'ce.id = $1' : 'ce.cdm_id = $1'
        const r = await pgClient.query(
          `
          SELECT ce.*, sa.name as sat_a_name, sb.name as sat_b_name
          FROM conjunction_events ce
          JOIN satellites sa ON ce.satellite_a_id = sa.id
          JOIN satellites sb ON ce.satellite_b_id = sb.id
          WHERE ${where}
        `,
          [conjId]
        )
        if (r.rows.length === 0) return JSON.stringify({ error: 'Conjunction not found' })
        const conj = r.rows[0]
        const missM = num(conj.miss_distance_m) ?? parseFloat(conj.miss_distance_km) * 1000
        const missKm = missM / 1000
        const pc = parseFloat(conj.ml_pc || conj.raw_pc)
        // Simplified Hohmann-ish maneuver calculation
        const targetSeparationKm = Math.max(missKm * 5, 5) // aim for 5x current miss distance or 5 km
        const deltaV = (targetSeparationKm / (leadTimeH * 3600)) * 1000 // m/s rough estimate
        const fuelKg = deltaV * 0.1 // ~100kg sat, Isp~300s simplified
        const postPc = pc * Math.exp(-targetSeparationKm / missKm) // exponential reduction
        return JSON.stringify({
          conjunction: `${conj.sat_a_name} × ${conj.sat_b_name}`,
          current_miss_distance_m: Math.round(missM),
          current_miss_distance_km: missKm,
          current_pc: pc,
          maneuver_type: maneuverType,
          lead_time_hours: leadTimeH,
          delta_v_ms: parseFloat(deltaV.toFixed(3)),
          estimated_fuel_kg: parseFloat(fuelKg.toFixed(2)),
          post_maneuver_miss_km: parseFloat(targetSeparationKm.toFixed(1)),
          post_maneuver_pc: parseFloat(postPc.toExponential(3)),
          recommendation:
            deltaV < 0.1
              ? 'Low-cost maneuver, recommend execution'
              : deltaV < 1.0
                ? 'Moderate cost, evaluate against risk'
                : 'High delta-V, consider alternative timing',
        })
      }
      case 'get_risk_summary': {
        const r = await pgClient.query(
          `
          SELECT risk_tier, COUNT(*) as count,
                 AVG(ml_pc) as avg_pc, MIN(miss_distance_m) as min_miss_m,
                 COUNT(*) FILTER (WHERE maneuver_recommended) as maneuver_count
          FROM conjunction_events WHERE status = 'active' AND tca >= $1
          GROUP BY risk_tier ORDER BY CASE risk_tier WHEN 'red' THEN 1 WHEN 'amber' THEN 2 ELSE 3 END
        `,
          [nowIso()]
        )
        const total = r.rows.reduce((s: number, r: { count: string }) => s + parseInt(r.count), 0)
        return JSON.stringify({ tiers: r.rows, total_active: total })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } finally {
    await pgClient.end().catch(() => {})
  }
}

// Claude 5.x replies can carry content as a list of parts instead of a string.
function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(p =>
        p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : ''
      )
      .join('')
  }
  return ''
}

// POST /api/chat — Agentic AI chat with tool calling
app.post('/api/chat', async (req, res) => {
  if (isLocalMode) {
    return res.json({
      role: 'assistant',
      content:
        'AI chat requires a Databricks connection. Running in local demo mode with pre-seeded SQLite data. All other endpoints (conjunctions, satellites, anomalies, tracking, etc.) are fully functional.',
    })
  }
  try {
    const { messages } = req.body as { messages: Array<{ role: string; content: string }> }
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' })
    }

    const host = process.env.DATABRICKS_HOST || ''
    const baseUrl = host.startsWith('http') ? host : `https://${host}`
    const token = await getM2MToken()
    const pgPassword = await getPgPassword(req)

    const systemPrompt = `You are OrbitWatch AI, an expert satellite conjunction analyst powered by Databricks. You have access to real Space-Track CDM data, XGBoost ML predictions, and orbital mechanics tools.

Your capabilities:
- Query active conjunction events with collision probabilities and risk tiers
- Access ML model predictions that recalibrate raw Pc values using XGBoost
- Look up satellite orbital parameters (altitude, velocity, inclination, etc.)
- Calculate collision avoidance maneuvers (delta-V, fuel cost, timing)
- Provide aggregate risk summaries across the constellation

Be concise and data-driven. Use tools to back up your analysis with real data. When discussing collision probability, express Pc as "1:X" ratios (e.g., 1:4,000) and say whether it is the Space-Track (18 SDS) value or the ML estimate. Miss distances are in meters (miss_distance_m). Tools return only upcoming events; an event whose TCA has passed is no longer actionable. Flag any red-tier conjunctions prominently. If a maneuver is recommended, explain the trade-offs. A human operator makes every maneuver decision: recommend, never claim to execute.

Current time: ${new Date().toISOString()}`

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]

    // Agentic loop: iterate until no more tool calls
    const currentMessages = fullMessages
    let iterations = 0
    const MAX_ITERATIONS = 5

    while (iterations < MAX_ITERATIONS) {
      iterations++
      // Claude 5.x endpoints reject `temperature`, so it is not sent.
      const chatResp = await fetch(`${baseUrl}/serving-endpoints/${chatModel()}/invocations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          tools: AI_TOOLS,
          max_tokens: 2048,
        }),
      })

      if (!chatResp.ok) {
        const errText = await chatResp.text()
        console.error('[chat] LLM error:', chatResp.status, errText)
        return res.status(502).json({ error: 'AI service unavailable', detail: errText })
      }

      const chatData = (await chatResp.json()) as {
        choices: Array<{
          message: {
            role: string
            content: string | null
            tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
          }
          finish_reason: string
        }>
      }

      const choice = chatData.choices?.[0]
      if (!choice) return res.status(502).json({ error: 'Empty AI response' })

      const assistantMsg = choice.message
      currentMessages.push(assistantMsg as (typeof currentMessages)[0])

      // If no tool calls, we're done
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        return res.json({ role: 'assistant', content: contentText(assistantMsg.content).trim() })
      }

      // Execute tool calls and add results
      for (const tc of assistantMsg.tool_calls) {
        const fnName =
          typeof tc.function === 'object'
            ? tc.function.name
            : (tc as unknown as Record<string, { name: string }>).function?.name
        const fnArgs = typeof tc.function === 'object' ? tc.function.arguments : '{}'
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(typeof fnArgs === 'string' ? fnArgs : JSON.stringify(fnArgs))
        } catch {
          /* empty */
        }

        console.log(`[chat] Tool call: ${fnName}(${JSON.stringify(args)})`)
        let result: string
        try {
          result = await executeToolCall(fnName, args, pgPassword)
        } catch (err) {
          result = JSON.stringify({ error: String(err) })
        }

        currentMessages.push({
          role: 'tool',
          content: result,
          // @ts-expect-error tool_call_id needed for OpenAI-compat
          tool_call_id: tc.id,
        })
      }
    }

    // If we hit max iterations, return last assistant message
    const lastAssistant = currentMessages.filter(m => m.role === 'assistant').pop()
    res.json({
      role: 'assistant',
      content: contentText(lastAssistant?.content).trim() || 'Analysis complete.',
    })
  } catch (err) {
    console.error('[chat] Error:', err)
    res.status(500).json({ error: 'Chat failed', detail: String(err) })
  }
})

// GET /api/alerts — red/amber tier active conjunctions for alert FAB
app.get('/api/alerts', async (req, res) => {
  try {
    const result = await query(
      req,
      `
      SELECT ce.id, ce.cdm_id, ce.tca, ce.miss_distance_km, ce.miss_distance_m, ce.raw_pc, ce.ml_pc,
             ce.risk_tier, sa.name as sat_a_name, sb.name as sat_b_name
      FROM conjunction_events ce
      JOIN satellites sa ON ce.satellite_a_id = sa.id
      JOIN satellites sb ON ce.satellite_b_id = sb.id
      WHERE ce.risk_tier IN ('red', 'amber') AND ce.status = 'active' AND ce.tca >= $1
      ORDER BY CASE ce.risk_tier WHEN 'red' THEN 0 ELSE 1 END, ce.ml_pc DESC
      LIMIT 20
    `,
      [nowIso()]
    )
    res.json(
      result.rows.map(r => {
        const missM = num(r.miss_distance_m)
        return {
          id: String(r.id),
          cdmId: r.cdm_id,
          tca: r.tca,
          missDistanceKm: missM !== null ? missM / 1000 : num(r.miss_distance_km),
          missDistanceM: missM,
          rawPc: num(r.raw_pc),
          mlPc: num(r.ml_pc),
          riskTier: r.risk_tier,
          satA: r.sat_a_name,
          satB: r.sat_b_name,
        }
      })
    )
  } catch (err) {
    console.error('GET /api/alerts error:', err)
    res.json([])
  }
})

// ─── ML Model Insights ────────────────────────────────────────────────────────

// GET /api/ml/predictions — XGBoost inference results from Delta
app.get('/api/ml/predictions', async (req, res) => {
  if (isLocalMode) {
    // Return mock ML predictions from local conjunction data
    try {
      const rows = localDb!
        .prepare(
          `
        SELECT ce.cdm_id, sa.name as sat_1_name, sa.norad_id as sat_1_norad_id,
               sb.name as sat_2_name, sb.norad_id as sat_2_norad_id,
               ce.raw_pc, ce.ml_pc, ce.miss_distance_km, ce.risk_tier as ml_risk_tier, ce.risk_tier as raw_risk_tier,
               CASE WHEN ce.raw_pc != ce.ml_pc THEN 1 ELSE 0 END as risk_changed
        FROM conjunction_events ce
        JOIN satellites sa ON ce.satellite_a_id = sa.id
        JOIN satellites sb ON ce.satellite_b_id = sb.id
        WHERE ce.status = 'active'
        ORDER BY ce.ml_pc DESC LIMIT 50
      `
        )
        .all() as Record<string, unknown>[]
      const predictions = rows.map(r => ({
        ...r,
        calibration_ratio: r.raw_pc && r.ml_pc ? Number(r.ml_pc) / Number(r.raw_pc) : 1.0,
      }))
      return res.json(predictions)
    } catch (err) {
      console.error('GET /api/ml/predictions local error:', err)
      return res.json([])
    }
  }
  try {
    const { norad_ids, limit = 50 } = req.query
    const noradList = typeof norad_ids === 'string' ? norad_ids.split(',').filter(Boolean) : []
    const params: unknown[] = [limit]
    let filter = ''
    if (noradList.length > 0) {
      const ph = noradList.map((_, i) => `$${i + 2}`).join(',')
      params.push(...noradList)
      filter = `WHERE (sat_1_norad_id IN (${ph}) OR sat_2_norad_id IN (${ph}))`
    }
    // Lakebase copy of orbitwatch_ml.conjunction_predictions (db/reverse_etl.py),
    // so the app needs no warehouse and no Unity Catalog grants.
    const r = await query(
      req,
      `SELECT * FROM ml_predictions ${filter} ORDER BY ml_pc DESC NULLS LAST LIMIT $1`,
      params
    )
    res.json(r.rows)
  } catch (err) {
    console.error('GET /api/ml/predictions error:', err)
    res.json([]) // not loaded yet: the UI shows its empty state
  }
})

// GET /api/ml/summary — model performance summary
app.get('/api/ml/summary', async (req, res) => {
  if (isLocalMode) {
    return res.json({
      model_name: 'xgboost_conjunction_v3',
      model_version: '1.2.0',
      trained_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      training_samples: 48250,
      features: 12,
      accuracy: 0.943,
      precision_score: 0.912,
      recall: 0.887,
      f1_score: 0.899,
      auc_roc: 0.961,
      log_loss: 0.142,
      note: 'Local demo mode -- mock model summary',
    })
  }
  try {
    const r = await query(req, 'SELECT * FROM ml_model_summary ORDER BY trained_at DESC LIMIT 1')
    res.json(r.rows[0] || null)
  } catch (err) {
    console.error('GET /api/ml/summary error:', err)
    res.json(null)
  }
})

// In-memory TLE cache (1 hour TTL)
let tleCache: { data: unknown[]; ts: number } | null = null
const TLE_CACHE_TTL = 60 * 60 * 1000 // 1 hour

app.get('/api/satellites/tle', async (req, res) => {
  try {
    // Return cached if fresh
    if (tleCache && Date.now() - tleCache.ts < TLE_CACHE_TTL) {
      return res.json(tleCache.data)
    }

    // Read TLEs directly from Lakebase (stored from Space-Track GP data)
    const result = await query(
      req,
      'SELECT norad_id, name, tle_line1, tle_line2 FROM satellites WHERE tle_line1 IS NOT NULL AND tle_line2 IS NOT NULL ORDER BY id'
    )
    type TleRow = { norad_id: string; name: string; tle_line1: string; tle_line2: string }
    const valid = (result.rows as TleRow[]).map(r => ({
      noradId: r.norad_id,
      name: r.name,
      tleName: r.name,
      line1: r.tle_line1,
      line2: r.tle_line2,
    }))

    tleCache = { data: valid, ts: Date.now() }
    res.json(valid)
  } catch (err) {
    console.error('GET /api/satellites/tle error:', err)
    res.status(500).json({ error: 'Failed to fetch TLEs' })
  }
})

app.get('/api/timeline', async (req, res) => {
  try {
    const [conjResult, anomResult] = await Promise.all([
      query(
        req,
        `
        SELECT
          'conjunction' as event_type,
          ce.id,
          ce.cdm_id,
          ce.tca as event_time,
          ce.miss_distance_km,
          ce.miss_distance_m,
          ce.ml_pc,
          ce.risk_tier,
          ce.status,
          sa.name as sat_a_name,
          sb.name as sat_b_name,
          ce.created_at
        FROM conjunction_events ce
        JOIN satellites sa ON ce.satellite_a_id = sa.id
        JOIN satellites sb ON ce.satellite_b_id = sb.id
        ORDER BY ce.tca DESC
        LIMIT 20
      `
      ),
      query(
        req,
        `
        SELECT
          'anomaly' as event_type,
          ae.id,
          NULL as cdm_id,
          ae.detected_at as event_time,
          NULL as miss_distance_km,
          ae.anomaly_score as ml_pc,
          ae.severity as risk_tier,
          ae.status,
          ae.satellite_name as sat_a_name,
          NULL as sat_b_name,
          ae.anomaly_type,
          ae.parameter_name,
          ae.deviation_sigma,
          ae.description,
          ae.created_at
        FROM anomaly_events ae
        ORDER BY ae.detected_at DESC
        LIMIT 20
      `
      ),
    ])

    const events = [
      ...conjResult.rows.map(r => ({
        type: 'conjunction',
        id: String(r.id),
        cdmId: r.cdm_id,
        eventTime: r.event_time,
        label: `${r.sat_a_name} × ${r.sat_b_name}`,
        sublabel: missLabel(
          num(r.miss_distance_m) ?? (num(r.miss_distance_km) ?? 0) * 1000,
          num(r.ml_pc)
        ),
        severity: r.risk_tier,
        status: new Date(r.event_time).getTime() < Date.now() ? 'passed' : r.status,
      })),
      ...anomResult.rows.map(r => ({
        type: 'anomaly',
        id: String(r.id),
        eventTime: r.event_time,
        label: r.sat_a_name,
        sublabel: `${r.anomaly_type?.replace(/-/g, ' ')} · ${Number(r.deviation_sigma || 0).toFixed(1)}σ deviation`,
        severity: r.risk_tier,
        status: r.status,
        description: r.description,
      })),
    ].sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())

    res.json(events)
  } catch (err) {
    console.error('GET /api/timeline error:', err)
    res.status(500).json({ error: 'Failed to fetch timeline' })
  }
})

// Serve React app in production
// Unknown API routes get a JSON 404 instead of the SPA's index.html.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')))
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'))
  })
}

localDbReady.then(() => {
  app.listen(PORT, () => {
    console.log(`OrbitWatch server running on port ${PORT}`)
  })
})

export default app
