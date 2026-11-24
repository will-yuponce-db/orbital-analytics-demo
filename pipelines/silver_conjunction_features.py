# Databricks notebook source
# MAGIC %md
# MAGIC # OrbitWatch - Silver Layer: Conjunction Feature Engineering
# MAGIC
# MAGIC **Space Domain Awareness (SDA) Pipeline - Medallion Architecture**
# MAGIC
# MAGIC This notebook transforms raw bronze data into enriched silver tables with
# MAGIC validated orbital elements, derived physical quantities, and conjunction
# MAGIC risk analysis features. Two silver tables are produced:
# MAGIC
# MAGIC 1. **silver_orbital_elements**: Validated Keplerian elements with derived
# MAGIC    altitude, velocity, and orbital regime classification. These enrichments
# MAGIC    support USSF space object characterization and catalog maintenance.
# MAGIC
# MAGIC 2. **silver_conjunction_analysis**: CDMs joined with satellite metadata,
# MAGIC    risk-tiered by collision probability (Pc), and enriched with maneuver
# MAGIC    decision windows. This table directly supports COLA (collision avoidance)
# MAGIC    operations at CSpOC and satellite operator mission planning.
# MAGIC
# MAGIC **Catalog**: `stable_demo_wy_catalog`
# MAGIC **Schema**: `orbitwatch`

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# COMMAND ----------

# Physical constants used for orbital mechanics derivations
# Earth radius (WGS-84 mean equatorial radius) in km
EARTH_RADIUS_KM = 6378.137
# Standard gravitational parameter for Earth (km^3/s^2)
MU_EARTH = 398600.4418
# Pi constant
PI = 3.141592653589793

# COMMAND ----------

# MAGIC %md
# MAGIC ## Silver: Orbital Elements (Validated & Enriched)
# MAGIC
# MAGIC This table takes raw GP data and:
# MAGIC - Parses and validates all six classical orbital elements
# MAGIC - Computes altitude from semi-major axis (a - R_earth)
# MAGIC - Computes orbital velocity using the vis-viva equation
# MAGIC - Classifies orbital regime (LEO, MEO, GEO, HEO, cislunar)
# MAGIC - Tags object type for DoD-relevant categorization (payload, debris, R/B)
# MAGIC
# MAGIC Altitude and velocity are critical for:
# MAGIC - Conjunction screening volume selection (LEO vs GEO thresholds differ)
# MAGIC - Reentry prediction (low-perigee objects with high BSTAR)
# MAGIC - Breakup detection (anomalous velocity changes indicate fragmentation)

# COMMAND ----------


