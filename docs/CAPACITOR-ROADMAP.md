# Capacitor Mağaza Yol Haritası — Adım Adım Görev Listesi

Bu dosya, **Capacitor ile devam** kararı sonrası yapılacakların **tek sıralı checklist**’idir.

**Karar özeti**
- **Üye + personel:** Google Play / App Store uygulaması (Capacitor WebView, mevcut web UI)
- **Admin:** PC tarayıcı birincil; aynı uygulamadan acil müdahale (isteğe bağlı)
- **Expo (`mobile/`):** Mağaza yolunda kullanılmayacak; Capacitor bitene kadar dokunulmaz / arşivlenir
- **Backend:** HTTPS + PostgreSQL bulutta; uygulama internet gerektirir

**İlgili dokümanlar**
| Doküman | Ne için |
|---------|---------|
| Bu dosya (`CR-xx`) | Sıra ve öncelik — **buradan takip edin** |
| `docs/NATIVE-APP-STORE-TASKS.md` (`NA-xx`) | Capacitor kurulum, mağaza, push detayı |
| `docs/MOBILE-FIRST-TASKS.md` (`MF-xx`) | Arayüz mobile-first tamamlama |
| `docs/MOBILE-FIRST-TEST-CHECKLIST.md` | Tarayıcı mobil test |
| `docs/MEMBER-PACKAGE-LOGIC.md` (`MP-xx`) | Paket / iptal iş kuralları |
| `docs/PERFORMANCE-TASKS.md` | Yavaş cihaz optimizasyonu |

---

## Önerilen sıra (kuş bakışı)

```text
A — Inline stil + üye/personel UI sertleştirme
        ↓
B — Production API hazır
        ↓
C — Capacitor projesi + gerçek cihazda smoke test
        ↓
D — Inline / modal / safe-area cihaz testi (Android + iOS)
        ↓
E — Google Play iç test → üretim
        ↓
F — App Store TestFlight → review
        ↓
G — Push bildirimleri (mağaza sonrası veya paralel)
        ↓
H — Operasyon (sürümleme, destek)
```

---

## A — Inline stil temizliği ve riskli layout (Capacitor öncesi)

Capacitor = gömülü tarayıcı. **Genişlik, yükseklik, max-height, flex** inline yazılırsa CSS media query’leri ezilir (seans modalı bug’ı gibi).

### A.1 Envanter

- [x] **CR-01** — `index.html` + `app.js` + `activity-logs.*` içinde `style="` taraması (2026-06-12)
- [x] **CR-02** — Kırmızı liste tablosu → **Ek A** (aşağıda)

**Özet sayım**

| Dosya | `style="` adet | Kırmızı | Sarı | Yeşil |
|-------|----------------|---------|------|-------|
| `index.html` | 15 | 0 | 12 | 3 |
| `app.js` | 6 (+ dinamik) | 0 | 4 | 6 |
| `activity-logs.html` | 0 | 0 | 0 | 0 |
| `activity-logs.js` | 0 | 0 | 0 | 0 |
| **Toplam** | **21** | **0** | **16** | **9** |

*Kırmızı = Capacitor’da layout/modal bozabilir. Sarı = margin/padding/font (düşük risk). Yeşil = dinamik/kaçınılmaz veya admin-only export.*

### A.2 Üye + personel (mağaza uygulaması — öncelik 1)

- [x] **CR-03** — `#memberPortalSessionsModal` inline stiller → CSS sınıfları (`modal__card--member-sheet`)
- [x] **CR-04** — `#packageSessionsModal` inline → CSS
- [x] **CR-05** — Üye yolu `index.html`: `#memberPackageRequestModal`, `#memberProfileModal` — layout inline kaldır (Ek A § P1)
- [x] **CR-06** — `#memberSessionCancelModal` HTML temiz; stack/z-index `styles.css` (`#memberSessionCancelModal`, `#memberPortalSessionsModal`)
- [x] **CR-07** — Üye takvim kartları (`renderMemberSessionBoxHtml`, `renderSessionsListCards`) layout inline yok; admin planner grid ayrı (Ek A yeşil)

### A.3 Admin mobil (telefondan admin — öncelik 2)

- [x] **CR-08** — Admin hub modalı (`width:min(960px…)`, `max-height:90vh`) → CSS + mobil tam ekran
- [x] **CR-09** — Giriş listesi, paket formları — kritik modallarda inline layout temizliği
- [x] **CR-10** — `app.js` PDF/Excel tablo `innerHTML` inline — export admin-only; Capacitor CSP testine bağla (NA-14)

