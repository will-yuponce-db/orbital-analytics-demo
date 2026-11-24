/**
 * Display formatting shared across the app. All times are shown in UTC, the
 * convention for conjunction assessment.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Number from a number or numeric string; null for null, empty, or NaN. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function formatInt(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? 'n/a' : Math.round(n).toLocaleString('en-US')
}

/** "66 m" under 1 km, "1.2 km" above (no decimals from 100 km). */
export function formatMissDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'n/a'
  if (meters < 1000) return `${Math.round(meters).toLocaleString('en-US')} m`
  const km = meters / 1000
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-US')} km`
}

/** Mantissa and exponent for scientific display of a probability. */
export function pcParts(
  pc: number | null | undefined
): { mantissa: string; exponent: number } | null {
  if (pc == null || !Number.isFinite(pc) || pc <= 0) return null
  let exponent = Math.floor(Math.log10(pc))
  let mantissa = Number((pc / 10 ** exponent).toFixed(1))
  if (mantissa >= 10) {
    mantissa = 1
    exponent += 1
  }
  return { mantissa: mantissa.toFixed(1), exponent }
}

/** Plain-text Pc such as "6.7×10⁻⁴" (tooltips, aria labels, chat prompts). */
export function formatPc(pc: number | null | undefined): string {
  if (pc == null || !Number.isFinite(pc)) return 'n/a'
  if (pc <= 0) return '0'
  const parts = pcParts(pc)
  if (!parts) return 'n/a'
  const exp = String(parts.exponent)
    .split('')
    .map(c => SUPERSCRIPT[c] ?? c)
    .join('')
  return `${parts.mantissa}×10${exp}`
}

/** ASCII scientific notation such as "6.70e-4", for prompts and exports. */
export function formatPcPlain(pc: number | null | undefined): string {
  if (pc == null || !Number.isFinite(pc)) return 'n/a'
  return pc === 0 ? '0' : pc.toExponential(2)
}

/** "1 in 1,500" style odds for a probability. */
export function formatPcOdds(pc: number | null | undefined): string {
  if (pc == null || !Number.isFinite(pc) || pc <= 0) return 'n/a'
  const n = 1 / pc
  const rounded = n >= 1000 ? Math.round(n / 10) * 10 : Math.round(n)
  return `1 in ${rounded.toLocaleString('en-US')}`
}

/** Compact duration: "2d 4h", "4h 39m", "39m 12s" (seconds only under an hour). */
export function formatDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad2(m)}m`
  if (opts.seconds) return m > 0 ? `${m}m ${pad2(s)}s` : `${s}s`
  return m > 0 ? `${m}m` : '<1m'
}

/** "TCA in 4h 39m" or "TCA 3h 12m ago". */
export function formatTcaCountdown(tcaMs: number, nowMs: number): string {
  const diff = tcaMs - nowMs
  return diff >= 0
    ? `TCA in ${formatDuration(diff, { seconds: true })}`
    : `TCA ${formatDuration(diff)} ago`
}

/** Clock-style countdown: "04:39:12", or "1d 04:39:12" beyond a day. */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(totalSec / 86400)
  const hms = `${pad2(Math.floor((totalSec % 86400) / 3600))}:${pad2(Math.floor((totalSec % 3600) / 60))}:${pad2(totalSec % 60)}`
  return d > 0 ? `${d}d ${hms}` : hms
}

/** Elapsed time, compact: "35m", "2h", "3d". */
export function formatAgeCompact(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** Elapsed time, prose: "just now", "12 min ago", "5 h ago", "3 d ago". */
export function formatAge(ms: number): string {
  if (ms < 60000) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

/** "24 Nov 16:48 UTC"; options add seconds or the year. */
export function formatUtc(
  value: string | number | Date | null | undefined,
  opts: { seconds?: boolean; year?: boolean } = {}
): string {
  if (value === null || value === undefined || value === '') return 'n/a'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return 'n/a'
  const date = `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}${opts.year ? ` ${d.getUTCFullYear()}` : ''}`
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}${opts.seconds ? `:${pad2(d.getUTCSeconds())}` : ''}`
  return `${date} ${time} UTC`
}

/** "databricks-claude-sonnet-4-5" becomes "Claude Sonnet 4.5". */
export function prettyModelName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const tokens = raw
    .replace(/^databricks-/i, '')
    .split(/[-_]/)
    .filter(Boolean)
  const out: string[] = []
  for (const t of tokens) {
    const prev = out[out.length - 1]
    if (/^\d+$/.test(t) && prev && /^\d+(\.\d+)*$/.test(prev)) out[out.length - 1] = `${prev}.${t}`
    else out.push(/^\d/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1))
  }
  return out.join(' ')
}

/** Human label for a snake_case model feature name. */
export function prettyFeatureName(name: string): string {
  return name
    .replace(/_enc$/, '')
    .replace(/_kms$/, ' (km/s)')
    .replace(/_km$/, ' (km)')
    .replace(/^sat_1_/, 'object 1 ')
    .replace(/^sat_2_/, 'object 2 ')
    .replace(/_/g, ' ')
    .replace(/\brcs\b/g, 'RCS')
    .trim()
}
