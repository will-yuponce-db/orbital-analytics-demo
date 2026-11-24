# Databricks notebook source
# MAGIC %md
# MAGIC # Silver: Orbital Elements
# MAGIC Parses raw OMM data from Celestrak into validated orbital elements.
# MAGIC Computes derived quantities: altitude, velocity, period.

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType

EARTH_RADIUS_KM = 6371.0
MU_KM3_S2 = 398600.4418  # Earth's gravitational parameter

@dlt.table(
    name="silver_orbital_elements",
    comment="Validated orbital elements with derived quantities (altitude, velocity, period).",
    table_properties={"quality": "silver"}
)
@dlt.expect_all_or_drop({
    "valid_eccentricity": "ECCENTRICITY BETWEEN 0 AND 0.99",
    "valid_inclination": "INCLINATION BETWEEN 0 AND 180",
    "has_norad_id": "NORAD_CAT_ID IS NOT NULL",
    "has_epoch": "EPOCH IS NOT NULL",
})
def silver_orbital_elements():
    df = dlt.read("bronze_tles")

    return (df
        .withColumn("norad_cat_id", F.col("NORAD_CAT_ID").cast("string"))
        .withColumn("name", F.col("OBJECT_NAME"))
        .withColumn("epoch", F.to_timestamp("EPOCH"))
        .withColumn("eccentricity", F.col("ECCENTRICITY").cast(DoubleType()))
        .withColumn("inclination", F.col("INCLINATION").cast(DoubleType()))
        .withColumn("raan", F.col("RA_OF_ASC_NODE").cast(DoubleType()))
        .withColumn("arg_of_perigee", F.col("ARG_OF_PERICENTER").cast(DoubleType()))
        .withColumn("mean_anomaly", F.col("MEAN_ANOMALY").cast(DoubleType()))
        .withColumn("mean_motion", F.col("MEAN_MOTION").cast(DoubleType()))
        .withColumn("bstar", F.col("BSTAR").cast(DoubleType()))
        # Derived: semi-major axis from mean motion (rad/s)
        .withColumn("mean_motion_rad_s", F.col("mean_motion") * 2 * 3.14159265 / 86400.0)
        .withColumn("semi_major_axis_km", F.pow(MU_KM3_S2 / F.pow(F.col("mean_motion_rad_s"), 2), 1.0/3.0))
        # Derived: altitude (from semi-major axis, approximate)
        .withColumn("altitude_km", F.col("semi_major_axis_km") - EARTH_RADIUS_KM)
        # Derived: orbital velocity
        .withColumn("velocity_kms", F.sqrt(MU_KM3_S2 / F.col("semi_major_axis_km")))
        # Derived: orbit regime
        .withColumn("orbit_regime",
            F.when(F.col("altitude_km") < 2000, "LEO")
            .when(F.col("altitude_km") < 35786, "MEO")
            .when(F.col("altitude_km") < 36000, "GEO")
            .otherwise("HEO"))
        .withColumn("category", F.col("_source_category"))
        .select("norad_cat_id", "name", "epoch", "eccentricity", "inclination",
                "raan", "arg_of_perigee", "mean_anomaly", "mean_motion", "bstar",
                "semi_major_axis_km", "altitude_km", "velocity_kms", "orbit_regime", "category")
    )
