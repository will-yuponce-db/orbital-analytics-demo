import {
  Scenario,
  Satellite,
  ScenarioEvent,
  AIRecommendation,
  TelemetryData,
  ScenarioVariant,
  ManeuverPlan,
  ThreatObject,
  EWThreat,
  OrbitalParameters,
  C2Alert,
  SSNDataSource,
  ClassificationMarking,
  UserProfile,
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

const telemetryDataStarlink: TelemetryData[] = [
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
    type: 'monitoring',
    priority: 'medium',
    description:
      'Continue monitoring ISS maneuver performance. Expected delta-v within nominal range.',
    confidence: 92,
    affectedSensors: ['Velocity', 'Altitude', 'Apogee', 'Perigee'],
    relatedEventId: 'event-002',
  },
  {
    id: 'rec-003',
    timestamp: '2025-11-03T19:00:00Z',
    type: 'analysis',
    priority: 'low',
    description:
      'Anomaly on STARLINK-1234 likely due to attitude control adjustment. No action required.',
    confidence: 78,
    affectedSensors: ['Drag Coefficient', 'Solar Panel Voltage'],
    relatedEventId: 'event-003',
  },
]

// ============================================================================
// SPACE FORCE OPERATIONAL DATA
// ============================================================================

/**
 * Classification Markings
 */
export const classificationUnclassified: ClassificationMarking = {
  level: 'UNCLASSIFIED',
}

export const classificationConfidential: ClassificationMarking = {
  level: 'CONFIDENTIAL',
  caveats: ['NOFORN'],
  derivedFrom: 'Multiple Sources',
  declassifyOn: '20501103',
}

export const classificationSecret: ClassificationMarking = {
  level: 'SECRET',
  caveats: ['NOFORN', 'RELIDO'],
  sciControls: ['TK', 'SI'],
  derivedFrom: 'USSF SATOPS',
  declassifyOn: 'X1',
}

export const classificationTopSecret: ClassificationMarking = {
  level: 'TOP SECRET',
  caveats: ['NOFORN'],
  sciControls: ['TK', 'SI', 'GAMMA'],
  derivedFrom: 'NRO/USSF',
  declassifyOn: 'X1',
}

/**
 * Hostile/Threat Objects
 */
export const threatObjects: ThreatObject[] = [
  {
    id: 'threat-001',
    name: 'COSMOS 2558 (INSPECTOR)',
    noradId: '52981',
    category: 'active',
    orbitalParams: {
      semiMajorAxis: 42164,
      eccentricity: 0.0001,
      inclination: 0.02,
      raan: 45.2,
      argOfPerigee: 180.0,
      trueAnomaly: 135.0,
    },
    altitude: 35786, // GEO
    velocity: 3.07,
    selected: false,
    threatType: 'co-orbital-threat',
    threatLevel: 'high',
    countryOfOrigin: 'RUS',
    firstDetected: '2025-10-15T08:30:00Z',
    behaviorProfile: 'proximity-ops',
    maneuverHistory: [
      {
        timestamp: '2025-10-20T12:00:00Z',
        deltaV: 45.2,
        description: 'Rapid orbit change toward SBIRS GEO-1',
        assessed: 'hostile',
      },
      {
        timestamp: '2025-10-25T18:30:00Z',
        deltaV: 32.1,
        description: 'Station-keeping adjustment near target',
        assessed: 'hostile',
      },
    ],
    capabilities: [
      {
        type: 'proximity-ops',
        detectionConfidence: 95,
        effectiveRange: 50,
        lastObserved: '2025-11-03T06:00:00Z',
      },
      {
        type: 'electronic',
        detectionConfidence: 72,
        lastObserved: '2025-11-02T14:00:00Z',
      },
    ],
    targetedAssets: ['sbirs-geo-1', 'dscs-iii-b8'],
  },
  {
    id: 'threat-002',
    name: 'SHIYAN-21 (ASAT TEST)',
    noradId: '51395',
    category: 'active',
    orbitalParams: {
      semiMajorAxis: 7171,
      eccentricity: 0.012,
      inclination: 98.5,
      raan: 234.1,
      argOfPerigee: 90.0,
      trueAnomaly: 270.0,
    },
    altitude: 800,
    velocity: 7.45,
    selected: false,
    threatType: 'asat-weapon',
    threatLevel: 'critical',
    countryOfOrigin: 'CHN',
    firstDetected: '2025-09-12T03:15:00Z',
    behaviorProfile: 'aggressive',
    maneuverHistory: [
      {
        timestamp: '2025-10-28T09:45:00Z',
        deltaV: 120.5,
        description: 'Large maneuver consistent with intercept trajectory',
        assessed: 'hostile',
      },
      {
        timestamp: '2025-11-01T16:20:00Z',
        deltaV: 85.3,
        description: 'Plane change maneuver toward ISR constellation',
        assessed: 'hostile',
      },
    ],
    capabilities: [
      {
        type: 'kinetic',
        detectionConfidence: 88,
        effectiveRange: 100,
        lastObserved: '2025-11-01T16:20:00Z',
      },
    ],
    targetedAssets: ['usa-290', 'usa-314'],
  },
  {
    id: 'threat-003',
    name: 'UNKNOWN OBJ 2025-099B',
    noradId: '58234',
    category: 'active',
    orbitalParams: {
      semiMajorAxis: 6921,
      eccentricity: 0.0005,
      inclination: 53.2,
      raan: 188.4,
      argOfPerigee: 45.0,
      trueAnomaly: 180.0,
    },
    altitude: 550,
    velocity: 7.59,
    selected: false,
    threatType: 'unknown',
    threatLevel: 'moderate',
    countryOfOrigin: 'Unknown',
    firstDetected: '2025-11-01T22:10:00Z',
    behaviorProfile: 'surveillance',
    maneuverHistory: [
      {
        timestamp: '2025-11-02T10:30:00Z',
        deltaV: 15.8,
        description: 'Minor trajectory adjustment',
        assessed: 'unknown',
      },
    ],
    capabilities: [],
    targetedAssets: [],
  },
]

