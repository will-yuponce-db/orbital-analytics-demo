# Databricks notebook source
# MAGIC %md
# MAGIC # Promote Latest Model to Production

from mlflow.tracking import MlflowClient

client = MlflowClient()
MODEL_NAME = "orbitwatch-pc-predictor"

# Get latest version
versions = client.search_model_versions(f"name='{MODEL_NAME}'")
latest = sorted(versions, key=lambda v: int(v.version), reverse=True)[0]

print(f"Promoting version {latest.version} to Production")
client.transition_model_version_stage(
    name=MODEL_NAME,
    version=latest.version,
    stage="Production",
    archive_existing_versions=True,
)
print(f"Done. {MODEL_NAME} v{latest.version} is now in Production.")
