# Mobile-First Görev Listesi

Bu dosya, Seans Planlayıcı uygulamasının mobile-first tasarıma geçişi için adım adım görev listesidir.  
Yeni veya güncellenen tüm UI işleri bu listeye sadık kalınarak yapılacaktır.

**İlgili kurallar:** `.cursor/rules/mobile-first-design.mdc`, `.cursor/rules/member-package-logic.mdc`  
**Paket/seans UI:** `docs/MEMBER-PACKAGE-LOGIC.md` (MP-15, MP-16 bu listeyle birleşik)

---

## Faz 1 — Temel CSS ve breakpoint altyapısı

- [x] **MF-01** — CSS breakpoint değişkenleri tanımla (`--bp-sm: 640px`, `--bp-md: 768px`, `--bp-lg: 1024px`)
- [x] **MF-02** — Mevcut `@media (max-width: 980px)` kurallarını mobile-first `min-width` yapısına dönüştür
- [x] **MF-03** — `html` / `body` için `safe-area-inset` padding ekle (çentikli telefonlar)
- [x] **MF-04** — Tüm `.btn`, `.sidebar-nav__btn`, `.btn--icon` için min 44×44px dokunma alanı
- [x] **MF-05** — `:hover` ile görünürlük/değişim veren kuralları `@media (hover: hover)` içine al
- [x] **MF-06** — Input ve select font-size min 16px (iOS zoom engeli)

---

## Faz 2 — Navigasyon ve sidebar

- [x] **MF-07** — Hamburger menü butonu ekle (`topbar` sol üst)
- [x] **MF-08** — Sidebar’ı overlay drawer yap (backdrop + dışarı tıklayınca kapanma)
- [x] **MF-09** — `sidebar-shell` hover genişletme mantığını mobilde devre dışı bırak
- [x] **MF-10** — `sidebarOpen` UI state’i ekle (`app.js`); aç/kapa toggle
- [x] **MF-11** — Drawer açıkken `body` scroll kilidi (`overflow: hidden`)
- [x] **MF-12** — Klavye: Escape ile drawer kapatma
- [x] **MF-13** — `sidebar-shell--expanded` (üye) davranışını mobilde ayrı değerlendir (Faz 5’e bağlı; üye `content--member-full` ile sidebar gizli, alt tab bar MF-30’da)

---

## Faz 3 — Topbar sadeleştirme

- [x] **MF-14** — Mobilde topbar tek/çift satır stack layout (grid → flex column)
- [x] **MF-15** — Filtre alanlarını (üye/personel ara, personel select, oda select) ikinci satıra veya “Filtrele” paneline taşı
- [x] **MF-16** — `weeknav__label` sabit 210px genişliğini mobilde esnek yap
- [x] **MF-17** — Admin ikincil aksiyonları (Dışa aktar, İçe aktar, Görev dağıtımı, Yazdır) overflow `⋯` menüsüne al
- [x] **MF-18** — `topbar__right` butonlarını mobilde wrap veya menü ile grupla
- [x] **MF-19** — Görünüm toggle (Günlük/Haftalık/Aylık) mobilde sadeleştir veya gizle

---

## Faz 4 — Takvim (planner) — genel

- [x] **MF-20** — `matchMedia('(max-width: 767px)')` helper ekle (`app.js`)
- [x] **MF-21** — Mobilde varsayılan görünüm: `day` + `dayDisplayMode: list`
- [x] **MF-22** — Ekran daralınca `week` görünümünden otomatik `day` listesine geçiş
- [x] **MF-23** — `.content.view-week .planner__grid` `min-width: 960px` kuralını yalnızca `min-width: 1024px` üstünde uygula
- [x] **MF-24** — Haftalık grid mobilde kullanılacaksa: sticky saat sütunu + kontrollü yatay scroll
- [x] **MF-25** — Günlük grid (`dayDisplayMode: grid`) mobilde tek sütun veya liste öncelikli göster
- [x] **MF-26** — `renderDayListView`’ı tüm günler için genişlet (yalnızca “bugün” kısıtını kaldır)
- [x] **MF-27** — Aylık görünüm: küçük hücreler, güne tıklayınca günlük listeye drill-down
- [x] **MF-28** — Seans event kartları mobilde tam genişlik; metin truncate + tıklayınca detay
- [x] **MF-29** — `event:hover` ile genişleyen üye listesini mobilde kaldır; tap ile expand

---

## Faz 5 — Üye portalı (öncelikli kullanıcı deneyimi)

