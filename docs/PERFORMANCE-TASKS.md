# Performans (Hızlandırma) Görev Listesi

Bu dosya, Seans Planlayıcı uygulamasının **çalışma hızını** (açılış, takvim, üye portalı) artırmak için adım adım görev listesidir.  
Görevler **kolay → orta → ileri** sırasıyla numaralandırılmıştır; tek tek uygulanacaktır.

**Mevcut ölçek (referans):** ~1 personel, ~2 üye, ~40–50 seans — veri hacmi küçük; öncelik **gereksiz istekler**, **çift render** ve **gereksiz DOM yeniden kurma**.

**İlgili dosyalar:** `app.js`, `api.js`, `backend/server.js`, `backend/routes/sessions.js`, `backend/routes/member-portal.js`, `backend/routes/members.js`  
**Paket/seans kuralları değişmez:** `docs/MEMBER-PACKAGE-LOGIC.md` — performans işleri yalnızca yükleme/render katmanını etkiler.

---

## Faz 0 — Teşhis (ilk adım)

- [x] **PERF-01** — Açılış yavaşlığını ölç ve kaydet (Chrome DevTools → Network + Performance)
  - Admin giriş: toplam istek sayısı, en yavaş istek, `DOMContentLoaded` → ilk `render` süresi
  - Üye giriş: aynı metrikler
  - Takvim prev/next: bir tıklamada `render()` süresi (Performance tab, `render` / `renderGrid` filtre)
  - Sonuçları bu dosyanın altındaki **Ölçüm notları** bölümüne tarih + cihaz ile yaz

### PERF-01 araçları (kuruldu)

| Araç | Kullanım |
|------|----------|
| `node backend/scripts/perf-baseline.js` | API + statik dosya ölçümü → `docs/perf-baseline-latest.json` |
| `PERF_ADMIN_EMAIL` / `PERF_ADMIN_PASSWORD` | Script admin girişi (varsayılan `admin@local` / `admin123` — ortamınızdaki şifre farklıysa env verin) |
| Tarayıcı konsolu: `perfBaseline()` | `app.js` sonuna eklenen helper — boot süresi, son 10 `render()` süresi |
| Chrome DevTools → Network | Disable cache + Hard reload → istek sayısı / waterfall |
| Chrome DevTools → Performance | Record → giriş → prev/next → Stop → `render` filtre |

**Tarayıcı adımları (siz tamamlayın):**
1. Gizli pencere aç → `http://localhost:5173`
2. Network: *Disable cache* işaretli
3. Admin giriş → Network’te toplam istek sayısını not et
4. Konsol: `perfBaseline()` → `sinceBootMs`, `avgRenderMs` kaydet
5. Takvimde **prev** bir kez → tekrar `perfBaseline()` → `lastRenderMs`
6. Çıkış → üye giriş → adım 4–5 tekrarla
7. Sonuçları **Ölçüm notları** tablosuna yazın

---

## Faz 1 — Hızlı kazanımlar (küçük veri, düşük risk)

Bu fazdaki maddeler mevcut ölçeğinizde **en yüksek emek/fayda** oranına sahiptir.

- [x] **PERF-02** — `render()`: üye için erken çıkış (`app.js`)
  - `isMemberUser()` kontrolünü fonksiyonun **en başına** al
  - Üye girişinde `updateStaffSummary`, `refreshPlannerFilterSelects`, `renderGrid` vb. admin işleri çalışmasın
  - **Test:** Üye giriş → Ana sayfa / Paketlerim / Profil geçişleri; seans iptal akışı bozulmamalı

- [x] **PERF-03** — Üye portal: gereksiz `/sessions` isteğini kaldır (`api.js` → `loadMemberPortalState`)
  - `GET /member-portal/dashboard` zaten paket seanslarını döndürüyor
  - İkinci `apiFetch('/sessions?startDate=2000-01-01&endDate=2030-12-31')` kaldırılacak veya dashboard verisinden türetilecek
  - Takvim/liste için gerekli `state.sessions` dashboard + aktif paket seanslarından oluşturulsun
  - **Test:** Üye giriş → yaklaşan/geçmiş seans listesi, takvim listesi, iptal — admin ile aynı DTO düzeni (`MEMBER-PACKAGE-LOGIC.md`)

