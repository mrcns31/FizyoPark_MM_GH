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

wait_for_db() {
  local CONT="fizyopark-mm-db"
  local DB_U; DB_U=$(grep '^DB_USER=' "$ENVF" | cut -d= -f2-)
  local i=0
  echo "  DB hazir bekleniyor..."
  until docker exec "$CONT" pg_isready -U "$DB_U" >/dev/null 2>&1; do
    i=$((i+1))
    [ "$i" -ge 30 ] && echo "  HATA: DB 60 saniyede hazir olmadi!" && return 1
    sleep 2
  done
  echo "  DB hazir."
}

run_migrations() {
  echo "== Migration kontrol basliyor =="
  local CONT="fizyopark-mm-db"
  local DB_U; DB_U=$(grep '^DB_USER=' "$ENVF" | cut -d= -f2-)
  local DB_N; DB_N=$(grep '^DB_NAME=' "$ENVF" | cut -d= -f2-)

  # Hangi migration'larin uygulandigini takip eden tablo (ilk seferinde olusturulur)
  docker exec "$CONT" psql -U "$DB_U" -d "$DB_N" -c \
    "CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   TEXT PRIMARY KEY,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     );" >/dev/null

  local applied=0
  local skipped=0

  for f in $(docker exec "$CONT" sh -c 'ls /migrations/migration_*.sql 2>/dev/null | sort'); do
    fname=$(basename "$f")
    count=$(docker exec "$CONT" psql -U "$DB_U" -d "$DB_N" -tAc \
      "SELECT COUNT(*) FROM schema_migrations WHERE filename='$fname';")
    if [ "$count" = "0" ]; then
      echo "  Applying : $fname"
      # ON_ERROR_STOP=0: IF NOT EXISTS kullanan satirlar guvenle tekrar calisir
      docker exec "$CONT" psql -U "$DB_U" -d "$DB_N" -v ON_ERROR_STOP=0 -f "$f" || true
      docker exec "$CONT" psql -U "$DB_U" -d "$DB_N" -c \
        "INSERT INTO schema_migrations(filename) VALUES('$fname') ON CONFLICT DO NOTHING;" >/dev/null
      echo "  OK        : $fname"
      applied=$((applied+1))
    else
      skipped=$((skipped+1))
    fi
  done

  echo "== Migration tamamlandi: $applied yeni uygulandı, $skipped zaten vardı =="
}

# db once (api ona bagimli), sonra api, sonra web. Yalniz degisen servisi gunceller.
if [ "${DEPLOY_DB:-false}" = "true" ];  then echo "== db  -> $SHA =="; setenv DB_TAG  "$SHA"; dc pull db;  dc up -d db;  fi
if [ "${DEPLOY_API:-false}" = "true" ]; then echo "== api -> $SHA =="; setenv API_TAG "$SHA"; dc pull api; dc up -d api; fi
if [ "${DEPLOY_WEB:-false}" = "true" ]; then echo "== web -> $SHA =="; setenv WEB_TAG "$SHA"; dc pull web; dc up -d web; fi

# Her deploy'da bekleyen migration'lari kontrol et ve uygula
wait_for_db && run_migrations

docker image prune -f
echo "Deploy tamam: ${SHA}"
dc ps
