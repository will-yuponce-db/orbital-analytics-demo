#!/usr/bin/env python3
"""
OrbitWatch reverse-ETL: load REAL Space-Track-derived data from the Unity
Catalog gold/silver tables into the Lakebase tables the app reads.

Replaces the synthetic rows written by db/seed.py with the real catalog data:
  silver_satellites               -> satellites, orbital_elements
  gold_conjunction_event_latest   -> conjunction_events (one row per physical
                                     event: latest CDM + update count + Pc history;
                                     falls back to gold_conjunction_events)
  orbitwatch_ml.conjunction_predictions -> conjunction_events.ml_pc, ml_predictions
  orbitwatch_ml.model_summary           -> ml_model_summary

Catalog reads go through the SQL warehouse statement API; Lakebase writes go
through psycopg2. It runs two ways:

  From a laptop (Databricks CLI for SQL, token passed in):
    PGPASSWORD=<lakebase-token> LAKEBASE_HOST=<host> \
    WAREHOUSE_ID=<id> DATABRICKS_PROFILE=<profile> CATALOG=<catalog> python db/reverse_etl.py

  As a Databricks job task (Databricks SDK for SQL, Lakebase host, and an OAuth
  credential for the job's run-as identity):
    python db/reverse_etl.py --catalog <catalog> --warehouse-id <id> \
      --endpoint projects/<project>/branches/<branch>/endpoints/<endpoint>
"""

import argparse
import os
import json
import subprocess
import time
import psycopg2

def _parse_args():
    ap = argparse.ArgumentParser(description="Load OrbitWatch catalog tables into Lakebase")
    ap.add_argument("--catalog", default=os.environ.get("CATALOG", "will_wy_demo_catalog"))
    ap.add_argument("--warehouse-id", default=os.environ.get("WAREHOUSE_ID"))
    ap.add_argument("--endpoint", default=os.environ.get(
        "LAKEBASE_ENDPOINT", "projects/orbitwatch/branches/production/endpoints/primary"))
    ap.add_argument("--database", default=os.environ.get("LAKEBASE_DB", "orbitwatch"))
    ap.add_argument("--use-sdk", action="store_true",
                    help="use the Databricks SDK for SQL and Lakebase credentials (job mode)")
    args, _ = ap.parse_known_args()
    if not args.warehouse_id:
        ap.error("--warehouse-id (or WAREHOUSE_ID) is required")
    return args


ARGS = _parse_args()
IN_DATABRICKS = ARGS.use_sdk or "DATABRICKS_RUNTIME_VERSION" in os.environ
PROFILE = os.environ.get("DATABRICKS_PROFILE", "fevm-will-wy-demo")
WAREHOUSE_ID = ARGS.warehouse_id
CATALOG = ARGS.catalog
DLT_SCHEMA = os.environ.get("DLT_SCHEMA", "orbitwatch_dlt")
ML_SCHEMA = os.environ.get("ML_SCHEMA", "orbitwatch_ml")
EVENT_VIEW = "gold_conjunction_event_latest"

_WS = None


def ws():
    """Databricks SDK client (only used when running on Databricks)."""
    global _WS
    if _WS is None:
        from databricks.sdk import WorkspaceClient
        _WS = WorkspaceClient()
    return _WS

# Columns added after the original schema (idempotent; safe on every run).
CONJ_DDL = """
ALTER TABLE conjunction_events
  ADD COLUMN IF NOT EXISTS miss_distance_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS cdm_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_pc DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS max_pc DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pc_history JSONB,
  ADD COLUMN IF NOT EXISTS cdm_created_at TIMESTAMP
"""

