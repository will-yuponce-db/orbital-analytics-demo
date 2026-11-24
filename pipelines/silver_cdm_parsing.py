# Databricks notebook source
# MAGIC %md
# MAGIC # Silver: CDM Parsing
# MAGIC Parses raw CDMs, validates fields, joins with satellite catalog.

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, TimestampType

@dlt.table(
    name="silver_cdms",
    comment="Validated and parsed Conjunction Data Messages with satellite orbit context.",
    table_properties={"quality": "silver"}
)
@dlt.expect_all_or_drop({
    "valid_pc": "pc BETWEEN 0 AND 1",
    "has_miss_distance": "miss_distance_km > 0",
    "has_sat_names": "sat1_name IS NOT NULL AND sat2_name IS NOT NULL",
})
def silver_cdms():
    cdms = dlt.read("bronze_cdms")
    orbital = dlt.read("silver_orbital_elements")

    # Parse key CDM fields
    parsed = (cdms
        .withColumn("cdm_id", F.col("CDM_ID"))
        .withColumn("sat1_name", F.col("SAT1_NAME"))
        .withColumn("sat1_norad", F.col("SAT1_OBJECT_DESIGNATOR"))
        .withColumn("sat2_name", F.col("SAT2_NAME"))
        .withColumn("sat2_norad", F.col("SAT2_OBJECT_DESIGNATOR"))
        .withColumn("tca", F.to_timestamp("TCA"))
        .withColumn("miss_distance_km", (F.col("MISS_DISTANCE").cast(DoubleType()) / 1000.0))  # meters -> km
        .withColumn("pc", F.col("COLLISION_PROBABILITY").cast(DoubleType()))
        .withColumn("relative_velocity_kms", (F.col("RELATIVE_SPEED").cast(DoubleType()) / 1000.0))
        .withColumn("days_to_tca", F.datediff(F.col("tca"), F.current_timestamp()).cast(DoubleType()))
    )

    # Join with orbital data to get orbit regime for each sat
    sat1_orbit = orbital.select(
        F.col("norad_cat_id").alias("sat1_norad_match"),
        F.col("altitude_km").alias("sat1_altitude_km"),
        F.col("orbit_regime").alias("sat1_orbit_regime"),
    )
    sat2_orbit = orbital.select(
        F.col("norad_cat_id").alias("sat2_norad_match"),
        F.col("altitude_km").alias("sat2_altitude_km"),
        F.col("orbit_regime").alias("sat2_orbit_regime"),
    )

    return (parsed
        .join(sat1_orbit, parsed.sat1_norad == sat1_orbit.sat1_norad_match, "left")
        .join(sat2_orbit, parsed.sat2_norad == sat2_orbit.sat2_norad_match, "left")
        .select("cdm_id", "sat1_name", "sat1_norad", "sat2_name", "sat2_norad",
                "tca", "miss_distance_km", "pc", "relative_velocity_kms", "days_to_tca",
                "sat1_altitude_km", "sat1_orbit_regime", "sat2_altitude_km", "sat2_orbit_regime")
    )
