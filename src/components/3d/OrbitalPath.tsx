import React, { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Satellite } from '../../types'
import { calculateOrbitPath } from '../../utils/orbitalCalculations'
import { periodMs, satrecFor, scenePosition } from '../../utils/satrec'

interface OrbitalPathProps {
  satellite: Satellite
  visible?: boolean
  isPredicted?: boolean
  currentTime?: Date
}

const OrbitalPath: React.FC<OrbitalPathProps> = ({
  satellite: s,
  visible = true,
  isPredicted = false,
  currentTime,
}) => {
  const shown = visible && (s.selected || isPredicted)

  // One full orbit centered on the current time: SGP4 when a TLE is available,
  // Keplerian elements otherwise. Skipped entirely for hidden objects.
  const points = useMemo(() => {
    if (!shown) return []
    const rec = satrecFor(s.tle)
    if (rec && currentTime) {
      const period = periodMs(rec)
      const segments = 128
      const pts: Array<{ x: number; y: number; z: number }> = []
      for (let i = 0; i <= segments; i++) {
        const t = new Date(currentTime.getTime() - period / 2 + (i / segments) * period)
        const pos = scenePosition(rec, t)
        if (pos) pts.push({ x: pos[0], y: pos[1], z: pos[2] })
      }
      if (pts.length > 10) return pts
    }
    return calculateOrbitPath(s.orbitalParams, 128).map(v => ({ x: v.x, y: v.y, z: v.z }))
  }, [shown, s.orbitalParams, s.tle, currentTime])

  const color = useMemo(() => {
    if (isPredicted) return '#00d9ff'
    switch (s.category) {
      case 'active':
        return '#4ade80'
      case 'debris':
        return '#ef4444'
      case 'rocket-body':
        return '#f59e0b'
      default:
        return '#888888'
    }
  }, [s.category, isPredicted])

  if (!shown || points.length === 0) return null

  if (isPredicted) {
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={color}
          linewidth={2}
          dashSize={0.5}
          gapSize={0.3}
          transparent
          opacity={0.8}
        />
      </line>
    )
  }

  return (
    <Line
      points={points.map(p => [p.x, p.y, p.z] as [number, number, number])}
      color={color}
      lineWidth={s.selected ? 2 : 1}
      transparent
      opacity={s.selected ? 0.6 : 0.3}
    />
  )
}

export default OrbitalPath
