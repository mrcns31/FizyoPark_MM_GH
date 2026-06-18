#!/usr/bin/env bash
# FizyoPark Kiosk — Raspberry Pi Kurulum Scripti
# Kullanım: sudo bash setup.sh
set -e

APP_USER="pi"
APP_DIR="/home/$APP_USER/app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== FizyoPark Kiosk Kurulumu ==="

# ── 1. Sistem güncellemesi ──────────────────────────────────────────────────
echo "[1/8] Sistem güncelleniyor..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Paket kurulumu ───────────────────────────────────────────────────────
echo "[2/8] Paketler kuruluyor..."
apt-get install -y -qq \
  nodejs npm \
  nginx \
  chromium-browser \
  xserver-xorg x11-xserver-utils xinit openbox \
  unclutter \
  python3-gpiozero python3-pigpio pigpio \
  git curl

# Node.js versiyonu kontrol (18+ gerekli)
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node))")
if [ $? -ne 0 ] || node -e "if(parseInt(process.versions.node)<18)process.exit(1)"; then
  echo "Node.js 18+ kuruluyor (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js: $(node --version), npm: $(npm --version)"

# ── 3. Uygulama dosyalarını kopyala ────────────────────────────────────────
echo "[3/8] Uygulama dosyaları kopyalanıyor..."
mkdir -p "$APP_DIR"
rsync -a --exclude='backend/node_modules' --exclude='.git' \
  "$PROJECT_ROOT/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 4. Backend bağımlılıklarını kur ────────────────────────────────────────
echo "[4/8] Backend npm paketleri kuruluyor..."
cd "$APP_DIR/backend"
sudo -u "$APP_USER" npm install --production

# ── 5. .env dosyasını oluştur ──────────────────────────────────────────────
echo "[5/8] .env ayarı..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/raspberry-pi/.env.example" "$APP_DIR/backend/.env"
  echo ""
  echo "!!! UYARI: $APP_DIR/backend/.env dosyasını düzenleyin !!!"
  echo "    DATABASE_URL, JWT_SECRET ve diğer değerleri ayarlayın."
  echo ""
else
  echo ".env zaten mevcut, atlanıyor."
fi

# ── 6. nginx statik dosya sunucusu ─────────────────────────────────────────
echo "[6/8] nginx yapılandırılıyor..."
cp "$APP_DIR/raspberry-pi/nginx-kiosk.conf" /etc/nginx/sites-available/fizyopark
ln -sf /etc/nginx/sites-available/fizyopark /etc/nginx/sites-enabled/fizyopark
rm -f /etc/nginx/sites-enabled/default
# APP_DIR'i nginx config içine yaz
sed -i "s|__APP_DIR__|$APP_DIR|g" /etc/nginx/sites-available/fizyopark
nginx -t && systemctl enable nginx && systemctl restart nginx

# ── 7. xinitrc kopyala ─────────────────────────────────────────────────────
echo "[7/8] Kiosk ekranı yapılandırılıyor..."
cp "$APP_DIR/raspberry-pi/xinitrc" "/home/$APP_USER/.xinitrc"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.xinitrc"
chmod +x "/home/$APP_USER/.xinitrc"

# ── 8. Systemd servisleri ──────────────────────────────────────────────────
echo "[8/8] Systemd servisleri kuruluyor..."

# APP_DIR değişkenini servislere yaz
for svc in door-control.service backend.service kiosk.service; do
  sed "s|__APP_DIR__|$APP_DIR|g; s|__APP_USER__|$APP_USER|g" \
    "$APP_DIR/raspberry-pi/$svc" > "/etc/systemd/system/$svc"
done

# pigpiod (GPIO daemon)
systemctl enable pigpiod
systemctl start pigpiod

systemctl daemon-reload
systemctl enable door-control backend kiosk
systemctl start door-control backend

echo ""
echo "=== Kurulum tamamlandı ==="
echo ""
echo "Sonraki adımlar:"
echo "  1) $APP_DIR/backend/.env dosyasını düzenleyin"
echo "  2) systemctl start kiosk   (veya reboot)"
echo "  3) Kiosk testi: http://localhost/kiosk.html"
echo ""
