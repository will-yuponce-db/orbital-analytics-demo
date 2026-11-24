# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch — XGBoost Conjunction Risk Model
# MAGIC Learns log10(Pc) from real Space-Track CDM fields and both objects' orbits, then scores every CDM.
# MAGIC Writes `<catalog>.orbitwatch_ml.conjunction_predictions` and `<catalog>.orbitwatch_ml.model_summary`.
# MAGIC
# MAGIC * Target is log10(Pc). Public Pc values span roughly 1e-4 to 1e-1, so a linear (or log1p) target has
# MAGIC   almost no variance and the trees cannot split.
# MAGIC * Train/test split is by `event_key`, so CDM updates of one conjunction never land on both sides.
# MAGIC * Features are symmetric in the two objects, so the A x B and B x A copies of a CDM get the same score.

# COMMAND ----------

import json

import mlflow
import mlflow.xgboost
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient
from xgboost import XGBRegressor
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, FloatType

mlflow.set_registry_uri("databricks-uc")
mlflow.autolog(disable=True)  # log explicitly; keeps the CV fits below from creating stray runs

dbutils.widgets.text("catalog", "will_wy_demo_catalog")
CATALOG = dbutils.widgets.get("catalog")
MODEL_NAME = f"{CATALOG}.orbitwatch_ml.pc_predictor"
RED_PC, AMBER_PC = 1e-3, 1e-4  # same thresholds as the pipeline's risk_tier

# Ensure the UC schema exists before model registration / table writes
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.orbitwatch_ml")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Load gold conjunction events with orbital features

# COMMAND ----------

gold_df = spark.read.table(f"{CATALOG}.orbitwatch_dlt.gold_conjunction_events")
missing = {"event_key", "miss_distance_m"} - set(gold_df.columns)
if missing:
    raise ValueError(f"gold_conjunction_events lacks {sorted(missing)}; run the OrbitWatch pipeline first")

pdf = gold_df.toPandas()
pdf = pdf[pdf["pc"].notna() & (pdf["pc"] > 0)].reset_index(drop=True)
print(f"CDM rows: {len(pdf)}, conjunction events: {pdf['event_key'].nunique()}")
print(f"Pc range: {pdf['pc'].min():.2e} to {pdf['pc'].max():.2e}")
print(f"Miss distance: {pdf['miss_distance_m'].min():.0f} m to {pdf['miss_distance_m'].max():.0f} m")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Feature Engineering

# COMMAND ----------

RCS_SIZE = {"SMALL": 1.0, "MEDIUM": 2.0, "LARGE": 3.0}  # ordinal radar cross-section class; unknown -> NaN


def _clean(series):
    return series.map(lambda v: "" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v).strip().upper())


t1, t2 = _clean(pdf["sat_1_type"]), _clean(pdf["sat_2_type"])
rcs = pd.concat([_clean(pdf["sat_1_rcs"]).map(RCS_SIZE), _clean(pdf["sat_2_rcs"]).map(RCS_SIZE)], axis=1).astype("float64")

pdf["is_debris_involved"] = ((t1 == "DEBRIS") | (t2 == "DEBRIS")).astype(int)
pdf["is_rocket_body"] = ((t1 == "ROCKET BODY") | (t2 == "ROCKET BODY")).astype(int)
pdf["n_debris"] = (t1 == "DEBRIS").astype(int) + (t2 == "DEBRIS").astype(int)
pdf["n_payload"] = (t1 == "PAYLOAD").astype(int) + (t2 == "PAYLOAD").astype(int)
pdf["max_rcs_size"] = rcs.max(axis=1, skipna=False)
pdf["min_rcs_size"] = rcs.min(axis=1, skipna=False)

# Orbit features: NaN when an object is not in the GP catalog (XGBoost handles missing values natively).
pdf["avg_altitude"] = pdf[["sat_1_altitude", "sat_2_altitude"]].mean(axis=1, skipna=True)
pdf["mean_inclination"] = pdf[["sat_1_inclination", "sat_2_inclination"]].mean(axis=1, skipna=True)

# One CDM update is published twice (A x B and B x A, created seconds apart) with the same TCA, Pc and
# miss distance. Lead time is measured from the update's first publication so both copies match.
UPDATE_KEY = ["event_key", "tca", "pc", "miss_distance_m"]
pdf["update_created_at"] = pdf.groupby(UPDATE_KEY, dropna=False)["created_at"].transform("min")
pdf["lead_time_hours"] = (pdf["tca"] - pdf["update_created_at"]).dt.total_seconds() / 3600.0
pdf["log10_miss_distance_m"] = np.log10(pdf["miss_distance_m"].astype("float64").clip(lower=1.0))

FEATURES = [
    "log10_miss_distance_m",   # dominant physical driver of Pc
    "lead_time_hours",         # TCA minus CDM creation: covariance growth proxy
    "relative_velocity_kms",
    "avg_altitude",
    "altitude_diff_km",
    "mean_inclination",
    "inclination_diff",
    "max_rcs_size",            # hard-body size proxies
    "min_rcs_size",
    "n_debris",
    "n_payload",
    "is_rocket_body",
]

