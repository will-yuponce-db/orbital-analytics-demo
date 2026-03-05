import Database from 'better-sqlite3'
import {
  mockScenarios,
  threatObjects,
  ewThreats,
  c2Alerts,
  ssnDataSources,
  mockUsers,
  telemetryDataISS,
  telemetryDataStarlink,
} from '../../src/data/scenarios.js'

export function seedDatabase(db: Database.Database) {
  // Clear existing data
  const tables = [
    'telemetry_data',
    'threat_capabilities',
    'maneuver_history',
    'ai_recommendations',
    'events',
    'scenario_satellites',
    'scenarios',
    'satellites',
    'threat_objects',
    'ew_threats',
    'c2_alerts',
    'ssn_data_sources',
    'user_profiles',
  ]

  tables.forEach(table => {
    db.prepare(`DELETE FROM ${table}`).run()
  })

  // Insert scenarios
  const insertScenario = db.prepare(`
    INSERT INTO scenarios (id, name, description, data_quality, created_at, start_time, end_time, duration, satellite_count, ai_decision_status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Insert satellites
  const insertSatellite = db.prepare(`
    INSERT OR IGNORE INTO satellites (id, name, norad_id, category, semi_major_axis, eccentricity, inclination, raan, arg_of_perigee, true_anomaly, altitude, velocity, selected)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Insert scenario_satellites junction
  const insertScenarioSatellite = db.prepare(`
    INSERT INTO scenario_satellites (scenario_id, satellite_id)
    VALUES (?, ?)
  `)

  // Insert events
  const insertEvent = db.prepare(`
    INSERT INTO events (id, scenario_id, timestamp, type, description, satellite_ids)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  // Insert AI recommendations
  const insertAIRecommendation = db.prepare(`
    INSERT INTO ai_recommendations (id, scenario_id, timestamp, type, priority, description, confidence, affected_sensors, related_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Insert telemetry data
  const insertTelemetry = db.prepare(`
    INSERT INTO telemetry_data (scenario_id, satellite_id, parameter, value, unit, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  // Process scenarios
  for (const scenario of mockScenarios) {
    insertScenario.run(
      scenario.id,
      scenario.name,
      scenario.description,
      scenario.dataQuality,
      scenario.createdAt,
      scenario.startTime,
      scenario.endTime,
      scenario.duration,
      scenario.satelliteCount,
      scenario.aiDecisionStatus,
      JSON.stringify(scenario.tags)
    )

    // Insert satellites for this scenario
    for (const satellite of scenario.satellites) {
      insertSatellite.run(
        satellite.id,
        satellite.name,
        satellite.noradId,
        satellite.category,
        satellite.orbitalParams.semiMajorAxis,
        satellite.orbitalParams.eccentricity,
        satellite.orbitalParams.inclination,
        satellite.orbitalParams.raan,
        satellite.orbitalParams.argOfPerigee,
        satellite.orbitalParams.trueAnomaly,
        satellite.altitude,
        satellite.velocity,
        satellite.selected ? 1 : 0
      )

      insertScenarioSatellite.run(scenario.id, satellite.id)
    }

    // Insert events
    for (const event of scenario.events) {
      insertEvent.run(
        event.id,
        scenario.id,
        event.timestamp,
        event.type,
        event.description,
        JSON.stringify(event.satelliteIds)
      )
    }

    // Insert AI recommendations
    for (const rec of scenario.aiRecommendations) {
      insertAIRecommendation.run(
        rec.id,
        scenario.id,
        rec.timestamp,
        rec.type,
        rec.priority,
        rec.description,
        rec.confidence,
        rec.affectedSensors ? JSON.stringify(rec.affectedSensors) : null,
        rec.relatedEventId || null
      )
    }

    // Insert telemetry data
    if (scenario.telemetryData) {
      const primarySatellite = scenario.satellites[0]
      for (const telemetry of scenario.telemetryData) {
        insertTelemetry.run(
          scenario.id,
          primarySatellite.id,
          telemetry.parameter,
          telemetry.value,
          telemetry.unit,
          telemetry.status
        )
      }
    }
  }

  // Insert threat objects
  const insertThreatObject = db.prepare(`
    INSERT INTO threat_objects (id, name, norad_id, category, semi_major_axis, eccentricity, inclination, raan, arg_of_perigee, true_anomaly, altitude, velocity, selected, threat_type, threat_level, country_of_origin, first_detected, behavior_profile, targeted_assets)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertManeuverHistory = db.prepare(`
    INSERT INTO maneuver_history (threat_object_id, timestamp, delta_v, description, assessed)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertThreatCapability = db.prepare(`
    INSERT INTO threat_capabilities (threat_object_id, type, detection_confidence, effective_range, last_observed)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const threat of threatObjects) {
    insertThreatObject.run(
      threat.id,
      threat.name,
      threat.noradId,
      threat.category,
      threat.orbitalParams.semiMajorAxis,
      threat.orbitalParams.eccentricity,
      threat.orbitalParams.inclination,
      threat.orbitalParams.raan,
      threat.orbitalParams.argOfPerigee,
      threat.orbitalParams.trueAnomaly,
      threat.altitude,
      threat.velocity,
      threat.selected ? 1 : 0,
      threat.threatType,
      threat.threatLevel,
      threat.countryOfOrigin,
      threat.firstDetected,
      threat.behaviorProfile,
      threat.targetedAssets ? JSON.stringify(threat.targetedAssets) : null
    )

    // Insert maneuver history
    for (const maneuver of threat.maneuverHistory) {
      insertManeuverHistory.run(
        threat.id,
        maneuver.timestamp,
        maneuver.deltaV,
        maneuver.description,
        maneuver.assessed
      )
    }

    // Insert threat capabilities
    if (threat.capabilities) {
      for (const capability of threat.capabilities) {
        insertThreatCapability.run(
          threat.id,
          capability.type,
          capability.detectionConfidence,
          capability.effectiveRange || null,
          capability.lastObserved
        )
      }
    }
  }

  // Insert EW threats
  const insertEWThreat = db.prepare(`
    INSERT INTO ew_threats (id, type, affected_frequencies, affected_satellites, source_latitude, source_longitude, ground_station, start_time, end_time, severity, classification_level, classification_caveats, classification_sci_controls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const threat of ewThreats) {
    insertEWThreat.run(
      threat.id,
      threat.type,
      JSON.stringify(threat.affectedFrequencies),
      JSON.stringify(threat.affectedSatellites),
      threat.sourceLocation?.latitude || null,
      threat.sourceLocation?.longitude || null,
      threat.sourceLocation?.groundStation || null,
      threat.startTime,
      threat.endTime || null,
      threat.severity,
      threat.classification.level,
      threat.classification.caveats ? JSON.stringify(threat.classification.caveats) : null,
      threat.classification.sciControls ? JSON.stringify(threat.classification.sciControls) : null
    )
  }

  // Insert C2 alerts
  const insertC2Alert = db.prepare(`
    INSERT INTO c2_alerts (id, timestamp, alert_type, priority, title, description, affected_assets, recommended_actions, dissemination_list, classification_level, classification_caveats, classification_sci_controls, acknowledged_by, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const alert of c2Alerts) {
    insertC2Alert.run(
      alert.id,
      alert.timestamp,
      alert.alertType,
      alert.priority,
      alert.title,
      alert.description,
      JSON.stringify(alert.affectedAssets),
      JSON.stringify(alert.recommendedActions),
      JSON.stringify(alert.disseminationList),
      alert.classification.level,
      alert.classification.caveats ? JSON.stringify(alert.classification.caveats) : null,
      alert.classification.sciControls ? JSON.stringify(alert.classification.sciControls) : null,
      alert.acknowledgedBy ? JSON.stringify(alert.acknowledgedBy) : null,
      alert.resolvedAt || null
    )
  }

  // Insert SSN data sources
  const insertSSNDataSource = db.prepare(`
    INSERT INTO ssn_data_sources (sensor_id, sensor_name, sensor_type, location, last_contact, data_quality, tracking_objects)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const source of ssnDataSources) {
    insertSSNDataSource.run(
      source.sensorId,
      source.sensorName,
      source.sensorType,
      source.location,
      source.lastContact,
      source.dataQuality,
      source.trackingObjects
    )
  }

  // Insert user profiles
  const insertUserProfile = db.prepare(`
    INSERT INTO user_profiles (id, username, rank, unit, role, clearance_level, sci_access, last_login, need_to_know)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const user of mockUsers) {
    insertUserProfile.run(
      user.id,
      user.username,
      user.rank || null,
      user.unit,
      user.role,
      user.clearanceLevel,
      JSON.stringify(user.sciAccess),
      user.lastLogin,
      JSON.stringify(user.needToKnow)
    )
  }

  console.log('✅ Database seeded successfully!')
  console.log(`   - ${mockScenarios.length} scenarios`)
  console.log(`   - ${threatObjects.length} threat objects`)
  console.log(`   - ${ewThreats.length} EW threats`)
  console.log(`   - ${c2Alerts.length} C2 alerts`)
  console.log(`   - ${ssnDataSources.length} SSN data sources`)
  console.log(`   - ${mockUsers.length} user profiles`)
}


