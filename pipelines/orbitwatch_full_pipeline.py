# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch: Full Lakeflow Pipeline — Bronze → Silver → Gold
# MAGIC
# MAGIC * Space-Track `cdm_public.MIN_RNG` is published in **meters**. `miss_distance_m` keeps the published value,
# MAGIC   `miss_distance_km` = MIN_RNG / 1000.
# MAGIC * Space-Track issues several CDM updates per physical conjunction and publishes each update in both
# MAGIC   orderings (A x B and B x A). `event_key` groups them in `gold_conjunction_events`, and
# MAGIC   `gold_conjunction_event_latest` holds one row per physical event.

# COMMAND ----------

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from pyspark import pipelines as dp
from pyspark.sql import Window
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType

# COMMAND ----------

EARTH_RADIUS_KM = 6378.135   # equatorial radius Space-Track uses for GP APOAPSIS/PERIAPSIS (WGS-72)
MU_EARTH = 398600.4418       # km^3/s^2
J2 = 1.08262668e-3
EVENT_GAP_SECONDS = 30 * 60  # same object pair: a TCA > 30 min after the previous CDM's TCA starts a new event
RED_PC = 1e-3
AMBER_PC = 1e-4

_SESSION = {}
_CACHE = {}


def _spacetrack_opener():
    """One authenticated Space-Track session per pipeline update instead of a login per request."""
    if "opener" not in _SESSION or time.time() - _SESSION["at"] > 1800:
        user = spark.conf.get("spark.spacetrack.user")
        pw = spark.conf.get("spark.spacetrack.pass")
        login_data = urllib.parse.urlencode({"identity": user, "password": pw}).encode()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
        opener.open("https://www.space-track.org/ajaxauth/login", login_data)
        _SESSION.update(opener=opener, at=time.time())
    return _SESSION["opener"]


def spacetrack_fetch(path):
    resp = _spacetrack_opener().open(f"https://www.space-track.org{path}")
    return json.loads(resp.read().decode())