def pg_config():
    """Lakebase connection settings for whichever way the script is running."""
    if IN_DATABRICKS:
        w = ws()
        endpoint = w.postgres.get_endpoint(name=ARGS.endpoint)
        cred = w.postgres.generate_database_credential(endpoint=ARGS.endpoint)
        return {
            "host": endpoint.status.hosts.host, "port": 5432, "dbname": ARGS.database,
            "user": w.current_user.me().user_name, "password": cred.token, "sslmode": "require",
        }
    return {
        "host": os.environ["LAKEBASE_HOST"],
        "port": 5432,
        "dbname": ARGS.database,
        "user": os.environ.get("LAKEBASE_USER", "will.yuponce@databricks.com"),
        "password": os.environ["PGPASSWORD"],
        "sslmode": "require",
    }


def _exec_sdk(statement):
    from databricks.sdk.service.sql import Disposition, Format, StatementState
    w = ws()
    r = w.statement_execution.execute_statement(
        warehouse_id=WAREHOUSE_ID, statement=statement, wait_timeout="50s",
        disposition=Disposition.INLINE, format=Format.JSON_ARRAY,
    )
    while r.status and r.status.state in (StatementState.PENDING, StatementState.RUNNING):
        time.sleep(2)
        r = w.statement_execution.get_statement(r.statement_id)
    if not r.status or r.status.state != StatementState.SUCCEEDED:
        raise RuntimeError(f"statement failed: {r.status}")
    meta = [(c.name, (c.type_name.value if c.type_name else "STRING").upper())
            for c in r.manifest.schema.columns]
    rows = (r.result.data_array if r.result and r.result.data_array else [])
    return meta, rows


