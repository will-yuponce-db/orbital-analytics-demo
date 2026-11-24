# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch — Orbital Anomaly Detection
# MAGIC IsolationForest model for detecting unexpected orbital element deviations

# COMMAND ----------

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import json

try:
    from pyspark.sql import functions as F
    SPARK_AVAILABLE = True
except ImportError:
    SPARK_AVAILABLE = False

# COMMAND ----------

# Widget for experiment path
try:
    dbutils.widgets.text("experiment_path", "/Users/will.yuponce@databricks.com/orbitwatch-anomaly-detector")
    EXPERIMENT_PATH = dbutils.widgets.get("experiment_path")
except Exception:
    EXPERIMENT_PATH = "/Users/will.yuponce@databricks.com/orbitwatch-anomaly-detector"

print(f"MLflow experiment path: {EXPERIMENT_PATH}")

# COMMAND ----------

# Feature columns used for anomaly detection
FEATURE_COLS = ["altitude_km", "velocity_kms", "eccentricity", "inclination", "mean_motion", "bstar"]

FEATURE_TO_ANOMALY_TYPE = {
    "altitude_km":   "altitude-drop",
    "velocity_kms":  "velocity-spike",
    "eccentricity":  "eccentricity-change",
    "inclination":   "inclination-drift",
    "mean_motion":   "orbital-decay",
    "bstar":         "maneuver-unplanned",
}

FEATURE_TO_PARAM_NAME = {
    "altitude_km":   "Altitude",
    "velocity_kms":  "Velocity",
    "eccentricity":  "Eccentricity",
    "inclination":   "Inclination",
    "mean_motion":   "Mean Motion",
    "bstar":         "BSTAR Drag Term",
}

# COMMAND ----------
# MAGIC %md
# MAGIC ## 1. Load Data

# COMMAND ----------

def load_silver_data():
    """Attempt to load from Delta table; fall back to synthetic data."""
    try:
        if not SPARK_AVAILABLE:
            raise RuntimeError("Spark not available")
        df_spark = spark.table("main.orbitwatch_dlt.silver_orbital_elements")
        df = df_spark.select(
            "norad_id", "satellite_name", "epoch",
            *FEATURE_COLS
        ).toPandas()
        if df.empty:
            raise ValueError("Silver table is empty")
        print(f"Loaded {len(df)} rows from main.orbitwatch_dlt.silver_orbital_elements")
        return df, False
    except Exception as e:
        print(f"Could not load silver table ({e}). Falling back to synthetic data.")
        return generate_synthetic_data(), True


