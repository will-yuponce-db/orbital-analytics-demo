import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { initializeDatabase } from './db/schema.js'
import { seedDatabase } from './db/seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Initialize database
const dbPath = path.join(__dirname, 'satellite.db')
const db = initializeDatabase(dbPath)

// Seed database if empty
const scenarioCount = db.prepare('SELECT COUNT(*) as count FROM scenarios').get() as { count: number }
if (scenarioCount.count === 0) {
  console.log('🌱 Seeding database...')
  seedDatabase(db)
}

// Middleware
app.use(cors())
app.use(express.json())

// Helper function to parse JSON fields
function parseJsonFields(obj: any, fields: string[]) {
  const result = { ...obj }
  fields.forEach(field => {
    if (result[field]) {
      try {
        result[field] = JSON.parse(result[field])
      } catch (e) {
        // Leave as is if not valid JSON
      }
    }
  })
  return result
}

// Helper function to convert snake_case to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      result[camelKey] = toCamelCase(obj[key])
      return result
    }, {} as any)
  }
  return obj
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Get all scenarios
app.get('/api/scenarios', (req, res) => {
  try {
    const scenarios = db.prepare('SELECT * FROM scenarios').all()
    
    const scenariosWithData = scenarios.map((scenario: any) => {
      // Get satellites for this scenario
      const satellites = db.prepare(`
        SELECT s.* FROM satellites s
        JOIN scenario_satellites ss ON s.id = ss.satellite_id
        WHERE ss.scenario_id = ?
      `).all(scenario.id)

      // Get events
      const events = db.prepare('SELECT * FROM events WHERE scenario_id = ?').all(scenario.id)

      // Get AI recommendations
      const aiRecommendations = db.prepare('SELECT * FROM ai_recommendations WHERE scenario_id = ?').all(scenario.id)

      // Get telemetry data
      const telemetryData = db.prepare('SELECT * FROM telemetry_data WHERE scenario_id = ?').all(scenario.id)

      return {
        ...scenario,
        tags: JSON.parse(scenario.tags),
        satellites: satellites.map((sat: any) => ({
          ...sat,
          selected: sat.selected === 1,
          orbitalParams: {
            semiMajorAxis: sat.semi_major_axis,
            eccentricity: sat.eccentricity,
            inclination: sat.inclination,
            raan: sat.raan,
            argOfPerigee: sat.arg_of_perigee,
            trueAnomaly: sat.true_anomaly,
          },
        })),
        events: events.map((e: any) => ({
          ...e,
          satelliteIds: JSON.parse(e.satellite_ids),
        })),
        aiRecommendations: aiRecommendations.map((r: any) => ({
          ...r,
          affectedSensors: r.affected_sensors ? JSON.parse(r.affected_sensors) : undefined,
          relatedEventId: r.related_event_id,
        })),
        telemetryData: telemetryData.length > 0 ? telemetryData : undefined,
      }
    })

    res.json(toCamelCase(scenariosWithData))
  } catch (error) {
    console.error('Error fetching scenarios:', error)
    res.status(500).json({ error: 'Failed to fetch scenarios' })
  }
})

// Get single scenario by ID
app.get('/api/scenarios/:id', (req, res) => {
  try {
    const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id) as any

    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }

    // Get satellites
    const satellites = db.prepare(`
      SELECT s.* FROM satellites s
      JOIN scenario_satellites ss ON s.id = ss.satellite_id
      WHERE ss.scenario_id = ?
    `).all(scenario.id)

    // Get events
    const events = db.prepare('SELECT * FROM events WHERE scenario_id = ?').all(scenario.id)

    // Get AI recommendations
    const aiRecommendations = db.prepare('SELECT * FROM ai_recommendations WHERE scenario_id = ?').all(scenario.id)

    // Get telemetry data
    const telemetryData = db.prepare('SELECT * FROM telemetry_data WHERE scenario_id = ?').all(scenario.id)

    const result = {
      ...scenario,
      tags: JSON.parse(scenario.tags),
      satellites: satellites.map((sat: any) => ({
        ...sat,
        selected: sat.selected === 1,
        orbitalParams: {
          semiMajorAxis: sat.semi_major_axis,
          eccentricity: sat.eccentricity,
          inclination: sat.inclination,
          raan: sat.raan,
          argOfPerigee: sat.arg_of_perigee,
          trueAnomaly: sat.true_anomaly,
        },
      })),
      events: events.map((e: any) => ({
        ...e,
        satelliteIds: JSON.parse(e.satellite_ids),
      })),
      aiRecommendations: aiRecommendations.map((r: any) => ({
        ...r,
        affectedSensors: r.affected_sensors ? JSON.parse(r.affected_sensors) : undefined,
        relatedEventId: r.related_event_id,
      })),
      telemetryData: telemetryData.length > 0 ? telemetryData : undefined,
    }

    res.json(toCamelCase(result))
  } catch (error) {
    console.error('Error fetching scenario:', error)
    res.status(500).json({ error: 'Failed to fetch scenario' })
  }
})