def _exec(statement):
    """Execute a SQL statement on the warehouse; return ([(name, type)], rows)."""
    if IN_DATABRICKS:
        return _exec_sdk(statement)
    payload = {
        "warehouse_id": WAREHOUSE_ID,
        "statement": statement,
        "wait_timeout": "50s",
        "disposition": "INLINE",
        "format": "JSON_ARRAY",
    }
    out = subprocess.run(
        ["databricks", "api", "post", "/api/2.0/sql/statements",
         "--profile", PROFILE, "--json", json.dumps(payload)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(f"statement API failed: {out.stderr}")
    d = json.loads(out.stdout)
    state = d.get("status", {}).get("state")
    if state != "SUCCEEDED":
        raise RuntimeError(f"statement state {state}: {d.get('status')}")
    meta = [(c["name"], (c.get("type_name") or "STRING").upper())
            for c in d["manifest"]["schema"]["columns"]]
    rows = d.get("result", {}).get("data_array", []) or []
    return meta, rows


def run_sql(statement):
    """Execute a SQL statement on the warehouse and return list[dict] rows."""
    meta, rows = _exec(statement)
    cols = [n for n, _ in meta]
    return [dict(zip(cols, r)) for r in rows]


PG_TYPES = {
    "DOUBLE": "DOUBLE PRECISION", "FLOAT": "DOUBLE PRECISION", "DECIMAL": "DOUBLE PRECISION",
    "INT": "BIGINT", "INTEGER": "BIGINT", "BIGINT": "BIGINT", "LONG": "BIGINT",
    "SHORT": "BIGINT", "SMALLINT": "BIGINT", "TINYINT": "BIGINT", "BYTE": "BIGINT",
    "BOOLEAN": "BOOLEAN", "TIMESTAMP": "TIMESTAMP", "TIMESTAMP_NTZ": "TIMESTAMP",
    "DATE": "DATE",
}


def _pg_value(v, pg_type):
    if v is None:
        return None
    if pg_type == "DOUBLE PRECISION":
        return float(v)
    if pg_type == "BIGINT":
        return int(float(v))
    if pg_type == "BOOLEAN":
        return str(v).lower() in ("true", "1")
    if isinstance(v, (dict, list)):
        return json.dumps(v)
    return v


def copy_table(cur, uc_table, pg_table):
    """Replace a Lakebase table with a full copy of a Unity Catalog table.

    Lets the app serve ML results from Postgres, so it doesn't need a SQL
    warehouse round trip (or USE CATALOG on the source catalog) per request.
    """
    meta, rows = _exec(f"SELECT * FROM {uc_table}")
    types = [PG_TYPES.get(t.split("(")[0], "TEXT") for _, t in meta]
    cols_ddl = ", ".join(f'"{n}" {t}' for (n, _), t in zip(meta, types))
    cur.execute(f"DROP TABLE IF EXISTS {pg_table}")
    cur.execute(f"CREATE TABLE {pg_table} ({cols_ddl})")
    if rows:
        names = ", ".join(f'"{n}"' for n, _ in meta)
        ph = ", ".join(["%s"] * len(meta))
        cur.executemany(
            f"INSERT INTO {pg_table} ({names}) VALUES ({ph})",
            [tuple(_pg_value(v, t) for v, t in zip(r, types)) for r in rows],
        )
    return len(rows)


def table_exists(name_schema, name_table):
    try:
        run_sql(f"SELECT 1 FROM {CATALOG}.{name_schema}.{name_table} LIMIT 1")
        return True
    except Exception:
        return False


def f(v):
    return None if v is None else float(v)


def main():
    print("Reading catalog tables via SQL warehouse...")
    sats = run_sql(f"""
        SELECT norad_id, name, operator, category, rcs_size, epoch,
               semi_major_axis, eccentricity, inclination, raan, arg_of_perigee,
               mean_anomaly, mean_motion, bstar, altitude_km, velocity_kms,
               orbit_regime
        FROM {CATALOG}.{DLT_SCHEMA}.silver_satellites
    """)
    print(f"  silver_satellites: {len(sats)} rows")

    base_cols = """sat_1_norad_id, sat_2_norad_id, sat_1_name, sat_2_name,
               sat_1_operator, sat_2_operator, sat_1_type, sat_2_type,
               sat_1_rcs, sat_2_rcs, tca, miss_distance_km, pc, risk_tier,
               maneuver_recommended, maneuver_window_open, maneuver_window_close"""
    if table_exists(DLT_SCHEMA, EVENT_VIEW):
        # One row per physical conjunction: Space-Track sends several CDM
        # updates per event, and both A x B and B x A orderings.
        conjs = run_sql(f"""
            SELECT cdm_id, {base_cols}, miss_distance_m, event_key, cdm_count,
                   first_pc, max_pc, created_at AS cdm_created_at,
                   to_json(pc_history) AS pc_history_json
            FROM {CATALOG}.{DLT_SCHEMA}.{EVENT_VIEW}
        """)
        print(f"  {EVENT_VIEW}: {len(conjs)} events")
    else:
        conjs = run_sql(f"""
            SELECT cdm_id, {base_cols}, CAST(NULL AS DOUBLE) AS miss_distance_m,
                   CAST(NULL AS STRING) AS event_key, 1 AS cdm_count,
                   pc AS first_pc, pc AS max_pc, created_at AS cdm_created_at,
                   CAST(NULL AS STRING) AS pc_history_json
            FROM {CATALOG}.{DLT_SCHEMA}.gold_conjunction_events
        """)
        print(f"  gold_conjunction_events: {len(conjs)} rows (no event view yet)")

    # Optional ML predictions: map cdm_id -> ml_pc
    ml_by_cdm = {}
    if table_exists(ML_SCHEMA, "conjunction_predictions"):
        preds = run_sql(f"""
            SELECT cdm_id, ml_pc
            FROM {CATALOG}.{ML_SCHEMA}.conjunction_predictions
        """)
        for p in preds:
            if p.get("cdm_id") is not None:
                ml_by_cdm[p["cdm_id"]] = f(p.get("ml_pc"))
        print(f"  conjunction_predictions: {len(preds)} rows ({len(ml_by_cdm)} with cdm_id)")
    else:
        print("  conjunction_predictions: not present yet (ml_pc = raw pc)")

    conn = psycopg2.connect(**pg_config())
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute(CONJ_DDL)
        print("Clearing app tables...")
        for t in ("ai_recommendations", "maneuver_plans", "conjunction_events",
                  "orbital_elements", "tracking_network"):
            cur.execute(f"DELETE FROM {t}")
        try:
            cur.execute("DELETE FROM anomaly_events")
        except Exception:
            conn.rollback()
            cur = conn.cursor()
        cur.execute("DELETE FROM satellites")

        # Build a complete satellite set: silver_satellites + any norad referenced
        # by conjunctions that is missing (stub it so FK holds).
        sat_by_norad = {}
        for s in sats:
            sat_by_norad[str(s["norad_id"])] = s
        extra = {}
        for c in conjs:
            for side in ("1", "2"):
                nid = c.get(f"sat_{side}_norad_id")
                if nid is None:
                    continue
                nid = str(nid)
                if nid not in sat_by_norad and nid not in extra:
                    extra[nid] = {
                        "norad_id": nid,
                        "name": c.get(f"sat_{side}_name") or f"OBJ-{nid}",
                        "operator": c.get(f"sat_{side}_operator"),
                        "category": (c.get(f"sat_{side}_type") or "active"),
                        "rcs_size": c.get(f"sat_{side}_rcs"),
                    }

        def norm_cat(v):
            v = (v or "").lower()
            if "deb" in v:
                return "debris"
            if "rocket" in v or "r/b" in v or v == "rocket-body":
                return "rocket-body"
            return "active"

        print(f"Inserting satellites ({len(sat_by_norad)} catalog + {len(extra)} stub)...")
        norad_to_id = {}
        for nid, s in {**extra, **sat_by_norad}.items():
            cur.execute(
                """INSERT INTO satellites (norad_id, name, operator, constellation, category, rcs_size)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                (nid, (s.get("name") or f"OBJ-{nid}")[:100], s.get("operator"),
                 None, norm_cat(s.get("category")), s.get("rcs_size")),
            )
            norad_to_id[nid] = cur.fetchone()[0]

        print("Inserting orbital_elements...")
        oe = 0
        for s in sats:
            nid = str(s["norad_id"])
            sid = norad_to_id.get(nid)
            if sid is None or s.get("epoch") is None:
                continue
            ecc = f(s.get("eccentricity"))
            if ecc is not None:
                ecc = min(max(ecc, 0.0), 0.9999999)
            inc = f(s.get("inclination"))
            if inc is not None:
                inc = min(max(inc, 0.0), 180.0)
            cur.execute(
                """INSERT INTO orbital_elements
                   (satellite_id, epoch, semi_major_axis, eccentricity, inclination,
                    raan, arg_of_perigee, mean_anomaly, mean_motion, bstar,
                    altitude_km, velocity_kms)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (satellite_id, epoch) DO NOTHING""",
                (sid, s["epoch"], f(s.get("semi_major_axis")), ecc, inc,
                 f(s.get("raan")), f(s.get("arg_of_perigee")), f(s.get("mean_anomaly")),
                 f(s.get("mean_motion")), f(s.get("bstar")), f(s.get("altitude_km")),
                 f(s.get("velocity_kms"))),
            )
            oe += 1

        print("Inserting conjunction_events...")
        ce = 0
        for c in conjs:
            a = norad_to_id.get(str(c.get("sat_1_norad_id")))
            b = norad_to_id.get(str(c.get("sat_2_norad_id")))
            if a is None or b is None:
                continue
            raw_pc = f(c.get("pc"))
            ml_pc = ml_by_cdm.get(c.get("cdm_id"), raw_pc)
            rp = None if raw_pc is None else min(max(raw_pc, 0.0), 1.0)
            mp = None if ml_pc is None else min(max(ml_pc, 0.0), 1.0)
            tier = (c.get("risk_tier") or "green").lower()
            if tier not in ("green", "amber", "red"):
                tier = "green"
            mr = c.get("maneuver_recommended")
            mr = bool(mr) if mr is not None else False
            cnt = c.get("cdm_count")
            cur.execute(
                """INSERT INTO conjunction_events
                   (cdm_id, satellite_a_id, satellite_b_id, tca, miss_distance_km,
                    raw_pc, ml_pc, risk_tier, maneuver_recommended,
                    maneuver_window_open, maneuver_window_close, status,
                    miss_distance_m, event_key, cdm_count, first_pc, max_pc,
                    pc_history, cdm_created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',
                           %s,%s,%s,%s,%s,%s::jsonb,%s)
                   ON CONFLICT (cdm_id) DO NOTHING""",
                (c.get("cdm_id"), a, b, c.get("tca"), f(c.get("miss_distance_km")),
                 rp, mp, tier, mr,
                 c.get("maneuver_window_open"), c.get("maneuver_window_close"),
                 f(c.get("miss_distance_m")), c.get("event_key"),
                 int(float(cnt)) if cnt is not None else 1,
                 f(c.get("first_pc")), f(c.get("max_pc")),
                 c.get("pc_history_json"), c.get("cdm_created_at")),
            )
            ce += 1

        # ── Supporting panels (no real catalog source) ──────────────────────
        # SSN ground-sensor network: reference/context data.
        sensors = [
            ("LEO-RADAR-AK", "LEO Radar Network (Alaska)", "radar", "Fairbanks, Alaska", 98, 3842),
            ("POLAR-RADAR-NO", "Polar Radar Array (Scandinavia)", "radar", "Tromso, Norway", 94, 1256),
            ("OPT-HI", "Optical Network (Hawaii)", "optical", "Mauna Kea, Hawaii", 91, 678),
            ("OPT-NM", "Optical Network (New Mexico)", "optical", "Socorro, New Mexico", 85, 523),
            ("SPACE-BASED-1", "Space-Based Sensor (LEO)", "space-based", "LEO Orbit, 630 km", 96, 2145),
            ("RADAR-AU", "Southern Hemisphere Radar (Australia)", "radar", "Alice Springs, Australia", 88, 892),
            ("SBAND-AK", "S-Band Tracking Array (Alaska)", "radar", "Clear, Alaska", 89, 1456),
            ("OPT-IO", "Equatorial Optical Array (Indian Ocean)", "optical", "Diego Garcia", 88, 542),
            ("CBAND-PAC", "C-Band Tracking (Pacific)", "radar", "Kwajalein Atoll", 93, 1189),
        ]
        for s in sensors:
            cur.execute(
                """INSERT INTO tracking_network (sensor_id, sensor_name, sensor_type, location, data_quality, tracking_objects)
                   VALUES (%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (sensor_id) DO UPDATE SET data_quality=EXCLUDED.data_quality,
                     tracking_objects=EXCLUDED.tracking_objects, last_contact=NOW()""", s)

        # AI recommendations: generated from the REAL high-risk conjunctions.
        cur.execute("""
            SELECT ce.id, ce.ml_pc, COALESCE(ce.miss_distance_m, ce.miss_distance_km * 1000),
                   ce.risk_tier, sa.name, sb.name
            FROM conjunction_events ce
            JOIN satellites sa ON ce.satellite_a_id = sa.id
            JOIN satellites sb ON ce.satellite_b_id = sb.id
            WHERE ce.risk_tier IN ('red','amber')
              AND ce.tca > (NOW() AT TIME ZONE 'UTC')
            ORDER BY ce.ml_pc DESC LIMIT 12
        """)
        recs = 0
        for cid, mlpc, miss, tier, na, nb in cur.fetchall():
            mlpc = mlpc or 0.0
            if tier == "red":
                rtype, prio, conf = "collision-avoidance", "high", 92
                desc = (f"{na} x {nb}: HIGH risk close approach at {miss:,.0f} m, Pc={mlpc:.2e}. "
                        f"Recommend immediate maneuver assessment; in-track burn to raise miss distance.")
            else:
                rtype, prio, conf = "conjunction-monitoring", "medium", 80
                desc = (f"{na} x {nb}: elevated Pc={mlpc:.2e} at {miss:,.0f} m. "
                        f"Increase observation cadence; prepare contingency maneuver if covariance grows.")
            cur.execute(
                """INSERT INTO ai_recommendations (conjunction_id, type, priority, description, confidence)
                   VALUES (%s,%s,%s,%s,%s)""", (cid, rtype, prio, desc, conf))
            recs += 1

        # Anomaly events: tie to REAL catalog objects that have orbital elements.
        cur.execute("""
            SELECT s.norad_id, s.name, oe.altitude_km, oe.velocity_kms,
                   oe.semi_major_axis, oe.eccentricity, oe.inclination
            FROM satellites s JOIN orbital_elements oe ON oe.satellite_id = s.id
            WHERE oe.altitude_km IS NOT NULL AND oe.velocity_kms IS NOT NULL
            ORDER BY oe.altitude_km ASC LIMIT 6
        """)
        anom_specs = [
            ("altitude-drop", "high", "altitude_km", "altitude_km", -3.8, 3.2, 0.87,
             "Unexpected altitude decrease detected over 2 orbits. Possible drag increase or unplanned thruster firing."),
            ("velocity-spike", "medium", "velocity_kms", "velocity_kms", 0.03, 2.1, 0.72,
             "Velocity anomaly: deviation from predicted ephemeris. Likely unscheduled station-keeping maneuver."),
            ("orbital-decay", "critical", "semi_major_axis", "semi_major_axis", -7.5, 4.1, 0.94,
             "Accelerated orbital decay detected. SMA decreasing faster than predicted; re-entry timeline may shift."),
            ("inclination-drift", "low", "inclination", "inclination", 0.04, 1.4, 0.45,
             "Minor inclination drift within operational tolerance. Monitor for sustained trend."),
            ("eccentricity-change", "medium", "eccentricity", "eccentricity", 0.0007, 2.8, 0.78,
             "Eccentricity change over 24h. Possible debris interaction or gravitational perturbation."),
            ("velocity-spike", "high", "velocity_kms", "velocity_kms", 0.03, 3.5, 0.89,
             "Sudden velocity increase; unscheduled maneuver suspected. Cross-referencing operator notifications."),
        ]
        statuses = ["active", "investigating", "active", "resolved", "active", "investigating"]
        anoms = 0
        from datetime import datetime, timedelta
        rows = cur.fetchall()
        col_idx = {"altitude_km": 2, "velocity_kms": 3, "semi_major_axis": 4,
                   "eccentricity": 5, "inclination": 6}
        for i, r in enumerate(rows):
            spec = anom_specs[i % len(anom_specs)]
            atype, sev, _pname, pcol, delta, sigma, score, desc = spec
            expected = r[col_idx[pcol]]
            if expected is None:
                continue
            observed = float(expected) + delta
            detected = datetime.utcnow() - timedelta(hours=(i + 1) * 4)
            cur.execute(
                """INSERT INTO anomaly_events
                   (norad_id, satellite_name, anomaly_type, severity, detected_at,
                    parameter_name, expected_value, observed_value, deviation_sigma,
                    anomaly_score, description, status)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (str(r[0]), r[1], atype, sev, detected, pcol, float(expected),
                 observed, sigma, score, f"{r[1]}: {desc}", statuses[i % len(statuses)]))
            anoms += 1

        ml_rows = {}
        for uc_name, pg_name in (("conjunction_predictions", "ml_predictions"),
                                 ("model_summary", "ml_model_summary")):
            if table_exists(ML_SCHEMA, uc_name):
                ml_rows[pg_name] = copy_table(cur, f"{CATALOG}.{ML_SCHEMA}.{uc_name}", pg_name)

        conn.commit()
        print(f"\nReverse-ETL complete:")
        print(f"  satellites:        {len(norad_to_id)}")
        print(f"  orbital_elements:  {oe}")
        print(f"  conjunction_events:{ce}")
        print(f"  tracking_network:  {len(sensors)}")
        print(f"  ai_recommendations:{recs}")
        print(f"  anomaly_events:    {anoms}")
        for k, v in ml_rows.items():
            print(f"  {k + ':':<19}{v}")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
