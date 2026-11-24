import React, { useRef, useMemo } from 'react'
import { Mesh } from 'three'
import { Html } from '@react-three/drei'
import { Satellite as SatelliteType } from '../../types'
import { calculateSimpleOrbitPosition } from '../../utils/orbitalCalculations'
import { satrecFor, scenePosition } from '../../utils/satrec'

interface SatelliteProps {
  satellite: SatelliteType
  currentTime: Date
  showLabel?: boolean
  onClick?: (satellite: SatelliteType) => void
}

const SatelliteComponent: React.FC<SatelliteProps> = ({
  satellite: sat,
  currentTime,
  showLabel = true,
  onClick,
}) => {
  const meshRef = useRef<Mesh>(null)

  // SGP4 with the real TLE when available, a simple Keplerian orbit otherwise.
  const position = useMemo(() => {
    const pos = scenePosition(satrecFor(sat.tle), currentTime)
    if (pos) return { x: pos[0], y: pos[1], z: pos[2] }
    const v = calculateSimpleOrbitPosition(sat.orbitalParams, currentTime)
    return { x: v.x, y: v.y, z: v.z }
  }, [sat.orbitalParams, sat.tle, currentTime])

  const color = useMemo(() => {
    switch (sat.category) {
      case 'active':
        return sat.selected ? '#00ff00' : '#4ade80'
      case 'debris':
        return sat.selected ? '#ff4444' : '#ef4444'
      case 'rocket-body':
        return sat.selected ? '#ffaa00' : '#f59e0b'
      default:
        return '#888888'
    }
  }, [sat.category, sat.selected])

  const size = sat.selected ? 0.08 : 0.05

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        ref={meshRef}
        onClick={() => onClick?.(sat)}
        onPointerOver={e => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={e => {
          e.stopPropagation()
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={sat.selected ? 0.5 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {showLabel && sat.selected && (
        <Html distanceFactor={10}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: color,
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              border: `1px solid ${color}`,
            }}
          >
            {sat.name}
          </div>
        </Html>
      )}
    </group>
  )
}

export default SatelliteComponent
