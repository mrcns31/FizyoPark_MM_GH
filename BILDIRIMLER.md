# Bildirim Sistemleri – Genel Bakış

Bu dosya, projede şu ana kadar eklenen tüm bildirim/uyarı özelliklerini özetler.

---

## 1. Üye Portalı – QR Giriş Bildirimi ("MERHABA X")

**Ne zaman tetiklenir:** Üye, üye portalındaki QR kodunu okutarak giriş yaptığında.

**Nasıl çalışır:**
- `backend/routes/member-portal.js` → `GET /dashboard` endpoint'i, üyenin günün en son QR girişini (`sessions.checked_in_at` veya `facility_access_logs`, hangisi daha yeni ise) `lastCheckIn: { at, ok }` olarak döner.
  - `ok: true` → planlı bir seansa giriş yapıldı.
  - `ok: false` → planlı seans yok, serbest giriş (walk-in).
- `app.js` → `maybeShowCheckInAlert(portal)`: `localStorage`'da (`memberCheckInAlertAt_<memberId>`) son gösterilen `at` değeri ile karşılaştırır, yeni bir giriş varsa **compact modal** (`compactDialog: true`) ile gösterir:
  - Başlık: `"MERHABA " + üyeAdı`
  - Mesaj: `"Seansınıza giriş kaydedildi"` (ok:true) veya `"Bugün için planlı bir seansınız yok"` (ok:false)

**Anlık gösterim (QR ekranı açıkken):**
- Üye QR kodunu ekranda açık tutarken `app.js` her **2 saniyede bir** (`MEMBER_QR_CHECKIN_POLL_MS`) `getMemberDashboard()` çağırır (`pollMemberQrCheckIn`).
- Yeni bir giriş tespit edilirse: QR modalı otomatik kapanır (`closeMemberQrModal`) ve portal yenilenir → yukarıdaki "MERHABA X" bildirimi hemen görünür.

---

## 2. Üye İptali → Personel/Admin Üst Bildirimi (Toast)

**Ne zaman tetiklenir:** Üye, kendi portalından bir randevusunu iptal ettiğinde.

**Backend:**
- `backend/routes/member-portal.js` → `POST /sessions/:id/cancel`, `activity_logs` tablosuna `session.cancel_by_member` kaydı düşer (`entityType: 'session'`, `entityId: <sessionId>`).
- `backend/routes/sessions.js` → `GET /sessions/notifications` (eski adı: `cancellation-notifications`) bu kayıtları okur ve rol bazlı filtreler:
  - `member` → `[]`
  - `staff` → sadece **kendi** seanslarına ve **bugüne** ait iptaller (`s.start_ts` bugünün aralığında)
  - `admin` → tüm tarihler, tüm personel

**Frontend:**
- `app.js` → `pollNotifications()` her **20 saniyede** bir (`NOTIFICATION_INTERVAL_MS`) ve sekme tekrar görünür/odaklanır olduğunda çalışır.
- Yeni bir iptal bulunduğunda ekranın üstünde kayan/solan bir bildirim (`showTopNotification`) gösterilir:
  > "{Üye Adı} randevusunu iptal etti (gg.aa ss:dd)."

---

## 3. Üye QR ile Kapıdan Giriş → Personel/Admin Üst Bildirimi (Toast)

**Ne zaman tetiklenir:** Üye kapıdaki QR ile giriş yaptığında **VE** o gün bir personelle planlı randevusu varsa (walk-in/serbest girişlerde bildirim gitmez).

**Backend:**
- `backend/routes/member-portal.js` → `POST /verify-access`, `checkIn.checkedIn === true` olduğunda `activity_logs`'a `session.check_in_qr` kaydı düşer (`entityType: 'session'`, `entityId: <sessionId>`).
- Aynı `GET /sessions/notifications` endpoint'i bu kayıtları da `type: 'checkin'` olarak döner; rol bazlı filtre `session.cancel_by_member` ile aynı mantıkla çalışır (personel sadece kendi/bugünkü, admin hepsi).

**Frontend:**
- Aynı `pollNotifications()` döngüsü içinde, `type === 'checkin'` olan kayıtlar için üstte şu bildirim gösterilir:
  > "{Üye Adı} Kapıdan Giriş Yaptı"

---

## 4. Admin Ana Alan – "Bildirimler" Görünümü (Kalıcı Liste)

**Kim görür:** Sadece **admin**.

**İçerik:** Son 30 gün içindeki tüm üye-iptal (`type: 'cancel'`) ve QR-giriş (`type: 'checkin'`) bildirimleri, en yeniden eskiye sıralı (en fazla 50 kayıt).