### A.4 Doğrulama kuralı (yeni kod)

- [x] **CR-11** — `.cursor/rules/mobile-first-design.mdc` — üye/personel modal ve layout’ta inline stil yasağı (dinamik grid hariç); admin ana panel kalıbı

---

## B — Mobile-first ve iş kuralı kapanışı

Mağazaya çıkmadan önce tarayıcıda mobil test bitmiş olmalı.

- [ ] **CR-12** — `docs/MOBILE-FIRST-TASKS.md` kalan `[ ]` maddeleri gözden geçir; üye/personel için bloklayıcı var mı?
- [ ] **CR-13** — `docs/MEMBER-PACKAGE-LOGIC.md` F grubu (MP-17 … MP-22) manuel QA — iptal, telafi, sabit/esnek
- [x] **CR-14** — `docs/MOBILE-FIRST-TEST-CHECKLIST.md` — üye + personel senaryoları (CR-14-A otomatik ✓, CR-14-B/C tarayıcı checklist); `node scripts/cr14-mobile-verify.mjs`
- [ ] **CR-15** — Düşük segment Android’de takvim açılış süresi (`docs/PERFORMANCE-TASKS.md` — kritik 3 madde)

---

## C — Production API (NA Faz 1–2 ile birlikte)

Detay: `NA-01` … `NA-15`

- [ ] **CR-20** — Production sunucu + PostgreSQL + tüm migration’lar
- [ ] **CR-21** — HTTPS domain sabit; `GET /health` → 200
- [ ] **CR-22** — Gizlilik politikası URL (KVKK) — mağaza zorunlu
- [ ] **CR-23** — `www/config.js` (veya build script): `window.__API_BASE__` production URL
- [ ] **CR-24** — Backend CORS: production web + `capacitor://localhost` + `https://localhost`
- [ ] **CR-25** — Tarayıcıdan production URL ile tam akış: giriş → takvim → paket → iptal (Capacitor öncesi)

---

## D — Capacitor kurulum (NA Faz 3)

Detay: `NA-16` … `NA-24`

- [ ] **CR-30** — Kök `package.json` veya `capacitor/` — `@capacitor/core`, `@capacitor/cli`
- [ ] **CR-31** — `npx cap init` — uygulama adı **FizyoPark** / **Seans Planlayıcı**, bundle ID **erken sabitle** (ör. `com.fizyopark.app`)
- [ ] **CR-32** — `npm run build:mobile`: `www/` sync (`index.html`, `app.js`, `api.js`, `styles.css`, `config.js`, `icons/` — `backend/` hariç)
- [ ] **CR-33** — `capacitor.config`: `webDir: www`, `androidScheme: https`, tema `#0b1020`
- [ ] **CR-34** — `@capacitor/splash-screen`, `@capacitor/status-bar` — koyu tema
- [ ] **CR-35** — `npx cap add android` → gerçek telefonda açılış
- [ ] **CR-36** — `npx cap add ios` → gerçek iPhone (Mac + Xcode)
- [ ] **CR-37** — Native’de `pwa-register.js` / service worker atla (`Capacitor.isNativePlatform()`)
- [ ] **CR-38** — **`mobile/` Expo klasörü:** README’de “mağaza yolu Capacitor; Expo kullanılmıyor” notu

---

## E — Capacitor cihaz testi (inline + safe-area)

Bu faz, **CR-01–07** düzeltmelerinin gerçekten işe yaradığını doğrular.

### Test ortamı

- [ ] **CR-40** — En az 1 Android telefon ( küçük ekran, örn. 360px )
- [ ] **CR-41** — En az 1 Android tablet (isteğe bağlı ama önerilir)
- [ ] **CR-42** — En az 1 iPhone (çentikli) + iOS sürüm notu
- [ ] **CR-43** — Debug build production API’ye bağlı (localhost yok)

### Üye checklist (her cihazda)

- [ ] **CR-44** — Giriş → ana sayfa → alt bar paket bilgisi → seans listesi modalı **tam ekran**, Kaydırma OK
- [ ] **CR-45** — Seans listesinde iptal edilmiş slot **görünmüyor**; sıra numarası paket hakkı ile uyumlu
- [ ] **CR-46** — «Seansı İptal Et» → «Randevuyu İptal Et» modalı **üstte**; Vazgeç → seans listesine dönüş
- [ ] **CR-47** — «Kapat» yalnızca seans listesini kapatır; iptal modalı açılmaz
- [ ] **CR-48** — QR giriş modalı — safe-area, geri tuşu (Android)
- [ ] **CR-49** — Klavye açıkken (şifre değiştir) footer/modal kesilmiyor

