/**
 * Utility functions for managing recently viewed scenarios
 */

const RECENTLY_VIEWED_KEY = 'ussf-sda-recently-viewed'
const MAX_RECENT_ITEMS = 5

export interface RecentlyViewedItem {
  scenarioId: string
  scenarioName: string
  timestamp: number
}

/**
 * Get recently viewed scenarios from localStorage
 */
export const getRecentlyViewed = (): RecentlyViewedItem[] => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error('Error reading recently viewed:', error)
    return []
  }
}

/**
 * Add a scenario to recently viewed list
 */
export const addToRecentlyViewed = (scenarioId: string, scenarioName: string): void => {
  try {
    const recent = getRecentlyViewed()

    // Remove existing entry if present
    const filtered = recent.filter(item => item.scenarioId !== scenarioId)

    // Add new entry at the beginning
    const updated: RecentlyViewedItem[] = [
      { scenarioId, scenarioName, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS) // Keep only the most recent items

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving recently viewed:', error)
  }
}

/**
 * Clear recently viewed history
 */
export const clearRecentlyViewed = (): void => {
  try {
    localStorage.removeItem(RECENTLY_VIEWED_KEY)
  } catch (error) {
    console.error('Error clearing recently viewed:', error)
  }
}

/**
 * Get relative time string (e.g., "2 minutes ago")
 */
export const getRelativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}
