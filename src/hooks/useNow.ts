import { useSyncExternalStore } from 'react'

/**
 * Shared wall clock for countdowns and "time ago" labels.
 *
 * Returns Date.now() rounded down to `intervalMs` and re-renders the caller on
 * each tick. One timer per interval is shared by every subscriber and aligned
 * to the interval boundary, so all countdowns on a page flip together. Reading
 * the clock through a store keeps Date.now() out of render (react-hooks/purity).
 */
type Ticker = {
  listeners: Set<() => void>
  timeout: number | null
  interval: number | null
}

const tickers = new Map<number, Ticker>()
const subscribers = new Map<number, (listener: () => void) => () => void>()

function stop(t: Ticker) {
  if (t.timeout !== null) window.clearTimeout(t.timeout)
  if (t.interval !== null) window.clearInterval(t.interval)
  t.timeout = null
  t.interval = null
}

function subscribeFor(intervalMs: number) {
  let subscribe = subscribers.get(intervalMs)
  if (subscribe) return subscribe

  subscribe = (listener: () => void) => {
    let t = tickers.get(intervalMs)
    if (!t) {
      t = { listeners: new Set(), timeout: null, interval: null }
      tickers.set(intervalMs, t)
    }
    const ticker = t
    ticker.listeners.add(listener)

    if (ticker.timeout === null && ticker.interval === null) {
      const fire = () => ticker.listeners.forEach(l => l())
      // Align the first tick with the next interval boundary.
      const delay = intervalMs - (Date.now() % intervalMs)
      ticker.timeout = window.setTimeout(() => {
        ticker.timeout = null
        fire()
        ticker.interval = window.setInterval(fire, intervalMs)
      }, delay)
    }

    return () => {
      ticker.listeners.delete(listener)
      if (ticker.listeners.size === 0) stop(ticker)
    }
  }
  subscribers.set(intervalMs, subscribe)
  return subscribe
}

export function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(
    subscribeFor(intervalMs),
    () => Math.floor(Date.now() / intervalMs) * intervalMs
  )
}

export default useNow
