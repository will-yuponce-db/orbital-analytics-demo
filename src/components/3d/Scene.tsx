import React from 'react'
import { OrbitControls, Stars } from '@react-three/drei'
import Earth from './Earth'
import Satellite from './Satellite'
import OrbitalPath from './OrbitalPath'
import { Satellite as SatelliteType, ManeuverAnalysis } from '../../types'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface SceneProps {
  satellites: SatelliteType[]
  currentTime: Date
  onSatelliteClick?: (satellite: SatelliteType) => void
  controlsRef?: React.RefObject<OrbitControlsImpl>
  maneuverAnalysis?: ManeuverAnalysis | null
}

const Scene: React.FC<SceneProps> = ({
  satellites,
  currentTime,
  onSatelliteClick,
  controlsRef,
  maneuverAnalysis,
}) => {
  return (
    <>
      {/* Camera Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={100}
        rotateSpeed={0.5}
        zoomSpeed={1.2}
      />

      {/* Lighting */}
      <ambientLight intensity={0.2} />
      {/* Sun - main directional light */}
      <directionalLight position={[100, 0, 0]} intensity={2} color="#ffffff" />
      {/* Subtle fill light */}
      <pointLight position={[-30, 20, -30]} intensity={0.3} color="#4a90e2" />

      {/* Stars Background */}
      <Stars radius={300} depth={60} count={5000} factor={7} saturation={0} fade speed={1} />

      {/* Earth */}
      <Earth currentTime={currentTime} />

      {/* Orbital Paths */}
      {satellites.map(satellite => (
        <OrbitalPath
          key={`path-${satellite.id}`}
          satellite={satellite}
          visible={satellite.selected}
        />
      ))}

      {/* Predicted Orbital Path from Maneuver */}
      {maneuverAnalysis && (
        <OrbitalPath
          key={`predicted-path-${maneuverAnalysis.plan.satelliteId}`}
          satellite={{
            ...satellites.find(s => s.id === maneuverAnalysis.plan.satelliteId)!,
            orbitalParams: maneuverAnalysis.predictedOrbitalParams,
          }}
          visible={true}
          isPredicted={true}
        />
      )}

      {/* Satellites */}
      {satellites.map(satellite => (
        <Satellite
          key={satellite.id}
          satellite={satellite}
          currentTime={currentTime}
          showLabel={true}
          onClick={onSatelliteClick}
        />
      ))}
    </>
  )
}

export default Scene