def generate_synthetic_data():
    """
    Generate realistic orbital element time series for 25 satellites
    (LEO / MEO / GEO mix) with 30 epochs each (30 days), plus 4 injected anomalies.
    Contamination ~0.05 (5 %).
    """
    np.random.seed(42)

    # Satellite catalogue: (norad_id, name, orbit_type, alt_km, incl_deg, ecc_baseline)
    catalogue = [
        # LEO — constellation
        ("25544",  "ISS",                "LEO",  408,  51.6,  0.0004),
        ("48274",  "STARLINK-2271",       "LEO",  555,  53.0,  0.0002),
        ("48275",  "STARLINK-2272",       "LEO",  555,  53.0,  0.0002),
        ("48276",  "STARLINK-2273",       "LEO",  555,  53.0,  0.0002),
        ("47932",  "ONEWEB-0234",         "LEO",  1200, 87.9,  0.0010),
        ("47933",  "ONEWEB-0235",         "LEO",  1200, 87.9,  0.0010),
        ("43013",  "PLANET-FLOCK-3P",     "LEO",  475,  97.4,  0.0005),
        ("43014",  "PLANET-FLOCK-3Q",     "LEO",  475,  97.4,  0.0005),
        ("27424",  "TERRA",               "LEO",  705,  98.2,  0.0001),
        ("25994",  "LANDSAT-7",           "LEO",  705,  98.2,  0.0001),
        # MEO — navigation
        ("40534",  "GPS BIIR-2",          "MEO", 20200, 55.0,  0.0080),
        ("40535",  "GPS BIIF-7",          "MEO", 20200, 55.0,  0.0080),
        ("37846",  "GALILEO-7",           "MEO", 23222, 56.0,  0.0002),
        ("37847",  "GALILEO-8",           "MEO", 23222, 56.0,  0.0002),
        ("39086",  "GLONASS-M 752",       "MEO", 19140, 64.8,  0.0010),
        # GEO — comms / weather
        ("41838",  "GOES-16",             "GEO", 35786,  0.0,  0.0001),
        ("43226",  "GOES-17",             "GEO", 35786,  0.0,  0.0001),
        ("45026",  "EUTELSAT-5WB",        "GEO", 35786,  0.1,  0.0003),
        ("39168",  "SES-6",               "GEO", 35786,  0.1,  0.0003),
        ("32712",  "INTELSAT-14",         "GEO", 35786,  0.2,  0.0002),
        # HEO / special
        ("28654",  "XM-3",               "HEO", 47000, 63.4,  0.6900),
        ("20580",  "HST",                "LEO",  540,  28.5,  0.0003),
        ("25382",  "CHANDRA",            "HEO", 139000, 28.5, 0.7700),
        ("43435",  "COSMOS-2521",        "LEO",  580,  97.9,  0.0006),
        ("44878",  "COSMOS-2543",        "LEO",  580,  97.9,  0.0008),
    ]

    MU = 398600.4418   # km^3/s^2
    RE = 6371.0        # km

    records = []
    base_date = datetime(2026, 2, 3, 0, 0, 0)

    # Anomaly injection plan: (sat_index, epoch_index, feature, multiplier)
    anomalies = {
        (2,  28): ("altitude_km",   0.92),   # Starlink altitude drop
        (6,  25): ("bstar",         8.50),   # Planet flock unplanned maneuver
        (10, 27): ("eccentricity",  4.20),   # GPS eccentricity change
        (16, 29): ("velocity_kms",  1.04),   # GOES velocity spike
    }

    for sat_idx, (norad_id, name, orbit_type, alt_baseline, incl, ecc_base) in enumerate(catalogue):
        # Derived orbital parameters
        a = RE + alt_baseline                          # semi-major axis km
        mm = np.sqrt(MU / a**3) * (86400 / (2 * np.pi))  # rev/day
        v_circ = np.sqrt(MU / a)                      # km/s

        for ep in range(30):
            epoch = base_date + timedelta(days=ep)

            # Realistic noise
            alt   = alt_baseline + np.random.normal(0, alt_baseline * 0.0005)
            incl_ = incl         + np.random.normal(0, 0.0002)
            ecc   = max(0, ecc_base + np.random.normal(0, ecc_base * 0.02 + 1e-6))
            a_ep  = RE + alt
            mm_ep = np.sqrt(MU / a_ep**3) * (86400 / (2 * np.pi))
            v_ep  = np.sqrt(MU / a_ep)
            bstar  = np.random.normal(1e-4, 5e-6)

            # Inject anomaly if scheduled
            key = (sat_idx, ep)
            if key in anomalies:
                feat, mult = anomalies[key]
                if feat == "altitude_km":
                    alt   *= mult
                    a_ep   = RE + alt
                    mm_ep  = np.sqrt(MU / a_ep**3) * (86400 / (2 * np.pi))
                    v_ep   = np.sqrt(MU / a_ep)
                elif feat == "velocity_kms":
                    v_ep  *= mult
                elif feat == "eccentricity":
                    ecc   *= mult
                elif feat == "bstar":
                    bstar *= mult

            records.append({
                "norad_id":       norad_id,
                "satellite_name": name,
                "epoch":          epoch,
                "altitude_km":    round(alt, 3),
                "velocity_kms":   round(v_ep, 4),
                "eccentricity":   round(ecc, 8),
                "inclination":    round(incl_, 4),
                "mean_motion":    round(mm_ep, 6),
                "bstar":          round(bstar, 8),
            })

    df = pd.DataFrame(records)
    print(f"Generated {len(df)} synthetic records for {df['norad_id'].nunique()} satellites")
    return df


df_all, is_synthetic = load_silver_data()

# COMMAND ----------
# MAGIC %md
# MAGIC ## 2. Per-Satellite Baseline + IsolationForest

# COMMAND ----------

def compute_per_satellite_stats(df):
    """Return mean/std per satellite per feature for per-satellite normalization."""
    stats = {}
    for norad_id, grp in df.groupby("norad_id"):
        stats[norad_id] = {
            feat: {"mean": grp[feat].mean(), "std": max(grp[feat].std(), 1e-10)}
            for feat in FEATURE_COLS
        }
    return stats


def get_root_cause_feature(row, stats):
    """Find the feature with largest deviation from satellite's own baseline (in sigma)."""
    norad_id = row["norad_id"]
    sat_stats = stats[norad_id]
    max_sigma = -1
    root_feat = FEATURE_COLS[0]
    for feat in FEATURE_COLS:
        sigma = abs(row[feat] - sat_stats[feat]["mean"]) / sat_stats[feat]["std"]
        if sigma > max_sigma:
            max_sigma = sigma
            root_feat = feat
    return root_feat, max_sigma


def score_to_severity(score):
    if score > 0.85:
        return "critical"
    elif score > 0.75:
        return "high"
    elif score > 0.60:
        return "medium"
    return "low"