### Personel checklist

- [ ] **CR-50** — Personel giriş → günlük liste → üye satırında ✓/✕ dokunma hedefi ≥ 44px
- [ ] **CR-51** — Onay sonrası liste yenileniyor

### Admin (telefon — ikincil)

- [ ] **CR-52** — Admin giriş → seans ekle → kaydet (kritik akış)
- [ ] **CR-53** — Giriş listesi modalı tam ekran / kaydırma

### Regresyon tablosu (inline stil)

| Ekran | Android telefon | iPhone | Tablet | Not |
|-------|-----------------|--------|--------|-----|
| Üye seans modalı | [ ] | [ ] | [ ] | 100dvh, sticky footer |
| Üye iptal modalı | [ ] | [ ] | [ ] | z-index stack |
| Personel takvim liste | [ ] | [ ] | [ ] | |
| Admin hub (mobil) | [ ] | [ ] | [ ] | |

---

## F — Google Play (NA Faz 4)

Detay: `NA-25` … `NA-35`

- [ ] **CR-60** — Upload keystore oluştur + güvenli yedekle
- [ ] **CR-61** — Release AAB imzalı build
- [ ] **CR-62** — Play Console: liste, ekran görüntüsü, gizlilik URL, veri güvenliği formu
- [ ] **CR-63** — İç test → kapalı test → üretim (aşamalı)
- [ ] **CR-64** — Mağaza açıklaması: internet gerekir; hesap stüdyo tarafından verilir

---

## G — App Store (NA Faz 5)

Detay: `NA-36` … `NA-47`

- [ ] **CR-70** — Apple Developer hesabı + Mac/Xcode
- [ ] **CR-71** — Archive → App Store Connect
- [ ] **CR-72** — Ekran görüntüleri (6.7" / 6.5" iPhone)
- [ ] **CR-73** — App Privacy + hesap silme akışı açıklaması
- [ ] **CR-74** — TestFlight → App Review (Guideline 4.2: tam iş akışı, salt web sarmalayıcı değil)

---

## H — Push bildirimleri (mağaza sonrası önerilir)

Detay: `NA-48` … `NA-69`. iOS için push capability erken açılabilir (`NA-38`).

- [ ] **CR-80** — Firebase + FCM + APNs
- [ ] **CR-81** — `@capacitor/push-notifications` + token kayıt API
- [ ] **CR-82** — İlk tetikleyiciler: seans hatırlatma, üye iptal → personel, paket azaldı

---

## I — Operasyon ve sürümleme

Detay: `NA-70` … `NA-76`

- [ ] **CR-90** — Sürüm politikası yazılı: UI değişikliği → yeni APK/IPA + mağaza; API → sadece backend deploy
- [ ] **CR-91** — Her release: `npm run build:mobile` → `cap sync` → platform build → mağaza
- [ ] **CR-92** — Minimum desteklenen uygulama sürümü (isteğe bağlı API kontrolü)
- [ ] **CR-93** — Play Console + Xcode crash izleme
- [ ] **CR-94** — Destek e-postası / WhatsApp mağaza listesinde

---

## Bilinçli olarak yapılmayacaklar (scope dışı)

- Expo ile ikinci bir native UI yazmak
- Offline-first / internetsiz seans planlama
- Admin için ayrı mağaza paketi (tek uygulama, rol bazlı UI yeterli)
- Her CSS değişikliğinde OTA (Capgo) — ilk sürümde mağaza güncellemesi yeterli

---

## İlerleme özeti

| Faz | Kod | Görev | Tamamlanan |
|-----|-----|-------|------------|
| A — Inline stil | CR-01–11 | 11 | 11 |
| B — Mobile / MP QA | CR-12–15 | 4 | 1 |
| C — Production API | CR-20–25 | 6 | 0 |
| D — Capacitor kurulum | CR-30–38 | 9 | 0 |
| E — Cihaz testi | CR-40–53 | 14 | 0 |
| F — Google Play | CR-60–64 | 5 | 0 |
| G — App Store | CR-70–74 | 5 | 0 |
| H — Push | CR-80–82 | 3 | 0 |
| I — Operasyon | CR-90–94 | 5 | 0 |
| **Toplam** | | **62** | **11** |

---

## Hemen şimdi (ilk 2 hafta önerisi)

