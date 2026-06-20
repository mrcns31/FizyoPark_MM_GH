#!/usr/bin/env bash
# fizyopark-mm sunucu deploy scripti. CI bunu cagirir: bash deploy.sh <git-sha>
# Token CI'dan GHCR_TOKEN env'i ile gelir; login -> tag -> pull -> up -> logout.
# Izole DOCKER_CONFIG kullanilir ve sonunda silinir -> serverda token izi kalmaz.
set -euo pipefail

APP_DIR=/opt/fizyopark-mm
cd "$APP_DIR"

SHA="${1:-latest}"
export DOCKER_CONFIG="$APP_DIR/.docker"
GHCR_USER="${GHCR_USER:-mrcns31}"

cleanup() {
  docker logout ghcr.io >/dev/null 2>&1 || true
  rm -rf "$DOCKER_CONFIG"
}
trap cleanup EXIT

if [ -n "${GHCR_TOKEN:-}" ]; then
  mkdir -p "$DOCKER_CONFIG"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

sed -i "s|^API_TAG=.*|API_TAG=${SHA}|" .env
sed -i "s|^WEB_TAG=.*|WEB_TAG=${SHA}|" .env
sed -i "s|^DB_TAG=.*|DB_TAG=${SHA}|" .env

docker compose -f compose.yml --env-file .env pull
docker compose -f compose.yml --env-file .env up -d
docker image prune -f

echo "Deploy tamam: ${SHA}"
docker compose -f compose.yml ps
