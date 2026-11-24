-- OrbitWatch: Lakebase PostgreSQL Schema
-- Database: orbitwatch (fe-shared-demo workspace)

-- Satellite catalog
CREATE TABLE IF NOT EXISTS satellites (
    id SERIAL PRIMARY KEY,
    norad_id VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    operator VARCHAR(100),
    constellation VARCHAR(50),
    category VARCHAR(20) CHECK (category IN ('active','debris','rocket-body')),
    rcs_size VARCHAR(10),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Orbital elements (latest epoch per satellite)
CREATE TABLE IF NOT EXISTS orbital_elements (
    id SERIAL PRIMARY KEY,
    satellite_id INT REFERENCES satellites(id) ON DELETE CASCADE,
    epoch TIMESTAMP NOT NULL,
    semi_major_axis FLOAT,
    eccentricity FLOAT CHECK (eccentricity >= 0 AND eccentricity < 1),
    inclination FLOAT CHECK (inclination >= 0 AND inclination <= 180),
    raan FLOAT,
    arg_of_perigee FLOAT,
    mean_anomaly FLOAT,
    mean_motion FLOAT,
    bstar FLOAT,
    altitude_km FLOAT,
    velocity_kms FLOAT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (satellite_id, epoch)
);

-- Conjunction events (from DLT Gold pipeline)
CREATE TABLE IF NOT EXISTS conjunction_events (
    id SERIAL PRIMARY KEY,
    cdm_id VARCHAR(50) UNIQUE,
    satellite_a_id INT REFERENCES satellites(id),
    satellite_b_id INT REFERENCES satellites(id),
    tca TIMESTAMP NOT NULL,
    miss_distance_km FLOAT NOT NULL,
    raw_pc FLOAT CHECK (raw_pc >= 0 AND raw_pc <= 1),
    ml_pc FLOAT CHECK (ml_pc >= 0 AND ml_pc <= 1),
    risk_tier VARCHAR(10) CHECK (risk_tier IN ('green','amber','red')),
    maneuver_recommended BOOLEAN DEFAULT FALSE,
    maneuver_window_open TIMESTAMP,
    maneuver_window_close TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','resolved','maneuvered')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    conjunction_id INT REFERENCES conjunction_events(id) ON DELETE CASCADE,
    type VARCHAR(30) CHECK (type IN ('collision-avoidance','conjunction-monitoring','orbital-adjustment','re-entry-watch')),
    priority VARCHAR(10) CHECK (priority IN ('high','medium','low')),
    description TEXT NOT NULL,
    confidence INT CHECK (confidence BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Maneuver plans
CREATE TABLE IF NOT EXISTS maneuver_plans (
    id SERIAL PRIMARY KEY,
    conjunction_id INT REFERENCES conjunction_events(id),
    satellite_id INT REFERENCES satellites(id),
    delta_v_ms FLOAT NOT NULL,
    execution_time TIMESTAMP NOT NULL,
    fuel_cost_kg FLOAT,
    post_maneuver_pc FLOAT,
    maneuver_type VARCHAR(30) CHECK (maneuver_type IN ('radial','in-track','cross-track','hohmann')),
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned','approved','executed','cancelled')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tracking network sensors
CREATE TABLE IF NOT EXISTS tracking_network (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(30) UNIQUE,
    sensor_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(20) CHECK (sensor_type IN ('radar','optical','space-based')),
    location VARCHAR(100),
    last_contact TIMESTAMP DEFAULT NOW(),
    data_quality INT CHECK (data_quality BETWEEN 0 AND 100),
    tracking_objects INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_conjunctions_tca ON conjunction_events(tca);
CREATE INDEX IF NOT EXISTS idx_conjunctions_ml_pc ON conjunction_events(ml_pc DESC);
CREATE INDEX IF NOT EXISTS idx_conjunctions_status ON conjunction_events(status);
CREATE INDEX IF NOT EXISTS idx_orbital_elements_satellite ON orbital_elements(satellite_id);
CREATE INDEX IF NOT EXISTS idx_ai_recs_conjunction ON ai_recommendations(conjunction_id);


-- Anomaly events (orbital-element deviations)
CREATE TABLE IF NOT EXISTS anomaly_events (
    id SERIAL PRIMARY KEY,
    norad_id VARCHAR(10) NOT NULL,
    satellite_name VARCHAR(100) NOT NULL,
    anomaly_type VARCHAR(30) NOT NULL,
    severity VARCHAR(10) CHECK (severity IN ('low','medium','high','critical')),
    detected_at TIMESTAMP NOT NULL,
    parameter_name VARCHAR(50),
    expected_value FLOAT,
    observed_value FLOAT,
    deviation_sigma FLOAT,
    anomaly_score FLOAT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','investigating','resolved')),
    created_at TIMESTAMP DEFAULT NOW()
);
