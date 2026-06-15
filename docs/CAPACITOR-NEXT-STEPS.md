# Capacitor Geçişi — Güncel Durum, Karar ve Yol Haritası (2026-06-14)

Bu doküman `docs/CAPACITOR-ROADMAP.md` (CR-xx), `docs/NATIVE-APP-STORE-TASKS.md` (NA-xx),
`docs/PERFORMANCE-TASKS.md` (PERF-xx) ve `docs/MEMBER-PACKAGE-LOGIC.md` (MP-xx) yeniden
incelenerek hazırlanmıştır. Amaç: **"şu an neredeyiz, sırada ne var, neyi atlayabiliriz, neyi
atlamamalıyız"** sorularına tek yerden cevap vermek.

---

## 1. Güncel durum — gerçek tablo

| Faz | Doküman | Durum | Not |
|-----|---------|-------|-----|
| A — Inline stil temizliği | CR-01–11 | ✅ 11/11 | Bitti |
| Mobile-first UI | MF-01–63 | ✅ 63/63 | Bitti |
| B — CR-12 (MF gözden geçirme) | — | ✅ pratikte tamam | MF listesi zaten 63/63 |
| B — CR-13 (MP F grubu QA) | MP-17–22 | ❌ 0/6 | **Manuel QA yapılmadı** |
| B — CR-14 (mobil test checklist) | — | ✅ tamam | `cr14-mobile-verify.mjs` var |
| B — CR-15 (performans) | PERF-xx | ⚠️ 8/32 | Faz 1 kısmen, Faz 0 ölçüm notları **boş** |
| C — Production API | CR-20–25 / NA-01–08 | ❌ 0/14 | **En büyük blokaj — hiç başlanmadı** |
| D — Capacitor kurulumu | CR-30–38 / NA-16–24 | ❌ 0/18 | Henüz `@capacitor/*` yok, root `package.json` yok |
| E — Cihaz testi | CR-40–53 | ❌ 0/14 | C+D bitmeden anlamsız |
| F/G — Mağaza (Play/App Store) | CR-60–74 / NA-25–47 | ❌ 0/28 | |
| H — Push | CR-80–82 / NA-48–69 | ❌ 0/22 | Mağaza sonrası |
| I — Operasyon | CR-90–94 / NA-70–76 | ❌ 0/5 | |

**Sonuç:** Hazırlık (A + mobile-first) tamamen bitmiş. Şu an **gerçek blokaj Faz C — Production
API**. Capacitor kurulumuna (Faz D) geçmeden önce production API olmadan yapılacak testler
gerçek koşulları yansıtmaz (CORS, HTTPS, performans hep değişir).

---

## 2. Yapılmaması gerekenler (kapsam dışı — roadmap'te zaten karara bağlanmış)

Bunları **tekrar tartışmaya açmayacağız**, zaman kaybettirir:

- ❌ **React Native rewrite** — önceki konuşmada karar verildi, kapsam dışı.
- ❌ **`mobile/` (Expo) klasörü** — dokunulmayacak/arşiv. Geçen taramada `mobile/` hâlâ repo'da
  duruyor (`App.tsx`, `package.json`, `node_modules` dahil) — bu **gereksiz kafa karışıklığı ve
  repo şişkinliği** yaratıyor. Öneri: `mobile/` içine `README: "Kullanılmıyor, Capacitor yolu
  tercih edildi"` notu koy veya tamamen kaldır (git'ten silmeden önce onay alınmalı).
- ❌ **Offline-first / internetsiz seans planlama** — kapsam dışı, native uygulama internet
  gerektirir (mağaza açıklamasında belirtilecek).
- ❌ **Admin için ayrı mağaza paketi** — tek uygulama, rol bazlı UI.
- ❌ **Her CSS değişikliğinde Capgo/OTA** — ilk sürümde gerek yok.
- ❌ **PERF Faz 2–5'in tamamını şimdi bitirmek** (PERF-08…27) — mevcut veri ölçeğinde (~50
  seans) kritik değil; Capacitor'ı bekletmemeli. Sadece **Faz 1'in kalanı** (PERF-04, PERF-05)
  ucuz ve faydalı, onu alalım.

---

## 3. Yapılması gerekenler — öncelik sırasıyla

### Adım 0 (bu hafta, kod değişikliği gerektirmiyor) — CR-13 manuel QA

`docs/MEMBER-PACKAGE-LOGIC.md` F grubu (**MP-17–22**) hâlâ işaretsiz. Bunlar paket/iptal/telafi
iş kurallarının doğru çalıştığını doğrulayan manuel testler:

- MP-17 — Sabit pakette üye iptali reddediliyor mu (API + UI)
- MP-18 — Esnek pakette 2 saat kuralı sınırda doğru çalışıyor mu
- MP-19 — İptal → telafi seansı paket sonuna ekleniyor mu, slot tekrar eklenmiyor mu
- MP-20 — Admin silme aynı telafi mantığını izliyor mu
- MP-21 — Aktif paket sonlandırma → yeni paket atanabiliyor mu, eski seanslar geçmişte mi
- MP-22 — Admin ve üye aynı paket için seans sayıları eşleşiyor mu

**Neden önce bu?** Capacitor/mağaza sürecinde bir hata bulunursa düzeltme → yeni build → mağaza
güncellemesi demek (saatler/günler). Şimdi (web'de) bulup düzeltmek bedava.

**Eylem:** Bu 6 maddeyi sırayla tarayıcıda test edip `[x]` işaretleyelim. Hata bulunursa ayrı
düzeltme görevi açılır.

---

### Adım 1 (bu hafta, ~1-2 saat) — CR-15 / PERF kalan Faz 1

- **PERF-04** — Takvim filtre input'una 200ms debounce (`app.js` → `bindEvents`,
  `plannerFilterInput`)
- **PERF-05** — `syncSessionsFromServer`: `changed === false` iken `saveState()`/`render()`
  atlanmalı

Sonra **PERF-01 ölçüm notları** tablosunu gerçek sayılarla doldur:
```powershell
$env:PERF_ADMIN_PASSWORD="<gerçek şifre>"
node backend/scripts/perf-baseline.js
```
Tarayıcı konsolunda `perfBaseline()` ile admin + üye için `sinceBootMs` / `avgRenderMs` not et.

PERF-08'den sonrası (render bölme, lookup map, event delegation, backend DTO inceltme) **mağaza
sonrasına** bırakılabilir — şu an riskli/maliyetli, kazanç düşük.

---

### Adım 2 (gerçek blokaj) — Production API (CR-20–25 / NA-01–08)

Bu, Capacitor kurulumundan **önce** bitmesi gereken tek büyük iş. Şu an backend tamamen
`localhost` üzerinde çalışıyor:

- `backend/.env.example`: `CORS_ORIGIN=http://localhost:5173`, `DB_HOST=localhost`
- `backend/server.js:39`: `cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' })`
  — **tek origin** kabul ediyor, Capacitor (`capacitor://localhost`, `https://localhost`) ve
  production web URL'i aynı anda desteklemiyor
- `backend/server.js:63`: `/health` endpoint zaten var ✅ (NA-06 hazır)
- `backend/server.js:37`: `helmet()` varsayılan ayarlarla — CDN'den yüklenen `xlsx`/`jspdf`
  Capacitor WebView'da CSP tarafından engellenebilir (NA-12)

**Yapılacaklar (CR-20–25 sırasıyla):**

1. **CR-20/NA-01–02** — Hosting kararı (bkz. § 5 — kullanıcı kararı gerekli) + PostgreSQL +
   tüm migration'ları çalıştır:
   - `backend/database/migration_app_settings.sql`
   - `migration_facility_access_logs.sql`
   - `migration_members_deletion_request.sql`
   - `migration_package_requests.sql`
   - `migration_sessions_attendance.sql`
   - `migration_sessions_check_in.sql`
   - `migration_sessions_check_in_method_length.sql`
   - `migration_users_profile_fields.sql`
