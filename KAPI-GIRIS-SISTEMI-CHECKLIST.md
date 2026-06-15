# Kapı Girişi (QR + Raspberry Pi Röle) Sistemi — Checklist

Bu dosya, üye QR girişi → kiosk ekranı → Raspberry Pi röle kapı açma zincirinde şu ana kadar
yapılan **tüm** kod/iş kalemlerini, hangi aşamada hangi dosyaya yazıldığını gösteren bir
checklist olarak tutar. Repo'da mevcut/yazılmış olan her şey `[x]` ile işaretlenmiştir;
fiziksel/Raspberry Pi üzerinde yapılması gereken kurulum adımları henüz doğrulanamadığından
`[ ]` bırakılmıştır.

---

## Aşama 1 — Üye QR Jetonu Üretimi (Backend)

- [x] **`backend/utils/memberAccessQr.js`** — 45 saniyelik zaman pencereli HMAC token
      (`createMemberAccessToken`, `verifyMemberAccessToken`), `qrPayload = {v,mid,t,w}`
- [x] **`backend/routes/member-portal.js`** → `GET /member-portal/access-qr` (üye girişi
      gerektirir) — `QRCode.toDataURL` ile QR PNG üretir, `expiresIn`/`windowSec` döner

## Aşama 2 — Üye Portalı: QR Gösterimi ve Anlık Bildirim (Frontend, `app.js`)

- [x] `memberQrModal` (compact modal) + FAB butonu (`memberQrFabBtn`) →
      `openMemberQrModal()` / `closeMemberQrModal()`
- [x] `MEMBER_QR_CHECKIN_POLL_MS = 2000` — modal açıkken `pollMemberQrCheckIn()` her 2 sn
      `getMemberAccessQr()` ile QR'ı yeniler ve giriş kontrolü yapar
- [x] Yeni QR-giriş tespit edilince modal otomatik kapanır (`closeMemberQrModal`) ve portal
      yenilenir
- [x] `maybeShowCheckInAlert(portal)` — "MERHABA {Ad}" compact modal'ı, `localStorage`
      (`memberCheckInAlertAt_<memberId>`) ile tekrar göstermeyi engeller

## Aşama 3 — Kapı Doğrulama API (Backend, auth'suz — mikrodenetleyici/kiosk için)

- [x] **`backend/routes/member-portal.js`** → `POST /member-portal/verify-access`
      (router'da `verifyToken`'dan **önce** tanımlı, auth gerektirmez)
  - [x] `verifyMemberAccessToken(token)` ile imza/pencere doğrulaması
  - [x] `checkInSessionForMember(db, memberId)` (→ `backend/utils/packageSessionCounts.js`)
        ile günün planlı seansına check-in (`checked_in_at`, `check_in_method`)
  - [x] Planlı seans yoksa `logWalkInQrAccess(db, memberId)` (→
        `backend/utils/facilityAccess.js`) ile `facility_access_logs`'a "Randevusuz QR" kaydı
  - [x] Başarılı check-in'de `activity_logs`'a `session.check_in_qr` kaydı (→ personel/admin
        bildirimlerinin kaynağı)
- [x] **Migration'lar**
  - [x] `backend/database/migration_sessions_check_in.sql` — `sessions.checked_in_at`,
        `check_in_method`
  - [x] `backend/database/migration_sessions_check_in_method_length.sql`
  - [x] `backend/database/migration_facility_access_logs.sql` — `facility_access_logs` tablosu
- [x] **`api.js`** → `verifyMemberAccess(token)` → `POST /member-portal/verify-access`

## Aşama 4 — Personel/Admin Bildirimleri (Backend + Frontend)

- [x] **`backend/routes/sessions.js`** → `GET /sessions/notifications` — `session.cancel_by_member`
      ve `session.check_in_qr` activity_log kayıtlarını rol bazlı filtreler (`?since=`/`?limit=`)
