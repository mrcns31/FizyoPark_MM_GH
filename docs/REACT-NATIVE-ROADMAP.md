# React Native Yol Haritası (Paralel / Keşif Hattı)

> **Durum:** Bu hat **Capacitor'a paralel** yürütülen alternatif bir mobil yaklaşımdır.
> Capacitor mağaza planı (`docs/CAPACITOR-*.md`, `docs/NATIVE-APP-STORE-TASKS.md`) birincil hattır ve **diğer geliştirici tarafından sürdürülür**.
> Bu doküman o planların **hiçbirini değiştirmez**; mevcut `mobile/` (Expo iskeleti) klasörüne de dokunulmaz.
> RN çalışması tamamen **yeni bir `mobile-rn/` klasöründe** izole edilir.

## Kararlar (2026-06-17)

| Konu | Karar | Not |
|------|-------|-----|
| Kapsam | **Tüm roller** (üye + personel + admin) | Fazlı: önce üye, sonra personel, en son admin |
| Konum | **`mobile-rn/`** yeni klasör | `mobile/` Expo iskeleti ve Capacitor planı dokunulmaz |
| Stack | **Expo (managed) + dev-client** | RFID/NFC gerekirse dev-client ile native modül eklenir |
| Build | **EAS yok — local build** | `expo prebuild` + Gradle/Xcode. EAS sonradan opsiyonel |
| Maliyet | **Sıfır** | Geliştirme + APK + cihaz testi tamamen ücretsiz; sadece mağaza yayını anında Google ($25) / Apple ($99/yıl) |
| Backend | **Değişmez** | Aynı `/api` REST + JWT; RN sadece tüketici |

---

## 0 — Neden RN burada "sıfırdan UI" demek

Mevcut web app **saf vanilla JS**'tir (`app.js` 12.8K satır, `api.js` 1K satır, React/Vue yok).
DOM, string birleştirme (`renderXxx()` fonksiyonları) ile üretiliyor.

Sonuç:
- **UI yeniden yazılır.** Web bileşenleri RN'e taşınamaz (HTML/CSS ≠ RN View/StyleSheet).
- **İş mantığı taşınabilir.** `api.js` içindeki endpoint çağrıları + veri mapper'ları (`memberFromApi`, `sessionFromApi`, `memberPackageFromApi` vb. ~50 fonksiyon, `window.API` altında) **TypeScript API client** olarak birebir port edilebilir. En değerli yeniden kullanım burada.
- **Backend dokunulmaz.** Capacitor da, RN de aynı REST yüzeyini kullanır → backend tek kaynak.

---

## Backend API Envanteri (RN'in tüketeceği yüzey — referans)