1. ~~**CR-01** — Inline stil envanteri~~ ✓ Ek A
2. ~~**CR-05**~~ ✓ — P1 üye modalları; ~~**CR-08**~~ ✓ — admin hub
3. ~~**CR-09**~~ ✓ — Diğer admin modalları (R08–R20); ~~**CR-10**~~ ✓ — loglar + admin tablolar
4. ~~**CR-11**~~ ✓ — Cursor kuralı (inline stil yasağı + admin-main-panel)
5. ~~**CR-14**~~ ✓ — Mobil test checklist + otomatik doğrulama scripti
6. **CR-12–13, CR-15** — MP manuel QA + performans
7. **CR-20–25** — Production API (Capacitor anlamlı test için şart)
8. **CR-30–37** — İlk Capacitor build + Android gerçek cihaz
9. **CR-44–47** — Üye seans/iptal modal regresyonu (cihazda doğrulama)

Tamamlandıkça `[ ]` → `[x]` işaretleyin ve **İlerleme özeti** tablosunu güncelleyin.

---

## Ek A — CR-01 inline stil envanteri (2026-06-12)

Tarama: `style="` sabit HTML/JS stringleri. `element.style.*` atamaları ayrı not (Ek B).

### Kırmızı liste — öncelik P1 (üye / personel, mağaza uygulaması)

| # | Dosya | Satır | Öğe / modal | Inline (özet) | Önerilen CSS sınıfı | CR |
|---|-------|-------|-------------|---------------|---------------------|-----|
| R01 | `index.html` | — | `#memberPackageRequestModal` | *(temizlendi)* | `.modal__card--member-request` + `.modal--compact` | CR-05 ✓ |
| R02 | `index.html` | — | `#memberProfileModal` | *(temizlendi)* | `.modal__card--member-sheet` + flex mobil | CR-05 ✓ |
| R03 | `index.html` | — | `#memberQrModal` | *(inline yok — `.member-qr-modal__card`)* | — | ✓ |
| R04 | `index.html` | — | `#memberPortalSessionsModal` | *(temizlendi)* | `.modal__card--member-sheet` | CR-03 ✓ |
| R05 | `index.html` | — | `#memberSessionCancelModal` | *(inline yok — `.member-cancel-modal__card`)* | `.modal--compact` | CR-06 ✓ |

**P1 tamamlandı** — tüm üye modalları inline layout temiz.

---

### Kırmızı liste — öncelik P2 (admin mobil / ortak modal)

| # | Dosya | Satır | Öğe / modal | Inline (özet) | Önerilen CSS sınıfı | CR |
|---|-------|-------|-------------|---------------|---------------------|-----|
| R06 | `index.html` | — | `#adminHubModal` | *(temizlendi)* | `.modal__card--admin-hub` + mobil sheet | CR-08 ✓ |
| R07 | `index.html` | — | Admin hub paket paneli | *(temizlendi)* | `.admin-hub-packages-layout` | CR-08 ✓ |
| R08 | `index.html` | — | `#memberPackageModal` | *(temizlendi)* | `.member-package-modal` | CR-09 ✓ |
| R09 | `index.html` | — | `#staffHoursModal` | *(temizlendi)* | `.staff-hours-modal` | CR-09 ✓ |
| R10 | `index.html` | — | `#entryListModal` | *(inline yok — `.entry-list-modal__card`)* | mevcut CSS | ✓ |
| R11 | `index.html` | — | `#packageSessionsModal` | *(temizlendi)* | `.modal__card--member-sheet` | CR-04 ✓ |
| R12 | `index.html` | — | `#memberCardModal` | *(temizlendi)* | `.member-card-modal` | CR-09 ✓ |
| R13 | `index.html` | — | `#deleteMemberModal` | *(temizlendi)* | `.delete-member-modal` | CR-09 ✓ |
| R14 | `index.html` | — | `#packageInconsistencyModal` | *(temizlendi)* | `.modal__card--compact-480` | CR-09 ✓ |
| R15 | `index.html` | — | `#staffAddModal` | *(temizlendi)* | `.staff-modal__card` | CR-09 ✓ |
| R16 | `index.html` | — | `#staffEditModal` | *(temizlendi)* | `.staff-edit-modal__card` | CR-09 ✓ |
| R17 | `index.html` | — | `#groupSessionModal` | *(zaten `.group-session-modal`; genişlik CSS)* | `.group-session-modal` | CR-09 ✓ |
| R18 | `index.html` | — | `#listMembersModal` | *(temizlendi)* | `.list-members-modal` | CR-09 ✓ |
| R19 | `index.html` | — | `#expiredMembershipsModal` | *(temizlendi)* | `.expired-memberships-modal` | CR-09 ✓ |
| R20 | `index.html` | — | `#formerMembersModal` | *(temizlendi)* | `.former-members-modal` | CR-09 ✓ |
| R21 | `activity-logs.html` | — | `.activity-logs-table` | *(temizlendi)* | `.activity-logs-table-wrap` + sayfa CSS | CR-10 ✓ |

