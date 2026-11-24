/**
 * Conjunction events as the UI sees them: one entry per physical event.
 *
 * Space-Track issues several CDMs per event as the solution updates, and the
 * public feed carries both the A x B and B x A orderings. The API is moving to
 * one row per event (eventKey, cdmCount, pcHistory); until every row carries
 * those fields, rows are grouped here by object pair and TCA.
 */
import { fetchJson, type OverviewEventRef } from '../services/api'
import { toNumber } from './format'

export type RiskTier = 'red' | 'amber' | 'green'

export interface SatRef {
  id: string
  name: string
  noradId: string
  operator: string | null
}

export interface PcPoint {
  createdAt: string | null
  pc: number | null
  missDistanceM: number | null
}

export interface ConjunctionView {
  id: string
  cdmId: string
  /** Server event key, or a client-side pair + TCA key. */
  eventKey: string
  tca: string
  tcaMs: number
  missDistanceM: number | null
  /** Pc from the CDM (18 SDS). */
  rawPc: number | null
  /** Pc from the OrbitWatch XGBoost model. */
  mlPc: number | null
  riskTier: RiskTier
  maneuverRecommended: boolean
  maneuverWindowOpen: string | null
  maneuverWindowClose: string | null
  status: string
  satelliteA: SatRef
  satelliteB: SatRef
  cdmCount: number
  firstPc: number | null
  /** Oldest first. */
  pcHistory: PcPoint[]
  /** Every CDM id folded into this event (for search and routing). */
  cdmIds: string[]
}

type Raw = Record<string, unknown>

const DAY_MS = 24 * 3600 * 1000
/** CDM updates of one event differ in TCA by seconds; passes of a pair are orbits apart. */
const SAME_EVENT_TCA_MS = 10 * 60 * 1000

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)

function parseSat(row: Raw, key: 'satelliteA' | 'satelliteB', prefix: 'sat_a' | 'sat_b'): SatRef {
  const s = row[key]
  if (isObj(s)) {
    return {
      id: str(s.id),
      name: str(s.name) || 'Unknown object',
      noradId: str(s.noradId ?? s.norad_id),
      operator: strOrNull(s.operator),
    }
  }
  return {
    id: str(row[`${prefix}_id`]),
    name: str(row[`${prefix}_name`]) || 'Unknown object',
    noradId: str(row[`${prefix}_norad`]),
    operator: strOrNull(row[`${prefix}_operator`]),
  }
}

/**
 * Miss distance in meters. Prefers missDistanceM; without it the km field is
 * taken at face value, so the display reads "N km" exactly as the API reports.
 */
export function missDistanceMeters(row: Raw): number | null {
  const m = toNumber(row.missDistanceM ?? row.miss_distance_m)
  if (m != null) return m
  const km = toNumber(row.missDistanceKm ?? row.miss_distance_km)
  return km == null ? null : km * 1000
}

function parseHistory(v: unknown): PcPoint[] {
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
    .filter(isObj)
    .map(p => ({
      createdAt: strOrNull(p.createdAt ?? p.created_at),
      pc: toNumber(p.pc),
      missDistanceM: toNumber(p.missDistanceM ?? p.miss_distance_m),
    }))
    .sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0
      return ta - tb
    })
}

function tierOf(v: unknown): RiskTier {
  const t = str(v).toLowerCase()
  return t === 'red' || t === 'amber' ? t : 'green'
}

interface Normalized extends ConjunctionView {
  serverKey: string | null
}

export function normalizeConjunction(input: unknown): Normalized | null {
  if (!isObj(input)) return null
  const row = input
  const tca = str(row.tca)
  const tcaMs = Date.parse(tca)
  if (!tca || Number.isNaN(tcaMs)) return null
  const cdmId = str(row.cdmId ?? row.cdm_id) || str(row.id)
  const satelliteA = parseSat(row, 'satelliteA', 'sat_a')
  const satelliteB = parseSat(row, 'satelliteB', 'sat_b')
  const serverKey = strOrNull(row.eventKey ?? row.event_key)
  const pair = [satelliteA.noradId, satelliteB.noradId].sort().join('x')
  return {
    id: str(row.id) || cdmId,
    cdmId,
    serverKey,
    eventKey: serverKey ?? `${pair}@${tcaMs}`,
    tca,
    tcaMs,
    missDistanceM: missDistanceMeters(row),
    rawPc: toNumber(row.rawPc ?? row.raw_pc),
    mlPc: toNumber(row.mlPc ?? row.ml_pc),
    riskTier: tierOf(row.riskTier ?? row.risk_tier),
    maneuverRecommended: Boolean(row.maneuverRecommended ?? row.maneuver_recommended),
    maneuverWindowOpen: strOrNull(row.maneuverWindowOpen ?? row.maneuver_window_open),
    maneuverWindowClose: strOrNull(row.maneuverWindowClose ?? row.maneuver_window_close),
    status: str(row.status) || 'active',
    satelliteA,
    satelliteB,
    cdmCount: Math.max(1, toNumber(row.cdmCount ?? row.cdm_count) ?? 1),
    firstPc: toNumber(row.firstPc ?? row.first_pc),
    pcHistory: parseHistory(row.pcHistory ?? row.pc_history),
    cdmIds: [cdmId],
  }
}

