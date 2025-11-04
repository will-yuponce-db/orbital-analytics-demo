import * as satellite from 'satellite.js'
import { OrbitalParameters } from '../types'
import { Vector3 } from 'three'

const EARTH_RADIUS_KM = 6371
const SCALE_FACTOR = 1 / 1000 // Scale down for visualization (1 unit = 1000 km)

/**
 * Convert Keplerian orbital elements to TLE (Two-Line Element) format
 * Note: This is a simplified conversion. Real TLE generation requires epoch time and additional parameters.
 */
export function keplerianToTLE(
  noradId: string,
  orbitalParams: OrbitalParameters,
  epochYear: number = 25,
  epochDay: number = 307
): { line1: string; line2: string } {
  const { semiMajorAxis, eccentricity, inclination, raan, argOfPerigee, trueAnomaly } =
    orbitalParams

  // Convert true anomaly to mean anomaly (simplified)
  const meanAnomaly = trueAnomaly // Simplified for circular orbits

  // Calculate mean motion (revs per day)
  const mu = 398600.4418 // Earth's gravitational parameter (km^3/s^2)
  const n = Math.sqrt(mu / Math.pow(semiMajorAxis, 3)) // rad/s
  const meanMotion = (n * 86400) / (2 * Math.PI) // revolutions per day

  // Format TLE lines (simplified - not checksummed)
  const line1 = `1 ${noradId.padStart(5, '0')}U 00000A   ${epochYear}${epochDay.toFixed(8).padStart(12, '0')} .00000000  00000-0  00000-0 0    00`
  const line2 = `2 ${noradId.padStart(5, '0')} ${inclination.toFixed(4).padStart(8, ' ')} ${raan.toFixed(4).padStart(8, ' ')} ${(
    eccentricity * 10000000
  )
    .toFixed(0)
    .padStart(
      7,
      '0'
    )} ${argOfPerigee.toFixed(4).padStart(8, ' ')} ${meanAnomaly.toFixed(4).padStart(8, ' ')} ${meanMotion.toFixed(8)}    00`

  return { line1, line2 }
}

/**
 * Calculate satellite position at a given time using SGP4 propagation
 */
export function calculateSatellitePosition(
  orbitalParams: OrbitalParameters,
  noradId: string,
  time: Date
): Vector3 {
  try {
    // Create TLE from orbital parameters
    const { line1, line2 } = keplerianToTLE(noradId, orbitalParams)

    // Initialize satellite record
    const satrec = satellite.twoline2satrec(line1, line2)

    // Propagate position
    const positionAndVelocity = satellite.propagate(satrec, time)

    if (
      positionAndVelocity &&
      positionAndVelocity.position &&
      typeof positionAndVelocity.position !== 'boolean'
    ) {
      const position = positionAndVelocity.position
      // Convert from km to our scaled units
      return new Vector3(
        position.x * SCALE_FACTOR,
        position.z * SCALE_FACTOR, // Swap Y and Z for Three.js coordinate system
        -position.y * SCALE_FACTOR
      )
    }
  } catch (error) {
    console.error('Error calculating satellite position:', error)
  }

  // Fallback: simple circular orbit calculation
  return calculateSimpleOrbitPosition(orbitalParams, time)
}

/**
 * Simplified orbital position calculation (circular orbit approximation)
 * More reliable than TLE conversion for visualization purposes
 */
export function calculateSimpleOrbitPosition(
  orbitalParams: OrbitalParameters,
  time: Date
): Vector3 {
  const { semiMajorAxis, inclination, raan, argOfPerigee, trueAnomaly } = orbitalParams

  // Calculate orbital period
  const mu = 398600.4418 // Earth's gravitational parameter (km^3/s^2)
  const period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu) // seconds

  // Calculate current position in orbit based on time
  const secondsSinceEpoch = time.getTime() / 1000
  const meanAnomaly = ((secondsSinceEpoch % period) / period) * 2 * Math.PI

  // Convert angles to radians
  const incRad = (inclination * Math.PI) / 180
  const raanRad = (raan * Math.PI) / 180
  const argPerigeeRad = (argOfPerigee * Math.PI) / 180
  const trueAnomalyRad = (trueAnomaly * Math.PI) / 180 + meanAnomaly

  // Calculate position in orbital plane
  const radius = semiMajorAxis * SCALE_FACTOR
  const x_orbit = radius * Math.cos(trueAnomalyRad)
  const y_orbit = radius * Math.sin(trueAnomalyRad)

  // Rotate by argument of perigee
  const x_perigee = x_orbit * Math.cos(argPerigeeRad) - y_orbit * Math.sin(argPerigeeRad)
  const y_perigee = x_orbit * Math.sin(argPerigeeRad) + y_orbit * Math.cos(argPerigeeRad)

  // Rotate by inclination
  const x_incl = x_perigee
  const y_incl = y_perigee * Math.cos(incRad)
  const z_incl = y_perigee * Math.sin(incRad)

  // Rotate by RAAN (right ascension of ascending node)
  const x = x_incl * Math.cos(raanRad) - y_incl * Math.sin(raanRad)
  const y = x_incl * Math.sin(raanRad) + y_incl * Math.cos(raanRad)
  const z = z_incl

  return new Vector3(x, z, -y) // Adjust for Three.js coordinate system
}

