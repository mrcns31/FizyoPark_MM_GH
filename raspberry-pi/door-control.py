#!/usr/bin/env python3
"""Kapı röle kontrol servisi.

Kiosk ekranındaki tarayıcı (Chromium), QR doğrulaması başarılı olduğunda
http://127.0.0.1:7000/open adresine POST isteği gönderir. Bu servis isteği
alınca GPIO pinini OPEN_DURATION saniye boyunca tetikleyip röleyi açar/kapatır.
"""

import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import lgpio

# --- Ayarlar ---------------------------------------------------------------
RELAY_PIN = 17          # Röle IN/SIG kablosunun bağlı olduğu GPIO (BCM) pini
ACTIVE_LOW = True        # Çoğu röle modülü "active low"dur (sinyal LOW -> röle çeker)
OPEN_DURATION = 3        # Kapının açık kalma süresi (saniye)
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 7000
# ----------------------------------------------------------------------------
# NOT: gpiozero + ayrı thread kombinasyonu, art arda tetiklemelerde
# donan thread'lere yol açıyordu. Bunun yerine ham lgpio çağrıları,
# istek başına thread açmadan (HTTPServer zaten tek seferde bir isteği
# işliyor, art arda gelen istekler otomatik sıraya giriyor) kullanılıyor.

_h = lgpio.gpiochip_open(0)
lgpio.gpio_claim_output(_h, RELAY_PIN, 0 if ACTIVE_LOW else 1)  # başlangıç: röle kapalı


def trigger_door():
    lgpio.gpio_write(_h, RELAY_PIN, 1 if ACTIVE_LOW else 0)
    time.sleep(OPEN_DURATION)
    lgpio.gpio_write(_h, RELAY_PIN, 0 if ACTIVE_LOW else 1)


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
            trigger_door()
            self._send_json(200, '{"ok":true}')
        else:
            self._send_json(404, '{"ok":false,"error":"not_found"}')

    def log_message(self, fmt, *args):
        pass  # konsolu kirletmesin


if __name__ == "__main__":
    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    try:
        server.serve_forever()
    finally:
        lgpio.gpio_free(_h, RELAY_PIN)
        lgpio.gpiochip_close(_h)
