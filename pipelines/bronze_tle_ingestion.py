# Databricks notebook source
# MAGIC %md
# MAGIC # Bronze: TLE Ingestion from Celestrak
# MAGIC Ingests Two-Line Element Sets for active satellites, Starlink constellation, and debris catalog.

import dlt
import requests
import json
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, FloatType, TimestampType

CELESTRAK_URLS = {
    "active": "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json",
    "starlink": "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json",
    "debris": "https://celestrak.org/NORAD/elements/gp.php?GROUP=debris&FORMAT=json",
    "rocket-body": "https://celestrak.org/NORAD/elements/gp.php?GROUP=rocket-body&FORMAT=json",
}

@dlt.table(
    name="bronze_tles",
    comment="Raw TLE/OMM records from Celestrak. Updated every 6 hours.",
    table_properties={"quality": "bronze"}
)
def bronze_tles():
    all_records = []
    for category, url in CELESTRAK_URLS.items():
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            records = response.json()
            for r in records:
                r["_source_category"] = category
                r["_ingested_at"] = F.current_timestamp()
            all_records.extend(records)
        except Exception as e:
            print(f"Failed to fetch {category} from Celestrak: {e}")

    if not all_records:
        return spark.createDataFrame([], schema="OBJECT_NAME STRING, NORAD_CAT_ID STRING, _source_category STRING")

    df = spark.createDataFrame(all_records)
    return df.withColumn("_ingested_at", F.current_timestamp())
