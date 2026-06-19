# FizyoPark React Native (mobile-rn) — Durum & Kalan İşler

Bu uygulama, web admin'in (kök `app.js`/`index.html`/`api.js`) **mobil görünümüyle birebir** paritesini hedefler.
Kural: yeni ekran/akıştan önce gerçek web kaynağı okunur, kafaya göre yapılmaz; web admin birebir + iyi mobil UX.

Son güncelleme: 2026-06-19

---

## ▶️ DEVAM ETMEK İÇİN (özellikle başka bilgisayarda)

> **"mobile-rn projesine devam"** dendiğinde: bu dosyayı oku, aşağıdaki **🔴 Kalan İşler**
> tablosundan kaldığımız yerden devam et. Her iş öncesi ilgili web kaynağını (`app.js` /
> `index.html` / `api.js`) okuyup birebir uygula. Değişiklik sonrası `tsc --noEmit` ile doğrula.
>
> Bu dosya taşınabilir tek doğruluk kaynağıdır (oturum hafızası yalnızca geliştirenin
> kendi makinesinde tutulur, repoda yoktur).

---

## 🔴 Kalan işler

| # | İş | Not |
|---|----|-----|
| 1 | **Excel / PDF / yazdırma export** (paket & seans) | Web'de var. Mobilde atlanır mı, karar bekliyor. |
| 2 | **Yasal link yönetimi** (admin hesap) | Gizlilik/koşullar/açık rıza/çerez URL'leri. Backend `getLegalLinks` hazır, RN'de form yok. |
| 3 | **Oda silmeden önce seans kontrolü** | Web odada seans varsa uyarır; RN doğrudan siler. |
| 4 | **Telefon / kart ile randevusuz giriş** (walk-in) | Backend `verifyMemberPhoneAccess` / `verifyMemberCardAccess` hazır; RN'de tetikleme yok. |
| 5 | **Push notifications** | Ertelendi. Detaylı plan + maliyet + test matrisi aşağıda → [📲 Push notifications](#-push-notifications--detayl%C4%B1-plan--maliyet--test). |
| 6 | **Android cihazda yaygın test** | iOS sim + Android emülatör + (dev build) fiziksel iPhone'da test edildi; gerçek Android cihaz/yaygın QA kaldı. |

---

## 📲 Push notifications — detaylı plan & maliyet & test

İki ayrı şey var, karıştırma:

- **Local bildirim** (`expo-notifications` zamanlanmış): "seansına 1 saat kaldı" gibi.
  Ücretsiz, sunucu YOK, **iOS'ta ücretsiz Apple ID ile bile çalışır**, FCM gerekmez.
  Sunucu olayını (yeni talep/iptal) gönderemez — sadece cihazda önceden planlanan.
- **Remote (sunucudan tetiklenen) push**: yeni talep/iptal/check-in app kapalıyken bildirir.
  Expo Push servisi veya ham Firebase (`@react-native-firebase`) ile yapılır. İkisi de aynı
  altyapıya (FCM + APNs) dayanır.

### Firebase / FCM gerçekleri (UNUTMA)
- **FCM ücretsiz** (Firebase Spark planı): mesaj başına ücret yok, sınırsız.
- **FCM iOS push'u baypas ETMEZ** — iOS'a giden her push, Firebase üzerinden bile olsa
  Apple'ın **APNs**'inden geçer. Yani:
  - **Android: tamamen ücretsiz** (test dahil). Apple/ücretli hesap gerekmez.
  - **iOS: ücretli Apple Developer ($99/yıl) ŞART** — Push Notifications capability + APNs
    anahtarı (.p8) için. **Ücretsiz Apple ID (Personal Team) bu capability'yi açamaz**; Xcode
    izin vermez. Yani iOS remote push'u **test etmek için bile** paralı hesap gerekir.
- Expo Go'da remote push çalışmaz → **dev build / standalone** gerekir.
- Backend işi: kullanıcı başına push token saklama + olayda gönderim (Expo Push API veya FCM).

### Simülatör/emülatörde test
| Test türü | Android emülatör (Play Services) | iOS simülatör |
|---|---|---|
| Gerçek uçtan uca remote push (FCM→cihaz) | ✅ ücretsiz, gerçek token alır | ❌ APNs token alamaz |
| Push payload handling (UI/handler) | ✅ | ✅ `xcrun simctl push <booted> com.fizyopark.mobilern payload.apns` (ücretsiz) |
| Local bildirim | ✅ | ✅ |

**Sonuç:** Geliştirme/handler testini büyük ölçüde **bedava** yaparsın (Android emülatör gerçek
push; iOS sim `simctl push` ile payload simülasyonu). **Gerçek uçtan uca iOS teslimatı** tek
paralı kısım: fiziksel iPhone + Apple Developer $99/yıl.

### Önerilen sıra
1. **Local** seans hatırlatması (ücretsiz, backend yok) → hemen yapılabilir.
2. **Remote**: Android'i FCM ile bedava kur+test et; iOS remote'u paralı Apple hesabı alınınca ekle.
   Expo (managed) olduğumuz için **Expo Push servisi** daha az kurulumla aynı işi yapar (FCM+APNs
   sarmalı) — ham Firebase yerine onu tercih edebiliriz.

---

## ✅ Tamamlananlar (özet)

- **Tüm admin ekranları** (web mobil paritesi): takvim/planner, üyeler (+eski/paketi bitmiş), paketler, personel, odalar, çalışma saatleri, kapalı günler, giriş listesi, işlem logları, talepler, hesap.
- **Grup seansı**: oluşturma (çoklu üye) + düzenleme (ekle/çıkar/slot) + planner gruplama + onaylanmış seansta admin şifresi.
- **Üye paketi**: atama, düzenleme (`updateMemberPackage`), sonlandırma, uzatma, paket seansları görüntüleme, uygunluk/çakışma uyarısı.
- **Realtime / polling** (web paritesi + foreground refetch):
  - Takvim/seanslar: **10 sn**
  - Talepler (paket+silme): **10 sn**
  - Bildirimler: **20 sn**
  - Üye QR check-in (QR ekranı açıkken): **2 sn**
  - Personel vardiya hatırlatması: **60 sn**
  - Uygulama öne gelince anında refetch (AppState→focusManager).
- **Bildirim toast'ı** (yeni bildirimde balon) + **drawer okunmamış rozeti** (bildirim & talep sayısı).
- **Üye portalı**: QR check-in canlı + geri sayım, Gelecek/Geçmiş seanslar, paket talebi, seans iptali (sebep + yeni randevu + WhatsApp).
- **Personel**: planner slota göre gruplu + doğru yoklama (gelecek seansa buton yok), kart no + şifre sıfırlama, vardiya hatırlatma.
- **Bottom sheet animasyonu** (`SheetModal`: backdrop fade + içerik slide), FAB taşması düzeltmesi, scroll alt boşluğu.
- **Takvim saat rayı** (günlük): çalışma saatleri boyunca tüm saatler dikey dizili, seanslar kendi saatine oturur.

---

## 🛠 Çalıştırma / geliştirme notları

**Node:** her komut öncesi `nvm use 22` (sistem node SDK 56'yı kırar).
**Typecheck:** `cd mobile-rn && ./node_modules/.bin/tsc --noEmit`
**Backend:** Docker — `fp_backend` (3000), `fp_postgres` (DB: `fizyopark_mm_gh`).

**API adresi** (`.env` → `EXPO_PUBLIC_API_BASE`): LAN IP kullanılıyor (`http://<MAC_LAN_IP>:3000/api`) → simülatör, emülatör ve fiziksel cihaz hepsi aynı Wi-Fi'da çalışır. Değiştirince Metro'yu `-c` ile yeniden başlat.

**Test hesapları** (login alanı `email`):
- Admin: `admin@local` / `admin123`
- Personel: `personel@local` / `personel123`
- Üye: `uye@local` / `uye123` (Ayşe Yılmaz, U001)
- Not: `seed-50-members.js` ile eklenen 50 üye **hesapsızdır** (giriş yapamaz).

**Çalıştırma:**
- iOS simülatör / Android emülatör: Expo Go (SDK 56) ile Metro'ya bağlan.
- Fiziksel iPhone: App Store Expo Go SDK 56'yı desteklemiyorsa **dev build** gerekir: `npx expo run:ios --device`. İmzalama için Xcode'a ücretsiz Apple ID (Personal Team) eklenir; ilk kurulumda cihazda *Ayarlar → Genel → VPN ve Cihaz Yönetimi → geliştiriciye güven*.
- Dev build'de de **Fast Refresh** çalışır (sadece JS değişiklikleri; native değişiklik → yeniden build).