- [x] **PERF-04** — Takvim filtre input’una debounce (`app.js` → `bindEvents`, `plannerFilterInput`)
  - 200 ms debounce; yazarken her tuşta `render()` tetiklenmesin
  - `plannerFilterInput` ve `topbarMobileFilterInput` için ortak `applyPlannerFilterDebounced()` /
    `applyPlannerFilterNow()` helper'ları eklendi; `input` → debounce, `Escape` → anında
  - **Test:** Filtre kutusuna yaz → takvim gecikmeli ama akıcı güncellenmeli; temizleme anında çalışmalı

- [x] **PERF-05** — `syncSessionsFromServer`: değişiklik yoksa `saveState` / `render` atlama (`app.js`)
  - Mevcut `changed` bayrağı var; `changed === false` iken `saveState()` çağrılmasın
  - Kod incelemesi: `render()` zaten yalnızca `changed === true` iken çağrılıyor (satır ~4392);
    `saveState()` / `loadState()` fonksiyonları bu kod tabanında artık mevcut değil (önceki bir
    refactor ile kaldırılmış) — bu maddenin hedefi pratikte zaten karşılanıyor, ek değişiklik
    gerekmedi
  - **Test:** 60 sn bekle (auto-sync); konsol/network’te gereksiz yazım ve render olmamalı; başka sekmede seans değiştir → sync sonrası takvim güncellenmeli

- [x] **PERF-06** — Açılışta çift render’ı azalt (`app.js` → `showCachedAppShell`, `DOMContentLoaded`)
  - Önbellekli shell: `init()` içindeki tam `render()` API verisi gelene kadar ertelensin **veya** yalnızca sidebar/topbar iskeleti çizilsin
  - API `applyStateFromApi` / `applyMemberPortalState` sonrası **tek** tam `render()`
  - **Test:** Hard refresh (F5) → admin/üye; flash/çift titreme azalmalı; giriş sonrası veri doğru

- [x] **PERF-07** — Modül yüklenirken gereksiz `loadState()` tekrarını kaldır (`app.js`)
  - `let state = loadState()` (modül seviyesi) + `showCachedAppShell` içindeki ikinci `loadState()` birleştirilsin
  - Boot path’te `JSON.parse` yalnızca bir kez
  - **Test:** localStorage dolu iken açılış; state bozulmamalı

---

## Faz 2 — Render ve DOM (orta emek)

- [ ] **PERF-08** — `render()` fonksiyonunu hedefli alt-render’lara ayır (`app.js`)
  - `renderPlanner()` — takvim (header + grid/list/month)
  - `renderMemberPortal()` — üye sekmeleri
  - `renderAdminSummaries()` — sidebar özetleri (rooms, staff, packages)
  - Mevcut `render()` ince bir yönlendirici olsun; tarih nav yalnızca `renderPlanner()` çağırsın
  - **Test:** prev/next, view mode, filtre — yalnızca takvim alanı güncellenmeli (sidebar özetleri gereksiz yere tetiklenmemeli)

- [ ] **PERF-09** — Lookup map’leri: `membersById`, `staffById`, `roomsById` (`app.js`)
  - `renderEvents` / liste kartlarında `Array.find` yerine render öncesi bir kez `Map` oluştur
  - **Test:** Haftalık takvimde seans kartları doğru isim/oda/personel göstermeli

- [ ] **PERF-10** — Takvim grid: event delegation (`app.js` → `renderGrid`, `renderEvents`)
  - Hücre `click` listener’ları her `renderGrid()`’de yeniden bağlanmasın; `#plannerGrid` üzerinde tek delegated handler
  - Seans kartları için benzer pattern (data-session-id)
  - **Test:** Boş hücreye tık → seans modal; mevcut seansa tık → düzenle; mobil liste görünümü

- [ ] **PERF-11** — `openListMembersModal` / kalan seans: ön-indeks (`app.js`)
  - Her modal açılışında `state.sessions.filter` × üye sayısı yerine `sessionsByMemberPackageId` map
  - **Test:** “Üyeleri listele” modalı açılış hızı; kalan seans sayıları doğru

- [ ] **PERF-12** — Sidebar CSS `:has()` hover genişlemeyi sadeleştir (`styles.css` + `app.js`)
  - `.content:has(.sidebar-shell:hover)` yerine JS class toggle (`.content--sidebar-expanded`)
  - Mobilde zaten drawer; masaüstünde layout recalc azalsın
  - **Test:** Sidebar hover/transition; takvim kartları kayması (`repositionOverlappingEvents`) bozulmamalı

---

## Faz 3 — Backend ve ağ (orta emek)

Küçük veride tek başına büyük fark yaratmaz; açılış hissi ve ileride ölçek için değerli.

