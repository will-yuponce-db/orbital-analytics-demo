# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch: Train XGBoost Conjunction Pc Predictor
# MAGIC Trains a model to refine raw Space-Track Pc values using orbital geometry features.

import mlflow
import mlflow.sklearn
import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

# MLflow experiment
EXPERIMENT_PATH = dbutils.widgets.get("experiment_path") if dbutils.widgets.get("experiment_path") else \
    "/Users/will.yuponce@databricks.com/orbitwatch-pc-model"
mlflow.set_experiment(EXPERIMENT_PATH)

# Load feature data from Silver DLT table
df = spark.table("main.orbitwatch_dlt.silver_conjunction_features").toPandas()

# If no real data yet, generate synthetic training data for demo
if len(df) < 100:
    print("Generating synthetic training data for demo...")
    np.random.seed(42)
    n = 5000
    df = pd.DataFrame({
        "miss_distance_km": np.random.exponential(2, n),
        "relative_velocity_kms": np.random.normal(10, 3, n),
        "altitude_a_km": np.random.uniform(200, 2000, n),
        "altitude_b_km": np.random.uniform(200, 2000, n),
        "altitude_diff_km": np.random.exponential(100, n),
        "inclination_diff": np.random.uniform(0, 90, n),
        "days_to_tca_capped": np.random.uniform(0, 7, n),
        "is_debris": np.random.binomial(1, 0.4, n),
        "orbit_regime_encoded": np.random.randint(0, 3, n),
    })
    # Synthetic Pc: inversely proportional to miss distance, proportional to velocity
    df["pc"] = np.clip(
        0.001 / (df["miss_distance_km"] + 0.01) * (df["relative_velocity_kms"] / 10) *
        (1 + 0.5 * df["is_debris"]) * np.random.lognormal(0, 0.5, n),
        0, 0.1
    )

FEATURES = ["miss_distance_km", "relative_velocity_kms", "altitude_a_km", "altitude_b_km",
            "altitude_diff_km", "inclination_diff", "days_to_tca_capped", "is_debris", "orbit_regime_encoded"]
TARGET = "pc"

X = df[FEATURES].fillna(0)
y = df[TARGET].fillna(0)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

with mlflow.start_run(run_name="xgboost-pc-predictor"):
    params = {
        "n_estimators": 200,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 3,
        "objective": "reg:squarederror",
    }
    mlflow.log_params(params)

    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 0, 1)

    metrics = {
        "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
        "mae": float(mean_absolute_error(y_test, y_pred)),
        "r2": float(r2_score(y_test, y_pred)),
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
    mlflow.log_metrics(metrics)

    # Log feature importances
    importance_df = pd.DataFrame({
        "feature": FEATURES,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)
    mlflow.log_text(importance_df.to_csv(index=False), "feature_importances.csv")

    # Register model
    mlflow.sklearn.log_model(
        model,
        artifact_path="pc_model",
        registered_model_name="orbitwatch-pc-predictor",
        input_example=X_test.head(5),
    )

    print(f"Model trained. RMSE: {metrics['rmse']:.6f}, R2: {metrics['r2']:.3f}")
    print(f"Registered as: orbitwatch-pc-predictor")