/**
 * Electronic Warfare Threats
 */
export const ewThreats: EWThreat[] = [
  {
    id: 'ew-001',
    type: 'jamming',
    affectedFrequencies: ['12.5-12.75 GHz', '14.0-14.5 GHz'],
    affectedSatellites: ['usa-326', 'wgs-11'],
    sourceLocation: {
      latitude: 39.9042,
      longitude: 116.4074,
      groundStation: 'Beijing SIGINT Site',
    },
    startTime: '2025-11-03T08:15:00Z',
    severity: 'high',
    classification: classificationUnclassified,
  },
  {
    id: 'ew-002',
    type: 'spoofing',
    affectedFrequencies: ['1.57542 GHz'],
    affectedSatellites: ['gps-iif-12', 'gps-iii-5'],
    sourceLocation: {
      latitude: 55.7558,
      longitude: 37.6173,
      groundStation: 'Moscow EW Complex',
    },
    startTime: '2025-11-02T14:30:00Z',
    endTime: '2025-11-02T18:45:00Z',
    severity: 'critical',
    classification: classificationUnclassified,
  },
  {
    id: 'ew-003',
    type: 'interference',
    affectedFrequencies: ['7.25-7.75 GHz'],
    affectedSatellites: ['dscs-iii-b8'],
    startTime: '2025-11-03T11:00:00Z',
    severity: 'moderate',
    classification: classificationUnclassified,
  },
]

/**
 * Command and Control Alerts
 */
