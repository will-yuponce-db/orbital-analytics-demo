# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch - Gold Layer: Risk Scoring & Analytics
# MAGIC
# MAGIC **Space Domain Awareness (SDA) Pipeline - Medallion Architecture**
# MAGIC
# MAGIC This notebook produces analytics-ready gold tables consumed by dashboards,
# MAGIC ML models, and operational decision support tools. Three gold tables:
# MAGIC
# MAGIC 1. **gold_conjunction_risk_dashboard**: Aggregated risk metrics per satellite,
# MAGIC    risk tier distributions, and time-to-TCA bucketing. Powers the OrbitWatch
# MAGIC    real-time COLA dashboard used by satellite operators and USSF analysts.
# MAGIC
# MAGIC 2. **gold_anomaly_detection_features**: Feature engineering for ML-based
# MAGIC    anomaly detection. Computes orbital parameter deltas, velocity deviations,
# MAGIC    and decay rate features used to detect maneuvers, breakups, and anomalous
# MAGIC    behavior in the RSO catalog. Supports the DoD Responsible AI framework.
# MAGIC
# MAGIC 3. **gold_sensor_coverage_metrics**: Tracking network performance aggregation.
# MAGIC    Measures observation cadence, catalog completeness, and regime-specific
# MAGIC    coverage -- relevant for USSF Space Surveillance Network (SSN) capacity
# MAGIC    planning and sensor tasking optimization.
# MAGIC
# MAGIC **Catalog**: `stable_demo_wy_catalog`
# MAGIC **Schema**: `orbitwatch`

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold: Conjunction Risk Dashboard
# MAGIC
# MAGIC Aggregated view for the OrbitWatch operational dashboard. Each row represents
# MAGIC a satellite with its current conjunction threat landscape -- total active
# MAGIC conjunctions, highest risk tier, nearest TCA, and risk distribution.
# MAGIC
# MAGIC This table is optimized for low-latency dashboard queries and is the primary
# MAGIC data source for the OrbitWatch React frontend. USSF operators use this view
# MAGIC for shift turnover briefs and watch commander situational awareness.

# COMMAND ----------