| Alan | Endpoint'ler (backend/routes) | Rol |
|------|-------------------------------|-----|
| Auth | `POST /auth/login`, `GET /auth/me`, `/consent`, `/set-password`, `/change-password`, `PUT /auth/account`, `/refresh`, `/logout` | hepsi |
| Üye portalı | `/member-portal/dashboard`, `/sessions/:id/cancel`, `/access-qr`, `/package-request`, `/request-account-deletion`, `/verify-access`, `/verify-card-access`, `/verify-phone-access` | member |
| Üyeler | `members` (CRUD, former, deletion-requests, reset-password, reactivate) | admin |
| Üye paketleri | `member-packages` (CRUD, check-availability, `:id/end`, `:id/sessions`) | admin/staff |
| Paketler | `packages` (CRUD, export/csv) | admin |
| Paket talepleri | `package-requests` (unseen-count, mark-seen, dismiss, fulfill) | admin |
| Seanslar | `sessions` (CRUD, notifications, group/bulk) | admin/staff |
| Devamsızlık | `session-attendance` (notifications, shift-reminder) | staff |
| Odalar | `rooms` (CRUD) | admin |
| Personel | `staff` (CRUD, reset-password) | admin |
| Ayarlar | `settings` (working-hours, institution-whatsapp) | admin |
| Kapanış | `closure-periods` (CRUD) | admin |
| Kapı | `POST /door/open` (admin; Raspberry Pi'ye proxy) | admin |
| Loglar | `activity-logs` | admin |

JWT, web tarafında `localStorage`'ta. RN'de → **`expo-secure-store`** (şifreli keychain/keystore).

---

## Faz F0 — İskelet ve İzolasyon (1-2 gün)

- [ ] **RN-01** — `mobile-rn/` oluştur: `npx create-expo-app@latest mobile-rn -t expo-template-blank-typescript`
- [ ] **RN-02** — Kök `.gitignore`'a `mobile-rn/node_modules`, `mobile-rn/.expo` ekle (Capacitor planına dokunmadan)
- [ ] **RN-03** — Tema portu: `mobile/src/theme/colors.ts` değerlerini `mobile-rn/src/theme/`e **kopyala** (orijinal dosyaya dokunma). `#0B1020` arka plan, `#3DB84A` yeşil.
- [ ] **RN-04** — Splash/font: `mobile/assets` ve `SplashScreen.tsx` mantığını referans alarak yeniden kur.
- [ ] **RN-05** — Bağımlılıklar: `expo-router` (veya `@react-navigation/*`), `expo-secure-store`, `@tanstack/react-query`, `zod`.
- [ ] **RN-06** — `app.config.ts`: bundle ID **Capacitor'dan FARKLI** seç (ör. `com.fizyopark.rn`) → iki uygulama çakışmasın.

## Faz F1 — Çekirdek altyapı (3-4 gün)

- [ ] **RN-10** — **API client port**: `api.js` → `mobile-rn/src/api/`. `apiFetch` (fetch wrapper + token header), endpoint fonksiyonları, mapper'lar. Saf TS, DOM bağımlılığı yok.
- [ ] **RN-11** — `API_BASE`: `app.config.ts` extra'dan oku (`EXPO_PUBLIC_API_BASE`). Web'deki `window.__API_BASE__` mantığının RN karşılığı.
- [ ] **RN-12** — **Auth context**: login → token → `expo-secure-store`; `GET /auth/me` ile rol; `refresh`/`logout`. Rol bazlı yönlendirme (member/staff/admin/manager).
- [ ] **RN-13** — **Navigation iskeleti**: rol bazlı stack/tab. Member tab, Staff tab, Admin tab ayrı.
- [ ] **RN-14** — React Query ile cache + retry; web'deki `readCache/writeCache` mantığının yerini tutar.
- [ ] **RN-15** — Hata/yükleme/boş durum ortak bileşenleri (LoadingDots RN portu).

## Faz F2 — Üye uygulaması (MVP, en yüksek değer — 1-1.5 hafta)

> Capacitor'ın da birincil kitlesi. Önce bu canlanır.

- [ ] **RN-20** — Login + KVKK onay (`/consent`) + ilk şifre (`/set-password`).
- [ ] **RN-21** — **Üye ana ekran**: dashboard (`/member-portal/dashboard`) — aktif paket, kalan seans (`renderMemberHome*` web karşılığı).
- [ ] **RN-22** — **Seans takvimi/listesi** (`renderMemberPortalSessionsTable`, `renderSessionsListCards` mantığı).
- [ ] **RN-23** — **Seans iptali** (`/sessions/:id/cancel`) — iptal kuralları `docs/MEMBER-PACKAGE-LOGIC.md`.
- [ ] **RN-24** — **Paket talebi** (`/package-request`) + geçmiş paketler.
- [ ] **RN-25** — **QR erişim ekranı** (`/access-qr`) — `expo-barcode-scanner`/QR gösterimi; kapı giriş akışı.
- [ ] **RN-26** — Profil + şifre değiştir (`PUT /auth/account`, `/change-password`) + hesap silme talebi.

## Faz F3 — Personel uygulaması (1 hafta)

- [ ] **RN-30** — Personel planner/seans listesi (`renderStaffPlanner*`, `renderStaffAttendance*`).
- [ ] **RN-31** — Devamsızlık/yoklama işaretleme (`session-attendance`).
- [ ] **RN-32** — Bildirimler listesi (`/notifications/list`, `/notifications/:id/read`).
- [ ] **RN-33** — Çalışma saatleri görünümü.

## Faz F4 — Admin uygulaması (en kapsamlı — 2-3 hafta)

> Web'de en ağır ekranlar. RN'de zorunlu mu, yoksa admin PC'de mi kalır → faz sonunda tekrar değerlendir.

- [ ] **RN-40** — Üye yönetimi (liste/CRUD/arama, former, reactivate).
- [ ] **RN-41** — Paket yönetimi + paket talepleri onayı (`fulfill`).
- [ ] **RN-42** — Seans/planner (admin grid — RN'de en zor; takvim kütüphanesi seç).
- [ ] **RN-43** — Personel & oda yönetimi.
- [ ] **RN-44** — Ayarlar (working-hours, whatsapp), kapanış dönemleri.
- [ ] **RN-45** — Silme talepleri onay/red, şifre sıfırlama.
- [ ] **RN-46** — **Kapı aç** (`/door/open`) — admin acil müdahale.
- [ ] **RN-47** — Aktivite logları (salt okuma).
- [ ] **RN-48** — Export (CSV/PDF) — mobilde paylaş/indir (`expo-sharing`).

## Faz F5 — Native özellikler & mağaza (1-2 hafta)

- [ ] **RN-50** — **Push bildirim** (`expo-notifications` + EAS push) — backend'e token kayıt endpoint'i gerekebilir (yeni, küçük). Capacitor planındaki push ile aynı backend ihtiyacı.
- [ ] **RN-51** — **RFID/NFC** (gerekiyorsa): `card_no` + `/verify-card-access`. NFC için **dev-client** + `react-native-nfc-manager` (managed Expo Go yetmez).
- [ ] **RN-52** — Derin link / QR ile açılış.
- [ ] **RN-53** — **Local build (EAS'siz):** `npx expo prebuild` → `android/`+`ios/` üret; Android Studio/Gradle ile APK/AAB, Xcode ile IPA. Bulut servisi yok, ücret yok. _(Opsiyonel: ileride OTA/bulut build istenirse EAS free tier'a geçilebilir — şimdilik kapsam dışı.)_
- [ ] **RN-54** — Google Play iç test + App Store TestFlight (Capacitor'dan **ayrı uygulama kaydı / bundle ID**). Yalnız mağaza yayını anında ücret: Google $25 / Apple $99.
- [ ] **RN-55** — KVKK gizlilik URL'i (mağaza zorunlu — mevcut `docs/KVKK-METINLERI.md` yeniden kullanılır).

---

## İki hat çakışmasın diye kurallar

1. **Dosya izolasyonu**: RN sadece `mobile-rn/` ve `docs/REACT-NATIVE-*.md`'ye yazar. `mobile/`, `docs/CAPACITOR-*`, `docs/NATIVE-APP-STORE-TASKS.md`, `app.js`, `api.js`, `index.html` **salt okunur** (port için kopyalanır, düzenlenmez).
2. **Backend ortak**: RN yeni backend endpoint'i gerektirirse (push token kaydı gibi) → ayrı küçük PR, Capacitor'ı bozmayacak şekilde additive.
3. **Bundle ID ayrı**: `com.fizyopark.rn` ≠ Capacitor'ın `com.fizyopark.app`. İki build yan yana kurulabilir, karşılaştırılabilir.
4. **Git**: tercihen ayrı feature branch (`feat/rn-mobile`), main'e ancak değerlendirme sonrası.

## Karar noktası (F2 sonrası)

Üye MVP'si RN'de canlandığında Capacitor üye akışıyla **yan yana** karşılaştır:
- Performans (düşük segment Android açılış süresi — `docs/PERFORMANCE-TASKS.md` metrikleri),
- Geliştirme hızı, bakım yükü, native his.
Buna göre RN'i admin'e kadar sürdürmek mi, yoksa Capacitor'da kalmak mı netleşir.

## Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| UI sıfırdan (12.8K satır web mantığı) | Yüksek efor | Fazlı; önce üye, mapper'ları yeniden kullan |
| Admin planner grid karmaşıklığı | Yüksek | Admin'i PC'de bırakma seçeneğini açık tut |
| İki mobil hat eforu böler | Orta | RN keşif hattı; Capacitor birincil kalır |
| RFID/NFC managed Expo'da çalışmaz | Orta | dev-client + native modül baştan planlı |
| Push için backend değişikliği | Düşük | Additive endpoint, ayrı PR |
