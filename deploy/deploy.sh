#!/usr/bin/env bash
# fizyopark-mm sunucu deploy scripti. CI bunu cagirir: bash deploy.sh <git-sha>
# Yalniz DEPLOY_API/WEB/DB=true olan servisi pull + up eder (path-bazli deploy).
# Token CI'dan GHCR_TOKEN env'i ile gelir; login -> pull -> up -> logout (serverda iz kalmaz).
set -euo pipefail

APP_DIR=/opt/fizyopark-mm
cd "$APP_DIR"

SHA="${1:-latest}"
export DOCKER_CONFIG="$APP_DIR/.docker"
GHCR_USER="${GHCR_USER:-mrcns31}"
ENVF="$APP_DIR/.env"
COMPOSE="$APP_DIR/compose.yml"

cleanup() {
  docker logout ghcr.io >/dev/null 2>&1 || true
  rm -rf "$DOCKER_CONFIG"
}
trap cleanup EXIT

if [ -n "${GHCR_TOKEN:-}" ]; then
  mkdir -p "$DOCKER_CONFIG"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

setenv() { # key val — .env'de varsa degistir, yoksa ekle
  if grep -q "^$1=" "$ENVF"; then sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi
}
dc() { docker compose -f "$COMPOSE" --env-file "$ENVF" "$@"; }

# db once (api ona bagimli), sonra api, sonra web. Yalniz degisen servisi gunceller.
if [ "${DEPLOY_DB:-false}" = "true" ];  then echo "== db  -> $SHA =="; setenv DB_TAG  "$SHA"; dc pull db;  dc up -d db;  fi
if [ "${DEPLOY_API:-false}" = "true" ]; then echo "== api -> $SHA =="; setenv API_TAG "$SHA"; dc pull api; dc up -d api; fi
if [ "${DEPLOY_WEB:-false}" = "true" ]; then echo "== web -> $SHA =="; setenv WEB_TAG "$SHA"; dc pull web; dc up -d web; fi

docker image prune -f
echo "Deploy tamam: ${SHA}"
dc ps
