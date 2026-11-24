#!/usr/bin/env bash
# Build OrbitWatch and deploy it to Databricks Apps.
#
# Databricks Apps rejects any source file over 10 MB, so we never ship
# node_modules. Instead we assemble a small folder (prebuilt client, compiled
# server, app.yaml, and a runtime-only package.json) and let Apps run
# `npm install` against the public registry.
#
# Usage:
#   deploy/deploy.sh                      # build + upload + deploy
#   SKIP_BUILD=1 deploy/deploy.sh         # reuse existing dist/ and server/dist/
#   PROFILE=<cli-profile> APP=<app-name> deploy/deploy.sh
#
# First-time setup (once per workspace):
#   databricks apps create --json @deploy/app-create.json --profile "$PROFILE"
#   then run the grants in deploy/README.md.
set -euo pipefail

PROFILE="${PROFILE:-fe-vm-dod-commercial}"
APP="${APP:-orbitwatch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/.build/app"

cd "$ROOT"
if [[ -z "${SKIP_BUILD:-}" ]]; then
  echo "==> Building client (vite) and server (tsc)"
  npm run build
  npm run build:server
fi

echo "==> Assembling deploy folder at $BUILD"
rm -rf "$BUILD"
mkdir -p "$BUILD/server"
cp -R dist "$BUILD/dist"
cp -R server/dist "$BUILD/server/dist"
find "$BUILD" -name '*.db' -delete          # local-mode SQLite files are not needed
cp app.yaml "$BUILD/app.yaml"
cp deploy/package.json "$BUILD/package.json"

big=$(find "$BUILD" -type f -size +10M)
if [[ -n "$big" ]]; then echo "Files over the 10 MB Apps limit:"; echo "$big"; exit 1; fi

USER_NAME=$(databricks current-user me --profile "$PROFILE" -o json \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["userName"])')
DEST="/Workspace/Users/$USER_NAME/orbitwatch-app"

echo "==> Uploading to $DEST"
databricks sync "$BUILD" "$DEST" --full --exclude .databricks --profile "$PROFILE"

echo "==> Deploying app $APP"
databricks apps deploy "$APP" --source-code-path "$DEST" --profile "$PROFILE"
databricks apps get "$APP" --profile "$PROFILE" -o json \
  | python3 -c 'import json,sys; a=json.load(sys.stdin); print("URL:", a.get("url")); print("Status:", (a.get("app_status") or {}).get("state"))'
