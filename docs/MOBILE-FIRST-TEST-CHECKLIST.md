# Mobile-First Test Checklist — CR-14

Bu dosya **MF-57 … MF-63** kabul kriterlerini ve Capacitor **CR-14** tarayıcı test senaryolarını içerir.

**Ortam:** `node server.js` (5173) + `cd backend && npm run dev` (3000)  
**Otomatik ön kontrol:** `node scripts/cr14-mobile-verify.mjs`  
**İlgili:** `docs/CAPACITOR-ROADMAP.md` (CR-14, CR-44–47), `docs/MOBILE-FIRST-TASKS.md`

---

## CR-14 test koşumu kaydı

| Tarih | Ortam | Chrome 360px | Safari 375px | Otomatik script | Test eden |
|-------|-------|--------------|--------------|-----------------|-----------|
| 2026-06-13 | localhost:5173 | Kod + API ✓ | Mac/iPhone manuel bekliyor | 20/21 geçti | Cursor agent |

**Script özeti (2026-06-13):** Üye modalları layout inline yok, admin-main-panel panelleri tanımlı, dokunma 44px, modal z-index sırası, seed üye API girişi OK. Admin girişi ortamda farklı kimlik bilgisi gerekebilir — tarayıcıda manuel doğrula.

---

## CR-14-A — Otomatik doğrulama (kod + HTTP)

`node scripts/cr14-mobile-verify.mjs` ile işaretleyin:

- [x] Üye modalları (`#memberPortalSessionsModal`, `#memberSessionCancelModal`, …) layout `style="` içermiyor
- [x] Admin geniş listeler `#adminMembersListView` vb. `.admin-main-panel` kullanıyor
- [x] `--touch-min: 44px`, `.staff-attendance-btn` 44×44px
- [x] `.modal__card--member-sheet` → `100dvh`; iptal modalı z-index 1100 > seans listesi 1050
- [x] `index.html` viewport + `theme-color` meta
- [x] Frontend 200, backend `/health` OK
- [x] Seed üye API: `test.uye.001@seed.local` + portal dashboard

---

## CR-14-B — Chrome DevTools mobil (360×800)

**Kurulum:** Chrome → F12 → Device Toolbar → Pixel 5 / 360×800, `http://localhost:5173`

### Üye senaryosu (MF-60 + CR-44–47 ön kontrol)

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 1 | Seed üye ile giriş | Takvim + alt tab bar görünür | [ ] |
| 2 | Alt bar paket satırına dokun | Seans listesi modalı tam genişlik, kaydırma OK | [ ] |
| 3 | İptal edilmiş slot | Listede görünmez; sıra no paket hakkı ile uyumlu | [ ] |
| 4 | «Seansı İptal Et» | «Randevuyu İptal Et» modalı **üstte** açılır | [ ] |
| 5 | **Vazgeç** | Seans listesine döner (iptal modalı kapanır) | [ ] |
| 6 | **Kapat** | Yalnızca seans listesi kapanır; iptal modalı açılmaz | [ ] |
| 7 | **Paketlerim** / **Profil** | Tam genişlik kartlar, butonlar ≥ 44px | [ ] |
| 8 | QR giriş (varsa) | Safe-area, modal taşmıyor | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı

### Personel senaryosu (MF-63)

**Ön koşul:** Giriş hesabı olan personel (telefon son 4 hane şifre).

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 1 | Personel giriş | Günlük liste görünümü, sidebar yok / sade topbar | [ ] |
| 2 | Bugünkü seans kartı | Üye satırında ✓ / ✕ butonları ≥ 44px | [ ] |
| 3 | **Geldi** (✓) dokun | Onay sonrası ✓ işareti; liste yenilenir | [ ] |
| 4 | Geçmiş seans | Buton yerine sabit ✓/✕/— durumu | [ ] |
| 5 | Tarih ← / → | Liste güncellenir, yatay scroll yok | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı

### Admin senaryosu (telefon — MF-61 güncel)

| # | Adım | Beklenen | ✓ |
|---|------|----------|---|
| 1 | Admin giriş | Takvim günlük liste | [ ] |
| 2 | Hamburger → **Takvim** | `#mainContent` takvim; sidebar aktif buton | [ ] |
| 3 | **Üyeleri Listele** | Modal değil; `#adminMembersListView` tam genişlik panel | [ ] |
| 4 | **Paketi Bitmiş** / **Eski Üyeler** | Ana alan paneli, arama + kaydırma | [ ] |
| 5 | **Giriş listesi** | `#adminEntryListView` sticky toolbar, kaydırma OK | [ ] |
| 6 | Sağa kaydır veya Esc (liste açıkken) | Takvime döner | [ ] |
| 7 | Seans ekle → Kaydet | Modal form tek sütun, footer sticky | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı

---

## CR-14-C — Safari iOS (375×812)

**Kurulum:** Safari Responsive Design Mode veya gerçek iPhone; genişlik ~375px.

CR-14-B ile **aynı üç senaryo** (üye, personel, admin). Ek kontroller:

- [ ] `safe-area-inset` alt tab bar ve topbar doğru
- [ ] Input focus zoom yok (font-size ≥ 16px)
- [ ] `-webkit-overflow-scrolling: touch` ile modal içi kaydırma akıcı

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-57 — iPhone Safari (375×812 veya benzeri)

### Genel layout
- [ ] Sayfa yatay scroll üretmiyor (takvim hariç kontrollü alanlar)
- [ ] `safe-area-inset` alt/üst boşlukları çentikli ekranda doğru (üye alt tab bar, topbar)
- [ ] Giriş kartı tam genişlik, input zoom yok (font-size ≥ 16px)

### Navigasyon (admin)
- [ ] Hamburger ile drawer açılıyor, backdrop tıklanınca kapanıyor
- [ ] Escape ile drawer kapanıyor
- [ ] Drawer açıkken arka plan scroll kilitli

### Topbar (admin)
- [ ] Tek/çift satır düzen okunaklı
- [ ] **Filtrele** paneli açılıp kapanıyor
- [ ] **⋯** overflow menüsünde ikincil aksiyonlar erişilebilir
- [ ] Hafta/Ay görünüm butonları mobilde gizli veya sade

### Takvim
- [ ] Varsayılan günlük liste görünümü
- [ ] Seans kartı tam genişlik; tıklayınca detay genişliyor
- [ ] Tarih navigasyonu (← / → / Bugün) çalışıyor

### Üye portalı
- [ ] Alt tab bar: Takvim | Paketlerim | Profil
- [ ] Paket kartları tam genişlik
- [ ] İptal butonu dokunması kolay (≥ 44px)
- [ ] Profil butonları tam genişlik stack

### Modallar
- [ ] Tam ekrana yakın (`100dvh`), footer sticky
- [ ] Birincil aksiyon (Kaydet) altta

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-58 — Android Chrome (360×800 veya benzeri)

### MF-57 ile ortak maddeler
- [ ] Layout, drawer, topbar, takvim, üye tab bar (MF-57 ile aynı kontroller)