export const c2Alerts: C2Alert[] = [
  {
    id: 'alert-001',
    timestamp: '2025-11-03T08:15:00Z',
    alertType: 'ew-attack',
    priority: 'immediate',
    title: 'ACTIVE JAMMING DETECTED - WGS CONSTELLATION',
    description:
      'High-power jamming detected affecting WGS-11 downlinks. Uplink communications degraded by 40%. Source identified as Beijing SIGINT facility. Recommend immediate frequency hopping and power increase.',
    affectedAssets: ['WGS-11', 'USA-326'],
    recommendedActions: [
      'Activate anti-jam protocols on WGS-11',
      'Switch to backup frequencies',
      'Increase transmit power by 6dB',
      'Coordinate with CYBERCOM for counter-EW operations',
      'Notify allied partners using WGS capacity',
    ],
    disseminationList: ['USSF/S3D', 'CYBERCOM', '614 AOC', 'STRATCOM/J3'],
    classification: classificationUnclassified,
    acknowledgedBy: ['maj.anderson', 'lt.col.martinez'],
  },
  {
    id: 'alert-002',
    timestamp: '2025-11-03T06:00:00Z',
    alertType: 'threat-detection',
    priority: 'flash',
    title: 'HOSTILE SATELLITE PROXIMITY OPS - SBIRS GEO-1',
    description:
      'COSMOS 2558 has maneuvered to within 50km of SBIRS GEO-1. Object demonstrates co-orbital threat behavior. Potential for close approach, inspection, or hostile action. Threat level: HIGH. IMMEDIATE ASSESSMENT REQUIRED.',
    affectedAssets: ['SBIRS GEO-1', 'DSCS-III-B8'],
    recommendedActions: [
      'Initiate 24/7 tracking and monitoring of COSMOS 2558',
      'Prepare evasive maneuver options for SBIRS GEO-1',
      'Alert SBIRS operators to potential interference',
      'Coordinate with NRO for enhanced surveillance',
      'Brief USSPACECOM commander immediately',
      'Prepare diplomatic protest through State Department',
    ],
    disseminationList: ['USSPACECOM', 'NRO', 'USSF/S2', 'JCS', 'NSC', 'POTUS'],
    classification: classificationUnclassified,
    acknowledgedBy: ['gen.thompson', 'col.rivera', 'maj.anderson'],
  },
  {
    id: 'alert-003',
    timestamp: '2025-11-03T12:00:00Z',
    alertType: 'conjunction',
    priority: 'priority',
    title: 'HIGH COLLISION PROBABILITY - USA-314',
    description:
      'Conjunction predicted between USA-314 (KH-11) and SHIYAN-21 at TCA 2025-11-04T03:45:00Z. Miss distance: 285 meters. Pc: 1:2,500. NOTE: SHIYAN-21 assessed as potential ASAT platform. Maneuver strongly recommended.',
    affectedAssets: ['USA-314'],
    recommendedActions: [
      'Execute collision avoidance maneuver NLT 18 hours prior to TCA',
      'Coordinate with NRO for ISR asset protection',
      'Monitor SHIYAN-21 for further maneuvers',
      'Assess if conjunction is deliberate harassment',
      'Prepare intelligence report on Chinese ASAT capabilities',
    ],
    disseminationList: ['NRO', 'USSF/S3D', '18 SPCS', 'USSPACECOM/J3'],
    classification: classificationUnclassified,
    acknowledgedBy: ['col.rivera'],
  },
  {
    id: 'alert-004',
    timestamp: '2025-11-03T14:30:00Z',
    alertType: 'anomaly',
    priority: 'routine',
    title: 'Telemetry Anomaly - GPS III-5',
    description:
      'Minor telemetry anomaly detected on GPS III-5. Solar array current reading 5% below nominal. No impact to navigation signal. Engineering review scheduled.',
    affectedAssets: ['GPS III-5'],
    recommendedActions: [
      'Continue monitoring telemetry',
      'Engineering team to review solar array performance',
      'No immediate action required',
    ],
    disseminationList: ['USSF/S3D', '2 SOPS'],
    classification: classificationUnclassified,
    acknowledgedBy: ['capt.johnson', 'ssgt.williams'],
  },
]

/**
 * SSN Data Sources
 */
export const ssnDataSources: SSNDataSource[] = [
  {
    sensorId: 'AN/FPS-132',
    sensorName: 'Space Fence (Kwajalein)',
    sensorType: 'radar',
    location: 'Kwajalein Atoll, Marshall Islands',
    lastContact: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    dataQuality: 98,
    trackingObjects: 3842,
  },
  {
    sensorId: 'PAVE-PAWS-1',
    sensorName: 'PAVE PAWS (Beale AFB)',
    sensorType: 'radar',
    location: 'Beale AFB, California',
    lastContact: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 minute ago
    dataQuality: 94,
    trackingObjects: 1256,
  },
  {
    sensorId: 'PAVE-PAWS-2',
    sensorName: 'PAVE PAWS (Cape Cod)',
    sensorType: 'radar',
    location: 'Cape Cod AFS, Massachusetts',
    lastContact: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    dataQuality: 92,
    trackingObjects: 1189,
  },
  {
    sensorId: 'GEODSS-1',
    sensorName: 'GEODSS (Diego Garcia)',
    sensorType: 'optical',
    location: 'Diego Garcia, Indian Ocean',
    lastContact: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    dataQuality: 88,
    trackingObjects: 542,
  },
  {
    sensorId: 'GEODSS-2',
    sensorName: 'GEODSS (Maui)',
    sensorType: 'optical',
    location: 'Maui, Hawaii',
    lastContact: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    dataQuality: 91,
    trackingObjects: 678,
  },
  {
    sensorId: 'GEODSS-3',
    sensorName: 'GEODSS (Socorro)',
    sensorType: 'optical',
    location: 'Socorro, New Mexico',
    lastContact: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    dataQuality: 85,
    trackingObjects: 523,
  },
  {
    sensorId: 'SBSS-1',
    sensorName: 'Space Based Space Surveillance',
    sensorType: 'space-based',
    location: 'LEO Orbit (630 km)',
    lastContact: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    dataQuality: 96,
    trackingObjects: 2145,
  },
  {
    sensorId: 'CLEAR-1',
    sensorName: 'C-Band Radar (Clear AFS)',
    sensorType: 'radar',
    location: 'Clear AFS, Alaska',
    lastContact: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    dataQuality: 89,
    trackingObjects: 892,
  },
  {
    sensorId: 'ALTAIR-1',
    sensorName: 'ALTAIR Radar',
    sensorType: 'radar',
    location: 'Kwajalein Atoll, Marshall Islands',
    lastContact: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    dataQuality: 93,
    trackingObjects: 1456,
  },
]

