# Databricks notebook source
# MAGIC %md
# MAGIC # Bronze: SOCRATES Conjunction Screening (Celestrak)
# MAGIC Fetches top-100 upcoming conjunctions from SOCRATES Plus. Free, no auth required.

import dlt
import requests
import re
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, FloatType

SOCRATES_URL = "https://celestrak.org/SOCRATES-Plus/table-socrates.php?ORDER=MINRANGE&MAX=100&FORMAT=json"

@dlt.table(
    name="bronze_socrates",
    comment="Conjunction screening results from Celestrak SOCRATES Plus. Top-100 by minimum range. Updated 3x daily.",
    table_properties={"quality": "bronze"}
)
def bronze_socrates():
    try:
        response = requests.get(SOCRATES_URL, timeout=30)
        response.raise_for_status()
        records = response.json()

        if not records:
            return spark.createDataFrame([], schema="NAME1 STRING, NORAD1 STRING, NAME2 STRING, NORAD2 STRING, TCA STRING, MIN_RANGE_KM FLOAT")

        df = spark.createDataFrame(records)
        return df.withColumn("_ingested_at", F.current_timestamp())
    except Exception as e:
        print(f"Failed to fetch SOCRATES data: {e}")
        return spark.createDataFrame([], schema="NAME1 STRING, NORAD1 STRING, NAME2 STRING, NORAD2 STRING, TCA STRING, MIN_RANGE_KM FLOAT")
