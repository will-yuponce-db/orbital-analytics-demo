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
}

export interface AIRecommendation {
  id: string
  timestamp: string
  type: 'maneuver' | 'monitoring' | 'collision-avoidance' | 'analysis'
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

// ============================================================================
// SPACE FORCE OPERATIONAL EXTENSIONS
// ============================================================================

/**
 * Classification Levels per DoD 5220.22-M
 */
export type ClassificationLevel = 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET'

/**
 * Classification Markings
 */
export interface ClassificationMarking {
  level: ClassificationLevel
  caveats?: string[] // e.g., ['NOFORN', 'RELIDO', 'FOUO']
  sciControls?: string[] // SCI compartments
  disseminationControls?: string[]
  derivedFrom?: string
  declassifyOn?: string
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
 * User Clearance and Access
 */
export interface UserProfile {
  id: string
  username: string
  rank?: string
  unit: string
  role: UserRole
  clearanceLevel: ClassificationLevel
  sciAccess: string[]
  lastLogin: string
  needToKnow: string[] // Mission areas
}

/**
 * Threat Assessment Types
 */
export type ThreatType =
  | 'hostile-satellite'
  | 'asat-weapon'
  | 'electronic-attack'
  | 'cyber-attack'
  | 'directed-energy'
  | 'kinetic-intercept'
  | 'co-orbital-threat'
  | 'unknown'

/**
 * Threat Level Assessment
 */
export type ThreatLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical'

/**
 * Hostile Satellite/Object Tracking
 */
export interface ThreatObject extends Satellite {
  threatType: ThreatType
  threatLevel: ThreatLevel
  countryOfOrigin: string
  firstDetected: string
  behaviorProfile: 'aggressive' | 'surveillance' | 'proximity-ops' | 'unknown'
  maneuverHistory: ManeuverEvent[]
  capabilities?: ThreatCapability[]
  targetedAssets?: string[] // IDs of threatened satellites
}

/**
 * Threat Capabilities
 */
export interface ThreatCapability {
  type: 'kinetic' | 'electronic' | 'directed-energy' | 'cyber' | 'proximity-ops'
  detectionConfidence: number // 0-100
  effectiveRange?: number // km
  lastObserved: string
}

/**
 * Maneuver Event History
 */
export interface ManeuverEvent {
  timestamp: string
  deltaV: number // m/s
  description: string
  assessed: 'hostile' | 'evasive' | 'routine' | 'unknown'
}

/**
 * Electronic Warfare Threat
 */
export interface EWThreat {
  id: string
  type: 'jamming' | 'spoofing' | 'interference' | 'signal-intercept'
  affectedFrequencies: string[] // GHz ranges
  affectedSatellites: string[]
  sourceLocation?: {
    latitude: number
    longitude: number
    groundStation?: string
  }
  startTime: string
  endTime?: string
  severity: ThreatLevel
  classification: ClassificationMarking
}

/**
 * Space Surveillance Network (SSN) Data Source
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
 * Command and Control Alert
 */
export interface C2Alert {
  id: string
  timestamp: string
  alertType: 'conjunction' | 'threat-detection' | 'anomaly' | 'ew-attack' | 'maneuver-required'
  priority: 'routine' | 'priority' | 'immediate' | 'flash'
  title: string
  description: string
  affectedAssets: string[]
  recommendedActions: string[]
  disseminationList: string[] // Units/commands to notify
  classification: ClassificationMarking
  acknowledgedBy?: string[]
  resolvedAt?: string
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
  classification: ClassificationLevel
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