@dlt.table(
    name="gold_conjunction_risk_dashboard",
    comment=(
        "Aggregated conjunction risk metrics per satellite for the OrbitWatch "
        "operational dashboard. Includes active conjunction count, highest risk tier, "
        "nearest TCA, risk tier distribution, and time-to-TCA bucketing. Optimized "
        "for real-time dashboard rendering and USSF watch commander briefs."
    ),
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "domain": "space_domain_awareness",
    },
)
def gold_conjunction_risk_dashboard():
    """
    Aggregate conjunction risk metrics per satellite for dashboard consumption.

    Produces one row per satellite (primary object in CDMs) with:
    - Total active conjunctions (where TCA is in the future)
    - Highest risk tier across all active conjunctions
    - Nearest TCA and time remaining
    - Count of conjunctions per risk tier (RED, AMBER, YELLOW, GREEN)
    - Time-to-TCA bucketing (< 6h, 6-24h, 24-48h, 48h-7d, > 7d)
    - Maximum collision probability across all active events
    - Count of emergency-reportable CDMs
    - Average and max relative velocity (for impact energy awareness)

    This view supports rapid triage: operators sort by highest risk tier
    and nearest TCA to prioritize their COLA response.
    """
    conjunctions = dlt.read("silver_conjunction_analysis")

    # Filter to active conjunctions only (TCA in the future)
    active = conjunctions.filter(F.col("tca") > F.current_timestamp())

    # Aggregate per primary satellite (sat1)
    dashboard = (
        active.groupBy("sat1_norad_id", "sat1_name")
        .agg(
            # Total active conjunction events for this satellite
            F.count("*").alias("active_conjunction_count"),
            # Highest collision probability across all events
            F.max("collision_probability").alias("max_collision_probability"),
            # Maximum risk score (0-100)
            F.max("risk_score").alias("max_risk_score"),
            # Nearest TCA -- most urgent event
            F.min("tca").alias("nearest_tca"),
            F.min("time_to_tca_hours").alias("hours_to_nearest_tca"),
            # Risk tier distribution -- how many conjunctions per tier
            F.sum(F.when(F.col("risk_tier") == "RED", 1).otherwise(0)).alias(
                "red_count"
            ),
            F.sum(F.when(F.col("risk_tier") == "AMBER", 1).otherwise(0)).alias(
                "amber_count"
            ),
            F.sum(F.when(F.col("risk_tier") == "YELLOW", 1).otherwise(0)).alias(
                "yellow_count"
            ),
            F.sum(F.when(F.col("risk_tier") == "GREEN", 1).otherwise(0)).alias(
                "green_count"
            ),
            # Time-to-TCA bucketing for operational urgency distribution
            F.sum(
                F.when(F.col("time_to_tca_hours") < 6, 1).otherwise(0)
            ).alias("tca_bucket_lt_6h"),
            F.sum(
                F.when(
                    (F.col("time_to_tca_hours") >= 6)
                    & (F.col("time_to_tca_hours") < 24),
                    1,
                ).otherwise(0)
            ).alias("tca_bucket_6h_24h"),
            F.sum(
                F.when(
                    (F.col("time_to_tca_hours") >= 24)
                    & (F.col("time_to_tca_hours") < 48),
                    1,
                ).otherwise(0)
            ).alias("tca_bucket_24h_48h"),
            F.sum(
                F.when(
                    (F.col("time_to_tca_hours") >= 48)
                    & (F.col("time_to_tca_hours") < 168),
                    1,
                ).otherwise(0)
            ).alias("tca_bucket_48h_7d"),
            F.sum(
                F.when(F.col("time_to_tca_hours") >= 168, 1).otherwise(0)
            ).alias("tca_bucket_gt_7d"),
            # Emergency-reportable CDM count
            F.sum(
                F.when(F.col("is_emergency") == True, 1).otherwise(0)
            ).alias("emergency_cdm_count"),
            # Relative velocity statistics -- impact energy proxy
            F.avg("relative_velocity_km_s").alias("avg_relative_velocity_km_s"),
            F.max("relative_velocity_km_s").alias("max_relative_velocity_km_s"),
            # Most recent CDM ingestion for data freshness monitoring
            F.max("_ingestion_timestamp").alias("latest_cdm_ingestion"),
        )
        # Derive the highest active risk tier for this satellite
        .withColumn(
            "highest_risk_tier",
            F.when(F.col("red_count") > 0, F.lit("RED"))
            .when(F.col("amber_count") > 0, F.lit("AMBER"))
            .when(F.col("yellow_count") > 0, F.lit("YELLOW"))
            .otherwise(F.lit("GREEN")),
        )
        # Urgency classification for watch commander quick scan
        .withColumn(
            "urgency",
            F.when(
                (F.col("highest_risk_tier") == "RED")
                & (F.col("hours_to_nearest_tca") < 24),
                F.lit("IMMEDIATE"),
            )
            .when(F.col("highest_risk_tier") == "RED", F.lit("HIGH"))
            .when(
                (F.col("highest_risk_tier") == "AMBER")
                & (F.col("hours_to_nearest_tca") < 48),
                F.lit("HIGH"),
            )
            .when(F.col("highest_risk_tier") == "AMBER", F.lit("MODERATE"))
            .otherwise(F.lit("ROUTINE")),
        )
        .withColumn("_dashboard_updated_at", F.current_timestamp())
    )

    return dashboard


# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold: Anomaly Detection Features
# MAGIC
# MAGIC Feature engineering table for ML-based space object anomaly detection.
# MAGIC Computes temporal deltas in orbital parameters that indicate:
# MAGIC
# MAGIC - **Maneuvers**: Sudden changes in semi-major axis, inclination, or RAAN
# MAGIC   indicate an active burn. Important for characterizing foreign adversary
# MAGIC   satellite behavior (e.g., RPO -- rendezvous and proximity operations).
# MAGIC
# MAGIC - **Breakups/Fragmentations**: Anomalous velocity deviations across multiple
# MAGIC   objects with similar epochs suggest a fragmentation event (ASAT test,
# MAGIC   accidental collision, or battery/propellant explosion).
# MAGIC
# MAGIC - **Orbital Decay**: Accelerating mean motion and decreasing semi-major axis
# MAGIC   indicate atmospheric drag-induced decay, critical for reentry prediction.
# MAGIC
# MAGIC These features feed into Databricks ML models for automated anomaly
# MAGIC classification, supporting the USSF characterization mission.