### Android özel
- [ ] Adres çubuğu göster/gizle sonrası layout bozulmuyor
- [ ] `theme-color` ile üst çubuk koyu tema (#0b1020)
- [ ] PWA “Ana ekrana ekle” sonrası standalone açılıyor (isteğe bağlı)
- [ ] Service worker kaydı hatasız (DevTools → Application → Service Workers)
- [ ] Dokunma gecikmesi yok; butonlar tek dokunuşla tepki veriyor

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-59 — Tablet (768px) yatay ve dikey

### Dikey (768×1024)
- [ ] Sidebar drawer modu (≤980px) veya dar rail davranışı tutarlı
- [ ] Topbar filtre alanları kullanılabilir
- [ ] Takvim: liste veya hafta görünümü geçişi bozulmuyor
- [ ] `.formGrid` 2 sütun (≥640px kuralı)
- [ ] Modallar tam ekran değil, makul genişlik

### Yatay (1024×768)
- [ ] Haftalık grid görünürse yatay scroll + sticky saat sütunu
- [ ] Üye listesi tablo görünümü (≥768px kart değil tablo)
- [ ] Grup seans / çalışma saatleri formları yatay düzene geçiyor

### Döndürme
- [ ] Portrait ↔ landscape geçişinde `matchMedia` layout güncelleniyor (drawer, üye kartları, admin paneller)

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-60 — Üye akışı (mobil)

**Ön koşul:** Aktif paketi olan üye hesabı.

| Adım | Beklenen | ✓ |
|------|----------|---|
| 1. `index.html` aç, giriş yap | Login overlay, başarılı giriş sonrası takvim | [ ] |
| 2. Takvim sekmesi | Günlük liste, kendi seansları görünür | [ ] |
| 3. Seans kartına dokun | Detay / not alanı genişler | [ ] |
| 4. İptal edilebilir seans → **İptal** | Onay sonrası seans iptal; liste güncellenir | [ ] |
| 5. Alt tab **Paketlerim** | Aktif paket kartı tam genişlik | [ ] |
| 6. Paket satırı → seans listesi | Sheet modal, Kapat/iptal akışı CR-44–47 uyumlu | [ ] |
| 7. Alt tab **Profil** | Profil kartı + Şifre / Çıkış butonları | [ ] |
| 8. Bildirim banner (varsa) | Üstte veya panel içinde okunaklı | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-61 — Admin akışı (mobil)

**Ön koşul:** Admin hesabı.

| Adım | Beklenen | ✓ |
|------|----------|---|
| 1. Giriş yap | Planner yüklenir, mobilde günlük liste | [ ] |
| 2. **Filtrele** → üye/personel/oda filtrele | Liste/grid filtrelenmiş seanslar | [ ] |
| 3. Boş slota veya **+** ile seans ekle | Seans modalı açılır, form tek sütun | [ ] |
| 4. Zorunlu alanları doldur → **Kaydet** | Seans oluşur, takvimde görünür | [ ] |
| 5. Sidebar → **Üyeleri Listele** | Ana alan paneli (`#adminMembersListView`), kart listesi + arama | [ ] |
| 6. Sidebar → **Takvim** | Listeden takvime dönüş | [ ] |
| 7. Admin hub → Paket / Personel modalları | Kaydet footer sticky, form okunaklı | [ ] |
| 8. Grup seans ekle (varsa slot) | Üye ekleme satırı dikey, kayıt başarılı | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-63 — Personel akışı (mobil) — CR-14 / CR-50–51

**Ön koşul:** `role=staff` giriş hesabı, bugün atanmış seans.

| Adım | Beklenen | ✓ |
|------|----------|---|
| 1. Personel giriş | Günlük seans listesi (admin takvimi değil) | [ ] |
| 2. Grup seans kartı | Her üye ayrı satır, yoklama alanı sağda | [ ] |
| 3. ✓ **Geldi** | API onayı, satır ✓ işaretine döner | [ ] |
| 4. ✕ **Gelmedi** | Satır ✕ işaretine döner | [ ] |
| 5. Gelecek seans | ✓/✕ yerine **—** bekleniyor | [ ] |
| 6. QR ile gelen üye | «QR ile geldi» ✓ (düzenlenemez) | [ ] |

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## MF-62 — Dokunma hedefleri ve focus ring

### Otomatik kod denetimi (tamamlandı)

| Kriter | Durum | Referans |
|--------|-------|----------|
| `--touch-min: 44px` | ✓ | `styles.css` `:root` |
| `.btn`, sidebar, topbar ikonları min 44px | ✓ | MF-04 |
| Üye iptal / tab bar min yükseklik | ✓ | MF-32, `.member-tab-bar__btn` 56px |
| Personel yoklama ✓/✕ 44px | ✓ | CR-14 script |
| `:hover` yalnızca `@media (hover: hover)` | ✓ | MF-05 |
| `focus-visible` ring (buton, input, kart) | ✓ | `styles.css` `.btn:focus-visible` vb. |
| Input font-size 16px (iOS zoom) | ✓ | MF-06 |
| Lighthouse Accessibility | **100** | `docs/PWA-LIGHTHOUSE.md` |

### Manuel klavye testi

- [ ] Tab ile tüm interaktif öğeler sırayla gezinilebilir
- [ ] Odak halkası (mor `box-shadow`) butonlarda görünür
- [ ] Modal açıkken Escape kapanıyor (drawer + uygun modallar)
- [ ] `btn--xs` kritik aksiyonlarda mobilde yeterli dokunma alanı (min-height devralınır)

**Sonuç:** ☐ Geçti ☐ Kısmi ☐ Kaldı  
**Notlar:**

---

## Özet tablo

| ID | Platform / kapsam | Checklist bölümü |
|----|-------------------|------------------|
| CR-14-A | Otomatik kod/HTTP | § CR-14-A |
| CR-14-B | Chrome 360px E2E | § CR-14-B |
| CR-14-C | Safari 375px E2E | § CR-14-C |
| MF-57 | iPhone Safari 375px | § MF-57 |
| MF-58 | Android Chrome 360px | § MF-58 |
| MF-59 | Tablet 768px P/L | § MF-59 |
| MF-60 | Üye E2E mobil | § MF-60 |
| MF-61 | Admin E2E mobil | § MF-61 |
| MF-63 | Personel E2E mobil | § MF-63 |
| MF-62 | A11y dokunma + focus | § MF-62 |

**İlgili:** `docs/MOBILE-FIRST-TASKS.md`, `docs/PWA-LIGHTHOUSE.md`, `docs/CAPACITOR-ROADMAP.md`
