import React, { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Satellite } from '../../types'
import { calculateOrbitPath } from '../../utils/orbitalCalculations'

interface OrbitalPathProps {
  satellite: Satellite
  visible?: boolean
  isPredicted?: boolean
}

const OrbitalPath: React.FC<OrbitalPathProps> = ({
  satellite,
  visible = true,
  isPredicted = false,
}) => {
  // Calculate orbital path points
  const points = useMemo(() => {
    return calculateOrbitPath(satellite.orbitalParams, 128)
  }, [satellite.orbitalParams])

  // Color based on satellite category or predicted status
  const color = useMemo(() => {
    if (isPredicted) {
      return '#00d9ff' // Cyan for predicted paths
    }
    switch (satellite.category) {
      case 'active':
        return '#4ade80'
      case 'debris':
        return '#ef4444'
      case 'rocket-body':
        return '#f59e0b'
      default:
        return '#888888'
    }
  }, [satellite.category, isPredicted])

  if (!visible || (!satellite.selected && !isPredicted)) {
    return null
  }

  // For predicted paths, render with dashed line
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
      points={points}
      color={color}
      lineWidth={satellite.selected ? 2 : 1}
      transparent
      opacity={satellite.selected ? 0.6 : 0.3}
    />
  )
}

export default OrbitalPath