- [x] **MF-30** — Üye girişinde sidebar yerine alt tab bar tasarla: Takvim | Paketlerim | Profil
- [x] **MF-31** — Paket kartı ve seans listesi tam genişlik, dikey kart layout
- [x] **MF-32** — İptal butonu mobilde belirgin, min 44px yükseklik
- [x] **MF-33** — Üye bildirimleri (`member-notifications`) mobilde üst banner veya tab içi
- [x] **MF-34** — Geçmiş paket modalı mobilde tam ekran sheet
- [x] **MF-35** — Üye takviminde haftalık/aylık görünüm butonlarını gizle

---

## Faz 6 — Modallar ve formlar

- [x] **MF-36** — `.formGrid` mobilde `grid-template-columns: 1fr`
- [x] **MF-37** — Tablet (`min-width: 640px`) için `1fr 1fr`; masaüstü (`min-width: 1024px`) için `1fr 1fr 1fr`
- [x] **MF-38** — `.modal__card` küçük ekranda tam genişlik / tam yükseklik (`100dvh`)
- [x] **MF-39** — Modal footer butonları mobilde dikey stack; birincil aksiyon altta
- [x] **MF-40** — Uzun modallarda sticky footer (Kaydet / İptal)
- [x] **MF-41** — `.inlineAdd` grid’ini mobilde tek sütun yap
- [x] **MF-42** — Giriş kartı (`login-card`) mobilde `width: 100%`, `max-width` koru

---

## Faz 7 — Tablolar ve listeler

- [x] **MF-43** — `.packagesTable` mobilde kart görünümü veya yatay scroll wrapper
- [x] **MF-44** — `.planner-day-table` mobilde satır kartlarına dönüştür (liste görünümü ile birleşebilir)
- [x] **MF-45** — `.listItem` aksiyon butonlarını mobilde alta al (column layout)
- [x] **MF-46** — Üye listesi (`membersList`) mobilde arama + kompakt kart
- [x] **MF-47** — Paket geçmişi (`mp-history-item`) uzun metinlerde `word-break` / çok satır

---

## Faz 8 — Admin / personel özel ekranlar

- [x] **MF-48** — Çalışma saatleri modalı: gün satırları mobilde dikey stack
- [x] **MF-49** — Paket tanımlama / üye paketi formları: slot seçimi mobilde scrollable chip list
- [x] **MF-50** — Grup seans modalı: üye ekleme satırı mobilde dikey
- [x] **MF-51** — İşlem logları tablosu mobilde sayfalama veya kart listesi
- [x] **MF-52** — Profil kartı (`profile-card`) butonları mobilde full-width stack

---

## Faz 9 — PWA ve performans (isteğe bağlı)

- [x] **MF-53** — `manifest.json` + uygulama ikonları
- [x] **MF-54** — `theme-color` meta ve `apple-mobile-web-app-capable`
- [x] **MF-55** — Basit service worker (statik shell cache)
- [x] **MF-56** — Lighthouse mobile skor ölçümü (hedef: Performance + Accessibility ≥ 90)

---

## Faz 10 — Test ve kabul kriterleri

Detaylı checklist: `docs/MOBILE-FIRST-TEST-CHECKLIST.md`

- [x] **MF-57** — iPhone Safari (375px) manuel test checklist
- [x] **MF-58** — Android Chrome (360px) manuel test checklist
- [x] **MF-59** — Tablet (768px) yatay/dikey test
- [x] **MF-60** — Üye akışı: giriş → takvim → seans iptal → paket görüntüleme (mobil)
- [x] **MF-61** — Admin akışı: seans ekleme → filtre → modal kaydet (mobil)
- [x] **MF-62** — Dokunma hedefleri ve focus ring erişilebilirlik kontrolü
- [x] **MF-63** — Personel akışı: günlük liste → yoklama ✓/✕ (CR-14 § MF-63)

Detaylı checklist: `docs/MOBILE-FIRST-TEST-CHECKLIST.md` — otomatik ön kontrol: `node scripts/cr14-mobile-verify.mjs`

## İlerleme özeti

| Faz | Görev sayısı | Tamamlanan |
|-----|--------------|------------|
| 1 — CSS temel | 6 | 6 |
| 2 — Sidebar | 7 | 7 |
| 3 — Topbar | 6 | 6 |
| 4 — Takvim | 10 | 10 |
| 5 — Üye portalı | 6 | 6 |
| 6 — Modallar | 7 | 7 |
| 7 — Tablolar | 5 | 5 |
| 8 — Admin | 5 | 5 |
| 9 — PWA | 4 | 4 |
| 10 — Test | 7 | 7 |
| **Toplam** | **63** | **63** |

---

## Notlar

- Görev tamamlandıkça `[ ]` → `[x]` işaretleyin ve üst tablodaki sayacı güncelleyin.
- Yeni UI özelliği eklerken önce bu listede ilgili madde var mı kontrol edin; yoksa madde ekleyin.
- Kural dosyası (`.cursor/rules/mobile-first-design.mdc`) her oturumda AI’a mobile-first hatırlatması yapar.