# Use latest epoch per satellite as "current" observation
latest_epochs = df_all.sort_values("epoch").groupby("norad_id").last().reset_index()
all_history   = df_all.copy()

# Per-satellite baseline statistics (30-day window = all available history)
sat_stats = compute_per_satellite_stats(all_history)

# Train IsolationForest on full feature matrix
CONTAMINATION = 0.05
N_ESTIMATORS  = 200
RANDOM_STATE  = 42

scaler = StandardScaler()
X_all  = scaler.fit_transform(all_history[FEATURE_COLS])

iso_forest = IsolationForest(
    n_estimators=N_ESTIMATORS,
    contamination=CONTAMINATION,
    random_state=RANDOM_STATE,
    bootstrap=False,
    n_jobs=-1,
)
iso_forest.fit(X_all)

# Score the latest epoch for each satellite
X_latest = scaler.transform(latest_epochs[FEATURE_COLS])
raw_scores = iso_forest.decision_function(X_latest)   # higher = more normal
preds      = iso_forest.predict(X_latest)              # -1 = anomaly

# Normalise anomaly score to [0, 1] where 1 = most anomalous
score_min, score_max = raw_scores.min(), raw_scores.max()
anomaly_scores = 1 - (raw_scores - score_min) / (score_max - score_min + 1e-10)

