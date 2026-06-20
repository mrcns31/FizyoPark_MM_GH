#!/bin/sh
# initdb sirasinda (volume bosken) schema.sql sonrasi migration_*.sql dosyalarini uygular.
# POSIX sh — alpine uyumlu. Hatalarda durmaz (idempotent olmayan migration'lar icin tolere).
echo "--- Migration dosyalari uygulaniyor ---"
for f in $(ls /migrations/migration_*.sql 2>/dev/null | sort); do
    echo "Calistiriliyor: $f"
    psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f" || true
done
echo "--- Migrationlar tamamlandi ---"
