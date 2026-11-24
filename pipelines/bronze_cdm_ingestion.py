# Databricks notebook source
# MAGIC %md
# MAGIC # Bronze: CDM Ingestion from Space-Track
# MAGIC Ingests Conjunction Data Messages from U.S. Space Force Space-Track API.
# MAGIC Requires SPACE_TRACK_USER and SPACE_TRACK_PASS in Databricks secrets.

import dlt
import requests
import json
from pyspark.sql import functions as F
from datetime import datetime, timedelta

SPACE_TRACK_BASE = "https://www.space-track.org"
LOGIN_URL = f"{SPACE_TRACK_BASE}/ajaxauth/login"
CDM_URL = f"{SPACE_TRACK_BASE}/basicspacedata/query/class/cdm_public/TCA/>now-7/orderby/TCA asc/format/json"

def get_space_track_session():
    """Authenticate with Space-Track and return session."""
    session = requests.Session()
    credentials = {
        "identity": dbutils.secrets.get(scope="orbitwatch", key="SPACE_TRACK_USER"),
        "password": dbutils.secrets.get(scope="orbitwatch", key="SPACE_TRACK_PASS"),
    }
    resp = session.post(LOGIN_URL, data=credentials, timeout=30)
    resp.raise_for_status()
    return session

@dlt.table(
    name="bronze_cdms",
    comment="Raw Conjunction Data Messages from U.S. Space Force Space-Track API. Updated every 6 hours.",
    table_properties={"quality": "bronze"}
)
def bronze_cdms():
    try:
        session = get_space_track_session()
        response = session.get(CDM_URL, timeout=60)
        response.raise_for_status()
        records = response.json()

        if not records:
            return spark.createDataFrame([], schema="CDM_ID STRING, SAT1_NAME STRING, SAT2_NAME STRING")

        df = spark.createDataFrame(records)
        return df.withColumn("_ingested_at", F.current_timestamp())
    except Exception as e:
        print(f"Failed to fetch CDMs from Space-Track: {e}")
        # Return empty DataFrame on failure — pipeline continues with cached data
        return spark.createDataFrame([], schema="CDM_ID STRING, SAT1_NAME STRING, SAT2_NAME STRING, TCA STRING, MISS_DISTANCE STRING, COLLISION_PROBABILITY STRING")