2. **CR-21/NA-03, NA-05, NA-06** — Sabit domain + HTTPS (Let's Encrypt veya hosting'in otomatik
   SSL'i); `GET /health` production'da 200 dönmeli
3. **NA-04** — `JWT_SECRET`, DB şifreleri sadece sunucu env'inde; repo'da gerçek `.env` **yok**
   olduğunu doğrula (sadece `.env.example` commit edilmeli — şu an öyle ✅)
4. **CR-22/NA-07** — Gizlilik politikası (KVKK) sayfası — statik bir HTML, hosting'e koy
5. **CR-24/NA-11** — `backend/server.js` CORS güncelle: `CORS_ORIGIN` tek string yerine
   virgülle ayrılmış liste olarak parse edilip array verilmeli, örn:
   ```js
   const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
     .split(',').map(s => s.trim());
   app.use(cors({
     origin: (origin, cb) => {
       if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
       cb(new Error('Not allowed by CORS'));
     },
     credentials: true
   }));
   ```
   `.env`: `CORS_ORIGIN=https://yourdomain.com,capacitor://localhost,https://localhost`
6. **CR-23/NA-09** — `api.js:3` zaten `window.__API_BASE__` enjeksiyonunu destekliyor ✅ —
   sadece `www/config.js` (production URL ile) eklenecek, `index.html`/`activity-logs.html`'e
   `<script src="config.js">` `api.js`'den **önce** yüklenecek
7. **CR-25/NA-15** — Tarayıcıdan production URL ile tam akış testi (giriş → takvim → paket →
   iptal) — Capacitor'a geçmeden önce

---

### Adım 3 — Capacitor kurulumu (CR-30–38 / NA-16–24)

Production API çalışınca:

- Root `package.json` oluştur (`@capacitor/core`, `@capacitor/cli`)
- `npx cap init` — uygulama adı **FizyoPark**, bundle ID **erken sabitle** (örn.
  `com.fizyopark.app`) — sonradan değiştirmek mağaza kaydını bozar
- `npm run build:mobile` script: `www/` altına `index.html`, `activity-logs.html`, `app.js`,
  `api.js`, `activity-logs.js`, `styles.css`, `config.js`, `icons/`, `manifest.json`,
  `pwa-register.js`, `sw.js` kopyala (`backend/`, `docs/`, `.cursor/` hariç)
- `@capacitor/splash-screen` + `@capacitor/status-bar` — koyu tema `#0b1020`
- `pwa-register.js`: `Capacitor.isNativePlatform()` kontrolü ile native'de service worker
  atlanmalı (NA-13)
- `npx cap add android` → gerçek cihaz smoke test (önce Android — Mac gerektirmiyor)
- `npx cap add ios` → Mac + Xcode gerektiğinde

---

### Adım 4 — Cihaz testi (CR-40–53)

CR-01–07'nin (inline stil temizliği) gerçekten işe yaradığını gerçek cihazda doğrulama. Bu faz
zaten detaylı checklist olarak hazır, ek planlamaya gerek yok — sırası geldiğinde uygulanır.

---

### Adım 5 — Mağaza (F/G) ve sonrası (H/I)

Roadmap'teki sıra mantıklı: **Google Play önce** (Mac gerektirmiyor, $25 tek seferlik), App
Store paralel/sonra ($99/yıl + Mac). Push bildirimleri (H) mağaza sonrasına bırakılabilir —
ama iOS için **Push capability**'yi Xcode'da erken açmak (NA-38) ileride sorun yaratmaz.

---

## 4. Önerilen 4 haftalık takvim (kabaca)

| Hafta | İş |
|-------|-----|
| 1 | MP-17–22 manuel QA + PERF-04/05 + ölçüm notları + `mobile/` klasörü için karar |
| 2 | Production hosting kurulumu + migration'lar + domain/HTTPS + CORS güncelleme + config.js |
| 3 | Capacitor init + Android build + gerçek Android cihazda smoke test (CR-40, CR-44–53) |
| 4 | iPhone testi (varsa Mac) + Play Console kaydı + iç test sürümü |

App Store / push / operasyon süreçleri 4. haftadan sonra paralel ilerler.

---

## 5. Sizden karar gerektiren açık konular

Aşağıdakiler kod/plan işi değil, sizin vereceğiniz kararlar — bunlar netleşmeden Adım 2'ye
başlanamaz:

1. **Hosting seçimi** (NA-01) — Railway / Render / kendi VPS'iniz mi? (Railway/Render daha az
   bakım, VPS daha ucuz ama sizin yönetmeniz gerekir)
2. **Domain** — Mevcut bir domain var mı, yoksa yeni alınacak mı?
3. **Bundle ID** (`com.???.???`) — mağaza kaydında değiştirilemez, erken karar gerekiyor
4. **Apple Developer hesabı** ($99/yıl) — iOS için ne zaman açılacak? (Android'le paralel mi,
   sonra mı?)
5. **`mobile/` (Expo) klasörü** — sildirelim mi, yoksa sadece "kullanılmıyor" notu mu koyalım?

---

## Özet — şimdi ne yapıyoruz?

**Bu hafta başlanabilecek, kodla ilgili, karar gerektirmeyen 2 iş:**
1. MP-17–22 manuel QA (test + işaretleme)
2. PERF-04 + PERF-05 (debounce + sync optimizasyonu) — küçük, izole `app.js` değişiklikleri

Bunlardan birine şimdi başlamak ister misiniz, yoksa önce § 5'teki kararları mı netleştirelim?