# Target: log10(Pc)
pdf["log10_pc"] = np.log10(pdf["pc"].astype("float64"))

# Train on distinct CDM updates (one row per A x B / B x A pair), grouped by physical event.
pool = pdf.drop_duplicates(subset=UPDATE_KEY).reset_index(drop=True)
X = pool[FEATURES].astype("float64")
y = pool["log10_pc"]
groups = pool["event_key"]
if groups.nunique() < 5:
    raise ValueError(f"Only {groups.nunique()} conjunction events; need at least 5 to train and evaluate")

print(f"Distinct CDM updates: {len(pool)} across {groups.nunique()} events; features: {len(FEATURES)}")
print(f"log10(Pc): mean {y.mean():.3f}, std {y.std():.3f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Train XGBoost Model

# COMMAND ----------

train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42).split(X, y, groups))
X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
assert not set(groups.iloc[train_idx]) & set(groups.iloc[test_idx]), "event leaked across train/test"

PARAMS = dict(
    n_estimators=400,
    max_depth=3,
    learning_rate=0.03,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=3,
    reg_lambda=1.0,
    random_state=42,
    objective="reg:squarederror",
    # Physics prior: with everything else fixed, a larger miss distance never raises Pc.
    monotone_constraints={"log10_miss_distance_m": -1},
)

# Grouped 5-fold CV on all events, logged alongside the held-out split as a stability check.
oof = np.full(len(y), np.nan)
for cv_tr, cv_te in GroupKFold(n_splits=min(5, groups.nunique())).split(X, y, groups):
    oof[cv_te] = XGBRegressor(**PARAMS).fit(X.iloc[cv_tr], y.iloc[cv_tr]).predict(X.iloc[cv_te])
cv_r2 = r2_score(y, oof)

