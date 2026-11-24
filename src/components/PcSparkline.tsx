import React from 'react'
import { formatPc } from '../utils/format'

interface PcSparklineProps {
  /** Pc per CDM update, oldest first. */
  values: (number | null)[]
  color: string
  width?: number
  height?: number
}

/** Pc across CDM updates on a log scale. Renders nothing with fewer than two points. */
const PcSparkline: React.FC<PcSparklineProps> = ({ values, color, width = 72, height = 22 }) => {
  const pts = values.filter((v): v is number => v != null && v > 0)
  if (pts.length < 2) return null

  const logs = pts.map(v => Math.log10(v))
  let lo = Math.min(...logs)
  let hi = Math.max(...logs)
  if (hi - lo < 0.2) {
    const mid = (hi + lo) / 2
    lo = mid - 0.1
    hi = mid + 0.1
  }
  const padX = 3
  const padY = 3
  const x = (i: number) => padX + (i / (logs.length - 1)) * (width - 2 * padX)
  const y = (l: number) => padY + (1 - (l - lo) / (hi - lo)) * (height - 2 * padY)
  const d = logs
    .map((l, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(l).toFixed(1)}`)
    .join(' ')
  const last = logs.length - 1
  const label = `Pc across ${pts.length} CDM updates, from ${formatPc(pts[0])} to ${formatPc(pts[last])}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <title>{label}</title>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
      {logs.map((l, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(l)}
          r={i === last ? 2.6 : 1.4}
          fill={color}
          opacity={i === last ? 1 : 0.6}
        />
      ))}
    </svg>
  )
}

export default PcSparkline