# COMMAND ----------


@dlt.table(
    name="gold_anomaly_detection_features",
    comment=(
        "Feature engineering table for ML-based anomaly detection on resident space "
        "objects. Computes temporal deltas in orbital parameters (semi-major axis, "
        "inclination, eccentricity, BSTAR) to detect maneuvers, breakups, and orbital "
        "decay. Supports USSF space object characterization and adversary behavior "
        "analysis (RPO detection, ASAT event identification)."
    ),
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "domain": "space_domain_awareness",
    },
)
def gold_anomaly_detection_features():
    """
    Compute orbital parameter deltas and anomaly detection features.

    Uses window functions to compare each observation against the previous
    observation for the same object (ordered by epoch). Deltas that exceed
    physical thresholds are flagged as potential anomalies:

    - delta_sma > 10 km between observations: possible maneuver
    - delta_inclination > 0.1 deg: possible plane-change maneuver
    - bstar_ratio > 10x previous: possible attitude change or breakup
    - mean_motion acceleration beyond drag model: possible fragmentation

    Features are designed for input to gradient-boosted classifiers or
    autoencoders trained on the historical catalog.
    """
    orbital = dlt.read("silver_orbital_elements")

    # Window: per object, ordered by epoch (chronological observation sequence)
    w = Window.partitionBy("norad_cat_id").orderBy("epoch")

    features = (
        orbital
        # Previous observation values (lag by 1 epoch)
        .withColumn("prev_epoch", F.lag("epoch", 1).over(w))
        .withColumn("prev_sma_km", F.lag("semimajor_axis_km", 1).over(w))
        .withColumn("prev_eccentricity", F.lag("eccentricity", 1).over(w))
        .withColumn("prev_inclination", F.lag("inclination", 1).over(w))
        .withColumn("prev_raan", F.lag("ra_of_asc_node", 1).over(w))
        .withColumn("prev_bstar", F.lag("bstar_drag_term", 1).over(w))
        .withColumn("prev_mean_motion", F.lag("mean_motion_rev_per_day", 1).over(w))
        .withColumn("prev_velocity", F.lag("velocity_km_s", 1).over(w))
        # Time delta between observations (hours)
        .withColumn(
            "observation_gap_hours",
            (F.unix_timestamp("epoch") - F.unix_timestamp("prev_epoch")) / 3600.0,
        )
        # Semi-major axis delta (km) -- primary maneuver indicator
        # Positive delta = orbit raise, negative = orbit lower or decay
        .withColumn(
            "delta_sma_km",
            F.col("semimajor_axis_km") - F.col("prev_sma_km"),
        )
        # Eccentricity delta -- orbit circularization or eccentricity pumping
        .withColumn(
            "delta_eccentricity",
            F.col("eccentricity") - F.col("prev_eccentricity"),
        )
        # Inclination delta (degrees) -- plane-change maneuver indicator
        # Plane changes are expensive (high delta-v), so any change > 0.1 deg
        # is significant and likely intentional
        .withColumn(
            "delta_inclination_deg",
            F.col("inclination") - F.col("prev_inclination"),
        )
        # RAAN delta (degrees) -- nodal precession vs maneuver discrimination
        # J2 causes predictable RAAN drift; deviations from expected drift
        # indicate a maneuver
        .withColumn(
            "delta_raan_deg",
            F.col("ra_of_asc_node") - F.col("prev_raan"),
        )
        # BSTAR ratio -- sudden changes indicate attitude shifts or breakup
        .withColumn(
            "bstar_ratio",
            F.when(
                (F.col("prev_bstar").isNotNull()) & (F.abs(F.col("prev_bstar")) > 1e-10),
                F.col("bstar_drag_term") / F.col("prev_bstar"),
            ).otherwise(F.lit(None)),
        )
        # Mean motion acceleration (rev/day^2) -- drag-induced decay rate
        # Positive acceleration = decreasing altitude (drag)
        .withColumn(
            "mean_motion_delta",
            F.col("mean_motion_rev_per_day") - F.col("prev_mean_motion"),
        )
        # Velocity deviation (km/s) -- direct delta-v estimate
        .withColumn(
            "delta_velocity_km_s",
            F.col("velocity_km_s") - F.col("prev_velocity"),
        )
        # Normalized deltas (per hour) for rate-based anomaly detection
        .withColumn(
            "sma_rate_km_per_hour",
            F.when(
                F.col("observation_gap_hours") > 0,
                F.col("delta_sma_km") / F.col("observation_gap_hours"),
            ).otherwise(F.lit(None)),
        )
        .withColumn(
            "inclination_rate_deg_per_hour",
            F.when(
                F.col("observation_gap_hours") > 0,
                F.col("delta_inclination_deg") / F.col("observation_gap_hours"),
            ).otherwise(F.lit(None)),
        )
        # Anomaly flags based on physical thresholds
        # These are conservative thresholds; ML models refine classification
        .withColumn(
            "possible_maneuver",
            F.when(
                (F.abs(F.col("delta_sma_km")) > 10)
                | (F.abs(F.col("delta_inclination_deg")) > 0.1),
                F.lit(True),
            ).otherwise(F.lit(False)),
        )
        .withColumn(
            "possible_breakup",
            F.when(
                (F.col("bstar_ratio").isNotNull())
                & (F.abs(F.col("bstar_ratio")) > 10),
                F.lit(True),
            ).otherwise(F.lit(False)),
        )
        .withColumn(
            "rapid_decay",
            F.when(
                (F.col("mean_motion_delta") > 0.01)
                & (F.col("decay_risk_flag") == True),
                F.lit(True),
            ).otherwise(F.lit(False)),
        )
        # Composite anomaly score (0-100) for prioritized analyst review
        .withColumn(
            "anomaly_score",
            (
                F.when(F.col("possible_maneuver") == True, F.lit(40)).otherwise(F.lit(0))
                + F.when(F.col("possible_breakup") == True, F.lit(40)).otherwise(F.lit(0))
                + F.when(F.col("rapid_decay") == True, F.lit(20)).otherwise(F.lit(0))
            ),
        )
        # Select final feature columns
        .select(
            "norad_cat_id",
            "object_name",
            "object_type",
            "country_code",
            "epoch",
            "orbital_regime",
            # Current state
            "semimajor_axis_km",
            "eccentricity",
            "inclination",
            "ra_of_asc_node",
            "bstar_drag_term",
            "mean_motion_rev_per_day",
            "velocity_km_s",
            "altitude_km",
            # Temporal features
            "observation_gap_hours",
            # Deltas (absolute change)
            "delta_sma_km",
            "delta_eccentricity",
            "delta_inclination_deg",
            "delta_raan_deg",
            "delta_velocity_km_s",
            "mean_motion_delta",
            "bstar_ratio",
            # Rates (change per hour)
            "sma_rate_km_per_hour",
            "inclination_rate_deg_per_hour",
            # Anomaly flags and score
            "possible_maneuver",
            "possible_breakup",
            "rapid_decay",
            "decay_risk_flag",
            "anomaly_score",
            "_ingestion_timestamp",
        )
        # Only include records that have a previous observation for comparison
        .filter(F.col("prev_epoch").isNotNull())
    )

    return features


# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold: Sensor Coverage Metrics
# MAGIC
# MAGIC Aggregated tracking network performance metrics. Measures how well the
# MAGIC Space Surveillance Network (SSN) is maintaining custody of the catalog
# MAGIC across different orbital regimes.
# MAGIC
# MAGIC Key metrics:
# MAGIC - **Observation cadence**: How frequently each object is updated
# MAGIC - **Catalog completeness**: Percentage of objects with recent observations
# MAGIC - **Regime coverage**: LEO vs MEO vs GEO tracking performance
# MAGIC
# MAGIC These metrics inform USSF sensor tasking decisions and help identify
# MAGIC coverage gaps that could allow undetected maneuvers or missed conjunctions.
# MAGIC Critical for Space Force acquisition programs evaluating new sensor
# MAGIC contributions to the SSN.

# COMMAND ----------


@dlt.table(
    name="gold_sensor_coverage_metrics",
    comment=(
        "Tracking network performance aggregation by orbital regime and object type. "
        "Measures observation cadence, catalog freshness, and coverage completeness "
        "for the Space Surveillance Network. Supports USSF sensor tasking optimization "
        "and acquisition planning for new tracking capabilities."
    ),
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "domain": "space_domain_awareness",
    },
)
def gold_sensor_coverage_metrics():
    """
    Aggregate tracking network performance metrics by orbital regime.

    Computes per-regime, per-object-type statistics on:
    - Total tracked objects in the regime
    - Average and median observation age (staleness)
    - Percentage of objects with observations < 24h old (freshness)
    - Average observation cadence (observations per day)
    - Debris vs payload tracking ratios
    - Country/operator distribution

    These metrics help USSF evaluate whether the SSN sensor network is
    keeping pace with the growing catalog (currently ~48,000 objects and
    rising due to mega-constellations and debris-generating events).
    """
    orbital = dlt.read("silver_orbital_elements")

    # Compute per-object observation freshness
    # Age = time since most recent epoch for each object
    latest_per_object = (
        orbital.groupBy("norad_cat_id", "object_name", "object_type", "orbital_regime", "country_code")
        .agg(
            F.max("epoch").alias("latest_epoch"),
            F.count("*").alias("total_observations"),
            F.min("epoch").alias("first_epoch"),
        )
        .withColumn(
            "observation_age_hours",
            (F.unix_timestamp(F.current_timestamp()) - F.unix_timestamp("latest_epoch")) / 3600.0,
        )
        .withColumn(
            "tracking_span_days",
            (F.unix_timestamp("latest_epoch") - F.unix_timestamp("first_epoch")) / 86400.0,
        )
        .withColumn(
            "obs_per_day",
            F.when(
                F.col("tracking_span_days") > 0,
                F.col("total_observations") / F.col("tracking_span_days"),
            ).otherwise(F.lit(None)),
        )
    )

    # Aggregate by orbital regime and object type
    coverage = (
        latest_per_object.groupBy("orbital_regime", "object_type")
        .agg(
            # Catalog size
            F.countDistinct("norad_cat_id").alias("tracked_object_count"),
            # Observation freshness
            F.avg("observation_age_hours").alias("avg_observation_age_hours"),
            F.percentile_approx("observation_age_hours", 0.5).alias(
                "median_observation_age_hours"
            ),
            F.max("observation_age_hours").alias("max_observation_age_hours"),
            # Freshness -- percentage of objects with obs < 24h old
            # High freshness = good sensor coverage for that regime
            (
                F.sum(
                    F.when(F.col("observation_age_hours") < 24, 1).otherwise(0)
                )
                / F.count("*")
                * 100
            ).alias("pct_fresh_lt_24h"),
            # Stale -- percentage of objects with obs > 7 days old
            # High staleness = coverage gap, potential custody loss
            (
                F.sum(
                    F.when(F.col("observation_age_hours") > 168, 1).otherwise(0)
                )
                / F.count("*")
                * 100
            ).alias("pct_stale_gt_7d"),
            # Observation cadence
            F.avg("obs_per_day").alias("avg_obs_per_day"),
            F.avg("total_observations").alias("avg_total_observations"),
            # Country distribution (top contributors by object count)
            F.count_distinct("country_code").alias("unique_country_codes"),
        )
        .withColumn("_metrics_computed_at", F.current_timestamp())
        # Sort by regime priority: LEO is most congested and operationally critical
        .orderBy(
            F.when(F.col("orbital_regime") == "LEO", 1)
            .when(F.col("orbital_regime") == "GEO", 2)
            .when(F.col("orbital_regime") == "MEO", 3)
            .when(F.col("orbital_regime") == "HEO", 4)
            .otherwise(5)
        )
    )

    return coverage
