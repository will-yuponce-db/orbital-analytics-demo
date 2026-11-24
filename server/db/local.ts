import Database from 'better-sqlite3'
import path from 'path'

export function createLocalDb(): Database.Database {
  const dbPath = path.join(__dirname, 'local.sqlite')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // ── Create tables ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS satellites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      norad_id TEXT UNIQUE,
      name TEXT,
      category TEXT,
      operator TEXT,
      constellation TEXT,
      rcs_size TEXT,
      tle_line1 TEXT,
      tle_line2 TEXT
    );

    CREATE TABLE IF NOT EXISTS orbital_elements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      satellite_id INTEGER,
      epoch TEXT,
      semi_major_axis REAL,
      eccentricity REAL,
      inclination REAL,
      raan REAL,
      arg_of_perigee REAL,
      mean_anomaly REAL,
      mean_motion REAL,
      bstar REAL,
      altitude_km REAL,
      velocity_kms REAL,
      UNIQUE(satellite_id, epoch)
    );

    CREATE TABLE IF NOT EXISTS conjunction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cdm_id TEXT UNIQUE,
      satellite_a_id INTEGER,
      satellite_b_id INTEGER,
      tca TEXT,
      miss_distance_km REAL,
      raw_pc REAL,
      ml_pc REAL,
      risk_tier TEXT,
      maneuver_recommended INTEGER,
      maneuver_window_open TEXT,
      maneuver_window_close TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      miss_distance_m REAL,
      event_key TEXT,
      cdm_count INTEGER DEFAULT 1,
      first_pc REAL,
      max_pc REAL,
      pc_history TEXT,
      cdm_created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conjunction_id INTEGER,
      type TEXT,
      priority TEXT,
      description TEXT,
      confidence INTEGER,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS maneuver_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conjunction_id INTEGER,
      satellite_id INTEGER,
      delta_v_ms REAL,
      execution_time TEXT,
      fuel_cost_kg REAL,
      post_maneuver_pc REAL,
      maneuver_type TEXT
    );

    CREATE TABLE IF NOT EXISTS tracking_network (
      sensor_id TEXT PRIMARY KEY,
      sensor_name TEXT,
      sensor_type TEXT,
      location TEXT,
      data_quality INTEGER,
      tracking_objects INTEGER,
      status TEXT DEFAULT 'active',
      last_contact TEXT
    );

    CREATE TABLE IF NOT EXISTS anomaly_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      norad_id TEXT,
      satellite_name TEXT,
      anomaly_type TEXT,
      severity TEXT,
      detected_at TEXT,
      parameter_name TEXT,
      expected_value TEXT,
      observed_value TEXT,
      deviation_sigma REAL,
      anomaly_score REAL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT
    );
  `)

  // Databases created before the event-level columns existed: add them.
  const conjCols = new Set(
    (db.prepare('PRAGMA table_info(conjunction_events)').all() as { name: string }[]).map(
      c => c.name
    )
  )
  for (const [col, type] of [
    ['miss_distance_m', 'REAL'],
    ['event_key', 'TEXT'],
    ['cdm_count', 'INTEGER DEFAULT 1'],
    ['first_pc', 'REAL'],
    ['max_pc', 'REAL'],
    ['pc_history', 'TEXT'],
    ['cdm_created_at', 'TEXT'],
  ]) {
    if (!conjCols.has(col)) db.exec(`ALTER TABLE conjunction_events ADD COLUMN ${col} ${type}`)
  }
  db.exec(
    'UPDATE conjunction_events SET miss_distance_m = miss_distance_km * 1000 WHERE miss_distance_m IS NULL'
  )

  // ── Check if already seeded ────────────────────────────────────────────────
  const satCount = (db.prepare('SELECT COUNT(*) as c FROM satellites').get() as { c: number }).c
  if (satCount > 0) {
    console.log(`[local] SQLite already seeded (${satCount} satellites). Skipping seed.`)
    return db
  }

  console.log('[local] Seeding SQLite with demo data...')

  // ── Helper: date offset from now ───────────────────────────────────────────
  const now = Date.now()
  function futureISO(hoursFromNow: number): string {
    return new Date(now + hoursFromNow * 3600000).toISOString()
  }
  function pastISO(hoursAgo: number): string {
    return new Date(now - hoursAgo * 3600000).toISOString()
  }

  // ── Satellites ─────────────────────────────────────────────────────────────
  // Structurally valid TLE lines (epoch 24001 = Jan 1 2024, checksums approximate)
  const satellites: Array<{
    norad_id: string
    name: string
    category: string
    operator: string | null
    constellation: string | null
    rcs_size: string | null
    tle_line1: string
    tle_line2: string
  }> = [
    {
      norad_id: '25544',
      name: 'ISS (ZARYA)',
      category: 'active',
      operator: 'NASA/Roscosmos',
      constellation: null,
      rcs_size: 'LARGE',
      tle_line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9006',
      tle_line2: '2 25544  51.6400 208.9163 0006703  40.5765  33.1788 15.49560532434827',
    },
    {
      norad_id: '55909',
      name: 'STARLINK-5709',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 55909U 23028B   24001.50000000  .00001234  00000-0  12345-4 0  9993',
      tle_line2: '2 55909  53.1600 120.4500 0001200  90.0000 270.0000 15.06390000 10001',
    },
    {
      norad_id: '56131',
      name: 'STARLINK-5814',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 56131U 23035A   24001.50000000  .00001100  00000-0  11000-4 0  9990',
      tle_line2: '2 56131  53.1600 150.2300 0001100  85.0000 275.0000 15.06400000 10005',
    },
    {
      norad_id: '48274',
      name: 'STARLINK-2305',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 48274U 21024K   24001.50000000  .00002100  00000-0  21000-4 0  9997',
      tle_line2: '2 48274  53.0500  60.7800 0001500  95.0000 265.0000 15.06350000 20003',
    },
    {
      norad_id: '44713',
      name: 'STARLINK-1007',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 44713U 19074A   24001.50000000  .00003200  00000-0  32000-4 0  9994',
      tle_line2: '2 44713  53.0500  30.5000 0001800 100.0000 260.0000 15.06320000 30007',
    },
    {
      norad_id: '56780',
      name: 'ONEWEB-0601',
      category: 'active',
      operator: 'OneWeb',
      constellation: 'OneWeb',
      rcs_size: 'MEDIUM',
      tle_line1: '1 56780U 23068A   24001.50000000  .00000100  00000-0  10000-5 0  9991',
      tle_line2: '2 56780  87.9000  45.3200 0001400  70.0000 290.0000 13.15620000  5003',
    },
    {
      norad_id: '56781',
      name: 'ONEWEB-0602',
      category: 'active',
      operator: 'OneWeb',
      constellation: 'OneWeb',
      rcs_size: 'MEDIUM',
      tle_line1: '1 56781U 23068B   24001.50000000  .00000110  00000-0  11000-5 0  9998',
      tle_line2: '2 56781  87.9000  45.3400 0001500  71.0000 289.0000 13.15600000  5009',
    },
    {
      norad_id: '43613',
      name: 'IRIDIUM 172',
      category: 'active',
      operator: 'Iridium',
      constellation: 'Iridium NEXT',
      rcs_size: 'MEDIUM',
      tle_line1: '1 43613U 18071E   24001.50000000  .00000080  00000-0  80000-6 0  9995',
      tle_line2: '2 43613  86.4000 170.0000 0002000  80.0000 280.0000 14.34170000 40002',
    },
    {
      norad_id: '37820',
      name: 'TIANGONG',
      category: 'active',
      operator: 'CNSA',
      constellation: null,
      rcs_size: 'LARGE',
      tle_line1: '1 37820U 11053A   24001.50000000  .00008000  00000-0  80000-4 0  9992',
      tle_line2: '2 37820  42.7700 100.0000 0009000  50.0000 310.0000 15.59100000 50006',
    },
    {
      norad_id: '36508',
      name: 'COSMOS 2251 DEB',
      category: 'debris',
      operator: null,
      constellation: null,
      rcs_size: 'SMALL',
      tle_line1: '1 36508U 93036SX  24001.50000000  .00000500  00000-0  50000-4 0  9996',
      tle_line2: '2 36508  74.0400 200.0000 0050000 120.0000 240.0000 14.35000000 60001',
    },
    {
      norad_id: '34602',
      name: 'COSMOS 2251 DEB',
      category: 'debris',
      operator: null,
      constellation: null,
      rcs_size: 'SMALL',
      tle_line1: '1 34602U 93036RY  24001.50000000  .00000600  00000-0  60000-4 0  9993',
      tle_line2: '2 34602  74.0200 198.0000 0045000 115.0000 245.0000 14.36000000 60005',
    },
    {
      norad_id: '40141',
      name: 'FENGYUN 1C DEB',
      category: 'debris',
      operator: null,
      constellation: null,
      rcs_size: 'SMALL',
      tle_line1: '1 40141U 99025CDT 24001.50000000  .00000400  00000-0  40000-4 0  9990',
      tle_line2: '2 40141  99.0000 250.0000 0040000 130.0000 230.0000 14.40000000 70003',
    },
    {
      norad_id: '33773',
      name: 'FENGYUN 1C DEB',
      category: 'debris',
      operator: null,
      constellation: null,
      rcs_size: 'SMALL',
      tle_line1: '1 33773U 99025AHB 24001.50000000  .00000350  00000-0  35000-4 0  9997',
      tle_line2: '2 33773  99.1000 252.0000 0035000 125.0000 235.0000 14.41000000 70008',
    },
    {
      norad_id: '28874',
      name: 'SL-16 R/B',
      category: 'rocket-body',
      operator: null,
      constellation: null,
      rcs_size: 'LARGE',
      tle_line1: '1 28874U 05049B   24001.50000000  .00000200  00000-0  20000-4 0  9994',
      tle_line2: '2 28874  71.0000 300.0000 0020000 140.0000 220.0000 14.12000000 80002',
    },
    {
      norad_id: '16182',
      name: 'SL-8 R/B',
      category: 'rocket-body',
      operator: null,
      constellation: null,
      rcs_size: 'LARGE',
      tle_line1: '1 16182U 85097B   24001.50000000  .00000150  00000-0  15000-4 0  9991',
      tle_line2: '2 16182  82.5000 320.0000 0015000 150.0000 210.0000 14.20000000 90006',
    },
    {
      norad_id: '58310',
      name: 'STARLINK-6234',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 58310U 23174A   24001.50000000  .00001500  00000-0  15000-4 0  9998',
      tle_line2: '2 58310  43.0000  80.0000 0001000  60.0000 300.0000 15.06500000  2003',
    },
    {
      norad_id: '58311',
      name: 'STARLINK-6235',
      category: 'active',
      operator: 'SpaceX',
      constellation: 'Starlink',
      rcs_size: 'MEDIUM',
      tle_line1: '1 58311U 23174B   24001.50000000  .00001400  00000-0  14000-4 0  9995',
      tle_line2: '2 58311  43.0000  80.1000 0001100  61.0000 299.0000 15.06480000  2007',
    },
    {
      norad_id: '41866',
      name: 'SENTINEL-3A',
      category: 'active',
      operator: 'ESA',
      constellation: null,
      rcs_size: 'MEDIUM',
      tle_line1: '1 41866U 16011A   24001.50000000  .00000050  00000-0  50000-6 0  9992',
      tle_line2: '2 41866  98.6500  10.0000 0001000 200.0000 160.0000 14.26000000 45003',
    },
    {
      norad_id: '43437',
      name: 'SENTINEL-3B',
      category: 'active',
      operator: 'ESA',
      constellation: null,
      rcs_size: 'MEDIUM',
      tle_line1: '1 43437U 18039A   24001.50000000  .00000060  00000-0  60000-6 0  9999',
      tle_line2: '2 43437  98.6500  10.1000 0001100 201.0000 159.0000 14.26100000 35007',
    },
    {
      norad_id: '27424',
      name: 'ENVISAT',
      category: 'debris',
      operator: null,
      constellation: null,
      rcs_size: 'LARGE',
      tle_line1: '1 27424U 02009A   24001.50000000  .00000030  00000-0  30000-6 0  9996',
      tle_line2: '2 27424  98.2800 340.0000 0001200 210.0000 150.0000 14.37000000 95002',
    },
  ]

  const insertSat = db.prepare(`
    INSERT INTO satellites (norad_id, name, category, operator, constellation, rcs_size, tle_line1, tle_line2)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const satIdMap = new Map<string, number>()

  const insertSats = db.transaction(() => {
    for (const s of satellites) {
      const info = insertSat.run(
        s.norad_id,
        s.name,
        s.category,
        s.operator,
        s.constellation,
        s.rcs_size,
        s.tle_line1,
        s.tle_line2
      )
      satIdMap.set(s.norad_id, Number(info.lastInsertRowid))
    }
  })
  insertSats()

  // ── Orbital elements (derived from TLE lines) ─────────────────────────────
  const insertOE = db.prepare(`
    INSERT OR IGNORE INTO orbital_elements
    (satellite_id, epoch, semi_major_axis, eccentricity, inclination, raan, arg_of_perigee, mean_anomaly, mean_motion, bstar, altitude_km, velocity_kms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const orbitalData: Array<{
    norad_id: string
    epoch: string
    sma: number
    ecc: number
    inc: number
    raan: number
    aop: number
    ma: number
    mm: number
    bstar: number
    alt: number
    vel: number
  }> = [
    {
      norad_id: '25544',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6793.0,
      ecc: 0.0006703,
      inc: 51.64,
      raan: 208.92,
      aop: 40.58,
      ma: 33.18,
      mm: 15.4956,
      bstar: 0.0001027,
      alt: 422.0,
      vel: 7.66,
    },
    {
      norad_id: '55909',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.00012,
      inc: 53.16,
      raan: 120.45,
      aop: 90.0,
      ma: 270.0,
      mm: 15.0639,
      bstar: 0.000012345,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '56131',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.00011,
      inc: 53.16,
      raan: 150.23,
      aop: 85.0,
      ma: 275.0,
      mm: 15.064,
      bstar: 0.000011,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '48274',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.00015,
      inc: 53.05,
      raan: 60.78,
      aop: 95.0,
      ma: 265.0,
      mm: 15.0635,
      bstar: 0.000021,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '44713',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.00018,
      inc: 53.05,
      raan: 30.5,
      aop: 100.0,
      ma: 260.0,
      mm: 15.0632,
      bstar: 0.000032,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '56780',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7581.0,
      ecc: 0.00014,
      inc: 87.9,
      raan: 45.32,
      aop: 70.0,
      ma: 290.0,
      mm: 13.1562,
      bstar: 0.000001,
      alt: 1210.0,
      vel: 7.25,
    },
    {
      norad_id: '56781',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7581.0,
      ecc: 0.00015,
      inc: 87.9,
      raan: 45.34,
      aop: 71.0,
      ma: 289.0,
      mm: 13.156,
      bstar: 0.0000011,
      alt: 1210.0,
      vel: 7.25,
    },
    {
      norad_id: '43613',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7155.0,
      ecc: 0.0002,
      inc: 86.4,
      raan: 170.0,
      aop: 80.0,
      ma: 280.0,
      mm: 14.3417,
      bstar: 0.0000008,
      alt: 784.0,
      vel: 7.46,
    },
    {
      norad_id: '37820',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6751.0,
      ecc: 0.0009,
      inc: 42.77,
      raan: 100.0,
      aop: 50.0,
      ma: 310.0,
      mm: 15.591,
      bstar: 0.00008,
      alt: 380.0,
      vel: 7.69,
    },
    {
      norad_id: '36508',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7145.0,
      ecc: 0.005,
      inc: 74.04,
      raan: 200.0,
      aop: 120.0,
      ma: 240.0,
      mm: 14.35,
      bstar: 0.00005,
      alt: 774.0,
      vel: 7.47,
    },
    {
      norad_id: '34602',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7140.0,
      ecc: 0.0045,
      inc: 74.02,
      raan: 198.0,
      aop: 115.0,
      ma: 245.0,
      mm: 14.36,
      bstar: 0.00006,
      alt: 769.0,
      vel: 7.47,
    },
    {
      norad_id: '40141',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7120.0,
      ecc: 0.004,
      inc: 99.0,
      raan: 250.0,
      aop: 130.0,
      ma: 230.0,
      mm: 14.4,
      bstar: 0.00004,
      alt: 749.0,
      vel: 7.48,
    },
    {
      norad_id: '33773',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7115.0,
      ecc: 0.0035,
      inc: 99.1,
      raan: 252.0,
      aop: 125.0,
      ma: 235.0,
      mm: 14.41,
      bstar: 0.000035,
      alt: 744.0,
      vel: 7.49,
    },
    {
      norad_id: '28874',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7230.0,
      ecc: 0.002,
      inc: 71.0,
      raan: 300.0,
      aop: 140.0,
      ma: 220.0,
      mm: 14.12,
      bstar: 0.00002,
      alt: 859.0,
      vel: 7.42,
    },
    {
      norad_id: '16182',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7190.0,
      ecc: 0.0015,
      inc: 82.5,
      raan: 320.0,
      aop: 150.0,
      ma: 210.0,
      mm: 14.2,
      bstar: 0.000015,
      alt: 819.0,
      vel: 7.44,
    },
    {
      norad_id: '58310',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.0001,
      inc: 43.0,
      raan: 80.0,
      aop: 60.0,
      ma: 300.0,
      mm: 15.065,
      bstar: 0.000015,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '58311',
      epoch: '2024-01-01T12:00:00Z',
      sma: 6921.0,
      ecc: 0.00011,
      inc: 43.0,
      raan: 80.1,
      aop: 61.0,
      ma: 299.0,
      mm: 15.0648,
      bstar: 0.000014,
      alt: 550.0,
      vel: 7.59,
    },
    {
      norad_id: '41866',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7178.0,
      ecc: 0.0001,
      inc: 98.65,
      raan: 10.0,
      aop: 200.0,
      ma: 160.0,
      mm: 14.26,
      bstar: 0.0000005,
      alt: 807.0,
      vel: 7.45,
    },
    {
      norad_id: '43437',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7178.0,
      ecc: 0.00011,
      inc: 98.65,
      raan: 10.1,
      aop: 201.0,
      ma: 159.0,
      mm: 14.261,
      bstar: 0.0000006,
      alt: 807.0,
      vel: 7.45,
    },
    {
      norad_id: '27424',
      epoch: '2024-01-01T12:00:00Z',
      sma: 7160.0,
      ecc: 0.00012,
      inc: 98.28,
      raan: 340.0,
      aop: 210.0,
      ma: 150.0,
      mm: 14.37,
      bstar: 0.0000003,
      alt: 789.0,
      vel: 7.46,
    },
  ]

  const insertOEs = db.transaction(() => {
    for (const o of orbitalData) {
      const satId = satIdMap.get(o.norad_id)
      if (!satId) continue
      insertOE.run(
        satId,
        o.epoch,
        o.sma,
        o.ecc,
        o.inc,
        o.raan,
        o.aop,
        o.ma,
        o.mm,
        o.bstar,
        o.alt,
        o.vel
      )
    }
  })
  insertOEs()

  // ── Conjunction events (3 red, 5 amber, 7 green) ──────────────────────────
  const insertConj = db.prepare(`
    INSERT INTO conjunction_events
    (cdm_id, satellite_a_id, satellite_b_id, tca, miss_distance_km, raw_pc, ml_pc, risk_tier,
     maneuver_recommended, maneuver_window_open, maneuver_window_close, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `)

  interface ConjSeed {
    cdm_id: string
    norad_a: string
    norad_b: string
    tca_hours: number
    miss_km: number
    raw_pc: number
    ml_pc: number
    risk_tier: string
    maneuver: boolean
  }

  const conjunctions: ConjSeed[] = [
    // RED tier (3) -- Pc > 1e-3, miss < 1 km
    {
      cdm_id: '1372680001',
      norad_a: '25544',
      norad_b: '36508',
      tca_hours: 18,
      miss_km: 0.12,
      raw_pc: 4.2e-3,
      ml_pc: 5.8e-3,
      risk_tier: 'red',
      maneuver: true,
    },
    {
      cdm_id: '1372680002',
      norad_a: '55909',
      norad_b: '40141',
      tca_hours: 42,
      miss_km: 0.35,
      raw_pc: 2.1e-3,
      ml_pc: 3.4e-3,
      risk_tier: 'red',
      maneuver: true,
    },
    {
      cdm_id: '1372680003',
      norad_a: '56780',
      norad_b: '33773',
      tca_hours: 72,
      miss_km: 0.68,
      raw_pc: 1.5e-3,
      ml_pc: 1.9e-3,
      risk_tier: 'red',
      maneuver: true,
    },
    // AMBER tier (5) -- Pc 1e-4 to 1e-3, miss 1-5 km
    {
      cdm_id: '1372680004',
      norad_a: '48274',
      norad_b: '34602',
      tca_hours: 24,
      miss_km: 1.2,
      raw_pc: 8.5e-4,
      ml_pc: 7.1e-4,
      risk_tier: 'amber',
      maneuver: true,
    },
    {
      cdm_id: '1372680005',
      norad_a: '44713',
      norad_b: '28874',
      tca_hours: 36,
      miss_km: 2.1,
      raw_pc: 4.3e-4,
      ml_pc: 5.0e-4,
      risk_tier: 'amber',
      maneuver: true,
    },
    {
      cdm_id: '1372680006',
      norad_a: '56131',
      norad_b: '16182',
      tca_hours: 60,
      miss_km: 3.4,
      raw_pc: 2.8e-4,
      ml_pc: 3.2e-4,
      risk_tier: 'amber',
      maneuver: true,
    },
    {
      cdm_id: '1372680007',
      norad_a: '37820',
      norad_b: '40141',
      tca_hours: 90,
      miss_km: 1.8,
      raw_pc: 6.0e-4,
      ml_pc: 5.5e-4,
      risk_tier: 'amber',
      maneuver: true,
    },
    {
      cdm_id: '1372680008',
      norad_a: '43613',
      norad_b: '27424',
      tca_hours: 120,
      miss_km: 4.5,
      raw_pc: 1.5e-4,
      ml_pc: 1.8e-4,
      risk_tier: 'amber',
      maneuver: false,
    },
    // GREEN tier (7) -- Pc < 1e-4, miss 5-50 km
    {
      cdm_id: '1372680009',
      norad_a: '58310',
      norad_b: '34602',
      tca_hours: 30,
      miss_km: 8.2,
      raw_pc: 6.5e-5,
      ml_pc: 5.2e-5,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680010',
      norad_a: '58311',
      norad_b: '36508',
      tca_hours: 48,
      miss_km: 12.5,
      raw_pc: 3.1e-5,
      ml_pc: 2.8e-5,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680011',
      norad_a: '41866',
      norad_b: '33773',
      tca_hours: 80,
      miss_km: 18.7,
      raw_pc: 1.5e-5,
      ml_pc: 1.2e-5,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680012',
      norad_a: '43437',
      norad_b: '40141',
      tca_hours: 100,
      miss_km: 25.3,
      raw_pc: 8.0e-6,
      ml_pc: 6.5e-6,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680013',
      norad_a: '56781',
      norad_b: '28874',
      tca_hours: 130,
      miss_km: 32.0,
      raw_pc: 5.0e-6,
      ml_pc: 4.2e-6,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680014',
      norad_a: '25544',
      norad_b: '27424',
      tca_hours: 150,
      miss_km: 45.0,
      raw_pc: 2.0e-6,
      ml_pc: 1.5e-6,
      risk_tier: 'green',
      maneuver: false,
    },
    {
      cdm_id: '1372680015',
      norad_a: '55909',
      norad_b: '16182',
      tca_hours: 168,
      miss_km: 38.0,
      raw_pc: 3.5e-6,
      ml_pc: 2.9e-6,
      risk_tier: 'green',
      maneuver: false,
    },
  ]

  const conjIdMap = new Map<string, number>()
  const insertConjs = db.transaction(() => {
    for (const c of conjunctions) {
      const satAId = satIdMap.get(c.norad_a)
      const satBId = satIdMap.get(c.norad_b)
      if (!satAId || !satBId) continue
      const tca = futureISO(c.tca_hours)
      const mwOpen = new Date(new Date(tca).getTime() - 48 * 3600000).toISOString()
      const mwClose = new Date(new Date(tca).getTime() - 6 * 3600000).toISOString()
      const createdAt = pastISO(24)
      const info = insertConj.run(
        c.cdm_id,
        satAId,
        satBId,
        tca,
        c.miss_km,
        c.raw_pc,
        c.ml_pc,
        c.risk_tier,
        c.maneuver ? 1 : 0,
        mwOpen,
        mwClose,
        createdAt,
        createdAt
      )
      conjIdMap.set(c.cdm_id, Number(info.lastInsertRowid))
    }
  })
  insertConjs()

  // ── AI recommendations ─────────────────────────────────────────────────────
  const insertRec = db.prepare(`
    INSERT INTO ai_recommendations (conjunction_id, type, priority, description, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const satNameMap = new Map<string, string>()
  for (const s of satellites) satNameMap.set(s.norad_id, s.name)

  const insertRecs = db.transaction(() => {
    for (const c of conjunctions) {
      const conjId = conjIdMap.get(c.cdm_id)
      if (!conjId) continue
      const nameA = satNameMap.get(c.norad_a) || c.norad_a
      const nameB = satNameMap.get(c.norad_b) || c.norad_b
      const pcStr = c.ml_pc > 0 ? `1:${Math.round(1 / c.ml_pc).toLocaleString()}` : 'N/A'

      let type: string, priority: string, confidence: number, desc: string
      if (c.risk_tier === 'red') {
        type = 'collision-avoidance'
        priority = 'high'
        confidence = 92
        desc = `HIGH RISK: ${nameA} and ${nameB} conjunction at ${c.miss_km.toFixed(2)} km miss distance. Pc=${pcStr} (18th SDS). Recommend immediate maneuver assessment.`
      } else if (c.risk_tier === 'amber') {
        type = 'conjunction-monitoring'
        priority = 'medium'
        confidence = 78
        desc = `ELEVATED: ${nameA} x ${nameB} close approach. Pc=${pcStr}, miss distance ${c.miss_km.toFixed(1)} km. Increase observation cadence and prepare contingency maneuver.`
      } else {
        type = 'orbital-adjustment'
        priority = 'low'
        confidence = 65
        desc = `MONITOR: ${nameA} near ${nameB}. Pc=${pcStr} at ${c.miss_km.toFixed(1)} km. Standard tracking sufficient.`
      }
      insertRec.run(conjId, type, priority, desc, confidence, pastISO(12))
    }
  })
  insertRecs()

  // ── Tracking network sensors ───────────────────────────────────────────────
  const insertSensor = db.prepare(`
    INSERT OR IGNORE INTO tracking_network
    (sensor_id, sensor_name, sensor_type, location, data_quality, tracking_objects, status, last_contact)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `)

  const sensors: Array<[string, string, string, string, number, number]> = [
    ['leo-radar-ak', 'LEO Radar Network (Alaska)', 'radar', 'Clear AFS, Alaska', 96, 4200],
    ['polar-radar-scan', 'Polar Radar Array (Scandinavia)', 'radar', 'Vardo, Norway', 94, 3800],
    ['optical-hi', 'Optical Network (Hawaii)', 'optical', 'Maui, Hawaii', 92, 2900],
    ['optical-nm', 'Optical Network (New Mexico)', 'optical', 'Socorro, New Mexico', 90, 2600],
    ['space-sensor', 'Space-Based Sensor (LEO, 630 km)', 'space-based', 'LEO Orbit', 98, 8500],
    [
      'southern-radar',
      'Southern Hemisphere Radar (Australia)',
      'radar',
      'Pine Gap, Australia',
      88,
      3100,
    ],
    ['sband-radar', 'S-Band Radar (Alaska)', 'radar', 'Cobra Dane, Alaska', 95, 5200],
    [
      'equatorial-optical',
      'Equatorial Optical Array (Diego Garcia)',
      'optical',
      'Diego Garcia',
      91,
      2400,
    ],
    ['cband-track', 'C-Band Tracking (Kwajalein)', 'radar', 'Kwajalein Atoll', 89, 1800],
  ]

  const insertSensors = db.transaction(() => {
    for (const [sensorId, sName, sType, loc, quality, tracking] of sensors) {
      insertSensor.run(sensorId, sName, sType, loc, quality, tracking, pastISO(0.5))
    }
  })
  insertSensors()

  // ── Anomaly events ─────────────────────────────────────────────────────────
  const insertAnomaly = db.prepare(`
    INSERT INTO anomaly_events
    (norad_id, satellite_name, anomaly_type, severity, detected_at, parameter_name,
     expected_value, observed_value, deviation_sigma, anomaly_score, description, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `)

  const anomalies: Array<{
    norad_id: string
    name: string
    type: string
    severity: string
    hours_ago: number
    param: string
    expected: string
    observed: string
    sigma: number
    score: number
    desc: string
  }> = [
    {
      norad_id: '25544',
      name: 'ISS (ZARYA)',
      type: 'orbit-deviation',
      severity: 'medium',
      hours_ago: 6,
      param: 'altitude_km',
      expected: '422.0',
      observed: '420.1',
      sigma: 2.8,
      score: 0.72,
      desc: 'ISS altitude 1.9 km below predicted. Possible increased atmospheric drag from solar activity.',
    },
    {
      norad_id: '55909',
      name: 'STARLINK-5709',
      type: 'drag-increase',
      severity: 'low',
      hours_ago: 12,
      param: 'bstar',
      expected: '1.23e-5',
      observed: '2.41e-5',
      sigma: 2.1,
      score: 0.58,
      desc: 'BSTAR drag term increase detected. Consistent with elevated solar flux (F10.7 > 180 SFU).',
    },
    {
      norad_id: '36508',
      name: 'COSMOS 2251 DEB',
      type: 'orbit-deviation',
      severity: 'high',
      hours_ago: 3,
      param: 'semi_major_axis',
      expected: '7145.0',
      observed: '7138.2',
      sigma: 4.1,
      score: 0.88,
      desc: 'Debris fragment showing unexpected orbital decay. Semi-major axis reduction of 6.8 km over 48 hours.',
    },
    {
      norad_id: '37820',
      name: 'TIANGONG',
      type: 'attitude-anomaly',
      severity: 'medium',
      hours_ago: 8,
      param: 'raan_rate',
      expected: '0.00',
      observed: '0.15',
      sigma: 3.2,
      score: 0.76,
      desc: 'Unexpected RAAN drift rate change. Possible attitude control thruster firing or torque imbalance.',
    },
    {
      norad_id: '28874',
      name: 'SL-16 R/B',
      type: 'tumble-detected',
      severity: 'high',
      hours_ago: 2,
      param: 'brightness_variation',
      expected: '0.5',
      observed: '3.2',
      sigma: 5.4,
      score: 0.91,
      desc: 'Rocket body exhibiting high brightness variation consistent with tumbling. Potential fragmentation risk.',
    },
    {
      norad_id: '56780',
      name: 'ONEWEB-0601',
      type: 'maneuver-detected',
      severity: 'low',
      hours_ago: 18,
      param: 'velocity_kms',
      expected: '7.250',
      observed: '7.253',
      sigma: 1.8,
      score: 0.45,
      desc: 'Small delta-V detected. Likely routine station-keeping maneuver by OneWeb.',
    },
    {
      norad_id: '27424',
      name: 'ENVISAT',
      type: 'orbit-deviation',
      severity: 'critical',
      hours_ago: 1,
      param: 'eccentricity',
      expected: '0.00012',
      observed: '0.00089',
      sigma: 6.2,
      score: 0.95,
      desc: 'Significant eccentricity increase on defunct ENVISAT. Large cross-section makes this a high-priority debris tracking target.',
    },
  ]

  const insertAnomalies = db.transaction(() => {
    for (const a of anomalies) {
      insertAnomaly.run(
        a.norad_id,
        a.name,
        a.type,
        a.severity,
        pastISO(a.hours_ago),
        a.param,
        a.expected,
        a.observed,
        a.sigma,
        a.score,
        a.desc,
        pastISO(a.hours_ago)
      )
    }
  })
  insertAnomalies()

  console.log('[local] Seed complete:', {
    satellites: satellites.length,
    orbitalElements: orbitalData.length,
    conjunctions: conjunctions.length,
    recommendations: conjunctions.length,
    sensors: sensors.length,
    anomalies: anomalies.length,
  })

  return db
}
