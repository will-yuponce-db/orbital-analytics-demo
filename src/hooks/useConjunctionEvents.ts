import { useSyncExternalStore } from 'react'
import { loadConjunctionEvents, type ConjunctionView } from '../utils/conjunctions'

/**
 * Upcoming and recently passed conjunction events, one entry per physical
 * event. Shared by the Home page and the scenario library so both always show
 * the same counts; refreshed every two minutes while subscribed.
 */
export interface ConjunctionEventsState {
  loading: boolean
  error: string | null
  events: ConjunctionView[] | null
  loadedAt: number | null
}

const POLL_MS = 120_000

let state: ConjunctionEventsState = { loading: true, error: null, events: null, loadedAt: null }
const listeners = new Set<() => void>()
let timer: number | null = null
let inflight: Promise<void> | null = null

function setState(next: Partial<ConjunctionEventsState>) {
  state = { ...state, ...next }
  listeners.forEach(l => l())
}

export function refreshConjunctionEvents(): Promise<void> {
  if (inflight) return inflight
  if (!state.events && !state.loading) setState({ loading: true, error: null })
  inflight = loadConjunctionEvents()
    .then(events => setState({ loading: false, error: null, events, loadedAt: Date.now() }))
    .catch(err =>
      setState({ loading: false, error: err instanceof Error ? err.message : String(err) })
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    void refreshConjunctionEvents()
    timer = window.setInterval(() => void refreshConjunctionEvents(), POLL_MS)
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

export function useConjunctionEvents(): ConjunctionEventsState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export default useConjunctionEvents