/**
 * User Profiles for RBAC
 */
export const mockUsers: UserProfile[] = [
  {
    id: 'user-001',
    username: 'john.anderson',
    rank: 'Maj',
    unit: 'USSF/S3D Space Operations',
    role: 'operator',
    clearanceLevel: 'UNCLASSIFIED',
    sciAccess: [],
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    needToKnow: ['Space Domain Awareness', 'Satellite Operations', 'Conjunction Assessment'],
  },
  {
    id: 'user-002',
    username: 'sarah.rivera',
    rank: 'Lt Col',
    unit: '18th Space Defense Squadron',
    role: 'commander',
    clearanceLevel: 'TOP SECRET',
    sciAccess: ['TK', 'SI', 'GAMMA'],
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    needToKnow: [
      'Space Domain Awareness',
      'Threat Assessment',
      'ASAT Intelligence',
      'Counter-Space Operations',
    ],
  },
  {
    id: 'user-003',
    username: 'michael.chen',
    rank: 'Capt',
    unit: 'USSF/S2 Intelligence',
    role: 'analyst',
    clearanceLevel: 'TOP SECRET',
    sciAccess: ['TK', 'SI', 'HCS'],
    lastLogin: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    needToKnow: ['Threat Assessment', 'ASAT Intelligence', 'EW Analysis', 'Foreign Space Programs'],
  },
  {
    id: 'user-004',
    username: 'emily.martinez',
    rank: 'TSgt',
    unit: '2nd Space Operations Squadron',
    role: 'engineer',
    clearanceLevel: 'SECRET',
    sciAccess: ['TK'],
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    needToKnow: ['Satellite Operations', 'GPS Constellation', 'Telemetry Analysis'],
  },
  {
    id: 'user-005',
    username: 'robert.thompson',
    rank: 'Brig Gen',
    unit: 'USSPACECOM/J3',
    role: 'commander',
    clearanceLevel: 'TOP SECRET',
    sciAccess: ['TK', 'SI', 'GAMMA', 'HCS'],
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    needToKnow: ['All Space Operations', 'Strategic Planning', 'Force Protection', 'Counter-Space'],
  },
]

export const mockScenarios: Scenario[] = [
  {
    id: 'scenario-001',
    name: 'LEO Constellation Analysis',
    description: 'Analysis of low Earth orbit constellation behavior and conjunction risks',
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
    name: 'ISS Reboost Training Set',
    description: 'Training data for ISS reboost maneuver prediction models',
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
    name: 'Debris Field Collision Risk',
    description: 'Testing collision prediction algorithms with debris field data',
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
    name: 'Starlink Constellation Monitor',
    description: 'Operational monitoring of Starlink constellation behavior',
    dataQuality: 'operational',
    createdAt: '2025-11-02T16:00:00Z',
    startTime: '2025-11-02T18:00:00Z',
    endTime: '2025-11-03T18:00:00Z',
    duration: 1440,
    satelliteCount: 2,
    aiDecisionStatus: 'nominal',
    tags: ['Starlink', 'monitoring', 'operational'],
    satellites: [satellites[1]],
    events: [events[2]],
    aiRecommendations: [aiRecommendations[2]],
    telemetryData: telemetryDataStarlink,
  },
  {
    id: 'scenario-005',
    name: 'GEO Belt Analysis',
    description: 'Analysis of geostationary orbit dynamics and stationkeeping',
    dataQuality: 'training',
    createdAt: '2025-10-20T11:00:00Z',
    startTime: '2025-10-22T00:00:00Z',
    endTime: '2025-10-24T23:59:59Z',
    duration: 4320,
    satelliteCount: 5,
    aiDecisionStatus: 'analyzing',
    tags: ['GEO', 'stationkeeping', 'training'],
    satellites: satellites,
    events: [],
    aiRecommendations: [],
  },
  {
    id: 'scenario-006',
    name: 'Re-entry Prediction Test',
    description: 'Testing re-entry prediction models with historical data',
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