/**
 * Calculate complete orbital path points
 */
export function calculateOrbitPath(
  orbitalParams: OrbitalParameters,
  segments: number = 128
): Vector3[] {
  const { semiMajorAxis, inclination, raan, argOfPerigee } = orbitalParams

  const points: Vector3[] = []
  const incRad = (inclination * Math.PI) / 180
  const raanRad = (raan * Math.PI) / 180
  const argPerigeeRad = (argOfPerigee * Math.PI) / 180
  const radius = semiMajorAxis * SCALE_FACTOR

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI

    // Position in orbital plane
    const x_orbit = radius * Math.cos(angle)
    const y_orbit = radius * Math.sin(angle)

    // Rotate by argument of perigee
    const x_perigee = x_orbit * Math.cos(argPerigeeRad) - y_orbit * Math.sin(argPerigeeRad)
    const y_perigee = x_orbit * Math.sin(argPerigeeRad) + y_orbit * Math.cos(argPerigeeRad)

    // Rotate by inclination
    const x_incl = x_perigee
    const y_incl = y_perigee * Math.cos(incRad)
    const z_incl = y_perigee * Math.sin(incRad)

    // Rotate by RAAN
    const x = x_incl * Math.cos(raanRad) - y_incl * Math.sin(raanRad)
    const y = x_incl * Math.sin(raanRad) + y_incl * Math.cos(raanRad)
    const z = z_incl

    points.push(new Vector3(x, z, -y))
  }

  return points
}

/**
 * Get Earth radius in scaled units
 */
export function getEarthRadius(): number {
  return EARTH_RADIUS_KM * SCALE_FACTOR
}

/**
 * Get scale factor for converting real distances to visualization units
 */
export function getScaleFactor(): number {
  return SCALE_FACTOR
}

/**
 * Generate time-series data for telemetry metrics
 * Creates mock historical data points over the last 24 hours
 */
export interface TimeSeriesDataPoint {
  timestamp: number // Unix timestamp in milliseconds
  time: string // Formatted time string for display
  altitude: number // km
  velocity: number // km/s
  conjunctionRisk: number // percentage
  orbitalDecay: number // km/day
}

export function generateTimeSeriesData(
  baseAltitude: number = 415.2,
  baseVelocity: number = 7.66,
  baseConjunctionRisk: number = 15,
  baseOrbitalDecay: number = 0.02,
  hoursBack: number = 24,
  intervalMinutes: number = 10
): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = []
  const now = Date.now()
  const numPoints = (hoursBack * 60) / intervalMinutes

  for (let i = numPoints; i >= 0; i--) {
    const timestamp = now - i * intervalMinutes * 60 * 1000
    const date = new Date(timestamp)

    // Create time-based variations with sine waves for realistic trends
    const timeProgress = (numPoints - i) / numPoints
    const hourOfDay = date.getHours() + date.getMinutes() / 60

    // Altitude: slight periodic variation due to orbital mechanics
    const altitudeVariation =
      Math.sin(timeProgress * Math.PI * 4) * 2.5 +
      Math.sin((hourOfDay / 24) * Math.PI * 2) * 1.5 +
      (Math.random() - 0.5) * 0.8
    const altitude = baseAltitude + altitudeVariation

    // Velocity: inversely related to altitude (orbital mechanics)
    const velocityVariation = -altitudeVariation * 0.002 + (Math.random() - 0.5) * 0.01
    const velocity = baseVelocity + velocityVariation

    // Conjunction Risk: decreasing trend over time with some spikes
    const riskTrend = -timeProgress * 8 // Decreasing trend
    const riskSpikes = Math.random() < 0.05 ? Math.random() * 15 : 0 // Occasional spikes
    const riskVariation = Math.sin(timeProgress * Math.PI * 6) * 3 + riskSpikes
    const conjunctionRisk = Math.max(
      0,
      Math.min(100, baseConjunctionRisk + riskTrend + riskVariation)
    )

    // Orbital Decay: gradually increasing with atmospheric drag
    const decayTrend = timeProgress * 0.015 // Slight increase over time
    const decayVariation =
      Math.sin(timeProgress * Math.PI * 3) * 0.008 + (Math.random() - 0.5) * 0.003
    const orbitalDecay = Math.max(0, baseOrbitalDecay + decayTrend + decayVariation)

    // Format time string
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    data.push({
      timestamp,
      time: timeString,
      altitude: Number(altitude.toFixed(2)),
      velocity: Number(velocity.toFixed(3)),
      conjunctionRisk: Number(conjunctionRisk.toFixed(1)),
      orbitalDecay: Number(orbitalDecay.toFixed(4)),
    })
  }

  return data
}
