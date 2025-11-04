import React, { useRef, useMemo } from 'react'
import { Mesh } from 'three'
import { Html } from '@react-three/drei'
import { Satellite as SatelliteType } from '../../types'
import { calculateSimpleOrbitPosition } from '../../utils/orbitalCalculations'

interface SatelliteProps {
  satellite: SatelliteType
  currentTime: Date
  showLabel?: boolean
  onClick?: (satellite: SatelliteType) => void
}

const Satellite: React.FC<SatelliteProps> = ({
  satellite,
  currentTime,
  showLabel = true,
  onClick,
}) => {
  const meshRef = useRef<Mesh>(null)

  // Calculate position based on orbital parameters and current time
  const position = useMemo(() => {
    return calculateSimpleOrbitPosition(satellite.orbitalParams, currentTime)
  }, [satellite.orbitalParams, currentTime])

  // Color based on satellite category
  const color = useMemo(() => {
    switch (satellite.category) {
      case 'active':
        return satellite.selected ? '#00ff00' : '#4ade80'
      case 'debris':
        return satellite.selected ? '#ff4444' : '#ef4444'
      case 'rocket-body':
        return satellite.selected ? '#ffaa00' : '#f59e0b'
      default:
        return '#888888'
    }
  }, [satellite.category, satellite.selected])

  // Size based on selection
  const size = satellite.selected ? 0.08 : 0.05

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => onClick?.(satellite)}
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
          emissiveIntensity={satellite.selected ? 0.5 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Label */}
      {showLabel && satellite.selected && (
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
            {satellite.name}
          </div>
        </Html>
      )}
    </group>
  )
}

export default Satellite
