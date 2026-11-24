import {
  Scenario,
  Satellite,
  ScenarioEvent,
  AIRecommendation,
  TelemetryData,
  ScenarioVariant,
  ManeuverPlan,
  OrbitalParameters,
  SSNDataSource,
  UserProfile,
  ConjunctionEvent,
} from '../types'

const satellites: Satellite[] = [
  {
    id: 'sat-001',
    name: 'ISS (ZARYA)',
    noradId: '25544',
    category: 'active',
    orbitalParams: {
      semiMajorAxis: 6793,
      eccentricity: 0.0001,
      inclination: 51.64,
      raan: 125.4,
      argOfPerigee: 45.2,
      trueAnomaly: 180.0,
    },
    altitude: 415,
    velocity: 7.66,
    selected: true,
  },
  {
    id: 'sat-002',
    name: 'STARLINK-1234',
    noradId: '45678',
    category: 'active',
    orbitalParams: {
      semiMajorAxis: 6921,
      eccentricity: 0.0002,
      inclination: 53.0,
      raan: 234.5,
      argOfPerigee: 67.8,
      trueAnomaly: 90.0,
    },
    altitude: 550,
    velocity: 7.59,
    selected: true,
  },
  {
    id: 'sat-003',
    name: 'COSMOS 2251 DEB',
    noradId: '33456',
    category: 'debris',
    orbitalParams: {
      semiMajorAxis: 7170,
      eccentricity: 0.015,
      inclination: 74.2,
      raan: 87.3,
      argOfPerigee: 234.1,
      trueAnomaly: 45.0,
    },
    altitude: 790,
    velocity: 7.45,
    selected: false,
  },
  {
    id: 'sat-004',
    name: 'FALCON 9 R/B',
    noradId: '47890',
    category: 'rocket-body',
    orbitalParams: {
      semiMajorAxis: 6878,
      eccentricity: 0.0008,
      inclination: 28.5,
      raan: 156.7,
      argOfPerigee: 123.4,
      trueAnomaly: 270.0,
    },
    altitude: 500,
    velocity: 7.61,
    selected: false,
  },
]

const events: ScenarioEvent[] = [
  {
    id: 'event-001',
    timestamp: '2025-11-03T12:00:00Z',
    type: 'conjunction',
    description: 'Close approach detected between STARLINK-1234 and COSMOS debris',
    satelliteIds: ['sat-002', 'sat-003'],
  },
  {
    id: 'event-002',
    timestamp: '2025-11-03T14:30:00Z',
    type: 'maneuver',
    description: 'ISS altitude adjustment maneuver',
    satelliteIds: ['sat-001'],
  },
  {
    id: 'event-003',
    timestamp: '2025-11-03T18:45:00Z',
    type: 'anomaly',
    description: 'Unexpected acceleration detected on STARLINK-1234',
    satelliteIds: ['sat-002'],
  },
]

export const telemetryDataISS: TelemetryData[] = [
  { parameter: 'Altitude', value: '415.2', unit: 'km', status: 'normal' },
  { parameter: 'Velocity', value: '7.66', unit: 'km/s', status: 'normal' },
  { parameter: 'Inclination', value: '51.64', unit: '°', status: 'normal' },
  { parameter: 'Period', value: '92.68', unit: 'min', status: 'normal' },
  { parameter: 'Apogee', value: '421.8', unit: 'km', status: 'normal' },
  { parameter: 'Perigee', value: '408.6', unit: 'km', status: 'normal' },
  { parameter: 'Eccentricity', value: '0.0001', unit: '', status: 'normal' },
  { parameter: 'RAAN', value: '125.4', unit: '°', status: 'normal' },
  { parameter: 'Arg of Perigee', value: '45.2', unit: '°', status: 'normal' },
  { parameter: 'True Anomaly', value: '180.0', unit: '°', status: 'normal' },
  { parameter: 'Solar Panel Voltage', value: '160.5', unit: 'V', status: 'normal' },
  { parameter: 'Battery Charge', value: '98.2', unit: '%', status: 'normal' },
  { parameter: 'Drag Coefficient', value: '2.2', unit: '', status: 'normal' },
]

