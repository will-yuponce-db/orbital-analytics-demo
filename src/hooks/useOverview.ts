import { useSyncExternalStore } from 'react'
import { fetchJson, parseMlSummary, parseOverview, type Overview } from '../services/api'
import { countEvents, headlineEvents, loadConjunctionEvents } from '../utils/conjunctions'

/**
 * Mission overview shared by the header chips and the Home page. One poller
 * runs while anything is subscribed. If GET /api/overview is unavailable, the
 * same figures are derived from the conjunction, ML and anomaly endpoints;
 * source is then 'derived' and the data timestamp is unknown.
 */
export interface OverviewState {
  loading: boolean
  source: 'live' | 'derived' | null
  data: Overview | null
  error: string | null
}

const POLL_MS = 60_000

let state: OverviewState = { loading: true, source: null, data: null, error: null }
const listeners = new Set<() => void>()
let timer: number | null = null
let inflight: Promise<void> | null = null

function setState(next: Partial<OverviewState>) {
  state = { ...state, ...next }
  listeners.forEach(l => l())
}

async function deriveOverview(): Promise<Overview> {
  const [eventsRes, mlRes, anomRes] = await Promise.allSettled([
    loadConjunctionEvents(),
    fetchJson<unknown>('/api/ml/summary'),
    fetchJson<unknown>('/api/anomalies'),
  ])
  if (eventsRes.status === 'rejected') throw eventsRes.reason
  const events = eventsRes.value
  const now = Date.now()
  const ml = mlRes.status === 'fulfilled' ? parseMlSummary(mlRes.value) : null
  const anomalies =
    anomRes.status === 'fulfilled' && Array.isArray(anomRes.value) ? anomRes.value : null
  return {
    dataAsOf: null,
    lastLoadedAt: null,
    objectsTracked: null,
    events: countEvents(events, now),
    ...headlineEvents(events, now),
    anomalies: anomalies
      ? {
          total: anomalies.length,
          criticalHigh: anomalies.filter(a => {
            const sev = (a as { severity?: string })?.severity
            return sev === 'critical' || sev === 'high'
          }).length,
        }
      : null,
    model: ml
      ? {
          name: ml.modelName,
          version: ml.modelVersion,
          trainedAt: ml.trainedAt,
          r2: ml.r2,
          mae: ml.mae,
          nTraining: ml.nTraining,
          nScored: ml.totalScored,
        }
      : null,
    chatModel: null,
  }
}

export function refreshOverview(): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const live = parseOverview(await fetchJson<unknown>('/api/overview'))
      if (!live) throw new Error('Unexpected /api/overview payload')
      setState({ loading: false, source: 'live', data: live, error: null })
    } catch {
      try {
        setState({ loading: false, source: 'derived', data: await deriveOverview(), error: null })
      } catch (err) {
        setState({ loading: false, error: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    void refreshOverview()
    timer = window.setInterval(() => void refreshOverview(), POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => state

/**
 * True when the overview reflects a database that answered. The server
 * returns zeroed counts (HTTP 200) when Lakebase is unreachable, which must
 * not read as "no events".
 */
export function overviewHasData(o: Overview | null | undefined): o is Overview {
  return !!o && (!!o.dataAsOf || (o.objectsTracked ?? 0) > 0)
}

export function useOverview(): OverviewState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export default useOverview