- [x] **PERF-13** — HTTP gzip sıkıştırma (`backend/server.js`)
  - `compression` middleware eklendi
  - **Test:** Network’te `Content-Encoding: gzip`; JSON yanıt boyutu düşmeli

- [x] **PERF-14** — Tek bootstrap endpoint: `GET /api/bootstrap` (yeni route + `api.js`)
  - Admin: members, staff, rooms, packages, member-packages, working-hours, sessions — **tek istek**
  - `loadFullState()` bootstrap kullanır; hata durumunda 7 istek fallback
  - **Test:** Admin açılış; Network’te `/bootstrap?startDate=…`; tüm sidebar + takvim verisi eksiksiz

- [ ] **PERF-15** — Üye bootstrap: `GET /api/member-portal/bootstrap` (veya genişletilmiş dashboard)
  - dashboard + staff + rooms + working-hours tek istek
  - `loadMemberPortalState()` sadeleşsin
  - **Test:** Üye açılış; PERF-03 ile birlikte en fazla 1–2 istek

- [ ] **PERF-16** — `GET /members` liste DTO’su incelt (`backend/routes/members.js`)
  - Liste: `id`, `name`, `member_no`, `phone`, `email` (klinik TEXT alanları yok)
  - Detay: mevcut `GET /members/:id` veya kart modal alanları
  - **Test:** Üye kartı modal, paket formu üye seçimi, export — eksik alan olmamalı

- [ ] **PERF-17** — `GET /sessions` SELECT incelt (`backend/routes/sessions.js`)
  - `s.*` + JOIN isimleri yerine frontend’in kullandığı kolonlar
  - **Test:** Takvim, seans modal, export — alan kaybı yok

- [ ] **PERF-18** — Üye dashboard geçmiş paket N+1 kaldır (`backend/routes/member-portal.js`)
  - Geçmiş paket seansları tek sorguda veya batch
  - **Test:** Geçmiş paket modal; seans listesi admin ile uyumlu format

---

## Faz 4 — Depolama ve PWA (isteğe bağlı, orta)

- [ ] **PERF-19** — `saveState()` debounce (`app.js`)
  - 500 ms batch veya `requestIdleCallback`; ardışık CRUD’da tek yazım
  - **Test:** Seans ekle/sil; sayfa yenile → veri korunmalı

- [ ] **PERF-20** — Seans verisini localStorage’dan ayır (`app.js`)
  - `STORAGE_SESSIONS_KEY` veya IndexedDB; admin state ile seans cache ayrı
  - Üye rolünde admin verisi cache’lenmesin
  - **Test:** Üye/admin giriş geçişi; localStorage boyutu

- [ ] **PERF-21** — Service worker: gereksiz her-ziyaret revalidate azalt (`sw.js`)
  - `app.js` / `styles.css` için version hash veya network-first (geliştirme kolaylığı korunsun)
  - **Test:** Lighthouse / offline shell; güncelleme sonrası yeni sürüm gelmeli

- [ ] **PERF-22** — Production JS minify (build script veya `terser`)
  - ~335 KB `app.js` parse süresini düşürür (özellikle mobil)
  - Capacitor `www/` sync ile uyumlu script
  - **Test:** İlk yükleme süresi; fonksiyonellik aynı

---

## Faz 5 — Veri büyüyünce (şimdilik ertelenebilir)

Mevcut ~50 seans ölçeğinde **şart değil**; üye/seans sayısı yüzlerce binlere çıkınca devreye alın.

- [x] **PERF-23** — Sessions API: görünür tarih aralığı (`api.js` + `app.js`)
  - Açılış: görünür takvim ± 14 gün buffer (`getPlannerFetchRange`)
  - Prev/next/ay geçişi: `ensurePlannerSessionsLoaded` ile merge
  - `syncSessionsFromServer`: yalnızca yüklü aralık
  - Üyeleri listele modalı: aktif paket tarih aralığı lazy load
  - **Test:** Admin açılış Network’te `/sessions?startDate=…&endDate=…` (~30 gün); takvim navigasyonu; seans CRUD; paket kaydı
- [ ] **PERF-24** — Incremental session sync (`updatedSince` veya etag)
- [ ] **PERF-25** — Veritabanı kısmi indeksler (`sessions(start_ts) WHERE deleted_at IS NULL`)
- [ ] **PERF-26** — `check-availability` batch sorgu (`member-packages.js`)
- [ ] **PERF-27** — Modal lazy inject (`index.html` → ilk açılışta DOM’a ekle)

---

