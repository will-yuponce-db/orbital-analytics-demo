-- Grant the OrbitWatch app's service principal DML on the Lakebase tables.
-- The tables in schema public are owned by the person who ran db/reverse_etl.py,
-- so the app SP (created by the app's `postgres` resource) needs explicit grants.
--
-- Usage (run as the table owner):
--   psql "host=<endpoint-host> user=<you> dbname=orbitwatch sslmode=require" \
--     -v sp=<app service_principal_client_id> -f db/grant_app_sp.sql
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO :"sp";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"sp";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"sp";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"sp";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"sp";
