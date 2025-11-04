import { OrbitalParameters, ManeuverPlan, ManeuverAnalysis, Satellite } from '../types'

const EARTH_GRAVITATIONAL_PARAMETER = 398600.4418 // km^3/s^2
const EARTH_RADIUS = 6371 // km
const ISP_STANDARD = 300 // seconds (specific impulse)
const G0 = 9.80665 / 1000 // km/s^2

/**
 * Calculate orbital velocity at a given radius
 */
function calculateOrbitalVelocity(radius: number): number {
  return Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER / radius)
}

/**
 * Calculate semi-major axis from altitude
 */
function altitudeToSemiMajorAxis(altitude: number): number {
  return EARTH_RADIUS + altitude
}

/**
 * Calculate altitude from semi-major axis
 */
function semiMajorAxisToAltitude(semiMajorAxis: number): number {
  return semiMajorAxis - EARTH_RADIUS
}

/**
 * Calculate orbit raising maneuver (Hohmann transfer)
 */
export function calculateOrbitRaising(
  currentParams: OrbitalParameters,
  targetAltitude: number
): { deltaV: number; newParams: OrbitalParameters } {
  const r1 = currentParams.semiMajorAxis
  const r2 = altitudeToSemiMajorAxis(targetAltitude)

  // Hohmann transfer delta-v
  const v1 = calculateOrbitalVelocity(r1)
  const vTransfer1 = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER * (2 / r1 - 2 / (r1 + r2)))
  const deltaV1 = vTransfer1 - v1

  const v2 = calculateOrbitalVelocity(r2)
  const vTransfer2 = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER * (2 / r2 - 2 / (r1 + r2)))
  const deltaV2 = v2 - vTransfer2

  const totalDeltaV = Math.abs(deltaV1) + Math.abs(deltaV2)

  const newParams: OrbitalParameters = {
    ...currentParams,
    semiMajorAxis: r2,
    eccentricity: 0.0001, // Assuming near-circular
  }

  return { deltaV: totalDeltaV * 1000, newParams } // Convert to m/s
}

/**
 * Calculate orbit lowering maneuver (reverse Hohmann transfer)
 */
export function calculateOrbitLowering(
  currentParams: OrbitalParameters,
  targetAltitude: number
): { deltaV: number; newParams: OrbitalParameters } {
  const r1 = currentParams.semiMajorAxis
  const r2 = altitudeToSemiMajorAxis(targetAltitude)

  // Similar to raising but in reverse
  const v1 = calculateOrbitalVelocity(r1)
  const vTransfer1 = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER * (2 / r1 - 2 / (r1 + r2)))
  const deltaV1 = vTransfer1 - v1

  const v2 = calculateOrbitalVelocity(r2)
  const vTransfer2 = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER * (2 / r2 - 2 / (r1 + r2)))
  const deltaV2 = v2 - vTransfer2

  const totalDeltaV = Math.abs(deltaV1) + Math.abs(deltaV2)

  const newParams: OrbitalParameters = {
    ...currentParams,
    semiMajorAxis: r2,
    eccentricity: 0.0001,
  }

  return { deltaV: totalDeltaV * 1000, newParams }
}

/**
 * Calculate inclination change maneuver
 */
export function calculateInclinationChange(
  currentParams: OrbitalParameters,
  targetInclination: number
): { deltaV: number; newParams: OrbitalParameters } {
  const velocity = calculateOrbitalVelocity(currentParams.semiMajorAxis)
  const currentIncRad = (currentParams.inclination * Math.PI) / 180
  const targetIncRad = (targetInclination * Math.PI) / 180

  // Delta-v for inclination change
  const deltaV = 2 * velocity * Math.sin(Math.abs(targetIncRad - currentIncRad) / 2)

  const newParams: OrbitalParameters = {
    ...currentParams,
    inclination: targetInclination,
  }

  return { deltaV: deltaV * 1000, newParams }
}