const pairKey = (e: ConjunctionView) =>
  [e.satelliteA.noradId, e.satelliteB.noradId].sort().join('x')
const cdmOrder = (e: ConjunctionView) => toNumber(e.cdmId) ?? 0
const contentKey = (pc: number | null, m: number | null, tcaMs: number) =>
  `${pc}|${m}|${Math.round(tcaMs / 1000)}`

function merge(members: Normalized[]): ConjunctionView {
  const sorted = [...members].sort((a, b) => cdmOrder(a) - cdmOrder(b))
  const base: ConjunctionView = sorted[sorted.length - 1]
  if (sorted.length === 1) return base

  // Mirrored A x B / B x A messages carry identical solutions; count them once.
  const seen = new Set<string>()
  const history: PcPoint[] = []
  for (const m of sorted) {
    const k = contentKey(m.rawPc, m.missDistanceM, m.tcaMs)
    if (seen.has(k)) continue
    seen.add(k)
    history.push({ createdAt: null, pc: m.rawPc, missDistanceM: m.missDistanceM })
  }
  const pcHistory = base.pcHistory.length > 1 ? base.pcHistory : history
  return {
    ...base,
    cdmCount: Math.max(base.cdmCount, history.length),
    firstPc: base.firstPc ?? pcHistory[0]?.pc ?? null,
    pcHistory,
    cdmIds: Array.from(new Set(sorted.map(m => m.cdmId))),
  }
}

/** Collapse CDM rows into one entry per physical conjunction event. */
export function groupConjunctions(rows: Normalized[]): ConjunctionView[] {
  const groups = new Map<string, Normalized[]>()
  const unkeyed: Normalized[] = []
  for (const r of rows) {
    if (r.serverKey) {
      const g = groups.get(r.serverKey)
      if (g) g.push(r)
      else groups.set(r.serverKey, [r])
    } else {
      unkeyed.push(r)
    }
  }

  // Cluster rows without a server key by object pair and TCA proximity.
  unkeyed.sort((a, b) => pairKey(a).localeCompare(pairKey(b)) || a.tcaMs - b.tcaMs)
  let current: Normalized[] = []
  let anchor: Normalized | null = null
  const flush = () => {
    if (anchor && current.length) groups.set(`${pairKey(anchor)}@${anchor.tcaMs}`, current)
    current = []
  }
  for (const r of unkeyed) {
    if (!anchor || pairKey(r) !== pairKey(anchor) || r.tcaMs - anchor.tcaMs > SAME_EVENT_TCA_MS) {
      flush()
      anchor = r
    }
    current.push(r)
  }
  flush()

  return Array.from(groups.entries()).map(([key, members]) => {
    const merged = merge(members)
    return members[0].serverKey ? merged : { ...merged, eventKey: key }
  })
}

export function normalizeAndGroup(rows: unknown[]): ConjunctionView[] {
  return groupConjunctions(
    rows.map(normalizeConjunction).filter((r): r is Normalized => r !== null)
  )
}

/**
 * Upcoming events plus events whose TCA passed in the last 24 h. Classification
 * uses TCA against the clock, so it holds whether or not the server has
 * applied the "passed" status yet.
 */
export async function loadConjunctionEvents(): Promise<ConjunctionView[]> {
  const [active, passed] = await Promise.allSettled([
    fetchJson<unknown>('/api/conjunctions?status=active&limit=250'),
    fetchJson<unknown>('/api/conjunctions?status=passed&since_hours=24&limit=250'),
  ])
  if (active.status === 'rejected' && passed.status === 'rejected') throw active.reason
  const rows: unknown[] = []
  const ids = new Set<string>()
  for (const res of [active, passed]) {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue
    for (const r of res.value) {
      const id = isObj(r) ? str(r.id ?? r.cdmId) : ''
      if (id && ids.has(id)) continue
      if (id) ids.add(id)
      rows.push(r)
    }
  }
  return normalizeAndGroup(rows)
}

export const isUpcoming = (e: ConjunctionView, now: number) => e.tcaMs > now
export const isRecentlyPassed = (e: ConjunctionView, now: number) =>
  e.tcaMs <= now && now - e.tcaMs <= DAY_MS
/** Maneuver advice only applies before TCA. */
export const showManeuver = (e: ConjunctionView, now: number) =>
  isUpcoming(e, now) && e.maneuverRecommended

