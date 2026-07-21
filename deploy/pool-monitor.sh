#!/usr/bin/env bash
# fizyopark-mm — hafif teşhis izleyicisi.
# Her çalıştığında DB bağlantı havuzu, uzun süren sorgular, API restart sayısı ve
# /health yanıt süresini tek satır olarak log dosyasına yazar.
# Amaç: "sistem yavaşlıyor / isimler #785 görünüyor" anını yakalamak (loglar
# container yeniden oluşunca silindiği için kalıcı kayıt tutar).
#
# Kurulum (VPS'te, root cron ile — sudo şifresi sormaması için):
#   sudo cp /opt/fizyopark-mm/pool-monitor.sh /opt/fizyopark-mm/pool-monitor.sh
#   sudo chmod +x /opt/fizyopark-mm/pool-monitor.sh
#   echo '*/2 * * * * root /opt/fizyopark-mm/pool-monitor.sh >> /var/log/fizyopark-pool.log 2>&1' | sudo tee /etc/cron.d/fizyopark-pool
# İzleme:  sudo tail -f /var/log/fizyopark-pool.log
#
# Not: Bu script sunucuya özel; container'a girmez, deploy pipeline'ını etkilemez.

set -uo pipefail

DB_CONTAINER="fizyopark-mm-db"
API_CONTAINER="fizyopark-mm-api"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

# --- DB havuz durumu: toplam / aktif / boşta / bekleyen (idle in transaction) ---
POOL="$(docker exec "$DB_CONTAINER" sh -c \
  'psql -tA -F"|" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT
      count(*),
      count(*) FILTER (WHERE state='\''active'\''),
      count(*) FILTER (WHERE state='\''idle'\''),
      count(*) FILTER (WHERE state='\''idle in transaction'\'')
    FROM pg_stat_activity
    WHERE datname = current_database();"' 2>/dev/null | tr -d ' ')"
TOTAL="${POOL%%|*}";  REST="${POOL#*|}"
ACTIVE="${REST%%|*}";  REST="${REST#*|}"
IDLE="${REST%%|*}";    IDLE_TX="${REST##*|}"

# --- En uzun süren aktif sorgu (saniye) — yavaş/kilitli sorgu göstergesi ---
LONGEST="$(docker exec "$DB_CONTAINER" sh -c \
  'psql -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT COALESCE(round(max(EXTRACT(EPOCH FROM (now()-query_start)))::numeric,1),0)
    FROM pg_stat_activity
    WHERE state='\''active'\'' AND query NOT ILIKE '\''%pg_stat_activity%'\'';"' 2>/dev/null | tr -d ' ')"

# --- API restart sayısı + çalışıyor mu ---
RESTARTS="$(docker inspect "$API_CONTAINER" --format '{{.RestartCount}}' 2>/dev/null || echo '?')"
STATUS="$(docker inspect "$API_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo '?')"

# --- /health yanıt süresi container içinden (node ile — Alpine'de curl/wget yok) ---
HEALTH_START="$(date +%s.%N)"
if docker exec "$API_CONTAINER" node -e \
    'require("http").get("http://127.0.0.1:3000/health",r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on("error",()=>process.exit(1))' \
    2>/dev/null; then
  HEALTH="ok $(awk "BEGIN{printf \"%.2f\", $(date +%s.%N)-$HEALTH_START}")s"
else
  HEALTH="FAIL"
fi

printf '%s | pool total=%s active=%s idle=%s idle_tx=%s | longest_query=%ss | api status=%s restarts=%s | health=%s\n' \
  "$TS" "${TOTAL:-?}" "${ACTIVE:-?}" "${IDLE:-?}" "${IDLE_TX:-?}" "${LONGEST:-?}" "$STATUS" "$RESTARTS" "$HEALTH"
