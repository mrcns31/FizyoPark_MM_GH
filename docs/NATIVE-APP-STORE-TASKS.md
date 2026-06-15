# Native App (Mağaza) Görev Listesi

Bu dosya, Seans Planlayıcı uygulamasının **Google Play** ve **App Store**’da yayınlanması, **Capacitor** native kabuğu ve **push bildirimleri** için adım adım görev listesidir.

**Ön koşul:** Mobile-first UI tamamlanmış olmalı (`docs/MOBILE-FIRST-TASKS.md` — MF-01 … MF-62).  
**Ana sıra (adım adım):** `docs/CAPACITOR-ROADMAP.md` (`CR-xx`) — inline stil, Capacitor, mağaza.  
**İlgili dokümanlar:** `DEPLOYMENT_GUIDE.md`, `docs/PWA-LIGHTHOUSE.md`, `docs/MEMBER-PACKAGE-LOGIC.md`  
**Mimari:** Arayüz APK/IPA içinde (Capacitor WebView) · API + PostgreSQL bulutta (HTTPS) · Expo (`mobile/`) mağaza yolunda kullanılmaz

---

## Faz 1 — Production API ve ön koşullar

- [ ] **NA-01** — Production ortamı seç (Railway / Render / VPS); `DEPLOYMENT_GUIDE.md` adımlarını uygula
- [ ] **NA-02** — PostgreSQL canlıda; tüm migration’lar çalıştırıldı (`backend/database/*.sql`)
- [ ] **NA-03** — Backend HTTPS ile erişilebilir (ör. `https://api.sizindomain.com` veya tek domain `/api`)
- [ ] **NA-04** — `JWT_SECRET`, DB şifreleri yalnızca sunucu env’de; repoya commit edilmedi
- [ ] **NA-05** — Stabil domain + SSL otomatik yenileme doğrulandı
- [ ] **NA-06** — Health check: `GET /health` production’da `200` dönüyor
- [ ] **NA-07** — Gizlilik politikası sayfası yayında (mağaza zorunluluğu; KVKK metni)
- [ ] **NA-08** — Hesaplar: Google Play Console ($25), Apple Developer ($99/yıl) — iOS için Mac + Xcode

---

## Faz 2 — API ve frontend mağaza yapılandırması

- [ ] **NA-09** — Production API URL: `window.__API_BASE__` enjekte eden `www/config.js` (veya build script) oluştur
- [ ] **NA-10** — `index.html` ve `activity-logs.html` içinde `config.js` → `api.js` sırasıyla yükle
- [ ] **NA-11** — `backend/server.js` CORS: Capacitor kökenlerini izin listesine ekle (`https://localhost`, `capacitor://localhost`) + production web URL
- [ ] **NA-12** — `helmet()` CSP: WebView’da CDN (cdnjs xlsx/jspdf) engellenmiyor; gerekirse izin ver
- [ ] **NA-13** — `pwa-register.js`: native platformda service worker kaydını atla (`Capacitor.isNativePlatform()`)
- [ ] **NA-14** — Dışa aktarma (Excel/PDF) gerçek cihazda test; gerekirse CDN kütüphanelerini `www/vendor/` altına lokal kopyala
- [ ] **NA-15** — Telefonda production URL ile tam akış testi: giriş → takvim → paket → iptal (tarayıcı, Capacitor öncesi)

---

## Faz 3 — Capacitor projesi

- [ ] **NA-16** — Repo kökünde `package.json` (veya `mobile/`) + `@capacitor/core`, `@capacitor/cli` kur
- [ ] **NA-17** — `npx cap init` — uygulama adı: **Seans Planlayıcı**, bundle ID: `com.sizinstudio.seans` (nihai ID’yi erken sabitle)
- [ ] **NA-18** — `www/` sync script: `index.html`, `activity-logs.html`, `app.js`, `api.js`, `styles.css`, `config.js`, `icons/`, `pwa-register.js` kopyala (`backend/`, `docs/` hariç)
- [ ] **NA-19** — `npm run build:mobile` script: www sync + `npx cap sync`
- [ ] **NA-20** — `capacitor.config` — `webDir: www`, `androidScheme: https`, tema rengi `#0b1020`
- [ ] **NA-21** — `@capacitor/splash-screen` + `@capacitor/status-bar` kur; koyu tema ile uyumlu splash
- [ ] **NA-22** — `npx cap add android` → Android Studio’da emulator veya gerçek cihazda açılış testi
- [ ] **NA-23** — `npx cap add ios` → Xcode simulator / gerçek iPhone testi (Mac gerekli)
- [ ] **NA-24** — Native’de giriş, API çağrıları ve üye/admin akışları çalışıyor (localhost API yok)