/**
 * Calculate collision avoidance maneuver
 */
export function calculateCollisionAvoidance(
  currentParams: OrbitalParameters,
  safetyDistance: number = 5 // km
): { deltaV: number; newParams: OrbitalParameters } {
  // Simple approach: raise orbit by safety distance
  const currentAltitude = semiMajorAxisToAltitude(currentParams.semiMajorAxis)
  const targetAltitude = currentAltitude + safetyDistance

  const result = calculateOrbitRaising(currentParams, targetAltitude)

  return {
    deltaV: result.deltaV,
    newParams: result.newParams,
  }
}

/**
 * Calculate station-keeping maneuver (small corrections)
 */
export function calculateStationKeeping(
  currentParams: OrbitalParameters,
  targetParams: Partial<OrbitalParameters>
): { deltaV: number; newParams: OrbitalParameters } {
  // Simplified: estimate delta-v based on parameter differences
  let totalDeltaV = 0

  const newParams: OrbitalParameters = { ...currentParams }

  // Altitude correction
  if (targetParams.semiMajorAxis) {
    const deltaA = Math.abs(targetParams.semiMajorAxis - currentParams.semiMajorAxis)
    totalDeltaV += deltaA * 0.5 // Simplified approximation
    newParams.semiMajorAxis = targetParams.semiMajorAxis
  }

  // Inclination correction
  if (targetParams.inclination !== undefined) {
    const velocity = calculateOrbitalVelocity(currentParams.semiMajorAxis)
    const deltaIncRad = Math.abs(
      ((targetParams.inclination - currentParams.inclination) * Math.PI) / 180
    )
    totalDeltaV += velocity * deltaIncRad
    newParams.inclination = targetParams.inclination
  }

  // RAAN correction
  if (targetParams.raan !== undefined) {
    newParams.raan = targetParams.raan
  }

  // Other parameters
  if (targetParams.argOfPerigee !== undefined) {
    newParams.argOfPerigee = targetParams.argOfPerigee
  }
  if (targetParams.eccentricity !== undefined) {
    newParams.eccentricity = targetParams.eccentricity
  }
  if (targetParams.trueAnomaly !== undefined) {
    newParams.trueAnomaly = targetParams.trueAnomaly
  }

  return { deltaV: totalDeltaV * 1000, newParams }
}

/**
 * Apply a maneuver to orbital parameters
 */
export function applyManeuver(
  orbitalParams: OrbitalParameters,
  deltaVMagnitude: number // m/s
): OrbitalParameters {
  // This is a simplified application
  // In reality, the direction and timing of delta-v matters
  const newParams = { ...orbitalParams }

  // Convert m/s to km/s
  const deltaVKmS = deltaVMagnitude / 1000

  // Adjust orbital energy
  const currentVelocity = calculateOrbitalVelocity(orbitalParams.semiMajorAxis)
  const newVelocity = currentVelocity + deltaVKmS

  // Calculate new semi-major axis
  const specificEnergy =
    (newVelocity * newVelocity) / 2 - EARTH_GRAVITATIONAL_PARAMETER / orbitalParams.semiMajorAxis
  const newSemiMajorAxis = -EARTH_GRAVITATIONAL_PARAMETER / (2 * specificEnergy)

  newParams.semiMajorAxis = newSemiMajorAxis

  return newParams
}

/**
 * Estimate fuel cost based on delta-v
 * Using Tsiolkovsky rocket equation
 */
export function estimateFuelCost(deltaVMs: number, satelliteMassKg: number = 500): number {
  // delta-v = v_e * ln(m0/mf)
  // where v_e = ISP * g0
  const exhaustVelocity = ISP_STANDARD * G0 * 1000 // m/s
  const massRatio = Math.exp(deltaVMs / exhaustVelocity)
  const fuelMass = satelliteMassKg * (massRatio - 1)

  return fuelMass
}