---

### Kırmızı liste — öncelik P3 (`app.js` dinamik / admin-only)

| # | Dosya | Satır | Bağlam | Inline (özet) | Not | CR |
|---|-------|-------|--------|---------------|-----|-----|
| R22 | `app.js` | — | Admin takvim slot kartı | *(CSS variable — yeşil)* | `--staff-card-border/bg` | CR-10 ✓ |
| R23 | `app.js` | 2742 | Admin planner liste | `grid-template-columns:repeat(N,…)` | Sütun sayısı runtime — **yeşil sayılabilir** | — |
| R24 | `app.js` | — | Oda listesi render | *(temizlendi)* | `.rooms-list` | CR-08 ✓ |
| R25 | `app.js` | — | Çalışma saatleri (admin hub) | *(temizlendi)* | `.staff-hours-list` genişletildi | CR-08 ✓ |
| R26 | `app.js` | — | Görev dağıtımı tablosu + boş durumlar | *(temizlendi)* | `.task-distribution-table`, `.admin-panel-empty` | CR-10 ✓ |
| R27 | `app.js` | — | Üye listesi tablo başlıkları | *(temizlendi)* | `.list-members-table th` | CR-09 ✓ |
| R28 | `app.js` | — | Çalışma saatleri panel (`prepareWorkingHoursPanel`) | *(temizlendi)* | `.staff-hours-list` | CR-09 ✓ |

*Personel takvim liste kartları (`renderStaffPlannerListCardHtml`) ve üye seans kutuları inline layout **içermiyor**.*

---

### Sarı liste (düşük risk — toplu temizlik isteğe bağlı)

Margin/padding/font-size/display:none (toggle) — Capacitor’da genelde sorun çıkarmaz.

| Dosya | Adet | Örnek satırlar |
|-------|------|----------------|
| `index.html` | 38 | 515, 746, 749, 840, 849, 851, 853, 882, 908, 912, 925–954, 1194, 1260, 1298, 1414, … |
| `app.js` | 22 | 6650, 6652, 9381, 9425, 9506, 9653, 9805, 9819, 7056–7057, … |
| `activity-logs.html` | 5 | 87–88, 90, 121–122 |
| `activity-logs.js` | 2 | 132, 201 |

---

### Yeşil liste (kaçınılmaz veya kabul edilebilir)

| Dosya | Satır | Neden yeşil |
|-------|-------|-------------|
| `app.js` | 2742 | Grid sütun sayısı admin takvimde runtime hesaplanıyor |
| `app.js` | 2709–2710 | Personel rengine göre dinamik kart rengi (alternatif: CSS var) |
| `app.js` | 3494–3814 | Takvim event `width`/`height` piksel hesabı (grid layout motoru) |
| `app.js` | 6610–6614 | `devResetWarnings` show/hide |
| `app.js` | 7359–7830 | Form satırı / buton `display` toggle (durum bazlı) |
| `index.html` | 853, 919 | Sabit input genişliği admin form (`width:120px`) — sarı sınırında |
| `index.html` | 928, 954 | Dev/test panelleri — mağaza build’inde gizli kalabilir |

---

### Ek B — `element.style.*` atamaları (`app.js`)

Capacitor riski düşük; davranış için gerekli. Dokunulmayacak (yeşil):

| Satır | Kullanım |
|-------|----------|
| 3494, 3646 | Event kart yüksekliği otomatik |
| 3517, 3669, 3814 | Event genişliği piksel |
| 3854 | Ay görünümü hücre yüksekliği |
| 6610–6614 | Dev reset uyarı kutusu |
| 7359–7380, 7512, 7779–7830 | Üye kartı / paket formu görünürlük toggle |
| 9431 | PDF tablo genişliği |

---

### Sonraki adım (CR-12 / CR-20)

1. ~~**CR-01 … CR-14**~~ ✓ — Inline stil + mobil test checklist
2. **CR-12–13** — MF görev gözden geçirme + paket mantığı manuel QA
3. **CR-15** — Düşük segment Android performans
4. **CR-20–25** — Production API
5. Cihaz testi **CR-44–47** ile doğrula

---

*Oluşturulma: Capacitor kararı + inline stil risk analizi + mağaza hedefi (üye/personel app, admin PC+telefon).*
*Ek A güncelleme: CR-01 otomatik tarama.*