@dlt.table(
    name="silver_orbital_elements",
    comment=(
        "Validated and enriched orbital elements derived from Space-Track GP data. "
        "Includes computed altitude (km above WGS-84 ellipsoid), orbital velocity "
        "(km/s via vis-viva equation), orbital regime classification, and orbital "
        "period. Supports USSF catalog maintenance, conjunction screening, and "
        "space object characterization."
    ),
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true",
        "domain": "space_domain_awareness",
    },
)
@dlt.expect_or_drop(
    "valid_eccentricity", "eccentricity >= 0 AND eccentricity < 1"
)
@dlt.expect_or_drop(
    "valid_inclination", "inclination >= 0 AND inclination <= 180"
)
@dlt.expect_or_drop(
    "valid_semimajor_axis", "semimajor_axis_km > 0"
)
@dlt.expect(
    "valid_mean_motion", "mean_motion_rev_per_day > 0"
)
@dlt.expect(
    "valid_raan", "ra_of_asc_node >= 0 AND ra_of_asc_node <= 360"
)
def silver_orbital_elements():
    """
    Enrich and validate GP orbital elements with derived physical quantities.

    Derivations:
    - altitude_km: Semi-major axis minus Earth radius. Represents mean altitude
      above the WGS-84 reference ellipsoid. For eccentric orbits this is the
      mean altitude, not perigee/apogee altitude.
    - velocity_km_s: Orbital velocity at the semi-major axis distance using
      the vis-viva equation: v = sqrt(mu / a). This is the circular orbit
      approximation; actual velocity varies with true anomaly for e > 0.
    - orbital_regime: Classification per standard DoD regime definitions:
      LEO (< 2000 km), MEO (2000-35000 km), GEO (35000-36000 km),
      HEO (> 36000 km or e > 0.25).
    - period_minutes: Orbital period derived from mean motion (1440 / n).

    Records failing eccentricity, inclination, or semi-major axis validation
    are dropped (@dlt.expect_or_drop) since they indicate corrupt TLE data
    that would produce invalid SGP4 propagations.
    """
    return (
        dlt.read("bronze_gp_data")
        .select(
            # Primary identifiers
            F.col("NORAD_CAT_ID").alias("norad_cat_id"),
            F.col("OBJECT_NAME").alias("object_name"),
            F.col("OBJECT_ID").alias("intl_designator"),
            F.col("OBJECT_TYPE").alias("object_type"),
            F.col("COUNTRY_CODE").alias("country_code"),
            F.col("RCS_SIZE").alias("rcs_size"),
            # Epoch
            F.col("_epoch_parsed").alias("epoch"),
            F.col("CLASSIFICATION_TYPE").alias("classification"),
            # Classical orbital elements (Keplerian)
            F.col("MEAN_MOTION").alias("mean_motion_rev_per_day"),
            F.col("ECCENTRICITY").alias("eccentricity"),
            F.col("INCLINATION").alias("inclination"),
            F.col("RA_OF_ASC_NODE").alias("ra_of_asc_node"),
            F.col("ARG_OF_PERICENTER").alias("arg_of_pericenter"),
            F.col("MEAN_ANOMALY").alias("mean_anomaly"),
            # Drag and perturbation terms
            # BSTAR: radiation pressure coefficient (1/Earth radii), proxy for
            # atmospheric drag. High BSTAR indicates rapid orbital decay.
            F.col("BSTAR").alias("bstar_drag_term"),
            F.col("MEAN_MOTION_DOT").alias("mean_motion_dot"),
            F.col("MEAN_MOTION_DDOT").alias("mean_motion_ddot"),
            # Derived orbital geometry from Space-Track
            F.col("SEMIMAJOR_AXIS").alias("semimajor_axis_km"),
            F.col("PERIOD").alias("period_minutes"),
            F.col("APOAPSIS").alias("apoapsis_km"),
            F.col("PERIAPSIS").alias("periapsis_km"),
            # TLE lines for downstream SGP4 propagation
            F.col("TLE_LINE1").alias("tle_line1"),
            F.col("TLE_LINE2").alias("tle_line2"),
            # Launch info
            F.col("LAUNCH_DATE").alias("launch_date"),
            F.col("SITE").alias("launch_site"),
            F.col("DECAY_DATE").alias("decay_date"),
            F.col("REV_AT_EPOCH").alias("rev_at_epoch"),
            F.col("GP_ID").alias("gp_id"),
            # Ingestion metadata
            F.col("_ingestion_timestamp"),
        )
        # Compute mean altitude above Earth surface (km)
        # altitude = semi-major axis - Earth equatorial radius
        .withColumn(
            "altitude_km",
            F.col("semimajor_axis_km") - F.lit(EARTH_RADIUS_KM),
        )
        # Compute apoapsis and periapsis altitudes (above surface)
        .withColumn(
            "apoapsis_altitude_km",
            F.col("apoapsis_km") - F.lit(EARTH_RADIUS_KM),
        )
        .withColumn(
            "periapsis_altitude_km",
            F.col("periapsis_km") - F.lit(EARTH_RADIUS_KM),
        )
        # Compute circular orbit velocity approximation (km/s)
        # vis-viva at circular orbit: v = sqrt(mu / a)
        .withColumn(
            "velocity_km_s",
            F.sqrt(F.lit(MU_EARTH) / F.col("semimajor_axis_km")),
        )
        # Classify orbital regime per standard DoD definitions
        # HEO check uses eccentricity > 0.25 to catch Molniya-type orbits
        .withColumn(
            "orbital_regime",
            F.when(F.col("eccentricity") > 0.25, F.lit("HEO"))
            .when(F.col("altitude_km") < 2000, F.lit("LEO"))
            .when(F.col("altitude_km") < 35000, F.lit("MEO"))
            .when(F.col("altitude_km") <= 36000, F.lit("GEO"))
            .otherwise(F.lit("HEO")),
        )
        # Flag objects in rapid decay (high BSTAR + low periapsis)
        # Operationally relevant for USSF reentry prediction mission
        .withColumn(
            "decay_risk_flag",
            F.when(
                (F.col("bstar_drag_term") > 0.001)
                & (F.col("periapsis_altitude_km") < 300),
                F.lit(True),
            ).otherwise(F.lit(False)),
        )
        # Flag active debris -- rocket bodies and debris with low perigee
        # are priority tracking targets for 18 SDS
        .withColumn(
            "is_debris",
            F.when(
                F.col("object_type").isin("DEBRIS", "ROCKET BODY"),
                F.lit(True),
            ).otherwise(F.lit(False)),
        )
    )