export const telemetryDataStarlink: TelemetryData[] = [
  { parameter: 'Altitude', value: '548.3', unit: 'km', status: 'warning' },
  { parameter: 'Velocity', value: '7.59', unit: 'km/s', status: 'warning' },
  { parameter: 'Inclination', value: '53.0', unit: '°', status: 'normal' },
  { parameter: 'Period', value: '95.4', unit: 'min', status: 'normal' },
  { parameter: 'Apogee', value: '552.1', unit: 'km', status: 'normal' },
  { parameter: 'Perigee', value: '544.5', unit: 'km', status: 'normal' },
  { parameter: 'Eccentricity', value: '0.0002', unit: '', status: 'normal' },
  { parameter: 'RAAN', value: '234.5', unit: '°', status: 'normal' },
  { parameter: 'Arg of Perigee', value: '67.8', unit: '°', status: 'normal' },
  { parameter: 'True Anomaly', value: '90.0', unit: '°', status: 'normal' },
  { parameter: 'Solar Panel Voltage', value: '142.3', unit: 'V', status: 'warning' },
  { parameter: 'Battery Charge', value: '95.7', unit: '%', status: 'normal' },
  { parameter: 'Drag Coefficient', value: '2.8', unit: '', status: 'critical' },
  { parameter: 'Thruster Pressure', value: '185.2', unit: 'bar', status: 'normal' },
]

// Reserved for future use - exported to satisfy TypeScript
export const telemetryDataDebris: TelemetryData[] = [
  { parameter: 'Altitude', value: '789.5', unit: 'km', status: 'normal' },
  { parameter: 'Velocity', value: '7.45', unit: 'km/s', status: 'normal' },
  { parameter: 'Inclination', value: '74.2', unit: '°', status: 'normal' },
  { parameter: 'Period', value: '100.2', unit: 'min', status: 'normal' },
  { parameter: 'Apogee', value: '795.8', unit: 'km', status: 'normal' },
  { parameter: 'Perigee', value: '783.2', unit: 'km', status: 'normal' },
  { parameter: 'Eccentricity', value: '0.015', unit: '', status: 'normal' },
  { parameter: 'RAAN', value: '87.3', unit: '°', status: 'normal' },
  { parameter: 'Arg of Perigee', value: '234.1', unit: '°', status: 'normal' },
  { parameter: 'True Anomaly', value: '45.0', unit: '°', status: 'normal' },
]

const aiRecommendations: AIRecommendation[] = [
  {
    id: 'rec-001',
    timestamp: '2025-11-03T12:05:00Z',
    type: 'collision-avoidance',
    priority: 'high',
    description:
      'Recommend collision avoidance maneuver for STARLINK-1234. Closest approach distance: 450m at 2025-11-03T12:00:00Z',
    confidence: 87,
    affectedSensors: ['Altitude', 'Velocity', 'Drag Coefficient'],
    relatedEventId: 'event-001',
  },
  {
    id: 'rec-002',
    timestamp: '2025-11-03T14:00:00Z',
    type: 'conjunction-monitoring',
    priority: 'medium',
    description:
      'Continue monitoring ISS conjunction proximity. Expected miss distance within acceptable range.',
    confidence: 92,
    affectedSensors: ['Velocity', 'Altitude', 'Apogee', 'Perigee'],
    relatedEventId: 'event-002',
  },
  {
    id: 'rec-003',
    timestamp: '2025-11-03T19:00:00Z',
    type: 're-entry-watch',
    priority: 'low',
    description:
      'Anomaly on STARLINK-1234 likely due to attitude control adjustment. No action required.',
    confidence: 78,
    affectedSensors: ['Drag Coefficient', 'Solar Panel Voltage'],
    relatedEventId: 'event-003',
  },
]

/**
 * Tracking Network Data Sources
 */
export const ssnDataSources: SSNDataSource[] = [
  {
    sensorId: 'LEO-RADAR-AK',
    sensorName: 'LEO Radar Network (Alaska)',
    sensorType: 'radar',
    location: 'Fairbanks, Alaska',
    lastContact: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    dataQuality: 94,
    trackingObjects: 3842,
  },
  {
    sensorId: 'POLAR-RADAR-NO',
    sensorName: 'Polar Radar Array (Scandinavia)',
    sensorType: 'radar',
    location: 'Tromsø, Norway',
    lastContact: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    dataQuality: 92,
    trackingObjects: 1256,
  },
  {
    sensorId: 'OPT-HAWAII',
    sensorName: 'Optical Network (Hawaii)',
    sensorType: 'optical',
    location: 'Mauna Kea, Hawaii',
    lastContact: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    dataQuality: 91,
    trackingObjects: 678,
  },
  {
    sensorId: 'OPT-NM',
    sensorName: 'Optical Network (New Mexico)',
    sensorType: 'optical',
    location: 'Socorro, New Mexico',
    lastContact: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    dataQuality: 85,
    trackingObjects: 523,
  },
  {
    sensorId: 'SPACE-LEO-1',
    sensorName: 'Space-Based Sensor (LEO)',
    sensorType: 'space-based',
    location: 'LEO Orbit, 630 km',
    lastContact: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    dataQuality: 96,
    trackingObjects: 2145,
  },
  {
    sensorId: 'RADAR-AU',
    sensorName: 'Southern Hemisphere Radar (Australia)',
    sensorType: 'radar',
    location: 'Alice Springs, Australia',
    lastContact: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    dataQuality: 88,
    trackingObjects: 892,
  },
  {
    sensorId: 'SBAND-AK',
    sensorName: 'S-Band Tracking Array (Alaska)',
    sensorType: 'radar',
    location: 'Clear, Alaska',
    lastContact: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    dataQuality: 89,
    trackingObjects: 1456,
  },
  {
    sensorId: 'OPT-IO',
    sensorName: 'Equatorial Optical Array (Indian Ocean)',
    sensorType: 'optical',
    location: 'Diego Garcia',
    lastContact: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    dataQuality: 88,
    trackingObjects: 542,
  },
  {
    sensorId: 'CBAND-PAC',
    sensorName: 'C-Band Tracking (Pacific)',
    sensorType: 'radar',
    location: 'Kwajalein Atoll',
    lastContact: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    dataQuality: 93,
    trackingObjects: 1189,
  },
]

