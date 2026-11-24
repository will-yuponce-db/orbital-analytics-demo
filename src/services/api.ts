/**
 * API client. All paths are relative to /api; in `vite` dev mode the dev
 * server proxies /api to the Express backend (see vite.config.ts).
 */
import { toNumber } from '../utils/format'

const API_BASE_URL = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Fetch JSON, rejecting on HTTP errors and on non-JSON bodies. The production
 * server answers unknown routes with the SPA's index.html (HTTP 200), so a
 * missing endpoint shows up as an HTML body rather than a 404.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${url}`, res.status)
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) throw new ApiError(`No JSON at ${url}`, 404)
  return res.json() as Promise<T>
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  return fetchJson<T>(`${API_BASE_URL}${endpoint}`)
}

async function postAPI<T>(endpoint: string, body: unknown): Promise<T> {
  return fetchJson<T>(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export interface ConjunctionSatellite {
  id: string
  name: string
  noradId: string
  operator: string | null
}

export interface AiRecommendation {
  id: string
  type: string
  priority: number
  description: string
  confidence: number
  timestamp: string
}

export interface PcHistoryPoint {
  createdAt: string | null
  pc: number | null
  missDistanceM: number | null
}

/** One item from GET /api/conjunctions. Newer fields are optional. */
export interface ConjunctionEvent {
  id: string
  cdmId: string
  tca: string
  missDistanceKm: number
  missDistanceM?: number | null
  hoursToTca?: number | null
  eventKey?: string | null
  cdmCount?: number | null
  firstPc?: number | null
  pcHistory?: PcHistoryPoint[] | null
  rawPc?: number
  mlPc: number
  riskTier: string
  maneuverRecommended: boolean
  maneuverWindowOpen?: string
  maneuverWindowClose?: string
  status: string
  satelliteA: ConjunctionSatellite
  satelliteB: ConjunctionSatellite
  aiRecommendations?: AiRecommendation[]
}

export interface Satellite {
  id: string
  noradId: string
  name: string
  operator: string
  constellation: string
  category: string
  altitude: number
  velocity: number
  selected: boolean
  orbitalParams: {
    semiMajorAxis: number
    eccentricity: number
    inclination: number
    raan: number
    argOfPerigee: number
    trueAnomaly: number
  }
}

export interface TrackingStation {
  sensorId: string
  sensorName: string
  sensorType: string
  location: string
  lastContact: string
  dataQuality: number
  trackingObjects: number
  status: string
}

export interface RiskSummaryRow {
  risk_tier: string
  count: number
  avg_pc: number
  min_miss_distance: number
}

export interface PipelineStatus {
  lastUpdated: string | null
  status: string
}

export interface ManeuverPlanInput {
  conjunctionId: string
  satelliteId: string
  deltaVMs: number
  executionTime: string
  fuelCostKg: number
  postManeuverPc: number
  maneuverType?: string
}

// ─── Overview (GET /api/overview) ────────────────────────────────────────────

export interface OverviewEventRef {
  id: string
  tca: string
  satA: string
  satB: string
  riskTier: string | null
  rawPc: number | null
  mlPc: number | null
  missDistanceM: number | null
}

export interface OverviewModel {
  name: string | null
  version: string | null
  trainedAt: string | null
  r2: number | null
  mae: number | null
  nTraining: number | null
  nScored: number | null
}

export interface Overview {
  dataAsOf: string | null
  lastLoadedAt: string | null
  objectsTracked: number | null
  events: {
    upcoming: number
    red: number
    amber: number
    green: number
    passed24h: number
    maneuverRecommended: number
  }
  nextTca: OverviewEventRef | null
  closestApproach: OverviewEventRef | null
  highestPc: OverviewEventRef | null
  anomalies: { total: number; criticalHigh: number } | null
  model: OverviewModel | null
  chatModel: string | null
}

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)
const satName = (v: unknown): string =>
  isObj(v) ? String(v.name ?? 'Unknown object') : String(v ?? 'Unknown object')

function parseEventRef(v: unknown): OverviewEventRef | null {
  if (!isObj(v) || !v.tca) return null
  return {
    id: String(v.id ?? v.cdmId ?? ''),
    tca: String(v.tca),
    satA: satName(v.satA ?? v.satelliteA),
    satB: satName(v.satB ?? v.satelliteB),
    riskTier: strOrNull(v.riskTier),
    rawPc: toNumber(v.rawPc),
    mlPc: toNumber(v.mlPc),
    missDistanceM: toNumber(v.missDistanceM),
  }
}

/** Validate and coerce an /api/overview payload; null if it is not one. */
export function parseOverview(v: unknown): Overview | null {
  if (!isObj(v) || !isObj(v.events)) return null
  const e = v.events
  const n = (x: unknown) => toNumber(x) ?? 0
  const m = isObj(v.model) ? v.model : null
  const a = isObj(v.anomalies) ? v.anomalies : null
  return {
    dataAsOf: strOrNull(v.dataAsOf),
    lastLoadedAt: strOrNull(v.lastLoadedAt),
    objectsTracked: toNumber(v.objectsTracked),
    events: {
      upcoming: n(e.upcoming),
      red: n(e.red),
      amber: n(e.amber),
      green: n(e.green),
      passed24h: n(e.passed24h),
      maneuverRecommended: n(e.maneuverRecommended),
    },
    nextTca: parseEventRef(v.nextTca),
    closestApproach: parseEventRef(v.closestApproach),
    highestPc: parseEventRef(v.highestPc),
    anomalies: a ? { total: n(a.total), criticalHigh: n(a.criticalHigh) } : null,
    model: m
      ? {
          name: strOrNull(m.name),
          version: strOrNull(m.version),
          trainedAt: strOrNull(m.trainedAt),
          r2: toNumber(m.r2),
          mae: toNumber(m.mae),
          nTraining: toNumber(m.nTraining),
          nScored: toNumber(m.nScored),
        }
      : null,
    chatModel: strOrNull(v.chatModel),
  }
}

// ─── ML (GET /api/ml/summary, /api/ml/predictions) ──────────────────────────

/** Model summary row; numeric fields may arrive as strings. */
export type MlSummaryRaw = Record<string, unknown>

export interface MlSummary {
  modelName: string | null
  modelVersion: string | null
  trainedAt: string | null
  r2: number | null
  mae: number | null
  rmse: number | null
  nTraining: number | null
  nTest: number | null
  nFeatures: number | null
  totalScored: number | null
  riskChanges: number | null
  meanCalibrationRatio: number | null
  topFeatures: { name: string; importance: number }[]
}

export function parseMlSummary(v: unknown): MlSummary | null {
  if (!isObj(v)) return null
  const topFeatures: { name: string; importance: number }[] = []
  for (let i = 1; i <= 10; i++) {
    const name = strOrNull(v[`top_feature_${i}`])
    const importance = toNumber(v[`top_feature_${i}_importance`])
    if (name && importance != null) topFeatures.push({ name, importance })
  }
  return {
    modelName: strOrNull(v.model_name),
    modelVersion: strOrNull(v.model_version),
    trainedAt: strOrNull(v.trained_at),
    r2: toNumber(v.r2_log_scale),
    mae: toNumber(v.mae),
    rmse: toNumber(v.rmse),
    nTraining: toNumber(v.n_training_samples ?? v.training_samples),
    nTest: toNumber(v.n_test_samples),
    nFeatures: toNumber(v.n_features ?? v.features),
    totalScored: toNumber(v.total_scored),
    riskChanges: toNumber(v.risk_changes),
    meanCalibrationRatio: toNumber(v.mean_calibration_ratio),
    topFeatures,
  }
}

export interface MlPrediction {
  cdmId: string
  eventKey: string | null
  sat1: string
  sat2: string
  rawPc: number | null
  mlPc: number | null
  ratio: number | null
  rawTier: string | null
  mlTier: string | null
  riskChanged: boolean
  missDistanceKm: number | null
}

export function parseMlPrediction(v: unknown): MlPrediction | null {
  if (!isObj(v)) return null
  const rawPc = toNumber(v.raw_pc)
  const mlPc = toNumber(v.ml_pc)
  const changed = v.risk_changed
  return {
    cdmId: String(v.cdm_id ?? ''),
    eventKey: strOrNull(v.event_key),
    sat1: String(v.sat_1_name ?? 'Unknown object'),
    sat2: String(v.sat_2_name ?? 'Unknown object'),
    rawPc,
    mlPc,
    ratio: toNumber(v.calibration_ratio) ?? (rawPc && mlPc != null ? mlPc / rawPc : null),
    rawTier: strOrNull(v.raw_risk_tier),
    mlTier: strOrNull(v.ml_risk_tier),
    riskChanged: changed === true || changed === 'true' || changed === 1 || changed === '1',
    missDistanceKm: toNumber(v.miss_distance_km),
  }
}

export const api = {
  getConjunctions: (status = 'active', limit = 50) =>
    fetchAPI<ConjunctionEvent[]>(`/conjunctions?status=${status}&limit=${limit}`),
  getConjunction: (id: string) =>
    fetchAPI<ConjunctionEvent>(`/conjunctions/${encodeURIComponent(id)}`),
  getSatellites: () => fetchAPI<Satellite[]>('/satellites'),
  getTrackingNetwork: () => fetchAPI<TrackingStation[]>('/tracking-network'),
  getAnalyticsRiskSummary: () => fetchAPI<RiskSummaryRow[]>('/analytics/risk-summary'),
  getPipelineStatus: () => fetchAPI<PipelineStatus>('/pipeline-status'),
  getOverview: async () => parseOverview(await fetchAPI<unknown>('/overview')),
  getMlSummary: async () => parseMlSummary(await fetchAPI<unknown>('/ml/summary')),
  getMlPredictions: async (limit = 50) => {
    const rows = await fetchAPI<unknown>(`/ml/predictions?limit=${limit}`)
    return (Array.isArray(rows) ? rows : [])
      .map(parseMlPrediction)
      .filter((p): p is MlPrediction => p !== null)
  },
  createManeuverPlan: (data: ManeuverPlanInput) =>
    postAPI<Record<string, unknown>>('/maneuver-plans', data),
}