// Get threat objects
app.get('/api/threats', (req, res) => {
  try {
    const threats = db.prepare('SELECT * FROM threat_objects').all()

    const threatsWithData = threats.map((threat: any) => {
      const maneuverHistory = db.prepare('SELECT * FROM maneuver_history WHERE threat_object_id = ?').all(threat.id)
      const capabilities = db.prepare('SELECT * FROM threat_capabilities WHERE threat_object_id = ?').all(threat.id)

      return {
        ...threat,
        selected: threat.selected === 1,
        orbitalParams: {
          semiMajorAxis: threat.semi_major_axis,
          eccentricity: threat.eccentricity,
          inclination: threat.inclination,
          raan: threat.raan,
          argOfPerigee: threat.arg_of_perigee,
          trueAnomaly: threat.true_anomaly,
        },
        maneuverHistory: maneuverHistory.map((m: any) => ({
          timestamp: m.timestamp,
          deltaV: m.delta_v,
          description: m.description,
          assessed: m.assessed,
        })),
        capabilities: capabilities.map((c: any) => ({
          type: c.type,
          detectionConfidence: c.detection_confidence,
          effectiveRange: c.effective_range,
          lastObserved: c.last_observed,
        })),
        targetedAssets: threat.targeted_assets ? JSON.parse(threat.targeted_assets) : [],
      }
    })

    res.json(toCamelCase(threatsWithData))
  } catch (error) {
    console.error('Error fetching threats:', error)
    res.status(500).json({ error: 'Failed to fetch threats' })
  }
})

// Get EW threats
app.get('/api/ew-threats', (req, res) => {
  try {
    const threats = db.prepare('SELECT * FROM ew_threats').all()
    const threatsWithParsedFields = threats.map((t: any) => ({
      ...t,
      affectedFrequencies: JSON.parse(t.affected_frequencies),
      affectedSatellites: JSON.parse(t.affected_satellites),
      sourceLocation: t.source_latitude && t.source_longitude ? {
        latitude: t.source_latitude,
        longitude: t.source_longitude,
        groundStation: t.ground_station,
      } : undefined,
      classification: {
        level: t.classification_level,
        caveats: t.classification_caveats ? JSON.parse(t.classification_caveats) : undefined,
        sciControls: t.classification_sci_controls ? JSON.parse(t.classification_sci_controls) : undefined,
      },
    }))

    res.json(toCamelCase(threatsWithParsedFields))
  } catch (error) {
    console.error('Error fetching EW threats:', error)
    res.status(500).json({ error: 'Failed to fetch EW threats' })
  }
})

// Get C2 alerts
app.get('/api/c2-alerts', (req, res) => {
  try {
    const alerts = db.prepare('SELECT * FROM c2_alerts').all()
    const alertsWithParsedFields = alerts.map((a: any) => ({
      ...a,
      affectedAssets: JSON.parse(a.affected_assets),
      recommendedActions: JSON.parse(a.recommended_actions),
      disseminationList: JSON.parse(a.dissemination_list),
      classification: {
        level: a.classification_level,
        caveats: a.classification_caveats ? JSON.parse(a.classification_caveats) : undefined,
        sciControls: a.classification_sci_controls ? JSON.parse(a.classification_sci_controls) : undefined,
      },
      acknowledgedBy: a.acknowledged_by ? JSON.parse(a.acknowledged_by) : undefined,
    }))

    res.json(toCamelCase(alertsWithParsedFields))
  } catch (error) {
    console.error('Error fetching C2 alerts:', error)
    res.status(500).json({ error: 'Failed to fetch C2 alerts' })
  }
})

// Get SSN data sources
app.get('/api/ssn-sources', (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM ssn_data_sources').all()
    res.json(toCamelCase(sources))
  } catch (error) {
    console.error('Error fetching SSN sources:', error)
    res.status(500).json({ error: 'Failed to fetch SSN sources' })
  }
})

// Get user profiles
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM user_profiles').all()
    const usersWithParsedFields = users.map((u: any) => ({
      ...u,
      sciAccess: JSON.parse(u.sci_access),
      needToKnow: JSON.parse(u.need_to_know),
    }))

    res.json(toCamelCase(usersWithParsedFields))
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../../dist')))

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 API available at http://localhost:${PORT}/api`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  db.close()
  process.exit(0)
})

