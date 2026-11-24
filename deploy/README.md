# Deploying OrbitWatch to Databricks Apps

The live deployment runs on the `fevm-dod-commercial` workspace (CLI profile
`fe-vm-dod-commercial`, bundle target `dod`).

| Piece                    | Where                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| Lakeflow pipeline + jobs | `databricks.yml` (target `dod`), writes `demo_cg_catalog.orbitwatch_dlt`   |
| ML scores                | job "OrbitWatch ML Train + Score", writes `demo_cg_catalog.orbitwatch_ml`  |
| App database             | Lakebase project `orbitwatch`, database `orbitwatch`                       |
| App                      | `orbitwatch` (config in `app.yaml`, resources in `deploy/app-create.json`) |
| Space-Track credentials  | secret scope `orbitwatch` (`spacetrack_user`, `spacetrack_pass`)           |

## Refresh the data

```bash
databricks bundle deploy -t dod --profile fe-vm-dod-commercial
databricks bundle run orbitwatch_pipeline -t dod --profile fe-vm-dod-commercial
databricks bundle run orbitwatch_ml_training_job -t dod --profile fe-vm-dod-commercial

# Load the catalog tables into Lakebase (runs as you, the table owner)
export PGPASSWORD=$(databricks postgres generate-database-credential \
  projects/orbitwatch/branches/production/endpoints/primary \
  --profile fe-vm-dod-commercial -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
LAKEBASE_HOST=<endpoint host> WAREHOUSE_ID=<warehouse id> CATALOG=demo_cg_catalog \
  DATABRICKS_PROFILE=fe-vm-dod-commercial python3 db/reverse_etl.py
```

## Deploy the app

```bash
deploy/deploy.sh            # builds, assembles .build/app, uploads, deploys
```

Databricks Apps rejects any file over 10 MB, so the script never ships
`node_modules`. It uploads the prebuilt client, the compiled server, `app.yaml`,
and `deploy/package.json` (runtime dependencies only), and Apps runs
`npm install` itself.

## First-time setup on a new workspace

1. Create the secret scope `orbitwatch` with `spacetrack_user` and `spacetrack_pass`.
2. Create the app: `databricks apps create --json @deploy/app-create.json`.
   The `postgres` resource creates a Postgres role for the app's service principal.
3. Grant that service principal access to the Lakebase tables you own:
   ```bash
   psql "host=<endpoint host> user=<you> dbname=orbitwatch sslmode=require" \
     -v sp=<service_principal_client_id> -f db/grant_app_sp.sql
   ```
4. Grant it read access to the ML schema in Unity Catalog:
   ```sql
   GRANT USE CATALOG ON CATALOG demo_cg_catalog TO `<service_principal_client_id>`;  -- needs MANAGE on the catalog
   GRANT USE SCHEMA, SELECT ON SCHEMA demo_cg_catalog.orbitwatch_ml TO `<service_principal_client_id>`;
   ```
5. Run `deploy/deploy.sh`.
