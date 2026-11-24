import type { RiskTier } from './conjunctions'

/** Risk tier palette. Always paired with a text label and an icon in the UI. */
export const TIER_COLOR: Record<RiskTier, string> = {
  red: '#ef5350',
  amber: '#ffa726',
  green: '#66bb6a',
}

export const TIER_LABEL: Record<RiskTier, string> = {
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
}

/** Section names used for the tiers on the scenario library. */
export const TIER_GROUP: Record<RiskTier, string> = {
  red: 'Action required',
  amber: 'Monitoring',
  green: 'Watch list',
}

export const PASSED_COLOR = '#78909c'

export const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff1744',
  high: '#ff6d00',
  medium: '#ffab00',
  low: '#00b0ff',
}

export const asTier = (v: string | null | undefined): RiskTier =>
  v === 'red' || v === 'amber' ? v : 'green'
