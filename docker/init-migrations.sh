#!/bin/bash
# PostgreSQL migration dosyalarını sırayla çalıştırır
set -e

echo "--- Migration dosyaları uygulanıyor ---"
for f in $(ls /migrations/migration_*.sql | sort); do
    echo "Çalıştırılıyor: $f"
    psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f" || true
done
echo "--- Migrationlar tamamlandı ---"
