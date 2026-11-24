# OrbitWatch Database Setup

## Lakebase PostgreSQL (Primary)

The OrbitWatch app uses Lakebase (Postgres) on the fe-shared-demo workspace.

### Create the database

In the Databricks workspace, create a new Lakebase instance named `orbitwatch`.

### Apply schema

```bash
PGPASSWORD=<pat-token> psql \
  -h <lakebase-host> \
  -U will.yuponce@databricks.com \
  -d orbitwatch \
  -f db/schema.sql
```

### Seed demo data

```bash
pip install psycopg2-binary
LAKEBASE_HOST=<lakebase-host> PGPASSWORD=<pat-token> python db/seed.py
```

### Local development

Add to `.env`:

```
LAKEBASE_HOST=<host>
PGPASSWORD=<your-personal-access-token>
LAKEBASE_DB=orbitwatch
LAKEBASE_USER=will.yuponce@databricks.com
```

## DLT Pipeline (Production Data)

The DLT pipeline in `pipelines/` ingests real TLE + CDM data and writes
to Lakebase via JDBC. Run via `databricks bundle deploy`.
