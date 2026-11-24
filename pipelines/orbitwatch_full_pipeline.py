# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch: Full DLT Pipeline — Bronze → Silver → Gold

# COMMAND ----------

import dlt
import urllib.request
import urllib.parse
import json
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType
from datetime import datetime, timedelta

# COMMAND ----------

def spacetrack_fetch(path):
    user = spark.conf.get("spark.spacetrack.user")
    pw = spark.conf.get("spark.spacetrack.pass")
    login_data = urllib.parse.urlencode({"identity": user, "password": pw}).encode()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    opener.open("https://www.space-track.org/ajaxauth/login", login_data)
    resp = opener.open(f"https://www.space-track.org{path}")
    return json.loads(resp.read().decode())

# COMMAND ----------

@dlt.table(name="bronze_cdm", comment="Raw CDMs from Space-Track", table_properties={"quality": "bronze"})
def bronze_cdm():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    future = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
    path = f"/basicspacedata/query/class/cdm_public/TCA/{today}--{future}/orderby/PC%20desc/limit/200/format/json"
    cdms = spacetrack_fetch(path)
    schema = StructType([
        StructField("CDM_ID", StringType()), StructField("CREATED", StringType()),
        StructField("EMERGENCY_REPORTABLE", StringType()), StructField("TCA", StringType()),
        StructField("MIN_RNG", StringType()), StructField("PC", StringType()),
        StructField("SAT_1_ID", StringType()), StructField("SAT_1_NAME", StringType()),
        StructField("SAT1_OBJECT_TYPE", StringType()), StructField("SAT1_RCS", StringType()),
        StructField("SAT_1_EXCL_VOL", StringType()), StructField("SAT_2_ID", StringType()),
        StructField("SAT_2_NAME", StringType()), StructField("SAT2_OBJECT_TYPE", StringType()),
        StructField("SAT2_RCS", StringType()), StructField("SAT_2_EXCL_VOL", StringType()),
    ])
    return spark.createDataFrame(cdms, schema).withColumn("_ingested_at", F.current_timestamp())

# COMMAND ----------

@dlt.table(name="bronze_gp", comment="Raw GP data from Space-Track", table_properties={"quality": "bronze"})
def bronze_gp():
    all_records = []
    for obj_type, limit in [("PAYLOAD", 100), ("DEBRIS", 50), ("ROCKET BODY", 30)]:
        encoded_type = urllib.parse.quote(obj_type)
        path = f"/basicspacedata/query/class/gp/OBJECT_TYPE/{encoded_type}/orderby/NORAD_CAT_ID/limit/{limit}/format/json"
        try:
            all_records.extend(spacetrack_fetch(path))
        except Exception:
            pass
    for name in ["STARLINK", "ONEWEB", "IRIDIUM"]:
        path = f"/basicspacedata/query/class/gp/OBJECT_NAME/{name}~~/orderby/NORAD_CAT_ID/limit/50/format/json"
        try:
            all_records.extend(spacetrack_fetch(path))
        except Exception:
            pass
    seen, unique = set(), []
    for r in all_records:
        nid = r.get("NORAD_CAT_ID")
        if nid and nid not in seen:
            seen.add(nid)
            unique.append(r)
    return spark.createDataFrame(unique).withColumn("_ingested_at", F.current_timestamp())

# COMMAND ----------

@dlt.table(name="silver_satellites", comment="Parsed satellite catalog", table_properties={"quality": "silver"})
@dlt.expect_or_drop("valid_norad_id", "norad_id IS NOT NULL")
def silver_satellites():
    gp = dlt.read("bronze_gp")
    return gp.select(
        F.col("NORAD_CAT_ID").alias("norad_id"),
        F.col("OBJECT_NAME").alias("name"),
        F.col("OBJECT_TYPE").alias("object_type"),
        F.col("COUNTRY_CODE").alias("country_code"),
        F.col("RCS_SIZE").alias("rcs_size"),
        F.col("LAUNCH_DATE").cast("date").alias("launch_date"),
        F.col("EPOCH").cast("timestamp").alias("epoch"),
        F.col("SEMIMAJOR_AXIS").cast("double").alias("semi_major_axis"),
        F.col("ECCENTRICITY").cast("double").alias("eccentricity"),
        F.col("INCLINATION").cast("double").alias("inclination"),
        F.col("RA_OF_ASC_NODE").cast("double").alias("raan"),
        F.col("ARG_OF_PERICENTER").cast("double").alias("arg_of_perigee"),
        F.col("MEAN_ANOMALY").cast("double").alias("mean_anomaly"),
        F.col("MEAN_MOTION").cast("double").alias("mean_motion"),
        F.col("BSTAR").cast("double").alias("bstar"),
        F.col("APOAPSIS").cast("double").alias("apoapsis_km"),
        F.col("PERIAPSIS").cast("double").alias("periapsis_km"),
        F.col("PERIOD").cast("double").alias("period_min"),
        F.col("TLE_LINE1").alias("tle_line1"),
        F.col("TLE_LINE2").alias("tle_line2"),
        (F.col("SEMIMAJOR_AXIS").cast("double") - 6371).alias("altitude_km"),
        F.sqrt(F.lit(398600.4418) / F.col("SEMIMAJOR_AXIS").cast("double")).alias("velocity_kms"),
        F.when(F.col("OBJECT_TYPE") == "DEBRIS", "debris")
         .when(F.col("OBJECT_TYPE") == "ROCKET BODY", "rocket-body")
         .otherwise("active").alias("category"),
        F.when(F.col("OBJECT_NAME").startswith("STARLINK"), "SpaceX")
         .when(F.col("OBJECT_NAME").startswith("ONEWEB"), "OneWeb")
         .when(F.col("OBJECT_NAME").startswith("IRIDIUM"), "Iridium")
         .otherwise(F.col("COUNTRY_CODE")).alias("operator"),
        F.when(F.col("SEMIMAJOR_AXIS").cast("double") - 6371 < 2000, "LEO")
         .when(F.col("SEMIMAJOR_AXIS").cast("double") - 6371 < 35786, "MEO")
         .otherwise("GEO").alias("orbit_regime"),
        F.col("_ingested_at"),
    )