with mlflow.start_run(run_name="orbitwatch-pc-xgboost") as run:
    model = XGBRegressor(**PARAMS)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test).astype("float64")
    pc_pred, pc_true = 10.0 ** y_pred, 10.0 ** y_test.to_numpy()

    # RMSE / MAE in Pc units; R² on the log10 scale the model is trained on
    rmse = float(np.sqrt(mean_squared_error(pc_true, pc_pred)))
    mae = float(mean_absolute_error(pc_true, pc_pred))
    r2 = float(r2_score(y_test, y_pred))
    rmse_log10 = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae_log10 = float(mean_absolute_error(y_test, y_pred))

    mlflow.log_params({k: str(v) for k, v in PARAMS.items()})
    mlflow.log_param("target", "log10(pc)")
    mlflow.log_param("split", "GroupShuffleSplit by event_key, test_size=0.25")
    mlflow.log_param("features", ",".join(FEATURES))
    mlflow.log_param("n_features", len(FEATURES))
    mlflow.log_param("n_training_samples", len(X_train))
    mlflow.log_param("n_test_samples", len(X_test))
    mlflow.log_param("n_train_events", int(groups.iloc[train_idx].nunique()))
    mlflow.log_param("n_test_events", int(groups.iloc[test_idx].nunique()))
    mlflow.log_metric("rmse", rmse)
    mlflow.log_metric("mae", mae)
    mlflow.log_metric("r2_log_scale", r2)
    mlflow.log_metric("rmse_log10", rmse_log10)
    mlflow.log_metric("mae_log10", mae_log10)
    mlflow.log_metric("cv_r2_log_scale", float(cv_r2))

    # Feature importances (gain)
    importances = dict(zip(FEATURES, model.feature_importances_.astype("float64").tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    for feat, imp in sorted_imp:
        mlflow.log_metric(f"fi_{feat}", imp)

    complete_rows = X_train.dropna()
    example = complete_rows.head(3) if len(complete_rows) else X_train.head(3).fillna(0.0)
    model_info = mlflow.xgboost.log_model(
        model,
        artifact_path="model",
        registered_model_name=MODEL_NAME,
        input_example=example,
    )

    run_id = run.info.run_id

model_version = getattr(model_info, "registered_model_version", None)
if model_version is None:
    model_version = max(
        int(v.version) for v in MlflowClient().search_model_versions(f"name='{MODEL_NAME}'") if v.run_id == run_id
    )
model_version = str(model_version)

print(f"\nModel {MODEL_NAME} v{model_version} (run {run_id})")
print(f"  Train: {len(X_train)} updates / {groups.iloc[train_idx].nunique()} events; "
      f"test: {len(X_test)} updates / {groups.iloc[test_idx].nunique()} events")
print(f"  R² (log10 Pc), held-out events: {r2:.4f}   grouped 5-fold CV: {cv_r2:.4f}")
print(f"  RMSE log10: {rmse_log10:.3f}   RMSE Pc: {rmse:.3e}   MAE Pc: {mae:.3e}")
print("Feature importances (gain):")
for feat, imp in sorted_imp:
    print(f"  {feat:28s} {imp:.4f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Score ALL conjunctions and write inference table

# COMMAND ----------

pdf["ml_pc"] = np.clip(10.0 ** model.predict(pdf[FEATURES].astype("float64")).astype("float64"), 0.0, 1.0)

# Calibration ratio: how far the model's Pc sits from the CDM's reported Pc
pdf["calibration_ratio"] = pdf["ml_pc"] / pdf["pc"].clip(lower=1e-12)


def assign_risk_tier(pc):
    if pc > RED_PC:
        return "red"
    elif pc > AMBER_PC:
        return "amber"
    return "green"


pdf["ml_risk_tier"] = pdf["ml_pc"].apply(assign_risk_tier)
pdf["raw_risk_tier"] = pdf["pc"].apply(assign_risk_tier)
pdf["risk_changed"] = pdf["ml_risk_tier"] != pdf["raw_risk_tier"]

predictions_pdf = pdf[[
    "cdm_id", "event_key", "sat_1_norad_id", "sat_1_name", "sat_2_norad_id", "sat_2_name",
    "tca", "miss_distance_m", "miss_distance_km", "pc", "ml_pc", "calibration_ratio",
    "raw_risk_tier", "ml_risk_tier", "risk_changed",
    "relative_velocity_kms", "inclination_diff", "altitude_diff_km",
    "avg_altitude", "is_debris_involved", "is_rocket_body",
    "hours_to_tca", "emergency_reportable",
    "sat_1_type", "sat_2_type",
]].copy()

predictions_pdf.rename(columns={"pc": "raw_pc"}, inplace=True)
predictions_pdf["model_run_id"] = run_id
predictions_pdf["scored_at"] = pd.Timestamp.now(tz="UTC")

print(f"\nInference Results:")
print(f"  Total scored: {len(predictions_pdf)}   distinct ml_pc: {predictions_pdf['ml_pc'].nunique()}")
print(f"  ml_pc range: {predictions_pdf['ml_pc'].min():.2e} to {predictions_pdf['ml_pc'].max():.2e}")
print(f"  Risk tier changes: {predictions_pdf['risk_changed'].sum()} / {len(predictions_pdf)}")
print(f"  Red events (raw):  {(predictions_pdf['raw_risk_tier'] == 'red').sum()}")
print(f"  Red events (ML):   {(predictions_pdf['ml_risk_tier'] == 'red').sum()}")
print(f"  Mean calibration ratio: {predictions_pdf['calibration_ratio'].mean():.3f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Write to Delta table

# COMMAND ----------


def _nan_to_null(sdf):
    """Missing orbit features are NaN in pandas; store them as NULL."""
    return sdf.select([
        F.when(F.isnan(F.col(f.name)), F.lit(None)).otherwise(F.col(f.name)).cast(f.dataType).alias(f.name)
        if isinstance(f.dataType, (DoubleType, FloatType)) else F.col(f.name)
        for f in sdf.schema.fields
    ])


predictions_sdf = _nan_to_null(spark.createDataFrame(predictions_pdf))
predictions_sdf.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(
    f"{CATALOG}.orbitwatch_ml.conjunction_predictions"
)

print(f"Predictions written to {CATALOG}.orbitwatch_ml.conjunction_predictions")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Write model summary table (for UI)

# COMMAND ----------

summary_data = [{
    "model_name": "pc_predictor",
    "model_version": model_version,
    "run_id": run_id,
    "trained_at": pd.Timestamp.now(tz="UTC"),
    "n_training_samples": int(len(X_train)),
    "n_test_samples": int(len(X_test)),
    "rmse": rmse,
    "mae": mae,
    "r2_log_scale": r2,
    "n_features": len(FEATURES),
    "top_feature_1": sorted_imp[0][0] if len(sorted_imp) > 0 else "",
    "top_feature_1_importance": float(sorted_imp[0][1]) if len(sorted_imp) > 0 else 0.0,
    "top_feature_2": sorted_imp[1][0] if len(sorted_imp) > 1 else "",
    "top_feature_2_importance": float(sorted_imp[1][1]) if len(sorted_imp) > 1 else 0.0,
    "top_feature_3": sorted_imp[2][0] if len(sorted_imp) > 2 else "",
    "top_feature_3_importance": float(sorted_imp[2][1]) if len(sorted_imp) > 2 else 0.0,
    "total_scored": int(len(predictions_pdf)),
    "risk_changes": int(predictions_pdf["risk_changed"].sum()),
    "mean_calibration_ratio": float(predictions_pdf["calibration_ratio"].mean()),
}]

summary_sdf = spark.createDataFrame(pd.DataFrame(summary_data))
summary_sdf.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(
    f"{CATALOG}.orbitwatch_ml.model_summary"
)

print(f"Model summary written to {CATALOG}.orbitwatch_ml.model_summary")
print("\nDone! Model trained, scored, and stored.")

dbutils.notebook.exit(json.dumps({
    "model_version": model_version,
    "run_id": run_id,
    "r2_log_scale": r2,
    "cv_r2_log_scale": float(cv_r2),
    "rmse_log10": rmse_log10,
    "n_training_samples": int(len(X_train)),
    "n_test_samples": int(len(X_test)),
    "total_scored": int(len(predictions_pdf)),
    "distinct_ml_pc": int(predictions_pdf["ml_pc"].nunique()),
    "importances": {k: round(v, 4) for k, v in sorted_imp},
}))
