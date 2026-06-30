# FizyoPark — Tam Güvenlik & Mağaza Hazırlık Raporu

**Tarih:** 29.06.2026  
**Durum:** Gönderim için HAZIR DEĞİL (Kritik sorunlar var)

---

## 🔴 KRİTİK — Hemen Düzeltilmeli

### 1. `backend/.env` Dosyası Git'te Açık
Gerçek şifreler repoda görünür durumda:
```
DB_PASSWORD=fizyopark2024
JWT_SECRET=fizyopark_jwt_secret_2024_degistir
```
**Yapılacak:**
```bash
git rm --cached backend/.env
# Sonra tüm şifreleri döndür (DB, JWT, QR secret)
```
Git history'de de kaldı — `git filter-branch` veya BFG Repo Cleaner ile temizlenmeli.

---

### 2. Firebase API Key Açıkta
`mobile-rn/google-services.json` dosyası repoda. Key: `AIzaSyAGh4hwSqBsX3sUL1bJ5xTDgeOlnXeAPTM`

**Yapılacak:** Firebase Console'dan bu key'i iptal et → `git rm --cached` → `.gitignore`'a ekle.

---

### 3. Rate Limiting Kapalı
`backend/.env` içinde `RATE_LIMIT_DISABLED=1` — brute force saldırısına tamamen açık.

**Yapılacak:** Production'da bu satırı sil veya `0` yap.

---

### 4. Şifre Politikası Çok Zayıf
`backend/routes/auth.js` — minimum şifre uzunluğu **sadece 4 karakter**.

```javascript
// Şu an
isLength({ min: 4 })

// Olması gereken
isLength({ min: 12 })
.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
```

Sağlık uygulaması için bu kritik — kullanıcı verileri hassas.

---

### 5. Privacy Policy & Terms of Service Eksik
App Store ve Google Play'in ikisi de zorunlu tutuyor. Şu an ne backend'de endpoint var ne de `app.json`'da URL tanımlı.

---

### 6. iOS Privacy Manifest Eksik
iOS 17+ için `PrivacyInfo.xcprivacy` zorunlu. Olmadan Apple reddeder.

---

## 🟡 ORTA — Gönderim Öncesi Düzeltilmeli

| # | Sorun | Dosya | Risk |
|---|-------|-------|------|
| 1 | JWT süresi çok uzun: access token 24h, remember-me 30d | `backend/routes/auth.js` | Token çalınırsa uzun süre geçerli |
| 2 | `NODE_ENV=development` .env'de → hata detayları client'a sızıyor | `backend/.env` | Bilgi ifşası |
| 3 | Kiosk endpoint'leri auth gerektirmiyor (`/verify-card-access` vb.) | `backend/routes/member-portal.js` | Tasarım gereği ama rate limit şart |
| 4 | `MEMBER_QR_SECRET` hardcoded fallback var | `backend/utils/memberAccessQr.js` | Güvenlik zayıflığı |
| 5 | HTTPS sunucu tarafında konfigüre edilmemiş (Nginx arkası olabilir) | `backend/server.js` | MITM riski |
| 6 | Certificate pinning yok | `mobile-rn` | MITM riski |
| 7 | CORS tüm 192.168.x.x / 10.x.x.x ağlarına açık | `backend/server.js` | Production'da daraltılmalı |
| 8 | `runtimeVersion: "1.0.0"` sabit | `mobile-rn/app.json` | `"policy": "nativeVersion"` önerilir |
| 9 | Google Play Data Safety formu doldurulmamış | Play Console | Mağaza gereksinimi |

---

## 🟢 Olumlu Bulgular

- **SecureStore** — JWT token güvenli saklanıyor (Keychain/Keystore) ✓
- **bcrypt** v5.1.1, 10 rounds — şifre hashing doğru ✓
- **SQL Injection koruması** — tüm sorgular parametrik (`$1, $2`) ✓
- **Helmet.js** aktif ✓
- **CORS** whitelist bazlı ✓
- **Android izinleri** minimal ✓
- **Role-based access control** uygulanmış ✓

---

## Yapılacaklar Sırası (Önceliğe Göre)

```
[ ] 1. git rm --cached backend/.env + google-services.json
[ ] 2. Firebase key'i iptal et, yeni oluştur
[ ] 3. Tüm şifreleri döndür (DB, JWT, QR secret)
[ ] 4. RATE_LIMIT_DISABLED kaldır
[ ] 5. Şifre min uzunluğunu 12'ye çıkar
[ ] 6. NODE_ENV=production yap
[ ] 7. Privacy Policy & Terms sayfaları yayınla
[ ] 8. app.json'a privacyUrl + iOS infoPlist ekle
[ ] 9. Google Play Data Safety formu doldur
[ ] 10. JWT access token süresini kısalt (24h → 30dk), refresh token ekle
```

---

## Detaylı Açıklamalar

### .env Güvenliği
`.env` dosyası `.gitignore`'da tanımlı olsa bile eğer bir kez commit edildiyse git history'de kalır.
Temizlemek için:
```bash
# BFG Repo Cleaner (önerilen)
bfg --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force-with-lease

# veya git filter-branch
git filter-branch --tree-filter 'rm -f backend/.env' -- --all
```

### Privacy Policy Gereksinimleri
Toplanılan veriler (KVKK/GDPR beyanı için):
- Kimlik: ad, soyad, e-posta
- İletişim: telefon numarası
- Sağlık: seans bilgileri, üyelik paketleri
- Teknik: push notification token

### iOS infoPlist Örneği
`mobile-rn/app.json` içine eklenecek:
```json
"ios": {
  "infoPlist": {
    "NSLocalNetworkUsageDescription": "Yerel ağ üzerinden klinik sistemiyle iletişim kurmak için kullanılır."
  },
  "privacyManifests": {
    "NSPrivacyAccessedAPITypes": []
  }
}
```

### Rate Limiting (Login Endpoint)
```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 dakika
  max: 5,                     // 5 deneme
  message: 'Çok fazla giriş denemesi, lütfen daha sonra tekrar deneyin'
});
router.post('/login', loginLimiter, loginHandler);
```

### JWT Token Süresi İyileştirmesi
```javascript
// Mevcut: access token 24h (çok uzun)
// Önerilen: access token 30dk + refresh token 7-30 gün
const accessToken = jwt.sign(payload, secret, { expiresIn: '30m' });
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: '7d' });
```

---

**Sonuç:** Uygulama teknik altyapısı sağlam (SecureStore, bcrypt, parametrik SQL, helmet hepsi doğru). Ancak `.env` + Firebase key açığı ve şifre politikası zayıflığı **derhal** düzeltilmeden mağazaya gönderilmemeli. Privacy Policy eksikliği ise her iki mağazada da direkt ret nedeni.