/**
 * User Profiles
 */
export const mockUsers: UserProfile[] = [
  {
    id: 'user-001',
    username: 'john.anderson',
    organization: 'OrbitWatch Operations',
    role: 'operator',
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'user-002',
    username: 'sarah.rivera',
    organization: 'Constellation Analytics',
    role: 'analyst',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'user-003',
    username: 'michael.chen',
    organization: 'Space Insurance Group',
    role: 'analyst',
    lastLogin: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'user-004',
    username: 'emily.martinez',
    organization: 'Launch Dynamics Inc.',
    role: 'engineer',
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
]

/**
 * Conjunction Events
 */
export const conjunctionEvents: ConjunctionEvent[] = [
  {
    id: 'conj-001',
    cdmId: 'CDM-2025-110301',
    satelliteA: { id: 'sat-002', name: 'STARLINK-1234', noradId: '45678', operator: 'SpaceX' },
    satelliteB: { id: 'sat-003', name: 'COSMOS 2251 DEB', noradId: '33456' },
    tca: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
    missDistanceKm: 0.285,
    rawPc: 0.0022,
    mlPc: 0.0024,
    riskTier: 'red',
    maneuverRecommended: true,
    maneuverWindowOpen: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    maneuverWindowClose: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'conj-002',
    cdmId: 'CDM-2025-110302',
    satelliteA: { id: 'ow-082', name: 'ONEWEB-0082', noradId: '47844', operator: 'OneWeb' },
    satelliteB: { id: 'f9rb-01', name: 'FALCON 9 R/B', noradId: '47890' },
    tca: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    missDistanceKm: 0.812,
    rawPc: 0.00041,
    mlPc: 0.00045,
    riskTier: 'amber',
    maneuverRecommended: true,
    maneuverWindowOpen: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    maneuverWindowClose: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'conj-003',
    cdmId: 'CDM-2025-110303',
    satelliteA: { id: 'irid-91', name: 'IRIDIUM-91', noradId: '43478', operator: 'Iridium' },
    satelliteB: { id: 'sl8-deb', name: 'SL-8 DEB', noradId: '18421' },
    tca: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    missDistanceKm: 1.243,
    rawPc: 0.00011,
    mlPc: 0.00012,
    riskTier: 'amber',
    maneuverRecommended: false,
    status: 'active',
  },
  {
    id: 'conj-004',
    cdmId: 'CDM-2025-110304',
    satelliteA: { id: 'sat-001', name: 'ISS', noradId: '25544', operator: 'NASA/Roscosmos' },
    satelliteB: { id: 'cz4c-deb', name: 'CZ-4C DEB', noradId: '37820' },
    tca: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    missDistanceKm: 4.5,
    rawPc: 0.000028,
    mlPc: 0.000032,
    riskTier: 'green',
    maneuverRecommended: false,
    status: 'active',
  },
]

export const mockScenarios: Scenario[] = [
  {
    id: 'scenario-001',
    name: 'Starlink Constellation Risk Analysis',
    description: 'AI-calibrated conjunction risk assessment for the Starlink LEO constellation',
    dataQuality: 'operational',
    createdAt: '2025-11-01T10:00:00Z',
    startTime: '2025-11-03T00:00:00Z',
    endTime: '2025-11-03T23:59:59Z',
    duration: 1440,
    satelliteCount: 4,
    aiDecisionStatus: 'warning',
    tags: ['LEO', 'conjunction', 'operational'],
    satellites,
    events,
    aiRecommendations,
    telemetryData: telemetryDataStarlink,
  },
  {
    id: 'scenario-002',
    name: 'LEO Crossing Event Monitor',
    description: 'Monitoring LEO crossing events and proximity alerts for commercial operators',
    dataQuality: 'training',
    createdAt: '2025-10-28T14:30:00Z',
    startTime: '2025-10-30T00:00:00Z',
    endTime: '2025-10-31T23:59:59Z',
    duration: 2880,
    satelliteCount: 1,
    aiDecisionStatus: 'nominal',
    tags: ['ISS', 'maneuver', 'training'],
    satellites: [satellites[0]],
    events: [events[1]],
    aiRecommendations: [aiRecommendations[1]],
    telemetryData: telemetryDataISS,
  },
  {
    id: 'scenario-003',
    name: 'Debris Field Analysis',
    description: 'Collision prediction and risk analysis for tracked debris fields',
    dataQuality: 'testing',
    createdAt: '2025-10-25T09:15:00Z',
    startTime: '2025-10-26T00:00:00Z',
    endTime: '2025-10-26T12:00:00Z',
    duration: 720,
    satelliteCount: 3,
    aiDecisionStatus: 'critical',
    tags: ['debris', 'collision', 'testing'],
    satellites: [satellites[1], satellites[2], satellites[3]],
    events: [events[0]],
    aiRecommendations: [aiRecommendations[0]],
    telemetryData: telemetryDataStarlink,
  },
  {
    id: 'scenario-004',
    name: 'GEO Belt Proximity Alert',
    description: 'Proximity monitoring and conjunction screening in the geostationary belt',
    dataQuality: 'operational',
    createdAt: '2025-11-02T16:00:00Z',
    startTime: '2025-11-02T18:00:00Z',
    endTime: '2025-11-03T18:00:00Z',
    duration: 1440,
    satelliteCount: 2,
    aiDecisionStatus: 'nominal',
    tags: ['GEO', 'monitoring', 'operational'],
    satellites: [satellites[1]],
    events: [events[2]],
    aiRecommendations: [aiRecommendations[2]],
    telemetryData: telemetryDataStarlink,
  },
  {
    id: 'scenario-005',
    name: 'ISS Conjunction Assessment',
    description: 'Real-time conjunction assessment and maneuver planning for the ISS',
    dataQuality: 'training',
    createdAt: '2025-10-20T11:00:00Z',
    startTime: '2025-10-22T00:00:00Z',
    endTime: '2025-10-24T23:59:59Z',
    duration: 4320,
    satelliteCount: 5,
    aiDecisionStatus: 'analyzing',
    tags: ['ISS', 'conjunction', 'training'],
    satellites: satellites,
    events: [],
    aiRecommendations: [],
  },
  {
    id: 'scenario-006',
    name: 'Re-entry Prediction Scenario',
    description: 'Re-entry prediction modeling and ground impact footprint analysis',
    dataQuality: 'testing',
    createdAt: '2025-10-18T13:45:00Z',
    startTime: '2025-10-19T00:00:00Z',
    endTime: '2025-10-19T06:00:00Z',
    duration: 360,
    satelliteCount: 1,
    aiDecisionStatus: 'nominal',
    tags: ['re-entry', 'testing'],
    satellites: [satellites[3]],
    events: [],
    aiRecommendations: [],
  },
]

/**
 * Create a scenario variant with applied maneuver
 */
export function createScenarioVariant(
  baseScenario: Scenario,
  satelliteId: string,
  maneuverPlan: ManeuverPlan,
  predictedOrbitalParams: OrbitalParameters
): ScenarioVariant {
  // Find and update the satellite with new orbital parameters
  const updatedSatellites = baseScenario.satellites.map(sat => {
    if (sat.id === satelliteId) {
      const newAltitude = predictedOrbitalParams.semiMajorAxis - 6371 // Earth radius
      const mu = 398600.4418 // km^3/s^2
      const newVelocity = Math.sqrt(mu / predictedOrbitalParams.semiMajorAxis)

      return {
        ...sat,
        orbitalParams: predictedOrbitalParams,
        altitude: newAltitude,
        velocity: newVelocity,
      }
    }
    return sat
  })

  // Create new scenario variant
  const variant: ScenarioVariant = {
    ...baseScenario,
    id: `${baseScenario.id}-variant-${Date.now()}`,
    name: `${baseScenario.name} (Maneuver Variant)`,
    description: `${baseScenario.description} - Maneuver applied: ${maneuverPlan.description}`,
    parentScenarioId: baseScenario.id,
    maneuverApplied: maneuverPlan,
    satellites: updatedSatellites,
    createdAt: new Date().toISOString(),
    tags: [...baseScenario.tags, 'variant', 'maneuver'],
  }

  return variant
}

/**
 * Save a scenario variant (in a real app, this would persist to backend)
 */
export function saveScenarioVariant(variant: ScenarioVariant): void {
  // In a real application, this would make an API call to save the variant
  // For now, we'll just log it and could add it to the mockScenarios array
  console.log('Saving scenario variant:', variant)
  mockScenarios.push(variant as Scenario)
}
