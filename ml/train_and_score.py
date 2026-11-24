# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch — XGBoost Conjunction Risk Model
# MAGIC Train an XGBoost model on real Space-Track CDM data to calibrate collision probability.
# MAGIC Stores inference results back to `will_wy_demo_catalog.orbitwatch_ml.conjunction_predictions`.

# COMMAND ----------

import mlflow
import mlflow.xgboost
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from pyspark.sql import functions as F

mlflow.set_registry_uri("databricks-uc")

dbutils.widgets.text("catalog", "will_wy_demo_catalog")
CATALOG = dbutils.widgets.get("catalog")

# Ensure the UC schema exists before model registration / table writes
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.orbitwatch_ml")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Load gold conjunction events with orbital features

# COMMAND ----------

gold_df = spark.read.table(f"{CATALOG}.orbitwatch_dlt.gold_conjunction_events")
print(f"Total CDM records: {gold_df.count()}")
gold_df.printSchema()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Feature Engineering

# COMMAND ----------

# Select and engineer features
feature_cols = [
    "miss_distance_km",
    "relative_velocity_kms",
    "inclination_diff",
    "altitude_diff_km",
    "sat_1_altitude",
    "sat_2_altitude",
    "sat_1_velocity",
    "sat_2_velocity",
    "sat_1_inclination",
    "sat_2_inclination",
    "hours_to_tca",
]

# Encode categorical features
cat_cols = {
    "sat_1_type": {"PAYLOAD": 0, "ROCKET BODY": 1, "DEBRIS": 2, "UNKNOWN": 3},
    "sat_2_type": {"PAYLOAD": 0, "ROCKET BODY": 1, "DEBRIS": 2, "UNKNOWN": 3},
    "sat_1_rcs": {"LARGE": 0, "MEDIUM": 1, "SMALL": 2, None: 3},
    "sat_2_rcs": {"LARGE": 0, "MEDIUM": 1, "SMALL": 2, None: 3},
    "emergency_reportable": {"Y": 1, "N": 0},
}

pdf = gold_df.toPandas()

# Encode categoricals
for col, mapping in cat_cols.items():
    pdf[f"{col}_enc"] = pdf[col].map(mapping).fillna(3).astype(int)
    feature_cols.append(f"{col}_enc")

# Derived features
pdf["avg_altitude"] = (pdf["sat_1_altitude"].fillna(0) + pdf["sat_2_altitude"].fillna(0)) / 2
pdf["is_debris_involved"] = ((pdf["sat_1_type"] == "DEBRIS") | (pdf["sat_2_type"] == "DEBRIS")).astype(int)
pdf["is_rocket_body"] = ((pdf["sat_1_type"] == "ROCKET BODY") | (pdf["sat_2_type"] == "ROCKET BODY")).astype(int)
pdf["log_miss_distance"] = np.log1p(pdf["miss_distance_km"].fillna(0))
pdf["velocity_product"] = pdf["sat_1_velocity"].fillna(0) * pdf["sat_2_velocity"].fillna(0)

feature_cols += ["avg_altitude", "is_debris_involved", "is_rocket_body", "log_miss_distance", "velocity_product"]

# Target: log-transformed Pc (handles wide range of values)
pdf["log_pc"] = np.log1p(pdf["pc"].fillna(0).clip(lower=0))

# Drop rows with missing target
pdf = pdf.dropna(subset=["pc"])
pdf = pdf[pdf["pc"] > 0]  # Only train on events with nonzero Pc

