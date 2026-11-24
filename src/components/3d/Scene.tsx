import React, { useMemo } from 'react'
import { OrbitControls, Stars, Line } from '@react-three/drei'
import Earth from './Earth'
import Satellite from './Satellite'
import OrbitalPath from './OrbitalPath'
import { Satellite as SatelliteType, ManeuverAnalysis } from '../../types'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SCENE_SCALE, satrecFor, scenePosition } from '../../utils/satrec'

interface ConjunctionWarning {
  satelliteANoradId: string
  satelliteBNoradId: string
  tca: string
  riskTier: string
  missDistanceKm: number
}

interface SceneProps {
  satellites: SatelliteType[]
  currentTime: Date
  onSatelliteClick?: (satellite: SatelliteType) => void
  controlsRef?: React.RefObject<OrbitControlsImpl>
  maneuverAnalysis?: ManeuverAnalysis | null
  conjunctionWarnings?: ConjunctionWarning[]
}

/** Objects closer than this (km) to a selected object get a proximity line. */
const PROXIMITY_KM = 500

const Scene: React.FC<SceneProps> = ({
  satellites,
  currentTime,
  onSatelliteClick,
  controlsRef,
  maneuverAnalysis,
  conjunctionWarnings = [],
}) => {
  // Warning lines: CDM conjunctions within 24 h of the scene time, plus other
  // objects within PROXIMITY_KM of a selected object. Each object is propagated
  // once per frame.
  const proximityLines = useMemo(() => {
    if (satellites.length < 2) return []
    type Vec = [number, number, number]
    const lines: Array<{ from: Vec; to: Vec; distance: number; riskTier?: string }> = []
    const placed: Array<{ sat: SatelliteType; p: Vec }> = []
    const byNorad = new Map<string, Vec>()
    for (const s of satellites) {
      const p = scenePosition(satrecFor(s.tle), currentTime)
      if (!p) continue
      placed.push({ sat: s, p })
      byNorad.set(s.noradId, p)
    }

    const drawn = new Set<string>()
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
    const ct = currentTime.getTime()
    for (const cw of conjunctionWarnings) {
      if (Math.abs(ct - new Date(cw.tca).getTime()) > 24 * 3600000) continue
      const key = pairKey(cw.satelliteANoradId, cw.satelliteBNoradId)
      if (drawn.has(key)) continue
      const a = byNorad.get(cw.satelliteANoradId)
      const b = byNorad.get(cw.satelliteBNoradId)
      if (!a || !b) continue
      drawn.add(key)
      lines.push({ from: a, to: b, distance: cw.missDistanceKm, riskTier: cw.riskTier })
    }

    const limit = PROXIMITY_KM * SCENE_SCALE
    for (const sel of placed) {
      if (!sel.sat.selected) continue
      for (const other of placed) {
        if (other === sel) continue
        const key = pairKey(sel.sat.noradId, other.sat.noradId)
        if (drawn.has(key)) continue
        const dx = sel.p[0] - other.p[0]
        const dy = sel.p[1] - other.p[1]
        const dz = sel.p[2] - other.p[2]
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < limit) {
          drawn.add(key)
          lines.push({ from: sel.p, to: other.p, distance: d / SCENE_SCALE })
        }
      }
    }
    return lines
  }, [satellites, currentTime, conjunctionWarnings])

  return (
    <>
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

      <ambientLight intensity={0.2} />
      <directionalLight position={[100, 0, 0]} intensity={2} color="#ffffff" />
      <pointLight position={[-30, 20, -30]} intensity={0.3} color="#4a90e2" />

      <Stars radius={300} depth={60} count={5000} factor={7} saturation={0} fade speed={1} />

      <Earth currentTime={currentTime} />

      {/* Orbital Paths (SGP4 when TLE available) */}
      {satellites.map(satellite => (
        <OrbitalPath
          key={`path-${satellite.id}`}
          satellite={satellite}
          visible={satellite.selected}
          currentTime={currentTime}
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
          currentTime={currentTime}
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

      {/* Proximity warning lines between close objects */}
      {proximityLines.map((line, i) => {
        const riskColors: Record<string, string> = {
          red: '#ff1744',
          amber: '#ff6d00',
          green: '#66bb6a',
        }
        const lineColor = line.riskTier
          ? riskColors[line.riskTier] || '#ffab00'
          : line.distance < 100
            ? '#ff1744'
            : line.distance < 200
              ? '#ff6d00'
              : '#ffab00'
        const lineWidth =
          line.riskTier === 'red' ? 3 : line.riskTier ? 2 : line.distance < 100 ? 3 : 2
        return (
          <group key={`prox-${i}`}>
            <Line
              points={[line.from, line.to]}
              color={lineColor}
              lineWidth={lineWidth}
              transparent
              opacity={0.8}
              dashed
              dashSize={0.1}
              gapSize={0.05}
            />
            {/* Distance label at midpoint */}
            <mesh
              position={[
                (line.from[0] + line.to[0]) / 2,
                (line.from[1] + line.to[1]) / 2 + 0.15,
                (line.from[2] + line.to[2]) / 2,
              ]}
            >
              <sphereGeometry args={[0.01, 4, 4]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

export default Scene