---

## Faz 4 — Google Play (Android)

- [ ] **NA-25** — Android Studio kurulumu tamam; `npx cap open android` sorunsuz
- [ ] **NA-26** — `AndroidManifest.xml`: `INTERNET` izni mevcut
- [ ] **NA-27** — Upload keystore oluşturuldu ve güvenli yedeklendi (kayıp = güncelleme yapılamaz)
- [ ] **NA-28** — `versionCode` / `versionName` sürümleme prosedürü yazıldı
- [ ] **NA-29** — Release **AAB** imzalı build alındı
- [ ] **NA-30** — Play Console uygulama kaydı; paket adı bundle ID ile aynı
- [ ] **NA-31** — Mağaza listesi: başlık, kısa/uzun açıklama (Türkçe), kategori, destek e-postası
- [ ] **NA-32** — Grafikler: ikon 512×512, feature graphic 1024×500, telefon ekran görüntüleri (min 2)
- [ ] **NA-33** — Veri güvenliği formu + gizlilik politikası URL’si dolduruldu
- [ ] **NA-34** — İç test → kapalı test → üretim (aşamalı yayın)
- [ ] **NA-35** — İnceleme notu: stüdyo personeli/üye seans planlama; hesap stüdyo tarafından verilir; internet gerekir

---

## Faz 5 — App Store (iOS)

- [ ] **NA-36** — Mac + Xcode kurulu; Apple Developer hesabı aktif
- [ ] **NA-37** — Xcode Signing: Team, Bundle ID, otomatik imzalama
- [ ] **NA-38** — Push Notifications capability (Faz 6 ile birlikte; şimdiden açılabilir)
- [ ] **NA-39** — App ikon seti (1024×1024) + Launch Screen (`#0b1020`)
- [ ] **NA-40** — Yalnızca HTTPS API; HTTP ATS istisnası gerekmediği doğrulandı
- [ ] **NA-41** — Archive → App Store Connect yükleme başarılı
- [ ] **NA-42** — App Store Connect kayıt; SKU ve bundle ID eşleşmesi
- [ ] **NA-43** — Ekran görüntüleri: 6.7" ve 6.5" iPhone boyutları
- [ ] **NA-44** — App Privacy + Privacy Nutrition Labels (e-posta, isim, seans verisi)
- [ ] **NA-45** — Hesap silme talebi akışı mağaza açıklamasında belirtildi (Guideline uyumu)
- [ ] **NA-46** — TestFlight iç test → App Review gönderimi
- [ ] **NA-47** — Guideline 4.2 notu: tam iş akışı (giriş, takvim, paket, iptal) — salt web sarmalayıcı değil

---

## Faz 6 — Push bildirim altyapısı

- [ ] **NA-48** — Firebase projesi oluşturuldu (FCM)
- [ ] **NA-49** — Android: `google-services.json` → Capacitor Android projesine eklendi
- [ ] **NA-50** — iOS: APNs key oluşturuldu, Firebase’e bağlandı; `GoogleService-Info.plist` eklendi
- [ ] **NA-51** — `@capacitor/push-notifications` kuruldu; izin isteme akışı (Android 13+ dahil)
- [ ] **NA-52** — Migration: `device_tokens` tablosu (`user_id`, `role`, `platform`, `token`, `updated_at`)
- [ ] **NA-53** — API: `POST /api/push/register`, `DELETE /api/push/unregister` (logout’ta token sil)
- [ ] **NA-54** — Backend: `firebase-admin` (veya FCM HTTP v1) ile `sendPushToUser` / `sendPushToRole` servisi
- [ ] **NA-55** — Mobil: token alındığında backend’e kayıt; yenileme (token refresh) dinleniyor
- [ ] **NA-56** — Mobil: bildirime tıklanınca deep link — seans / paket / profil ekranına yönlendirme
- [ ] **NA-57** — Gerçek cihaz push testi: Android + iPhone (simülatörde iOS push sınırlı)

---

## Faz 7 — Push iş kuralları ve uygulama içi bildirimler

Mevcut üye uyarıları (`member-portal` dashboard `notifications`) korunur; push bunların tamamlayıcısıdır.

### Tetikleyiciler