def fetch_cdms():
    """Public CDMs with TCA in the next 7 days, highest Pc first.

    Memoized so bronze_cdm and bronze_gp (which needs the CDM objects' NORAD IDs) share one call.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    future = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    path = f"/basicspacedata/query/class/cdm_public/TCA/{today}--{future}/orderby/PC%20desc/limit/200/format/json"
    hit = _CACHE.get(path)
    if hit is None or time.time() - hit[0] > 600:
        hit = (time.time(), spacetrack_fetch(path))
        _CACHE[path] = hit
    return hit[1]

# COMMAND ----------

@dp.materialized_view(name="bronze_cdm", comment="Raw CDMs from Space-Track cdm_public (MIN_RNG in meters)", table_properties={"quality": "bronze"})
def bronze_cdm():
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
    return spark.createDataFrame(fetch_cdms(), schema).withColumn("_ingested_at", F.current_timestamp())

# COMMAND ----------

@dp.materialized_view(name="bronze_gp", comment="Raw GP data from Space-Track: every object in the current CDMs plus reference sets", table_properties={"quality": "bronze"})
def bronze_gp():
    all_records = []
    # GP elements for both objects of every CDM, so each conjunction can be enriched with real orbits.
    try:
        cdm_norads = sorted({str(c[k]) for c in fetch_cdms() for k in ("SAT_1_ID", "SAT_2_ID") if c.get(k)})
    except Exception:
        cdm_norads = []
    for i in range(0, len(cdm_norads), 100):
        path = f"/basicspacedata/query/class/gp/NORAD_CAT_ID/{','.join(cdm_norads[i:i + 100])}/format/json"
        try:
            all_records.extend(spacetrack_fetch(path))
        except Exception:
            pass
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

@dp.materialized_view(name="silver_satellites", comment="Parsed satellite catalog. altitude_km = semi-major axis minus equatorial radius (mean altitude)", table_properties={"quality": "silver"})
@dp.expect_or_drop("valid_norad_id", "norad_id IS NOT NULL")
def silver_satellites():
    gp = spark.read.table("bronze_gp")
    sma = F.col("SEMIMAJOR_AXIS").cast("double")
    altitude = sma - F.lit(EARTH_RADIUS_KM)
    return gp.select(
        F.col("NORAD_CAT_ID").alias("norad_id"),
        F.col("OBJECT_NAME").alias("name"),
        F.col("OBJECT_TYPE").alias("object_type"),
        F.col("COUNTRY_CODE").alias("country_code"),
        F.col("RCS_SIZE").alias("rcs_size"),
        F.col("LAUNCH_DATE").cast("date").alias("launch_date"),
        F.col("EPOCH").cast("timestamp").alias("epoch"),
        sma.alias("semi_major_axis"),
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
        altitude.alias("altitude_km"),
        F.sqrt(F.lit(MU_EARTH) / sma).alias("velocity_kms"),
        F.when(F.col("OBJECT_TYPE") == "DEBRIS", "debris")
         .when(F.col("OBJECT_TYPE") == "ROCKET BODY", "rocket-body")
         .otherwise("active").alias("category"),
        F.when(F.col("OBJECT_NAME").startswith("STARLINK"), "SpaceX")
         .when(F.col("OBJECT_NAME").startswith("ONEWEB"), "OneWeb")
         .when(F.col("OBJECT_NAME").startswith("IRIDIUM"), "Iridium")
         .otherwise(F.col("COUNTRY_CODE")).alias("operator"),
        F.when(altitude.isNull(), F.lit(None).cast("string"))
         .when(altitude < 2000, "LEO")
         .when(altitude < 35786, "MEO")
         .otherwise("GEO").alias("orbit_regime"),
        F.col("_ingested_at"),
    )

# COMMAND ----------

@dp.materialized_view(
    name="silver_conjunctions",
    comment="One row per CDM with risk tiers. miss_distance_m = MIN_RNG as published (meters); miss_distance_km = MIN_RNG / 1000",
    table_properties={"quality": "silver"},
)
@dp.expect_or_drop("valid_pc", "pc >= 0 AND pc <= 1")
@dp.expect_or_drop("valid_tca", "tca IS NOT NULL")
@dp.expect_or_drop("valid_object_pair", "sat_1_norad_id IS NOT NULL AND sat_2_norad_id IS NOT NULL")
@dp.expect("miss_distance_within_5km", "miss_distance_km BETWEEN 0 AND 5")
def silver_conjunctions():
    cdm = spark.read.table("bronze_cdm")
    pc = F.col("PC").cast("double")
    miss_m = F.col("MIN_RNG").cast("double")
    return cdm.select(
        F.col("CDM_ID").alias("cdm_id"),
        F.col("CREATED").cast("timestamp").alias("created_at"),
        F.col("EMERGENCY_REPORTABLE").alias("emergency_reportable"),
        F.col("TCA").cast("timestamp").alias("tca"),
        miss_m.alias("miss_distance_m"),
        (miss_m / 1000.0).alias("miss_distance_km"),
        pc.alias("pc"),
        F.col("SAT_1_ID").alias("sat_1_norad_id"),
        F.col("SAT_1_NAME").alias("sat_1_name"),
        F.col("SAT1_OBJECT_TYPE").alias("sat_1_type"),
        F.col("SAT1_RCS").alias("sat_1_rcs"),
        F.col("SAT_2_ID").alias("sat_2_norad_id"),
        F.col("SAT_2_NAME").alias("sat_2_name"),
        F.col("SAT2_OBJECT_TYPE").alias("sat_2_type"),
        F.col("SAT2_RCS").alias("sat_2_rcs"),
        F.when(pc > RED_PC, "red")
         .when(pc > AMBER_PC, "amber")
         .otherwise("green").alias("risk_tier"),
        (pc > AMBER_PC).alias("maneuver_recommended"),
        ((F.col("TCA").cast("timestamp").cast("long") - F.current_timestamp().cast("long")) / 3600).alias("hours_to_tca"),
        F.col("_ingested_at"),
    ).dropDuplicates(["cdm_id"])  # CDM_ID is unique per CDM; distinct updates can share a TCA

# COMMAND ----------

_ORBIT_HELPERS = [f"_{c}_{s}" for c in ("raan", "sma", "ecc", "epoch") for s in ("1", "2")]


def _orbit_cols(sats, side):
    return sats.select(
        F.col("norad_id").alias(f"sat_{side}_norad_id"),
        F.col("altitude_km").alias(f"sat_{side}_altitude"),
        F.col("velocity_kms").alias(f"sat_{side}_velocity"),
        F.col("inclination").alias(f"sat_{side}_inclination"),
        F.col("operator").alias(f"sat_{side}_operator"),
        F.col("orbit_regime").alias(f"sat_{side}_orbit"),
        F.col("raan").alias(f"_raan_{side}"),
        F.col("semi_major_axis").alias(f"_sma_{side}"),
        F.col("eccentricity").alias(f"_ecc_{side}"),
        F.col("epoch").alias(f"_epoch_{side}"),
    )


def _raan_at_tca_rad(side):
    """RAAN propagated from the GP epoch to TCA with the secular J2 drift."""
    sma, ecc = F.col(f"_sma_{side}"), F.col(f"_ecc_{side}")
    mean_motion = F.sqrt(F.lit(MU_EARTH) / F.pow(sma, 3))  # rad/s
    semi_latus = sma * (F.lit(1.0) - ecc * ecc)
    raan_rate = F.lit(-1.5 * J2) * F.pow(F.lit(EARTH_RADIUS_KM) / semi_latus, 2) * mean_motion * F.cos(F.radians(f"sat_{side}_inclination"))
    dt_s = F.col("tca").cast("double") - F.col(f"_epoch_{side}").cast("double")
    return F.radians(f"_raan_{side}") + raan_rate * dt_s


def _encounter_speed_kms():
    """Relative speed at the conjunction for near-circular orbits.

    At the mutual node both velocity vectors are perpendicular to the line of nodes, so the angle between
    them is the angle between the orbit planes: cos(theta) = cos i1 cos i2 + sin i1 sin i2 cos(dRAAN).
    """
    i1, i2 = F.radians("sat_1_inclination"), F.radians("sat_2_inclination")
    cos_theta = F.cos(i1) * F.cos(i2) + F.sin(i1) * F.sin(i2) * F.cos(_raan_at_tca_rad("1") - _raan_at_tca_rad("2"))
    v1, v2 = F.col("sat_1_velocity"), F.col("sat_2_velocity")
    v_sq = v1 * v1 + v2 * v2 - F.lit(2.0) * v1 * v2 * cos_theta
    return F.sqrt(F.when(v_sq < 0, F.lit(0.0)).otherwise(v_sq))


def _with_event_key(df):
    """event_key = <lo NORAD>-<hi NORAD>-<yyyyMMddHHmm of the event's earliest TCA>.

    CDMs of the same unordered pair are sorted by TCA; a TCA more than EVENT_GAP_SECONDS after the
    previous CDM's TCA starts a new event. This folds CDM updates and both orderings into one event.
    """
    id1, id2 = F.col("sat_1_norad_id"), F.col("sat_2_norad_id")
    n1, n2 = id1.cast("bigint"), id2.cast("bigint")
    numeric = n1.isNotNull() & n2.isNotNull()
    pair_w = Window.partitionBy("_pair_lo", "_pair_hi").orderBy("tca", "created_at", "_cdm_num")
    gap_s = F.col("tca").cast("double") - F.lag("tca").over(pair_w).cast("double")
    event_w = Window.partitionBy("_pair_lo", "_pair_hi", "_event_seq")
    return (
        df.withColumn("_pair_lo", F.when(numeric, F.least(n1, n2).cast("string")).otherwise(F.least(id1, id2)))
          .withColumn("_pair_hi", F.when(numeric, F.greatest(n1, n2).cast("string")).otherwise(F.greatest(id1, id2)))
          .withColumn("_cdm_num", F.col("cdm_id").cast("bigint"))
          .withColumn("_new_event", F.when(gap_s.isNull() | (gap_s > EVENT_GAP_SECONDS), 1).otherwise(0))
          .withColumn("_event_seq", F.sum("_new_event").over(pair_w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("event_key", F.concat_ws("-", "_pair_lo", "_pair_hi",
                                               F.date_format(F.min("tca").over(event_w), "yyyyMMddHHmm")))
          .drop("_pair_lo", "_pair_hi", "_cdm_num", "_new_event", "_event_seq")
    )


@dp.materialized_view(
    name="gold_conjunction_events",
    comment=(
        "One row per CDM, enriched with both objects' orbits. event_key groups the CDM updates and both "
        "orderings (A x B, B x A) of one physical conjunction. relative_velocity_kms is the circular-orbit "
        "encounter speed from the angle between the orbit planes (RAAN J2-propagated to TCA)."
    ),
    table_properties={"quality": "gold"},
)
def gold_conjunction_events():
    conj = spark.read.table("silver_conjunctions")
    sats = spark.read.table("silver_satellites")
    enriched = (
        conj.join(_orbit_cols(sats, "1"), "sat_1_norad_id", "left")
            .join(_orbit_cols(sats, "2"), "sat_2_norad_id", "left")
            .withColumn("relative_velocity_kms", _encounter_speed_kms())
            .withColumn("inclination_diff", F.abs(F.col("sat_1_inclination") - F.col("sat_2_inclination")))
            .withColumn("altitude_diff_km", F.abs(F.col("sat_1_altitude") - F.col("sat_2_altitude")))
            .withColumn("maneuver_window_open", F.col("tca") - F.expr("INTERVAL 48 HOURS"))
            .withColumn("maneuver_window_close", F.col("tca") - F.expr("INTERVAL 6 HOURS"))
            .drop(*_ORBIT_HELPERS)
    )
    return _with_event_key(enriched)

# COMMAND ----------

@dp.materialized_view(
    name="gold_conjunction_event_latest",
    comment=(
        "One row per physical conjunction (event_key) carrying every column of its latest CDM "
        "(max created_at, ties to the highest cdm_id). cdm_count = distinct CDM updates (the A x B and "
        "B x A copies of an update count once); cdm_record_count = raw CDM rows; first_pc = Pc of the "
        "earliest-created CDM; pc_history = one entry per update sorted by created_at."
    ),
    table_properties={"quality": "gold"},
)
def gold_conjunction_event_latest():
    cdms = spark.read.table("gold_conjunction_events").withColumn("_cdm_num", F.col("cdm_id").cast("bigint"))
    latest_w = Window.partitionBy("event_key").orderBy(
        F.col("created_at").desc(), F.col("_cdm_num").desc(), F.col("cdm_id").desc()
    )
    latest = (
        cdms.withColumn("_rn", F.row_number().over(latest_w))
            .filter(F.col("_rn") == 1)
            .drop("_rn", "_cdm_num")
    )
    stats = cdms.groupBy("event_key").agg(
        F.count("*").alias("cdm_record_count"),
        F.min("created_at").alias("first_created_at"),
        F.min_by("pc", F.struct("created_at", "_cdm_num")).alias("first_pc"),
        F.max("pc").alias("max_pc"),
    )
    # Both orderings of one CDM update carry the same TCA, Pc and miss distance.
    updates = cdms.groupBy("event_key", "tca", "pc", "miss_distance_m").agg(F.min("created_at").alias("created_at"))
    history = updates.groupBy("event_key").agg(
        F.count("*").alias("cdm_count"),
        F.array_sort(F.collect_list(F.struct("created_at", "pc", "miss_distance_m"))).alias("pc_history"),
    )
    return latest.join(stats, "event_key").join(history, "event_key")

# COMMAND ----------

@dp.materialized_view(
    name="gold_operator_risk_summary",
    comment="Distinct conjunction events per operator, from the latest CDM of each event; an event counts once for each operator involved",
    table_properties={"quality": "gold"},
)
def gold_operator_risk_summary():
    events = spark.read.table("gold_conjunction_event_latest")
    per_operator = events.select(
        "event_key", "risk_tier", "pc", "miss_distance_km",
        F.explode(F.array_distinct(F.array(
            F.coalesce(F.col("sat_1_operator"), F.lit("UNKNOWN")),
            F.coalesce(F.col("sat_2_operator"), F.lit("UNKNOWN")),
        ))).alias("operator"),
    )
    return per_operator.groupBy("operator").agg(
        F.count("*").alias("total_conjunctions"),
        F.sum(F.when(F.col("risk_tier") == "red", 1).otherwise(0)).alias("red_events"),
        F.sum(F.when(F.col("risk_tier") == "amber", 1).otherwise(0)).alias("amber_events"),
        F.sum(F.when(F.col("risk_tier") == "green", 1).otherwise(0)).alias("green_events"),
        F.avg("pc").alias("avg_pc"),
        F.min("miss_distance_km").alias("min_miss_distance_km"),
        F.avg("miss_distance_km").alias("avg_miss_distance_km"),
    )

# COMMAND ----------

@dp.materialized_view(
    name="gold_orbit_regime_analytics",
    comment="Distinct conjunction events per orbit regime of the objects involved, from the latest CDM of each event",
    table_properties={"quality": "gold"},
)
def gold_orbit_regime_analytics():
    events = spark.read.table("gold_conjunction_event_latest")
    objects = events.select(
        "event_key", "pc", "miss_distance_km",
        F.explode(F.array(
            F.struct(F.coalesce(F.col("sat_1_orbit"), F.lit("UNKNOWN")).alias("orbit_regime"),
                     F.col("sat_1_norad_id").alias("norad_id")),
            F.struct(F.coalesce(F.col("sat_2_orbit"), F.lit("UNKNOWN")).alias("orbit_regime"),
                     F.col("sat_2_norad_id").alias("norad_id")),
        )).alias("obj"),
    ).select("event_key", "pc", "miss_distance_km", "obj.orbit_regime", "obj.norad_id")
    per_event = objects.dropDuplicates(["orbit_regime", "event_key"]).groupBy("orbit_regime").agg(
        F.count("*").alias("total_events"),
        F.avg("pc").alias("avg_pc"),
        F.min("miss_distance_km").alias("closest_approach_km"),
    )
    per_object = objects.groupBy("orbit_regime").agg(F.countDistinct("norad_id").alias("unique_objects"))
    return per_event.join(per_object, "orbit_regime")
