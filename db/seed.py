#!/usr/bin/env python3
"""
OrbitWatch: Lakebase seed script.
Bootstraps the orbitwatch database with realistic demo data.

Usage:
  PGPASSWORD=<token> python db/seed.py

Requires: psycopg2-binary
  pip install psycopg2-binary
"""

import os
import sys
import psycopg2
from datetime import datetime, timedelta

# Connection config (same as Express backend)
DB_CONFIG = {
    "host": os.environ.get("LAKEBASE_HOST", ""),
    "port": 5432,
    "dbname": os.environ.get("LAKEBASE_DB", "orbitwatch"),
    "user": os.environ.get("LAKEBASE_USER", "will.yuponce@databricks.com"),
    "password": os.environ.get("PGPASSWORD", ""),
    "sslmode": "require",
}

NOW = datetime.utcnow()
# Timestamp-based CDM IDs to avoid conflicts with stale data
CDM_PREFIX = NOW.strftime("CDM-%Y%m%d%H%M")

def seed(conn):
    cur = conn.cursor()

    # Clear stale data (order matters for FK constraints)
    print("Clearing stale data...")
    cur.execute("DELETE FROM ai_recommendations")
    cur.execute("DELETE FROM maneuver_plans")
    cur.execute("DELETE FROM conjunction_events")
    cur.execute("DELETE FROM orbital_elements")
    cur.execute("DELETE FROM tracking_network")
    try:
        cur.execute("DELETE FROM anomaly_events")
    except Exception:
        conn.rollback()
        # Table may not exist yet — create it
        cur.execute("""
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
            )
        """)
    cur.execute("DELETE FROM satellites")

    print("Seeding satellites...")
    satellites = [
        ("25544",  "ISS (ZARYA)",      "NASA/Roscosmos", "iss",      "active",      "LARGE"),
        ("45678",  "STARLINK-1234",    "SpaceX",         "starlink", "active",      "SMALL"),
        ("73001",  "ONEWEB-0082",      "OneWeb",         "oneweb",   "active",      "SMALL"),
        ("47890",  "FALCON 9 R/B",     None,             None,       "rocket-body", "LARGE"),
        ("33456",  "COSMOS 2251 DEB",  None,             None,       "debris",      "SMALL"),
        ("24793",  "IRIDIUM-91",       "Iridium",        "iridium",  "active",      "MEDIUM"),
        ("43641",  "SL-8 DEB",         None,             None,       "debris",      "SMALL"),
        ("38858",  "CZ-4C DEB",        None,             None,       "debris",      "SMALL"),
    ]
    sat_ids = {}
    for norad, name, operator, constellation, category, rcs in satellites:
        cur.execute("""
            INSERT INTO satellites (norad_id, name, operator, constellation, category, rcs_size)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (norad_id) DO UPDATE SET name=EXCLUDED.name, operator=EXCLUDED.operator
            RETURNING id
        """, (norad, name, operator, constellation, category, rcs))
        sat_ids[norad] = cur.fetchone()[0]

    print("Seeding orbital elements...")
    orbital_data = [
        # (norad_id, semi_major_axis, eccentricity, inclination, raan, arg_of_perigee, mean_anomaly, mean_motion, bstar, altitude_km, velocity_kms)
        ("25544", 6793, 0.0001, 51.64, 125.4, 45.2, 180.0, 15.489, 0.000035, 415, 7.66),
        ("45678", 6921, 0.0002, 53.0,  234.5, 67.8, 90.0,  15.06,  0.000022, 550, 7.59),
        ("73001", 6921, 0.0001, 87.9,  301.2, 12.3, 45.0,  15.06,  0.000018, 550, 7.59),
        ("47890", 6878, 0.0008, 28.5,  156.7, 123.4, 270.0, 15.14, 0.000041, 500, 7.61),
        ("33456", 7170, 0.015,  74.2,  87.3,  234.1, 45.0,  14.48,  0.000089, 790, 7.45),
        ("24793", 7159, 0.0001, 86.4,  45.6,  89.1,  180.0, 14.50, 0.000012, 781, 7.46),
        ("43641", 7171, 0.012,  82.9,  198.4, 45.0,  90.0,  14.48,  0.000076, 800, 7.45),
        ("38858", 6980, 0.003,  97.8,  112.3, 67.4,  135.0, 14.91, 0.000054, 602, 7.55),
    ]
    for norad, sma, ecc, inc, raan, aop, ma, mm, bstar, alt, vel in orbital_data:
        cur.execute("""
            INSERT INTO orbital_elements
            (satellite_id, epoch, semi_major_axis, eccentricity, inclination, raan,
             arg_of_perigee, mean_anomaly, mean_motion, bstar, altitude_km, velocity_kms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (satellite_id, epoch) DO NOTHING
        """, (sat_ids[norad], NOW, sma, ecc, inc, raan, aop, ma, mm, bstar, alt, vel))

    print("Seeding conjunction events...")
    conjunctions = [
        # (cdm_suffix, sat_a_norad, sat_b_norad, tca_offset_hours, miss_dist, raw_pc, ml_pc, risk_tier, maneuver_rec)
        ("-001", "45678", "33456", 14,  0.285, 0.0021, 0.0024, "red",   True),
        ("-002", "73001", "47890", 48,  0.812, 0.0004, 0.00045,"amber", True),
        ("-003", "24793", "43641", 96,  1.243, 0.0001, 0.00012,"amber", True),
        ("-004", "25544", "38858", 144, 4.512, 0.00003,0.000032,"green",False),
        # Additional events for a richer timeline
        ("-005", "45678", "43641", 6,   0.142, 0.0035, 0.0041, "red",   True),
        ("-006", "73001", "33456", 24,  0.621, 0.0008, 0.00092,"amber", True),
        ("-007", "25544", "47890", 72,  2.180, 0.00008,0.00009,"green", False),
        # Past events (for timeline depth)
        ("-008", "24793", "38858", -12, 0.891, 0.0005, 0.00058,"amber", True),
        ("-009", "45678", "47890", -36, 1.456, 0.00015,0.00018,"amber", False),
    ]
    conj_ids = {}
    for cdm_suffix, sat_a, sat_b, tca_hrs, miss, raw_pc, ml_pc, tier, maneuver in conjunctions:
        cdm_id = CDM_PREFIX + cdm_suffix
        tca = NOW + timedelta(hours=tca_hrs)
        cur.execute("""
            INSERT INTO conjunction_events
            (cdm_id, satellite_a_id, satellite_b_id, tca, miss_distance_km,
             raw_pc, ml_pc, risk_tier, maneuver_recommended,
             maneuver_window_open, maneuver_window_close, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            ON CONFLICT (cdm_id) DO UPDATE SET
                tca=EXCLUDED.tca, ml_pc=EXCLUDED.ml_pc, risk_tier=EXCLUDED.risk_tier,
                miss_distance_km=EXCLUDED.miss_distance_km, updated_at=NOW()
            RETURNING id
        """, (cdm_id, sat_ids[sat_a], sat_ids[sat_b], tca, miss, raw_pc, ml_pc, tier, maneuver,
              tca - timedelta(hours=48), tca - timedelta(hours=6)))
        conj_ids[cdm_id] = cur.fetchone()[0]

    print("Seeding AI recommendations...")
    rec_suffix_001 = CDM_PREFIX + "-001"
    rec_suffix_002 = CDM_PREFIX + "-002"
    rec_suffix_003 = CDM_PREFIX + "-003"
    rec_suffix_004 = CDM_PREFIX + "-004"
    rec_suffix_005 = CDM_PREFIX + "-005"
    rec_suffix_006 = CDM_PREFIX + "-006"
    recommendations = [
        (rec_suffix_001, "collision-avoidance", "high",
         "Execute in-track maneuver of +0.42 m/s within the next 8 hours. Post-maneuver Pc reduces to 3.2x10^-6. Maneuver window closes T-6h before TCA.", 94),
        (rec_suffix_001, "conjunction-monitoring", "medium",
         "Continue 15-minute orbital updates for STARLINK-1234 via LEO Radar Network (Alaska). Covariance uncertainty decreasing as TCA approaches.", 87),
        (rec_suffix_005, "collision-avoidance", "high",
         "CRITICAL: STARLINK-1234 and SL-8 DEB close approach at 142m. Immediate maneuver assessment required. Recommend +0.55 m/s in-track burn.", 96),
        (rec_suffix_002, "collision-avoidance", "high",
         "Recommended: cross-track maneuver of +0.18 m/s. Alternative: coordinate with launch provider for FALCON 9 R/B disposal trajectory update.", 81),
        (rec_suffix_006, "conjunction-monitoring", "medium",
         "ONEWEB-0082 approaching COSMOS 2251 DEB. Pc elevated. Increase observation cadence to 10-minute intervals.", 78),
        (rec_suffix_003, "conjunction-monitoring", "medium",
         "Pc trending downward as new TLE epochs reduce orbital uncertainty. Continue monitoring -- maneuver threshold (Pc > 1x10^-4) has been crossed.", 76),
        (rec_suffix_004, "re-entry-watch", "low",
         "CZ-4C debris object in natural decay trajectory. No maneuver required. Monitor re-entry window: estimated 12-18 months.", 92),
    ]
    for cdm_id, rec_type, priority, description, confidence in recommendations:
        if cdm_id in conj_ids:
            cur.execute("""
                INSERT INTO ai_recommendations (conjunction_id, type, priority, description, confidence)
                VALUES (%s, %s, %s, %s, %s)
            """, (conj_ids[cdm_id], rec_type, priority, description, confidence))

    print("Seeding anomaly events...")
    anomalies = [
        # (norad_id, sat_name, anomaly_type, severity, hours_ago, param, expected, observed, sigma, score, description, status)
        ("73001", "ONEWEB-0082", "altitude-drop", "high", 6,
         "altitude_km", 550.0, 546.2, 3.2, 0.87,
         "Unexpected altitude decrease of 3.8 km detected over 2 orbits. Possible atmospheric drag increase or unplanned thruster firing.",
         "active"),
        ("45678", "STARLINK-1234", "velocity-spike", "medium", 18,
         "velocity_kms", 7.59, 7.62, 2.1, 0.72,
         "Velocity anomaly detected: +30 m/s deviation from predicted ephemeris. Likely station-keeping maneuver not in schedule.",
         "investigating"),
        ("33456", "COSMOS 2251 DEB", "orbital-decay", "critical", 3,
         "semi_major_axis", 7170.0, 7162.5, 4.1, 0.94,
         "Accelerated orbital decay detected. Semi-major axis decreasing 2.3x faster than predicted. Re-entry timeline may need revision.",
         "active"),
        ("25544", "ISS (ZARYA)", "inclination-drift", "low", 48,
         "inclination", 51.64, 51.68, 1.4, 0.45,
         "Minor inclination drift of 0.04 deg. Within operational tolerance. Monitor for sustained trend.",
         "resolved"),
        ("47890", "FALCON 9 R/B", "eccentricity-change", "medium", 10,
         "eccentricity", 0.0008, 0.0015, 2.8, 0.78,
         "Eccentricity increased from 0.0008 to 0.0015 over 24h. Possible debris interaction or gravitational perturbation.",
         "active"),
        ("24793", "IRIDIUM-91", "velocity-spike", "high", 1,
         "velocity_kms", 7.46, 7.49, 3.5, 0.89,
         "Sudden velocity increase detected. Unscheduled maneuver suspected. Cross-referencing with operator notification database.",
         "investigating"),
    ]
    for norad, sat_name, atype, severity, hours_ago, param, expected, observed, sigma, score, desc, status in anomalies:
        detected = NOW - timedelta(hours=hours_ago)
        cur.execute("""
            INSERT INTO anomaly_events
            (norad_id, satellite_name, anomaly_type, severity, detected_at,
             parameter_name, expected_value, observed_value, deviation_sigma,
             anomaly_score, description, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (norad, sat_name, atype, severity, detected,
              param, expected, observed, sigma, score, desc, status))

    print("Seeding tracking network...")
    sensors = [
        ("LEO-RADAR-AK",  "LEO Radar Network (Alaska)",            "radar",      "Fairbanks, Alaska",          98, 3842),
        ("POLAR-RADAR-NO","Polar Radar Array (Scandinavia)",        "radar",      "Tromso, Norway",             94, 1256),
        ("OPT-HI",        "Optical Network (Hawaii)",               "optical",    "Mauna Kea, Hawaii",          91, 678),
        ("OPT-NM",        "Optical Network (New Mexico)",           "optical",    "Socorro, New Mexico",        85, 523),
        ("SPACE-BASED-1", "Space-Based Sensor (LEO)",               "space-based","LEO Orbit, 630 km",          96, 2145),
        ("RADAR-AU",      "Southern Hemisphere Radar (Australia)",  "radar",      "Alice Springs, Australia",   88, 892),
        ("SBAND-AK",      "S-Band Tracking Array (Alaska)",         "radar",      "Clear, Alaska",              89, 1456),
        ("OPT-IO",        "Equatorial Optical Array (Indian Ocean)","optical",    "Diego Garcia",               88, 542),
        ("CBAND-PAC",     "C-Band Tracking (Pacific)",              "radar",      "Kwajalein Atoll",            93, 1189),
    ]
    for sensor_id, name, stype, loc, quality, objects in sensors:
        cur.execute("""
            INSERT INTO tracking_network (sensor_id, sensor_name, sensor_type, location, data_quality, tracking_objects)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (sensor_id) DO UPDATE
            SET data_quality=EXCLUDED.data_quality, tracking_objects=EXCLUDED.tracking_objects,
                last_contact=NOW()
        """, (sensor_id, name, stype, loc, quality, objects))

    conn.commit()
    cur.close()
    print(f"Seed complete! CDM prefix: {CDM_PREFIX}")
    print(f"  Satellites: {len(satellites)}")
    print(f"  Conjunctions: {len(conjunctions)}")
    print(f"  Anomalies: {len(anomalies)}")
    print(f"  Recommendations: {len(recommendations)}")

if __name__ == "__main__":
    if not DB_CONFIG["host"]:
        print("ERROR: Set LAKEBASE_HOST environment variable")
        sys.exit(1)

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        seed(conn)
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
