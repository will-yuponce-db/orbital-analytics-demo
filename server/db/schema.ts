import Database from 'better-sqlite3'

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    -- Scenarios table
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      data_quality TEXT NOT NULL,
      created_at TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      satellite_count INTEGER NOT NULL,
      ai_decision_status TEXT NOT NULL,
      tags TEXT NOT NULL
    );

    -- Satellites table
    CREATE TABLE IF NOT EXISTS satellites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      norad_id TEXT NOT NULL,
      category TEXT NOT NULL,
      semi_major_axis REAL NOT NULL,
      eccentricity REAL NOT NULL,
      inclination REAL NOT NULL,
      raan REAL NOT NULL,
      arg_of_perigee REAL NOT NULL,
      true_anomaly REAL NOT NULL,
      altitude REAL NOT NULL,
      velocity REAL NOT NULL,
      selected INTEGER DEFAULT 0
    );

    -- Scenario Satellites junction table
    CREATE TABLE IF NOT EXISTS scenario_satellites (
      scenario_id TEXT NOT NULL,
      satellite_id TEXT NOT NULL,
      PRIMARY KEY (scenario_id, satellite_id),
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
      FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      satellite_ids TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    -- AI Recommendations table
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      priority TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      affected_sensors TEXT,
      related_event_id TEXT,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    -- Telemetry Data table
    CREATE TABLE IF NOT EXISTS telemetry_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id TEXT NOT NULL,
      satellite_id TEXT NOT NULL,
      parameter TEXT NOT NULL,
      value TEXT NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
      FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
    );

    -- Threat Objects table
    CREATE TABLE IF NOT EXISTS threat_objects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      norad_id TEXT NOT NULL,
      category TEXT NOT NULL,
      semi_major_axis REAL NOT NULL,
      eccentricity REAL NOT NULL,
      inclination REAL NOT NULL,
      raan REAL NOT NULL,
      arg_of_perigee REAL NOT NULL,
      true_anomaly REAL NOT NULL,
      altitude REAL NOT NULL,
      velocity REAL NOT NULL,
      selected INTEGER DEFAULT 0,
      threat_type TEXT NOT NULL,
      threat_level TEXT NOT NULL,
      country_of_origin TEXT NOT NULL,
      first_detected TEXT NOT NULL,
      behavior_profile TEXT NOT NULL,
      targeted_assets TEXT
    );

    -- Maneuver History table
    CREATE TABLE IF NOT EXISTS maneuver_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      threat_object_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      delta_v REAL NOT NULL,
      description TEXT NOT NULL,
      assessed TEXT NOT NULL,
      FOREIGN KEY (threat_object_id) REFERENCES threat_objects(id) ON DELETE CASCADE
    );

    -- Threat Capabilities table
    CREATE TABLE IF NOT EXISTS threat_capabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      threat_object_id TEXT NOT NULL,
      type TEXT NOT NULL,
      detection_confidence INTEGER NOT NULL,
      effective_range REAL,
      last_observed TEXT NOT NULL,
      FOREIGN KEY (threat_object_id) REFERENCES threat_objects(id) ON DELETE CASCADE
    );

    -- EW Threats table
    CREATE TABLE IF NOT EXISTS ew_threats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      affected_frequencies TEXT NOT NULL,
      affected_satellites TEXT NOT NULL,
      source_latitude REAL,
      source_longitude REAL,
      ground_station TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      severity TEXT NOT NULL,
      classification_level TEXT NOT NULL,
      classification_caveats TEXT,
      classification_sci_controls TEXT
    );

    -- C2 Alerts table
    CREATE TABLE IF NOT EXISTS c2_alerts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_assets TEXT NOT NULL,
      recommended_actions TEXT NOT NULL,
      dissemination_list TEXT NOT NULL,
      classification_level TEXT NOT NULL,
      classification_caveats TEXT,
      classification_sci_controls TEXT,
      acknowledged_by TEXT,
      resolved_at TEXT
    );

    -- SSN Data Sources table
    CREATE TABLE IF NOT EXISTS ssn_data_sources (
      sensor_id TEXT PRIMARY KEY,
      sensor_name TEXT NOT NULL,
      sensor_type TEXT NOT NULL,
      location TEXT NOT NULL,
      last_contact TEXT NOT NULL,
      data_quality INTEGER NOT NULL,
      tracking_objects INTEGER NOT NULL
    );

    -- User Profiles table
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      rank TEXT,
      unit TEXT NOT NULL,
      role TEXT NOT NULL,
      clearance_level TEXT NOT NULL,
      sci_access TEXT NOT NULL,
      last_login TEXT NOT NULL,
      need_to_know TEXT NOT NULL
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_scenarios_data_quality ON scenarios(data_quality);
    CREATE INDEX IF NOT EXISTS idx_scenarios_ai_decision_status ON scenarios(ai_decision_status);
    CREATE INDEX IF NOT EXISTS idx_events_scenario_id ON events(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_ai_recommendations_scenario_id ON ai_recommendations(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_scenario_id ON telemetry_data(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_c2_alerts_priority ON c2_alerts(priority);
    CREATE INDEX IF NOT EXISTS idx_threat_objects_threat_level ON threat_objects(threat_level);
  `)

  return db
}