- [x] **`api.js`** → `getNotifications({since, limit})`
- [x] **`app.js`** → `pollNotifications()` (20 sn) — üst toast bildirimleri ("X randevusunu
      iptal etti", "X Kapıdan Giriş Yaptı")
- [x] **"Bildirimler" ana görünümü** (`#adminNotificationsView`, `ui.adminMainView ===
      "notifications"`) — Üyeleri Listele / Paketi Bitmiş Üyeler / Eski Üyeler ile aynı alanda,
      tür filtreli (Tümü/İptaller/Kapıdan Girişler) ve sayfalamalı tablo
      (`renderNotificationsTable`, `openNotificationsView`, `addNotificationToList`) — **bu
      oturumda tamamlandı**
- [x] `BILDIRIMLER.md` — tüm bildirim akışlarının dokümantasyonu

## Aşama 5 — Kiosk Ekranı (`kiosk.html` + `kiosk.js`)

- [x] **`kiosk.html`** — tam ekran kiosk arayüzü (sol logo paneli, sağ durum paneli, saat),
      `cursor:none`, `user-select:none`; `api.js` + `kiosk.js` yükler
- [x] **`kiosk.js`**
  - [x] Görünmez `kioskInput` üzerinden USB QR okuyucu (klavye-wedge) girişini yakalama
  - [x] `SCANNER_CHAR_FIX` — bu okuyucuya özgü klavye düzeni karakter düzeltmesi
        (`` ` ``→`"`, `?`→`:`, `\`→`,`, `/`→`.`, `'`→`i`)
  - [x] `extractToken(raw)` — ham QR verisinden `{t: "..."}` jetonunu çıkarma (JSON / düzeltilmiş
        JSON / ham metin sırasıyla denenir)
  - [x] `handleScan()` → `window.API.verifyMemberAccess(token)`; başarı/başarısızlık durum
        ekranları (`is-idle` / `is-ok` / `is-fail`), 4 sn sonra otomatik `setIdle()`
  - [x] `INVALID_REASON_MESSAGES` — `expired`/`empty`/`format`/`parse`/`invalid_sig`/
        `member_mismatch` için Türkçe mesajlar
  - [x] `triggerDoor()` — doğrulama başarılıysa `http://127.0.0.1:7000/open`'a `POST`

## Aşama 6 — Raspberry Pi Kapı Röle Servisi (`raspberry-pi/`)

- [x] **`raspberry-pi/door-control.py`** — `gpiozero.OutputDevice` ile GPIO 17 (BCM, active-low)
      röle kontrolü; `127.0.0.1:7000` üzerinde basit HTTP sunucu (`POST /open` → 3 sn röleyi
      tetikler, `trigger_lock` ile eşzamanlı tetiklemeyi engeller, CORS header'ları eklenmiş)
- [x] **`raspberry-pi/door-control.service`** — systemd unit dosyası (`Restart=on-failure`,
      `ExecStart=/usr/bin/python3 /home/fizyopark_mm_gh/door-control.py`)

## Aşama 7 — Font / Görsel Hazırlık

- [x] `fonts/Roboto-Regular.ttf` repoya eklendi (muhtemelen Raspberry Pi'deki Chromium'da Türkçe
      karakterlerin (ı, ş, ğ vb.) düzgün görünmesi için)
- [ ] **Eksik:** `kiosk.html` içine bu fontu kullanan bir `@font-face` tanımı henüz **eklenmedi**
      — şu an `--font` değişkeni sistem fontlarına (`Roboto` dahil, ama yerel dosya değil)
      düşüyor. Raspberry Pi'de Türkçe karakterler bozuk görünüyorsa bu adım tamamlanmalı.

## Aşama 8 — Raspberry Pi Üzerinde Fiziksel Kurulum (doğrulanamadı — sahada yapılacak/yapıldı mı kontrol edilmeli)

- [ ] Raspberry Pi OS kurulumu + Chromium'un kiosk modunda (`--kiosk`) `kiosk.html`'i açacak
      şekilde otomatik başlatılması (örn. `autostart` / systemd servisi)
- [ ] `door-control.service`'in `systemctl enable --now door-control` ile etkinleştirilmesi
- [ ] Röle modülünün GPIO 17 (BCM) pinine kablolanması, `ACTIVE_LOW`/`OPEN_DURATION`
      değerlerinin gerçek donanıma göre doğrulanması
- [ ] USB QR okuyucunun Raspberry Pi'ye takılıp `kioskInput`'a odaklanmış şekilde test
      edilmesi (`SCANNER_CHAR_FIX` eşlemesinin bu cihaz/okuyucu ile uyumlu olduğunun
      doğrulanması)
- [ ] `api.js`'in production backend URL'ine işaret ettiğinin doğrulanması (kiosk, backend'e
      ağ üzerinden erişebilmeli — `CORS_ORIGIN` ayarına bakılmalı)
- [ ] `migration_sessions_check_in.sql`, `migration_sessions_check_in_method_length.sql`,
      `migration_facility_access_logs.sql`'in **production veritabanında** çalıştırıldığının
      doğrulanması

---

## Özet

| Aşama | Konu | Durum |
|---|---|---|
| 1 | Üye QR jetonu üretimi (backend) | ✅ Tamam |
| 2 | Üye portalı QR gösterimi/anlık kontrol (frontend) | ✅ Tamam |
| 3 | Kapı doğrulama API + check-in/walk-in kaydı | ✅ Tamam |
| 4 | Personel/Admin bildirimleri (toast + Bildirimler görünümü) | ✅ Tamam |
| 5 | Kiosk ekranı (`kiosk.html`/`kiosk.js`) | ✅ Tamam |
| 6 | Raspberry Pi röle servisi (`door-control.py` + systemd) | ✅ Tamam (kod) |
| 7 | Font hazırlığı | ⚠️ Kısmi — `@font-face` eksik |
| 8 | Raspberry Pi fiziksel kurulum/saha testleri | ❌ Doğrulanmadı |