print(f"Total satellites evaluated: {len(latest_epochs)}")
print(f"Anomalies detected (contamination={CONTAMINATION}): {(preds == -1).sum()}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 3. Build Anomaly Events Table

# COMMAND ----------

anomaly_records = []
now_ts = datetime.utcnow()

for i, (_, row) in enumerate(latest_epochs.iterrows()):
    is_anomaly = preds[i] == -1
    score      = float(anomaly_scores[i])

    if not is_anomaly:
        continue

    root_feat, dev_sigma = get_root_cause_feature(row, sat_stats)
    expected_val  = sat_stats[row["norad_id"]][root_feat]["mean"]
    observed_val  = row[root_feat]
    anomaly_type  = FEATURE_TO_ANOMALY_TYPE[root_feat]
    param_name    = FEATURE_TO_PARAM_NAME[root_feat]
    severity      = score_to_severity(score)

    description = (
        f"{row['satellite_name']} exhibits a {anomaly_type.replace('-', ' ')} anomaly. "
        f"{param_name} deviated {dev_sigma:.2f}σ from 30-day baseline "
        f"(expected {expected_val:.4f}, observed {observed_val:.4f}). "
        f"IsolationForest anomaly score: {score:.3f}."
    )

    anomaly_records.append({
        "norad_id":       row["norad_id"],
        "satellite_name": row["satellite_name"],
        "anomaly_type":   anomaly_type,
        "severity":       severity,
        "detected_at":    now_ts,
        "parameter_name": param_name,
        "expected_value": round(expected_val, 6),
        "observed_value": round(observed_val, 6),
        "deviation_sigma": round(dev_sigma, 3),
        "anomaly_score":  round(score, 4),
        "description":    description,
        "status":         "active",
        "epoch":          row["epoch"],
    })

df_anomalies = pd.DataFrame(anomaly_records)
print(f"\nAnomaly events generated: {len(df_anomalies)}")
if not df_anomalies.empty:
    print(df_anomalies[["satellite_name", "anomaly_type", "severity", "deviation_sigma", "anomaly_score"]])

# COMMAND ----------
# MAGIC %md
# MAGIC ## 4. MLflow Logging + Model Registration

# COMMAND ----------

mlflow.set_experiment(EXPERIMENT_PATH)

with mlflow.start_run(run_name="orbitwatch-anomaly-detection") as run:
    # Log parameters
    mlflow.log_params({
        "model_type":       "IsolationForest",
        "n_estimators":     N_ESTIMATORS,
        "contamination":    CONTAMINATION,
        "random_state":     RANDOM_STATE,
        "features":         ",".join(FEATURE_COLS),
        "baseline_days":    30,
        "synthetic_data":   is_synthetic,
    })

    # Log metrics
    n_anomalies = len(df_anomalies)
    mean_score  = float(df_anomalies["anomaly_score"].mean()) if n_anomalies > 0 else 0.0
    n_critical  = int((df_anomalies["severity"] == "critical").sum()) if n_anomalies > 0 else 0
    n_high      = int((df_anomalies["severity"] == "high").sum())     if n_anomalies > 0 else 0

    mlflow.log_metrics({
        "n_anomalies":      n_anomalies,
        "n_critical":       n_critical,
        "n_high":           n_high,
        "mean_anomaly_score": mean_score,
        "satellites_evaluated": len(latest_epochs),
    })

    # Log model
    mlflow.sklearn.log_model(
        sk_model=iso_forest,
        artifact_path="model",
        registered_model_name="orbitwatch-anomaly-detector",
        input_example=pd.DataFrame([latest_epochs[FEATURE_COLS].iloc[0].to_dict()]),
    )

    # Log scaler as artifact
    import pickle, tempfile, os
    with tempfile.TemporaryDirectory() as tmp:
        scaler_path = os.path.join(tmp, "scaler.pkl")
        with open(scaler_path, "wb") as f:
            pickle.dump(scaler, f)
        mlflow.log_artifact(scaler_path, "preprocessing")

    if not df_anomalies.empty:
        with tempfile.TemporaryDirectory() as tmp:
            csv_path = os.path.join(tmp, "anomaly_events.csv")
            df_anomalies.to_csv(csv_path, index=False)
            mlflow.log_artifact(csv_path, "results")

    run_id = run.info.run_id
    print(f"\nMLflow run_id: {run_id}")
    print(f"n_anomalies={n_anomalies}, mean_score={mean_score:.4f}, n_critical={n_critical}, n_high={n_high}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 5. Write to Delta Table (gold_anomaly_events)

# COMMAND ----------

if SPARK_AVAILABLE and not df_anomalies.empty:
    try:
        df_spark_out = spark.createDataFrame(df_anomalies)

        # Add ingestion timestamp
        df_spark_out = df_spark_out.withColumn("ingested_at", F.current_timestamp())

        df_spark_out.write.format("delta") \
            .mode("append") \
            .option("mergeSchema", "true") \
            .saveAsTable("main.orbitwatch_dlt.gold_anomaly_events")

        print("Wrote anomaly events to main.orbitwatch_dlt.gold_anomaly_events")
    except Exception as e:
        print(f"Warning: Could not write to Delta table: {e}")
else:
    print("Skipping Delta write (Spark not available or no anomalies detected)")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 6. Write HIGH+ Anomalies to Lakebase (JDBC)

# COMMAND ----------

import os

LAKEBASE_HOST = os.environ.get("LAKEBASE_HOST", "")
LAKEBASE_USER = os.environ.get("LAKEBASE_USER", "will.yuponce@databricks.com")
PGPASSWORD    = os.environ.get("PGPASSWORD", "")
LAKEBASE_DB   = os.environ.get("LAKEBASE_DB", "orbitwatch")

if LAKEBASE_HOST and PGPASSWORD and SPARK_AVAILABLE:
    try:
        high_severity = df_anomalies[df_anomalies["severity"].isin(["high", "critical"])].copy()

        if not high_severity.empty:
            jdbc_url = (
                f"jdbc:postgresql://{LAKEBASE_HOST}:5432/{LAKEBASE_DB}"
                f"?sslmode=require"
            )

            write_cols = [
                "norad_id", "satellite_name", "anomaly_type", "severity",
                "detected_at", "parameter_name", "expected_value", "observed_value",
                "deviation_sigma", "anomaly_score", "description", "status",
            ]
            df_jdbc = spark.createDataFrame(high_severity[write_cols])

            df_jdbc.write \
                .format("jdbc") \
                .option("url", jdbc_url) \
                .option("dbtable", "anomaly_events") \
                .option("user", LAKEBASE_USER) \
                .option("password", PGPASSWORD) \
                .option("driver", "org.postgresql.Driver") \
                .mode("append") \
                .save()

            print(f"Wrote {len(high_severity)} HIGH/CRITICAL anomalies to Lakebase anomaly_events table")
        else:
            print("No HIGH/CRITICAL anomalies to write to Lakebase")
    except Exception as e:
        print(f"Warning: Could not write to Lakebase via JDBC: {e}")
else:
    print("Skipping Lakebase JDBC write (missing env vars or Spark not available)")

# COMMAND ----------
# MAGIC %md
# MAGIC ## Summary

# COMMAND ----------

print("=" * 60)
print("OrbitWatch Anomaly Detection — Run Complete")
print("=" * 60)
print(f"  Data source:          {'Synthetic' if is_synthetic else 'Delta silver_orbital_elements'}")
print(f"  Satellites evaluated: {len(latest_epochs)}")
print(f"  Anomalies detected:   {len(df_anomalies)}")
if not df_anomalies.empty:
    print(f"  Severity breakdown:")
    for sev in ["critical", "high", "medium", "low"]:
        cnt = (df_anomalies["severity"] == sev).sum()
        if cnt:
            print(f"    {sev.upper():10s}: {cnt}")
    print(f"  Mean anomaly score:   {df_anomalies['anomaly_score'].mean():.4f}")
print(f"  MLflow run ID:        {run_id}")
print(f"  Model registered as:  orbitwatch-anomaly-detector")
print("=" * 60)