# COMMAND ----------

# MAGIC %md
# MAGIC ## Silver: Conjunction Analysis (CDM Enrichment & Risk Tiering)
# MAGIC
# MAGIC This table joins CDM data with satellite metadata and applies risk tiering
# MAGIC based on collision probability (Pc) thresholds. The risk tiers align with
# MAGIC the standard JSpOC/CSpOC COLA decision framework:
# MAGIC
# MAGIC | Tier   | Pc Threshold | Action Required |
# MAGIC |--------|-------------|-----------------|
# MAGIC | RED    | Pc >= 1e-2  | Emergency avoidance maneuver required |
# MAGIC | AMBER  | 1e-4 <= Pc < 1e-2 | Active monitoring, maneuver planning |
# MAGIC | YELLOW | 1e-6 <= Pc < 1e-4 | Enhanced tracking, pre-planning |
# MAGIC | GREEN  | Pc < 1e-6   | Routine monitoring |
# MAGIC
# MAGIC Maneuver windows are computed as TCA - 48h (planning deadline) to TCA - 6h
# MAGIC (execution deadline). These windows reflect operational constraints where
# MAGIC ground stations need lead time for uplink and the spacecraft needs time
# MAGIC to execute the delta-v.

# COMMAND ----------


@dlt.table(
    name="silver_conjunction_analysis",
    comment=(
        "Enriched Conjunction Data Messages with risk tiering, maneuver windows, "
        "and satellite metadata. Risk tiers (RED/AMBER/YELLOW/GREEN) are based on "
        "collision probability (Pc) thresholds per CSpOC COLA standards. Maneuver "
        "decision windows (TCA-48h to TCA-6h) support operational timeline planning. "
        "Directly supports USSF collision avoidance decision-making."
    ),
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true",
        "domain": "space_domain_awareness",
    },
)
@dlt.expect_or_drop(
    "valid_collision_probability", "collision_probability >= 0 AND collision_probability <= 1"
)
@dlt.expect(
    "valid_miss_distance_km", "miss_distance_km >= 0"
)
@dlt.expect(
    "valid_tca_timestamp", "tca IS NOT NULL"
)
def silver_conjunction_analysis():
    """
    Enrich CDMs with risk tiers, maneuver windows, and satellite metadata.

    This table is the primary input for COLA (collision avoidance) decision
    support. Each record represents a conjunction event between two resident
    space objects, enriched with:

    - risk_tier: RED/AMBER/YELLOW/GREEN based on Pc thresholds
    - maneuver_window_open: TCA - 48h (planning deadline)
    - maneuver_window_close: TCA - 6h (execution deadline)
    - time_to_tca_hours: real-time countdown for operational urgency
    - relative_velocity_km_s: approach speed, critical for impact energy
    - is_emergency: flag for CDMs marked emergency-reportable by CSpOC

    Conjunction events with Pc outside [0, 1] are dropped as they indicate
    data corruption in the CDM source.
    """
    # Read CDM bronze data
    cdm = (
        dlt.read("bronze_cdm_data")
        .select(
            F.col("CDM_ID").alias("cdm_id"),
            F.col("_tca_parsed").alias("tca"),
            F.col("MIN_RNG").alias("miss_distance_km"),
            F.col("PC").alias("collision_probability"),
            F.col("EMERGENCY_REPORTABLE").alias("emergency_reportable"),
            # Primary object
            F.col("SAT_1_ID").alias("sat1_norad_id"),
            F.col("SAT_1_NAME").alias("sat1_name"),
            F.col("SAT1_OBJECT_TYPE").alias("sat1_object_type"),
            F.col("SAT1_RCS").alias("sat1_rcs_size"),
            # Primary object state vector (ECI, km and km/s)
            F.col("SAT1_X").alias("sat1_x_km"),
            F.col("SAT1_Y").alias("sat1_y_km"),
            F.col("SAT1_Z").alias("sat1_z_km"),
            F.col("SAT1_X_DOT").alias("sat1_vx_km_s"),
            F.col("SAT1_Y_DOT").alias("sat1_vy_km_s"),
            F.col("SAT1_Z_DOT").alias("sat1_vz_km_s"),
            # Secondary object
            F.col("SAT_2_ID").alias("sat2_norad_id"),
            F.col("SAT_2_NAME").alias("sat2_name"),
            F.col("SAT2_OBJECT_TYPE").alias("sat2_object_type"),
            F.col("SAT2_RCS").alias("sat2_rcs_size"),
            # Secondary object state vector (ECI, km and km/s)
            F.col("SAT2_X").alias("sat2_x_km"),
            F.col("SAT2_Y").alias("sat2_y_km"),
            F.col("SAT2_Z").alias("sat2_z_km"),
            F.col("SAT2_X_DOT").alias("sat2_vx_km_s"),
            F.col("SAT2_Y_DOT").alias("sat2_vy_km_s"),
            F.col("SAT2_Z_DOT").alias("sat2_vz_km_s"),
            # Metadata
            F.col("CREATED").alias("cdm_created"),
            F.col("_ingestion_timestamp"),
        )
    )

    # Apply risk tiering based on collision probability (Pc)
    # Thresholds aligned with CSpOC COLA operational standards
    enriched = (
        cdm
        # Risk tier classification -- drives operator action level
        .withColumn(
            "risk_tier",
            F.when(F.col("collision_probability") >= 1e-2, F.lit("RED"))
            .when(F.col("collision_probability") >= 1e-4, F.lit("AMBER"))
            .when(F.col("collision_probability") >= 1e-6, F.lit("YELLOW"))
            .otherwise(F.lit("GREEN")),
        )
        # Numeric risk score (0-100) for sorting and dashboarding
        # Maps Pc to a linear 0-100 scale within each tier
        .withColumn(
            "risk_score",
            F.when(F.col("collision_probability") >= 1e-2, F.lit(100))
            .when(
                F.col("collision_probability") >= 1e-4,
                F.lit(50) + (F.log10(F.col("collision_probability")) + 4) * 25,
            )
            .when(
                F.col("collision_probability") >= 1e-6,
                F.lit(10) + (F.log10(F.col("collision_probability")) + 6) * 20,
            )
            .otherwise(F.lit(0)),
        )
        # Maneuver planning window: TCA - 48 hours (open) to TCA - 6 hours (close)
        # 48h lead time allows ground station scheduling and orbit determination
        # 6h cutoff accounts for command uplink and burn execution time
        .withColumn(
            "maneuver_window_open",
            F.col("tca") - F.expr("INTERVAL 48 HOURS"),
        )
        .withColumn(
            "maneuver_window_close",
            F.col("tca") - F.expr("INTERVAL 6 HOURS"),
        )
        # Time to TCA from current wall-clock -- operational urgency metric
        .withColumn(
            "time_to_tca_hours",
            (F.unix_timestamp("tca") - F.unix_timestamp(F.current_timestamp()))
            / 3600.0,
        )
        # Relative velocity at TCA (magnitude of velocity difference vector)
        # Critical for impact energy estimation: KE = 0.5 * m * v_rel^2
        .withColumn(
            "relative_velocity_km_s",
            F.sqrt(
                F.pow(F.col("sat1_vx_km_s") - F.col("sat2_vx_km_s"), 2)
                + F.pow(F.col("sat1_vy_km_s") - F.col("sat2_vy_km_s"), 2)
                + F.pow(F.col("sat1_vz_km_s") - F.col("sat2_vz_km_s"), 2)
            ),
        )
        # Emergency flag -- CDMs flagged by CSpOC as requiring immediate action
        .withColumn(
            "is_emergency",
            F.when(F.upper(F.col("emergency_reportable")) == "Y", F.lit(True))
            .otherwise(F.lit(False)),
        )
        # Maneuver window status -- is the current time within the actionable window?
        .withColumn(
            "maneuver_window_status",
            F.when(
                F.current_timestamp() < F.col("maneuver_window_open"),
                F.lit("UPCOMING"),
            )
            .when(
                F.current_timestamp() < F.col("maneuver_window_close"),
                F.lit("ACTIVE"),
            )
            .when(
                F.current_timestamp() < F.col("tca"),
                F.lit("CRITICAL"),
            )
            .otherwise(F.lit("EXPIRED")),
        )
    )

    return enriched