- [ ] **NA-58** — Üye: aktif paket kalan seans &lt; 4 → push (+ mevcut uygulama içi banner)
- [ ] **NA-59** — Üye: paket seansları tükendi → push
- [ ] **NA-60** — Üye: seans hatırlatması (ör. 24 saat / 2 saat önce — cron veya zamanlanmış job)
- [ ] **NA-61** — Üye: seans iptal onayı → push
- [ ] **NA-62** — Personel: atanan seansa üye iptali → push (ilgili personel)
- [ ] **NA-63** — Personel: yeni seans atandı → push
- [ ] **NA-64** — Admin: üyelik silme talebi → push
- [ ] **NA-65** — Admin: kritik sistem uyarıları (isteğe bağlı)

### Uygulama içi genişletme

- [ ] **NA-66** — `notifications` tablosu veya genişletilmiş API: geçmiş bildirimler, okundu işareti
- [ ] **NA-67** — Admin ve personel için bildirim paneli / badge (mobil topbar veya drawer)
- [ ] **NA-68** — Bildirim tercihleri (rol bazlı aç/kapa — isteğe bağlı, `app_settings` veya kullanıcı profili)
- [ ] **NA-69** — `docs/MEMBER-PACKAGE-LOGIC.md` içine bildirim kuralları eklendi (MP-xx maddeleri)

---

## Faz 8 — Mağaza sonrası operasyon ve test

Detaylı cihaz checklist’i: `docs/NATIVE-APP-TEST-CHECKLIST.md` (oluşturulacak)

- [ ] **NA-70** — Sürümleme politikası: UI değişikliği → mağaza sürümü; API/iş kuralı → backend deploy
- [ ] **NA-71** — Her release: `build:mobile` → `cap sync` → platform build → mağazaya yükle
- [ ] **NA-72** — Üye akışı native: giriş → takvim → iptal → paket → push alındı
- [ ] **NA-73** — Admin akışı native: seans ekle → kaydet → personel push (ilgili senaryoda)
- [ ] **NA-74** — Push izni reddedildiğinde uygulama içi bildirimler çalışmaya devam ediyor
- [ ] **NA-75** — Crash / ANR: Play Console + Xcode Organizer izleme
- [ ] **NA-76** — Kullanıcı destek kanalı (e-posta / WhatsApp) mağaza listesinde güncel

---

## Bildirim matrisi (referans)

| Olay | Üye | Personel | Admin | Kanal |
|------|-----|----------|-------|-------|
| Paket azalıyor (&lt; 4) | ✓ | — | — | Push + uygulama içi |
| Paket bitti | ✓ | — | — | Push + uygulama içi |
| Seans hatırlatma | ✓ | — | — | Push |
| Üye seans iptal | ✓ | ✓ | ops. | Push |
| Yeni seans atandı | ✓ | ✓ | — | Push |
| Silme talebi | uygulama içi | — | ✓ | Push (admin) |

---

## İlerleme özeti

| Faz | Görev sayısı | Tamamlanan |
|-----|--------------|------------|
| 1 — Production API | 8 | 0 |
| 2 — API / frontend config | 7 | 0 |
| 3 — Capacitor | 9 | 0 |
| 4 — Google Play | 11 | 0 |
| 5 — App Store | 12 | 0 |
| 6 — Push altyapı | 10 | 0 |
| 7 — Push iş kuralları | 12 | 0 |
| 8 — Operasyon / test | 7 | 0 |
| **Toplam** | **76** | **0** |

---

## Önerilen sıra

```text
Faz 1–2 (API + config) → Faz 3 (Capacitor) → Faz 4 veya 5 (mağaza, paralel mümkün)
→ Faz 6–7 (push) → Faz 8 (operasyon)
```

Push (Faz 6–7), mağaza iç testi sırasında veya hemen sonrasında eklenebilir; iOS için Faz 5 öncesi NA-38 (Push capability) açılmalı.

---

## Notlar

- Görev tamamlandıkça `[ ]` → `[x]` işaretleyin ve üst tablodaki sayacı güncelleyin.
- Bundle ID (`com.sizinstudio.seans` örnek) ilk `cap init`’te sabitlenmeli; sonradan değiştirmek mağaza kaydını zorlaştırır.
- Native uygulama **offline çalışmaz**; mağaza açıklamasında internet gereksinimi belirtilmeli.
- `www/config.js` içinde production API URL’si repoda placeholder tutulabilir; gerçek URL deploy secret veya CI env ile enjekte edilmeli.
- Yeni mağaza veya push özelliği eklerken önce bu listede madde var mı kontrol edin; yoksa madde ekleyin.