**Nasıl çalışır:**
- Sidebar'da "Üyeler" bölümüne, "Eski Üyeler" butonunun yanına **"Bildirimler"** butonu eklendi (`#openNotificationsBtn`), üzerinde okunmamış bildirim sayısı rozeti (`notificationsNavBadge`).
- Tıklandığında `openNotificationsView()` çağrılır: "Üyeleri Listele" / "Paketi Bitmiş Üyeler" / "Eski Üyeler" ile aynı **ana içerik alanında** (`#adminNotificationsView`, `ui.adminMainView === "notifications"`) tablo halinde açılır.
- Üstte tür bazlı filtre sekmeleri bulunur (`.entry-list-tabs`): **Tümü / İptaller / Kapıdan Girişler** (`ui.notificationsTypeFilter`). Ayrıca üst arama kutusu (`ui.plannerFilter`) ile üye/personel adına göre de filtrelenebilir.
- Açıldığında `GET /sessions/notifications?limit=50` çağrılır (`loadAdminNotificationsList`), tablo render edilir (`renderNotificationsTable`, sayfalama ile) ve tüm bildirimler "okundu" olarak işaretlenir (en güncel `at` değeri `localStorage["lastSeenNotificationAt"]`'e yazılır → rozet sıfırlanır).
- Gerçek zamanlı `pollNotifications()` sırasında admin'e gelen her yeni bildirim, toast'a ek olarak bu listeye de eklenir (`addNotificationToList`) ve rozet artar.
- Okunmamış bildirimler tabloda mor vurgulu satır (`.notifications-table__row--unread`) ile gösterilir.

---

## Ortak Altyapı

- **Üst bildirim (toast):** `showTopNotification(message)` — `#topNotificationContainer`, ekranın üstünde ortalanmış, 6 saniye sonra solarak kaybolan kutu (`.top-notification`).
- **Polling:** `startSessionAutoSync()` içinde, üye olmayan kullanıcılar için 20 saniyede bir `pollNotifications()` çalışır; ayrıca sekme görünür/odaklı olduğunda (`onSessionSyncVisibility`) anında tetiklenir.
- **Tek API endpoint'i:** `GET /sessions/notifications`
  - `?since=<ms>` → polling modu (yeni bildirimler, eskiden yeniye sıralı)
  - `?limit=<n>` (since olmadan) → liste modu (son N bildirim, yeniden eskiye sıralı, varsayılan 30 gün)
- **Modal stili:** Yeni eklenen tüm "modal" tarzı bildirimler varsayılan olarak `compactDialog` / `.modal--compact` stilini kullanır (ortalanmış, ~400px, ortalı başlık/metin, yan yana butonlar).

---

## 5. Kapı Girişi → Mobil Push Bildirimi (Android APK)

**Ne zaman tetiklenir:** Üye QR / KART / TELEFON ile kapıdan giriş yaptığında.

**Alıcılar ve mesajlar:**

| Alıcı | Başlık | Mesaj |
|-------|--------|-------|
| Admin / Manager | Kapı Girişi | `Ad Soyad - QR/KART/TELEFON ile SS:DD'deki randevusu için giriş yapmıştır.` |
| Admin / Manager (randevusuz) | Kapı Girişi | `Ad Soyad - QR/KART/TELEFON ile randevusuz giriş yapmıştır.` |
| O saatteki sorumlu personel | Kapı Girişi | Aynı mesaj (admin ile) |
| Üyenin kendisi | `Merhaba Ad Soyad` | `PaketAdı paketinizden kalan seans: X` |

**Backend:**
- `backend/routes/member-portal.js` → `sendEntryPush(memberName, method, startTs, sessionId, memberId)`
- Tetiklendiği endpoint'ler: `POST /verify-access` (QR), `POST /verify-card-access` (KART), `POST /verify-phone-access` (TELEFON)
- Expo Push API (`https://exp.host/--/api/v2/push/send`) kullanılır
- `push_tokens` tablosundan token'lar alınır

**Mobil:**
- `mobile-rn/src/lib/push-notifications.ts` → token alınır, giriş sonrası `/api/auth/push-token` ile backend'e kaydedilir
- Token kaydı: kullanıcı giriş yaptığında (`signIn`) otomatik tetiklenir

---

## 6. Üye Randevu İptali → Admin/Personel Push Bildirimi

**Ne zaman tetiklenir:** Üye kendi portalından randevusunu iptal ettiğinde.

**Alıcılar:**
| Alıcı | Koşul |
|-------|-------|
| Admin / Manager | Her zaman |
| Sorumlu Personel | Sadece **bugünkü** randevular (gün içi iptal) |

**Mesaj:**
- Başlık: `Randevu İptali`
- Gövde: `Ad Soyad - GG.AA.YYYY SS:DD randevusunu iptal etmiştir.`

**Backend:**
- `backend/routes/member-portal.js` → `POST /sessions/:id/cancel` → `sendCancellationPush(memberName, startTs, staffId)`

---

## 7. Mesai Sonu Seans Onay Hatırlatması → Personel Push Bildirimi

**Ne zaman tetiklenir:** Personelin mesai saati bittiğinde ve o günkü onaylanmamış seans varsa (günde bir kez).

**Alıcılar:** İlgili personel

**Mesaj:**
- Başlık: `Onay bekleyen seanslar`
- Gövde: `GG.AA.YYYY tarihinde X seans için geldi/gelmedi onayı verilmedi. Lütfen giriş onaylarını tamamlayın.`

**Backend:**
- `backend/utils/sessionAttendance.js` → `createShiftReminderNotification()` → `sendExpoPush()`
- Aynı zamanda `staff_notifications` tablosuna da yazılır (uygulama içi bildirim listesi)

---

## Mobil Uygulama Push Altyapısı

- **Paket:** `expo-notifications` (SDK 56)
- **Servis:** Expo Push Notification Service → FCM V1 (Android)
- **Token kaydı:** `push_tokens` tablosu (user_id, token, unique constraint)
- **Firebase:** FizyoPark Ankara projesi (`fizyopark-ankara-89e46`)
- **Gönderici:** Backend doğrudan `https://exp.host/--/api/v2/push/send` endpoint'ine POST atar
- **iOS:** Henüz eklenmedi (Apple Developer hesabı gerektirir)