## Faz 6 — Regresyon testi (her faz sonrası)

Her faz tamamlandığında minimum kontrol listesi:

- [ ] **PERF-28** — Admin: giriş → haftalık/günlük/aylık takvim → seans ekle/düzenle/sil
- [ ] **PERF-29** — Admin: üye kartı → paket ata/güncelle → seans tablosu export
- [ ] **PERF-30** — Üye: giriş → yaklaşan seans → iptal (esnek kural) → liste güncellenmeli
- [ ] **PERF-31** — Mobil (≤767px): gün listesi, sidebar drawer, filtre paneli
- [ ] **PERF-32** — PERF-01 metriklerini tekrar ölç; iyileşmeyi **Ölçüm notları**na yaz

---

## Önerilen uygulama sırası

```
PERF-01 (ölç)
  → PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07  (Faz 1 — önce bunlar)
  → PERF-28 … PERF-32 (kısa test)
  → PERF-08 … PERF-12 (Faz 2)
  → PERF-13 … PERF-18 (Faz 3 — ihtiyaç halinde)
  → PERF-19 … PERF-22 (Faz 4 — isteğe bağlı)
  → PERF-23 … PERF-27 (veri büyüyünce)
```

**Bir sonraki adım:** **PERF-04** (filtre debounce) veya **PERF-16** (members DTO incelt).

---

## İlerleme özeti

| Faz | Görev | Tamamlanan |
|-----|-------|------------|
| 0 — Teşhis | 1 | 1 |
| 1 — Hızlı kazanımlar | 6 | 6 |
| 2 — Render / DOM | 5 | 0 |
| 3 — Backend / ağ | 6 | 2 |
| 4 — Depolama / PWA | 4 | 0 |
| 5 — Ölçek (ertelenmiş) | 5 | 1 |
| 6 — Test | 5 | 0 |
| **Toplam** | **32** | **10** |

---

## PERF-01 baseline özeti (2026-06-09)

Otomatik ölçüm (`node backend/scripts/perf-baseline.js`, Windows dev, localhost):

### Statik yükleme (disk)

| Dosya | Boyut |
|-------|-------|
| `app.js` | **328 KB** (en ağır — parse maliyeti) |
| `index.html` | 87.5 KB |
| `styles.css` | 69.1 KB |
| `api.js` | 23 KB |
| **Toplam (ilk yükleme)** | **~508 KB** HTML+JS+CSS |

### Kod analizi — açılış istek sayısı

| Rol | Paralel API isteği | Not |
|-----|-------------------|-----|
| Admin | **2** (`/auth/me` + `GET /bootstrap`) | PERF-14 tek istek; gzip (PERF-13) |
| Üye | **4** (`loadMemberPortalState`) | Dashboard seanslarından türetilir (PERF-03) |

### Olası darboğazlar (mevcut veri hacminde)

1. **328 KB `app.js` parse** — özellikle mobil / ilk açılış
2. **8 paralel HTTP isteği** — veri küçük olsa bile bağlantı gecikmesi
3. **Çift `render()`** — önbellekli shell + API sonrası (PERF-06 hedefi)
4. **Üye: çift seans isteği** — ~~PERF-03 hedefi~~ ✓ (2026-06-09)

### API script notu

Script varsayılan `admin123` ile giriş yapamadı (ortamda şifre değişmiş). API sürelerini almak için:

```powershell
$env:PERF_ADMIN_PASSWORD="sizin_sifreniz"
node backend/scripts/perf-baseline.js
```

Detaylı JSON: `docs/perf-baseline-latest.json`

---

## Ölçüm notları

| Tarih | Cihaz | Rol | Açılış (ms) | İstek sayısı | render avg (ms) | Not |
|-------|-------|-----|-------------|--------------|-----------------|-----|
| 2026-06-09 | Windows / Chrome (script) | admin | — | 8 (kod) | — | Statik ~508 KB; API script şifre bekliyor |
| | | admin | | | | `perfBaseline()` — siz doldurun |
| | | üye | | | | `perfBaseline()` — siz doldurun |

---

## Notlar

- Görev tamamlandıkça `[ ]` → `[x]` işaretleyin; **İlerleme özeti** tablosunu güncelleyin.
- Paket/seans iş kuralı değişikliği gerektiren maddelerde `docs/MEMBER-PACKAGE-LOGIC.md` ile çelişmeyin.
- Faz 5 maddeleri mevcut küçük veri setinde **ertelenebilir**; Faz 1 bitmeden Faz 5’e geçmeyin.