export type ManeuverWindowState =
  | { state: 'pending'; atMs: number }
  | { state: 'open'; untilMs: number }
  | { state: 'closed'; atMs: number }

export function maneuverWindow(e: ConjunctionView, now: number): ManeuverWindowState | null {
  const open = e.maneuverWindowOpen ? Date.parse(e.maneuverWindowOpen) : NaN
  const close = e.maneuverWindowClose ? Date.parse(e.maneuverWindowClose) : NaN
  if (Number.isNaN(open) || Number.isNaN(close)) return null
  if (now < open) return { state: 'pending', atMs: open }
  if (now <= close) return { state: 'open', untilMs: close }
  return { state: 'closed', atMs: close }
}

export interface EventCounts {
  upcoming: number
  red: number
  amber: number
  green: number
  passed24h: number
  maneuverRecommended: number
}

export function countEvents(events: ConjunctionView[], now: number): EventCounts {
  const upcoming = events.filter(e => isUpcoming(e, now))
  return {
    upcoming: upcoming.length,
    red: upcoming.filter(e => e.riskTier === 'red').length,
    amber: upcoming.filter(e => e.riskTier === 'amber').length,
    green: upcoming.filter(e => e.riskTier === 'green').length,
    passed24h: events.filter(e => isRecentlyPassed(e, now)).length,
    maneuverRecommended: upcoming.filter(e => e.maneuverRecommended).length,
  }
}

export interface PcTrend {
  first: number
  latest: number
  ratio: number
  direction: 'up' | 'down' | 'flat'
}

/** First to latest 18 SDS Pc across CDM updates; null with a single CDM. */
export function pcTrend(e: ConjunctionView): PcTrend | null {
  if (e.cdmCount < 2) return null
  const pts = e.pcHistory.map(p => p.pc).filter((p): p is number => p != null && p > 0)
  const first = e.firstPc ?? pts[0] ?? null
  const latest = e.rawPc ?? pts[pts.length - 1] ?? null
  if (first == null || latest == null || first <= 0 || latest <= 0) return null
  const ratio = latest / first
  const direction = Math.abs(Math.log10(ratio)) < 0.05 ? 'flat' : ratio > 1 ? 'up' : 'down'
  return { first, latest, ratio, direction }
}

export const pairLabel = (e: ConjunctionView) => `${e.satelliteA.name} × ${e.satelliteB.name}`

export function matchesSearch(e: ConjunctionView, q: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    e.satelliteA.name.toLowerCase().includes(s) ||
    e.satelliteB.name.toLowerCase().includes(s) ||
    e.satelliteA.noradId.includes(s) ||
    e.satelliteB.noradId.includes(s) ||
    e.cdmIds.some(id => id.toLowerCase().includes(s)) ||
    (e.satelliteA.operator ?? '').toLowerCase().includes(s) ||
    (e.satelliteB.operator ?? '').toLowerCase().includes(s)
  )
}

/** Risk tier thresholds applied by the pipeline to the 18 SDS Pc. */
export const TIER_RULES: Record<RiskTier, string> = {
  red: 'Pc above 1×10⁻³',
  amber: 'Pc 1×10⁻⁴ to 1×10⁻³',
  green: 'Pc below 1×10⁻⁴',
}

/** Compact reference used by overview tiles. */
export function toEventRef(e: ConjunctionView): OverviewEventRef {
  return {
    id: e.cdmId || e.id,
    tca: e.tca,
    satA: e.satelliteA.name,
    satB: e.satelliteB.name,
    riskTier: e.riskTier,
    rawPc: e.rawPc,
    mlPc: e.mlPc,
    missDistanceM: e.missDistanceM,
  }
}

/** Soonest TCA, closest approach and highest 18 SDS Pc among upcoming events. */
export function headlineEvents(events: ConjunctionView[], now: number) {
  const upcoming = events.filter(e => isUpcoming(e, now))
  const best = (
    list: ConjunctionView[],
    better: (a: ConjunctionView, b: ConjunctionView) => boolean
  ) =>
    list.reduce<ConjunctionView | null>(
      (acc, e) => (acc === null || better(e, acc) ? e : acc),
      null
    )
  const next = best(upcoming, (a, b) => a.tcaMs < b.tcaMs)
  const closest = best(
    upcoming.filter(e => e.missDistanceM != null),
    (a, b) => (a.missDistanceM ?? Infinity) < (b.missDistanceM ?? Infinity)
  )
  const highest = best(
    upcoming.filter(e => e.rawPc != null),
    (a, b) => (a.rawPc ?? 0) > (b.rawPc ?? 0)
  )
  return {
    nextTca: next ? toEventRef(next) : null,
    closestApproach: closest ? toEventRef(closest) : null,
    highestPc: highest ? toEventRef(highest) : null,
  }
}
