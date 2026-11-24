# Databricks notebook source
# MAGIC %md
# MAGIC # Silver: Feature Engineering for ML
# MAGIC Builds feature vectors for the XGBoost Pc prediction model.

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, IntegerType

@dlt.table(
    name="silver_conjunction_features",
    comment="ML-ready feature vectors for conjunction probability prediction.",
    table_properties={"quality": "silver"}
)
def silver_conjunction_features():
    cdms = dlt.read("silver_cdms")

    return (cdms
        # Feature: inclination difference
        .withColumn("inclination_diff", F.abs(F.col("sat1_altitude_km") - F.col("sat2_altitude_km")))
        # Feature: altitude difference
        .withColumn("altitude_diff_km", F.abs(F.col("sat1_altitude_km") - F.col("sat2_altitude_km")))
        # Feature: is either object debris?
        .withColumn("is_debris",
            F.when(
                F.col("sat1_name").contains("DEB") | F.col("sat2_name").contains("DEB") |
                F.col("sat1_name").contains("R/B") | F.col("sat2_name").contains("R/B"),
                1
            ).otherwise(0).cast(IntegerType()))
        # Feature: orbit regime encoded
        .withColumn("orbit_regime_encoded",
            F.when(F.col("sat1_orbit_regime") == "LEO", 0)
            .when(F.col("sat1_orbit_regime") == "MEO", 1)
            .when(F.col("sat1_orbit_regime") == "GEO", 2)
            .otherwise(3).cast(IntegerType()))
        # Feature: days to TCA (capped)
        .withColumn("days_to_tca_capped", F.least(F.col("days_to_tca"), F.lit(7.0)))
        # Select final feature set
        .select(
            "cdm_id", "sat1_name", "sat2_name", "tca", "pc",  # keep original pc as label
            "miss_distance_km",
            "relative_velocity_kms",
            F.col("sat1_altitude_km").alias("altitude_a_km"),
            F.col("sat2_altitude_km").alias("altitude_b_km"),
            "altitude_diff_km",
            "inclination_diff",
            "days_to_tca_capped",
            "is_debris",
            "orbit_regime_encoded",
        )
    )
