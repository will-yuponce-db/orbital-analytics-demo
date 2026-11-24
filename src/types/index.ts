export type DataQuality = 'testing' | 'training' | 'operational'

export type AIDecisionStatus = 'nominal' | 'warning' | 'critical' | 'analyzing'

export interface OrbitalParameters {
  semiMajorAxis: number // km
  eccentricity: number
  inclination: number // degrees
  raan: number // right ascension of ascending node, degrees
  argOfPerigee: number // degrees
  trueAnomaly: number // degrees
}

export interface Satellite {
  id: string
  name: string
  noradId: string
  category: 'active' | 'debris' | 'rocket-body'
  orbitalParams: OrbitalParameters
  altitude: number // km
  velocity: number // km/s
  selected: boolean
  tle?: { line1: string; line2: string } | null
}

export interface AIRecommendation {
  id: string
  timestamp: string
  type:
    | 'collision-avoidance'
    | 'conjunction-monitoring'
    | 'orbital-adjustment'
    | 're-entry-watch'
    | 'maneuver'
    | 'monitoring'
    | 'analysis'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  confidence: number // 0-100
  affectedSensors?: string[] // Parameter names that triggered or are related to this recommendation
  relatedEventId?: string // Link to a specific scenario event
}

export interface ScenarioEvent {
  id: string
  timestamp: string
  type: 'launch' | 'maneuver' | 'conjunction' | 'reentry' | 'anomaly'
  description: string
  satelliteIds: string[]
}

export interface Scenario {
  id: string
  name: string
  description: string
  dataQuality: DataQuality
  createdAt: string
  startTime: string
  endTime: string
  duration: number // minutes
  satelliteCount: number
  aiDecisionStatus: AIDecisionStatus
  thumbnail?: string
  tags: string[]
  satellites: Satellite[]
  events: ScenarioEvent[]
  aiRecommendations: AIRecommendation[]
  telemetryData?: TelemetryData[] // Sensor readings for the primary satellite
}

export interface TelemetryData {
  parameter: string
  value: string
  unit: string
  status: 'normal' | 'warning' | 'critical'
}

export type ManeuverType =
  | 'collision-avoidance'
  | 'orbit-raising'
  | 'orbit-lowering'
  | 'inclination-change'
  | 'station-keeping'

export interface ManeuverPlan {
  id: string
  type: ManeuverType
  satelliteId: string
  executionTime: string // ISO timestamp
  deltaV: {
    x: number // m/s
    y: number // m/s
    z: number // m/s
    magnitude: number // m/s
  }
  targetParameters?: Partial<OrbitalParameters>
  description: string
}

export interface ManeuverAnalysis {
  plan: ManeuverPlan
  predictedOrbitalParams: OrbitalParameters
  fuelCostKg: number
  fuelCostDeltaV: number // m/s
  collisionProbability: number // 0-100
  executionDuration: number // seconds
  timeToComplete: number // seconds
  newAltitude: number // km
  newVelocity: number // km/s
}

export interface ScenarioVariant extends Scenario {
  parentScenarioId?: string
  maneuverApplied?: ManeuverPlan
}

/**
 * User Roles for Role-Based Access Control
 */
export type UserRole =
  | 'operator'
  | 'analyst'
  | 'commander'
  | 'engineer'
  | 'admin'
  | 'coalition-partner'

/**
 * User Profile
 */
export interface UserProfile {
  id: string
  username: string
  role: UserRole
  organization: string
  lastLogin: string
}

/**
 * Tracking Network Data Source
 */
export interface SSNDataSource {
  sensorId: string
  sensorName: string
  sensorType: 'radar' | 'optical' | 'space-based'
  location: string
  lastContact: string
  dataQuality: number // 0-100
  trackingObjects: number
}

/**
 * Conjunction Event
 */
export interface ConjunctionEvent {
  id: string
  cdmId?: string
  satelliteA: { id: string; name: string; noradId: string; operator?: string }
  satelliteB: { id: string; name: string; noradId: string; operator?: string }
  tca: string
  missDistanceKm: number
  rawPc?: number
  mlPc: number
  riskTier: 'green' | 'amber' | 'red'
  maneuverRecommended: boolean
  maneuverWindowOpen?: string
  maneuverWindowClose?: string
  status: 'active' | 'resolved' | 'maneuvered' | 'passed'
  /** Miss distance in meters (newer API rows). */
  missDistanceM?: number | null
  /** Hours from now to TCA; negative once passed. */
  hoursToTca?: number | null
  /** Stable key for the physical event across CDM updates and object orderings. */
  eventKey?: string | null
  /** Number of CDMs folded into this event. */
  cdmCount?: number | null
  firstPc?: number | null
  maxPc?: number | null
  pcHistory?: { createdAt: string | null; pc: number | null; missDistanceM: number | null }[] | null
}

/**
 * Anomaly Detection Event (IsolationForest ML output)
 */
export interface AnomalyEvent {
  id: number
  noradId: string
  satelliteName: string
  anomalyType:
    | 'altitude-drop'
    | 'velocity-spike'
    | 'eccentricity-change'
    | 'inclination-drift'
    | 'orbital-decay'
    | 'maneuver-unplanned'
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: string
  parameterName: string
  expectedValue: number
  observedValue: number
  deviationSigma: number
  anomalyScore: number
  description: string
  status: 'active' | 'investigating' | 'resolved'
}

/**
 * Audit Log Entry for Compliance
 */
export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  username: string
  action: string
  resourceType: string
  resourceId: string
  details: string
  ipAddress: string
  result: 'success' | 'failure' | 'denied'
}

/**
 * Campaign Story Structure
 */
export type CampaignAct = 'act-1' | 'act-2' | 'act-3' | 'act-4'

export type StoryBeat =
  | 'reconnaissance'
  | 'initial-threat'
  | 'escalation'
  | 'coordinated-attack'
  | 'crisis-point'
  | 'decision-point'
  | 'resolution'
  | 'aftermath'

export interface StoryContext {
  act: CampaignAct
  actTitle: string
  beat: StoryBeat
  dayNumber: number
  missionBriefing: string
  previousEvents: string[]
  nextScenarios?: string[]
  alternativeBranches?: {
    condition: string
    scenarioId: string
  }[]
}

export interface CampaignScenario extends Scenario {
  storyContext?: StoryContext
  campaignId?: string
  isPartOfCampaign: boolean
  prerequisites?: string[]
  unlocks?: string[]
  missionObjectives?: string[]
  successCriteria?: string[]
}