print(f"Training samples after filtering: {len(pdf)}")
print(f"Features: {len(feature_cols)}")
print(f"Pc range: {pdf['pc'].min():.2e} to {pdf['pc'].max():.2e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Train XGBoost Model

# COMMAND ----------

X = pdf[feature_cols].fillna(0).values
y = pdf["log_pc"].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

with mlflow.start_run(run_name="orbitwatch-pc-xgboost") as run:
    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    # Predictions (inverse log transform)
    y_pred = model.predict(X_test)
    y_pred_pc = np.expm1(y_pred)
    y_test_pc = np.expm1(y_test)

    # Metrics
    rmse = np.sqrt(mean_squared_error(y_test_pc, y_pred_pc))
    mae = mean_absolute_error(y_test_pc, y_pred_pc)
    r2 = r2_score(y_test, y_pred)  # R² on log scale

    mlflow.log_param("n_estimators", 200)
    mlflow.log_param("max_depth", 6)
    mlflow.log_param("learning_rate", 0.05)
    mlflow.log_param("n_features", len(feature_cols))
    mlflow.log_param("n_training_samples", len(X_train))
    mlflow.log_param("n_test_samples", len(X_test))
    mlflow.log_metric("rmse", rmse)
    mlflow.log_metric("mae", mae)
    mlflow.log_metric("r2_log_scale", r2)

    # Feature importances
    importances = dict(zip(feature_cols, model.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    for feat, imp in sorted_imp:
        mlflow.log_metric(f"fi_{feat}", imp)

    # Log model to Unity Catalog
    mlflow.xgboost.log_model(
        model,
        artifact_path="model",
        registered_model_name=f"{CATALOG}.orbitwatch_ml.pc_predictor",
        input_example=pd.DataFrame([X_test[0]], columns=feature_cols),
    )

    print(f"\nModel Performance:")
    print(f"  RMSE:         {rmse:.6f}")
    print(f"  MAE:          {mae:.6f}")
    print(f"  R² (log Pc):  {r2:.4f}")
    print(f"\nTop 5 Feature Importances:")
    for feat, imp in sorted_imp[:5]:
        print(f"  {feat:30s} {imp:.4f}")

    run_id = run.info.run_id

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Score ALL conjunctions and write inference table

# COMMAND ----------

# Score the full dataset
X_all = pdf[feature_cols].fillna(0).values
pdf["ml_pc"] = np.expm1(model.predict(X_all))
pdf["ml_pc"] = pdf["ml_pc"].clip(lower=0, upper=1)

# Compute calibration ratio (how much the model adjusts the raw Pc)
pdf["calibration_ratio"] = pdf["ml_pc"] / pdf["pc"].clip(lower=1e-12)

# Risk tier based on ML prediction
def assign_risk_tier(pc):
    if pc > 1e-3:
        return "red"
    elif pc > 1e-4:
        return "amber"
    return "green"

pdf["ml_risk_tier"] = pdf["ml_pc"].apply(assign_risk_tier)
pdf["raw_risk_tier"] = pdf["pc"].apply(assign_risk_tier)
pdf["risk_changed"] = pdf["ml_risk_tier"] != pdf["raw_risk_tier"]

# Feature importance dict for storing
fi_json = {feat: float(imp) for feat, imp in sorted_imp}

# Build predictions dataframe
predictions_pdf = pdf[[
    "cdm_id", "sat_1_norad_id", "sat_1_name", "sat_2_norad_id", "sat_2_name",
    "tca", "miss_distance_km", "pc", "ml_pc", "calibration_ratio",
    "raw_risk_tier", "ml_risk_tier", "risk_changed",
    "relative_velocity_kms", "inclination_diff", "altitude_diff_km",
    "avg_altitude", "is_debris_involved", "is_rocket_body",
    "hours_to_tca", "emergency_reportable",
    "sat_1_type", "sat_2_type",
]].copy()

predictions_pdf.rename(columns={"pc": "raw_pc"}, inplace=True)
predictions_pdf["model_run_id"] = run_id
predictions_pdf["scored_at"] = pd.Timestamp.now(tz="UTC")

# Summary stats
print(f"\nInference Results:")
print(f"  Total scored: {len(predictions_pdf)}")
print(f"  Risk tier changes: {predictions_pdf['risk_changed'].sum()} / {len(predictions_pdf)}")
print(f"  Red events (raw):  {(predictions_pdf['raw_risk_tier'] == 'red').sum()}")
print(f"  Red events (ML):   {(predictions_pdf['ml_risk_tier'] == 'red').sum()}")
print(f"  Mean calibration ratio: {predictions_pdf['calibration_ratio'].mean():.3f}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Write to Delta table

# COMMAND ----------

# Create schema if not exists
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.orbitwatch_ml")

# Write predictions
predictions_sdf = spark.createDataFrame(predictions_pdf)
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
    "model_version": "1",
    "run_id": run_id,
    "trained_at": pd.Timestamp.now(tz="UTC"),
    "n_training_samples": int(len(X_train)),
    "n_test_samples": int(len(X_test)),
    "rmse": float(rmse),
    "mae": float(mae),
    "r2_log_scale": float(r2),
    "n_features": len(feature_cols),
    "top_feature_1": sorted_imp[0][0] if len(sorted_imp) > 0 else "",
    "top_feature_1_importance": float(sorted_imp[0][1]) if len(sorted_imp) > 0 else 0,
    "top_feature_2": sorted_imp[1][0] if len(sorted_imp) > 1 else "",
    "top_feature_2_importance": float(sorted_imp[1][1]) if len(sorted_imp) > 1 else 0,
    "top_feature_3": sorted_imp[2][0] if len(sorted_imp) > 2 else "",
    "top_feature_3_importance": float(sorted_imp[2][1]) if len(sorted_imp) > 2 else 0,
    "total_scored": len(predictions_pdf),
    "risk_changes": int(predictions_pdf["risk_changed"].sum()),
    "mean_calibration_ratio": float(predictions_pdf["calibration_ratio"].mean()),
}]

summary_sdf = spark.createDataFrame(pd.DataFrame(summary_data))
summary_sdf.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(
    f"{CATALOG}.orbitwatch_ml.model_summary"
)

print(f"Model summary written to {CATALOG}.orbitwatch_ml.model_summary")
print("\nDone! Model trained, scored, and stored.")