/**
 * Calculate collision probability after maneuver
 */
export function calculateCollisionProbability(
  newOrbitalParams: OrbitalParameters,
  otherSatellites: Satellite[]
): number {
  // Simplified proximity-based risk assessment
  let maxRisk = 0

  const newAltitude = semiMajorAxisToAltitude(newOrbitalParams.semiMajorAxis)

  for (const satellite of otherSatellites) {
    const otherAltitude = satellite.altitude
    const altitudeDiff = Math.abs(newAltitude - otherAltitude)

    const inclinationDiff = Math.abs(
      newOrbitalParams.inclination - satellite.orbitalParams.inclination
    )

    // Risk increases as altitude difference decreases and inclination difference decreases
    let risk = 0
    if (altitudeDiff < 50 && inclinationDiff < 10) {
      risk = 100 * Math.exp(-altitudeDiff / 10) * Math.exp(-inclinationDiff / 2)
    }

    maxRisk = Math.max(maxRisk, risk)
  }

  return Math.min(maxRisk, 100)
}

/**
 * Create a complete maneuver analysis
 */
export function analyzeManeuver(
  plan: ManeuverPlan,
  currentParams: OrbitalParameters,
  otherSatellites: Satellite[]
): ManeuverAnalysis {
  let predictedOrbitalParams: OrbitalParameters
  let deltaV: number

  // Calculate based on maneuver type
  switch (plan.type) {
    case 'orbit-raising':
      if (plan.targetParameters?.semiMajorAxis) {
        const targetAlt = semiMajorAxisToAltitude(plan.targetParameters.semiMajorAxis)
        const result = calculateOrbitRaising(currentParams, targetAlt)
        predictedOrbitalParams = result.newParams
        deltaV = result.deltaV
      } else {
        predictedOrbitalParams = currentParams
        deltaV = 0
      }
      break

    case 'orbit-lowering':
      if (plan.targetParameters?.semiMajorAxis) {
        const targetAlt = semiMajorAxisToAltitude(plan.targetParameters.semiMajorAxis)
        const result = calculateOrbitLowering(currentParams, targetAlt)
        predictedOrbitalParams = result.newParams
        deltaV = result.deltaV
      } else {
        predictedOrbitalParams = currentParams
        deltaV = 0
      }
      break

    case 'inclination-change':
      if (plan.targetParameters?.inclination !== undefined) {
        const result = calculateInclinationChange(currentParams, plan.targetParameters.inclination)
        predictedOrbitalParams = result.newParams
        deltaV = result.deltaV
      } else {
        predictedOrbitalParams = currentParams
        deltaV = 0
      }
      break

    case 'collision-avoidance': {
      const result = calculateCollisionAvoidance(currentParams, 5)
      predictedOrbitalParams = result.newParams
      deltaV = result.deltaV
      break
    }

    case 'station-keeping':
      if (plan.targetParameters) {
        const result = calculateStationKeeping(currentParams, plan.targetParameters)
        predictedOrbitalParams = result.newParams
        deltaV = result.deltaV
      } else {
        predictedOrbitalParams = currentParams
        deltaV = 0
      }
      break

    default:
      predictedOrbitalParams = currentParams
      deltaV = 0
  }

  const fuelCostKg = estimateFuelCost(deltaV)
  const collisionProbability = calculateCollisionProbability(
    predictedOrbitalParams,
    otherSatellites
  )
  const newAltitude = semiMajorAxisToAltitude(predictedOrbitalParams.semiMajorAxis)
  const newVelocity = calculateOrbitalVelocity(predictedOrbitalParams.semiMajorAxis)

  return {
    plan,
    predictedOrbitalParams,
    fuelCostKg,
    fuelCostDeltaV: deltaV,
    collisionProbability,
    executionDuration: 300, // 5 minutes typical
    timeToComplete: 1800, // 30 minutes typical
    newAltitude,
    newVelocity,
  }
}