# COMMAND ----------

@dlt.table(name="silver_conjunctions", comment="Parsed conjunction events with risk tiers", table_properties={"quality": "silver"})
@dlt.expect_or_drop("valid_pc", "pc >= 0 AND pc <= 1")
@dlt.expect_or_drop("valid_tca", "tca IS NOT NULL")
def silver_conjunctions():
    cdm = dlt.read("bronze_cdm")
    return cdm.select(
        F.col("CDM_ID").alias("cdm_id"),
        F.col("CREATED").cast("timestamp").alias("created_at"),
        F.col("EMERGENCY_REPORTABLE").alias("emergency_reportable"),
        F.col("TCA").cast("timestamp").alias("tca"),
        F.col("MIN_RNG").cast("double").alias("miss_distance_km"),
        F.col("PC").cast("double").alias("pc"),
        F.col("SAT_1_ID").alias("sat_1_norad_id"),
        F.col("SAT_1_NAME").alias("sat_1_name"),
        F.col("SAT1_OBJECT_TYPE").alias("sat_1_type"),
        F.col("SAT1_RCS").alias("sat_1_rcs"),
        F.col("SAT_2_ID").alias("sat_2_norad_id"),
        F.col("SAT_2_NAME").alias("sat_2_name"),
        F.col("SAT2_OBJECT_TYPE").alias("sat_2_type"),
        F.col("SAT2_RCS").alias("sat_2_rcs"),
        F.when(F.col("PC").cast("double") > 0.001, "red")
         .when(F.col("PC").cast("double") > 0.0001, "amber")
         .otherwise("green").alias("risk_tier"),
        (F.col("PC").cast("double") > 0.0001).alias("maneuver_recommended"),
        ((F.col("TCA").cast("timestamp").cast("long") - F.current_timestamp().cast("long")) / 3600).alias("hours_to_tca"),
        F.col("_ingested_at"),
    ).dropDuplicates(["sat_1_norad_id", "sat_2_norad_id", "tca"])

# COMMAND ----------

@dlt.table(name="gold_conjunction_events", comment="Risk-scored conjunction events", table_properties={"quality": "gold"})
def gold_conjunction_events():
    conj = dlt.read("silver_conjunctions")
    sats = dlt.read("silver_satellites")
    enriched = conj.join(
        sats.select(
            F.col("norad_id").alias("sat_1_norad_id"),
            F.col("altitude_km").alias("sat_1_altitude"),
            F.col("velocity_kms").alias("sat_1_velocity"),
            F.col("inclination").alias("sat_1_inclination"),
            F.col("operator").alias("sat_1_operator"),
            F.col("orbit_regime").alias("sat_1_orbit"),
        ), "sat_1_norad_id", "left"
    ).join(
        sats.select(
            F.col("norad_id").alias("sat_2_norad_id"),
            F.col("altitude_km").alias("sat_2_altitude"),
            F.col("velocity_kms").alias("sat_2_velocity"),
            F.col("inclination").alias("sat_2_inclination"),
            F.col("operator").alias("sat_2_operator"),
            F.col("orbit_regime").alias("sat_2_orbit"),
        ), "sat_2_norad_id", "left"
    )
    return enriched.select(
        "*",
        F.abs(F.col("sat_1_velocity") - F.col("sat_2_velocity")).alias("relative_velocity_kms"),
        F.abs(F.col("sat_1_inclination") - F.col("sat_2_inclination")).alias("inclination_diff"),
        F.abs(F.col("sat_1_altitude") - F.col("sat_2_altitude")).alias("altitude_diff_km"),
        (F.col("tca") - F.expr("INTERVAL 48 HOURS")).alias("maneuver_window_open"),
        (F.col("tca") - F.expr("INTERVAL 6 HOURS")).alias("maneuver_window_close"),
    )

# COMMAND ----------

@dlt.table(name="gold_operator_risk_summary", comment="Risk aggregated by operator", table_properties={"quality": "gold"})
def gold_operator_risk_summary():
    events = dlt.read("gold_conjunction_events")
    return events.groupBy("sat_1_operator").agg(
        F.count("*").alias("total_conjunctions"),
        F.sum(F.when(F.col("risk_tier") == "red", 1).otherwise(0)).alias("red_events"),
        F.sum(F.when(F.col("risk_tier") == "amber", 1).otherwise(0)).alias("amber_events"),
        F.sum(F.when(F.col("risk_tier") == "green", 1).otherwise(0)).alias("green_events"),
        F.avg("pc").alias("avg_pc"),
        F.min("miss_distance_km").alias("min_miss_distance_km"),
        F.avg("miss_distance_km").alias("avg_miss_distance_km"),
    ).withColumnRenamed("sat_1_operator", "operator")

# COMMAND ----------

@dlt.table(name="gold_orbit_regime_analytics", comment="Conjunction density by orbit regime", table_properties={"quality": "gold"})
def gold_orbit_regime_analytics():
    events = dlt.read("gold_conjunction_events")
    return events.groupBy("sat_1_orbit").agg(
        F.count("*").alias("total_events"),
        F.avg("pc").alias("avg_pc"),
        F.min("miss_distance_km").alias("closest_approach_km"),
        F.countDistinct("sat_1_norad_id").alias("unique_objects"),
    ).withColumnRenamed("sat_1_orbit", "orbit_regime")
