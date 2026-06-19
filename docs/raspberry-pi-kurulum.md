# Raspberry Pi Kiosk Kurulum Rehberi

## Donanım
- Raspberry Pi 3 Model B
- Kullanıcı adı: `piuc`
- Hostname: `fizyopark-pi3`
- Pi IP: `192.168.8.103`
- Sunucu IP: `192.168.8.112`
- Röle GPIO pin: BCM 17 (active-low)

---

## 1. SD Kart Hazırlama (Raspberry Pi Imager)

- OS: **Raspberry Pi OS Lite (32-bit)** — Bookworm
- Kullanıcı: `piuc`
- Şifre: (belirlenen şifre)
- SSH: **Etkin**
- Klavye: `tr`
- Timezone: `Europe/Istanbul`
- Hostname: `fizyopark-pi3`

> Not: Imager'da dişli/ayarlar simgesi yoksa bu ayarlar yapılamıyor olabilir — kurulum sonrası manuel yapılır.

---

## 2. İlk Bağlantı (SSH)

```bash
ssh piuc@192.168.8.103
```

> SSH bağlantı hatası alırsanız (host key changed):
> ```powershell
> ssh-keygen -R 192.168.8.103
> ```

---

## 3. Sistem Güncellemesi

```bash
sudo apt update
sudo apt install -y chromium-browser xorg openbox unclutter
```

---

## 4. Klavye ve Saat Ayarı

```bash
sudo nano /etc/default/keyboard
# XKBLAYOUT="tr" yapın
sudo dpkg-reconfigure keyboard-configuration
sudo timedatectl set-timezone Europe/Istanbul
sudo timedatectl set-ntp true
```

---

## 5. Otomatik Login (Console)

```bash
sudo raspi-config nonint do_boot_behaviour B2
```

---

## 6. Kiosk Otomatik Başlatma

### `.bash_profile` (startx tetikleyici)
```bash
echo '[[ -z $DISPLAY && $(tty) == /dev/tty1 ]] && startx' >> ~/.bash_profile
```

### `.xinitrc` (Chromium kiosk)
```bash
echo 'exec chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://192.168.8.112:5173/kiosk.html' > ~/.xinitrc
```

### Xwrapper izni
```bash
echo -e "allowed_users=anybody\nneeds_root_rights=yes" | sudo tee /etc/X11/Xwrapper.config
```

---

## 7. Kapı Röle Servisi

### `/home/piuc/door-control.py`

```python
#!/usr/bin/env python3
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from gpiozero import OutputDevice
from gpiozero.pins.rpigpio import RPiGPIOFactory

RELAY_PIN = 17
OPEN_DURATION = 1.5
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 7000

factory = RPiGPIOFactory()
relay = OutputDevice(RELAY_PIN, active_high=False, initial_value=False, pin_factory=factory)

trigger_lock = threading.Lock()

def trigger_door():
    if not trigger_lock.acquire(blocking=False):
        return
    try:
        relay.on()
        time.sleep(OPEN_DURATION)
        relay.off()
    finally:
        trigger_lock.release()

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def do_OPTIONS(self):
        self._send_json(204, "")

    def do_POST(self):
        if self.path == "/open":
            threading.Thread(target=trigger_door, daemon=True).start()
            self._send_json(200, '{"ok":true}')
        else:
            self._send_json(404, '{"ok":false,"error":"not_found"}')

    def log_message(self, fmt, *args):
        pass

if __name__ == "__main__":
    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    try:
        server.serve_forever()
    finally:
        relay.close()
```

### `/etc/systemd/system/door-control.service`

```ini
[Unit]
Description=FizyoPark Kapi Role Kontrol
After=multi-user.target

[Service]
Type=simple
User=piuc
WorkingDirectory=/tmp
ExecStart=/usr/bin/python3 /home/piuc/door-control.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

### Servisi etkinleştir

```bash
sudo systemctl daemon-reload
sudo systemctl enable door-control
sudo systemctl start door-control
```

---

## 8. Sunucu `.env` Ayarı

```
DOOR_RASPI_URL=http://192.168.8.103:7000/open
```

---

## Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|-------|-------|
| SSH host key hatası | `ssh-keygen -R <ip>` |
| `startx` izin hatası | `/etc/X11/Xwrapper.config` → `allowed_users=anybody` |
| `lgpio` pipe hatası | Servis dosyasına `WorkingDirectory=/tmp` ekle |
| Kapı açılmıyor | `sudo systemctl status door-control` + `journalctl -u door-control -n 20` |
| Röle başlangıçta tetikleniyor | Donanımsal sorun — GPIO init sırasında kısa LOW pulse normal |
| Pi internete çıkamıyor | Router'da MAC filtreleme veya DNS sorunu kontrol et |
| Chromium açılmıyor | `cat ~/.xinitrc` ve `cat ~/.bash_profile` doğru mu kontrol et |
