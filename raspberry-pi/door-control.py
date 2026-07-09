#!/usr/bin/env python3
"""Kapı röle kontrol servisi.

Kiosk ekranındaki tarayıcı (Chromium), QR doğrulaması başarılı olduğunda
http://127.0.0.1:7000/open adresine POST isteği gönderir. Bu servis isteği
alınca GPIO pinini OPEN_DURATION saniye boyunca tetikleyip röleyi açar/kapatır.
"""

import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from gpiozero import OutputDevice
from gpiozero.pins.lgpio import LGPIOFactory

# --- Ayarlar ---------------------------------------------------------------
RELAY_PIN = 17          # Röle IN/SIG kablosunun bağlı olduğu GPIO (BCM) pini
ACTIVE_LOW = True        # Çoğu röle modülü "active low"dur (sinyal LOW -> röle çeker)
OPEN_DURATION = 3        # Kapının açık kalma süresi (saniye)
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 7000
# ----------------------------------------------------------------------------
# NOT: RPi.GPIO, Raspberry Pi OS Bookworm çekirdeğinde tekrarlı pin
# toggle'larında donabiliyor (thread sonsuza kadar kilitleniyor). lgpio
# bu sorunu yaşamıyor, bu yüzden pin factory olarak açıkça belirtiliyor.

relay = OutputDevice(
    RELAY_PIN,
    active_high=not ACTIVE_LOW,
    initial_value=False,
    pin_factory=LGPIOFactory(),
)
trigger_lock = threading.Lock()


def trigger_door():
    if not trigger_lock.acquire(blocking=False):
        return  # zaten açık/işlem sürüyor, yeni isteği yoksay
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
        self.send_header("Access-Control-Allow-Private-Network", "true")
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
        pass  # konsolu kirletmesin


if __name__ == "__main__":
    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.serve_forever()
