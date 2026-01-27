# Backend ve Güvenlik Planı

## 📋 Genel Bakış

Bu dokümantasyon, seans takip sistemini online, güvenli ve uzaktan erişilebilir hale getirmek için yapılması gerekenleri içerir.

---

## 🏗️ Backend Mimarisi

### 1. Teknoloji Stack Önerisi

**Seçenek 1: Node.js + Express (Önerilen)**
- ✅ Mevcut frontend ile uyumlu
- ✅ Hızlı geliştirme
- ✅ Geniş ekosistem

**Seçenek 2: Node.js + Fastify**
- ✅ Daha performanslı
- ✅ Modern ve hafif

**Seçenek 3: Python + FastAPI**
- ✅ Güçlü veri analizi
- ✅ Kolay entegrasyon

### 2. Veritabanı Seçimi

**Seçenek 1: PostgreSQL (Önerilen)**
- ✅ Güvenilir ve güçlü
- ✅ İlişkisel veri yapısı
- ✅ Ücretsiz ve açık kaynak

**Seçenek 2: MongoDB**
- ✅ NoSQL, esnek yapı
- ✅ JSON uyumlu
- ✅ Hızlı geliştirme

**Seçenek 3: SQLite (Küçük ölçek için)**
- ✅ Dosya tabanlı, kurulum yok
- ✅ Küçük projeler için ideal

---

## 🔐 Güvenlik Katmanları

### 1. Authentication (Kimlik Doğrulama)

**JWT (JSON Web Token) Tabanlı Sistem:**
```
Kullanıcı Girişi → JWT Token → Her İstekte Token Kontrolü
```

**Özellikler:**
- Kullanıcı adı/şifre ile giriş
- JWT token ile oturum yönetimi
- Token yenileme mekanizması
- Otomatik oturum sonlandırma

### 2. Authorization (Yetkilendirme)

**Rol Tabanlı Erişim Kontrolü (RBAC):**
- **Admin**: Tüm yetkiler
- **Personel**: Kendi seanslarını görüntüleme/düzenleme
- **Yönetici**: Personel ve seans yönetimi

### 3. Güvenlik Önlemleri

**a) HTTPS/SSL:**
- Tüm trafik şifrelenmeli
- Let's Encrypt ile ücretsiz sertifika

**b) CORS (Cross-Origin Resource Sharing):**
- Sadece güvenilir domain'lerden erişim
- Production'da sıkı CORS politikası

**c) Rate Limiting:**
- API isteklerini sınırlama
- DDoS saldırılarına karşı koruma

**d) Input Validation:**
- Tüm kullanıcı girdilerini doğrulama
- SQL Injection koruması
- XSS (Cross-Site Scripting) koruması

**e) Veri Şifreleme:**
- Hassas verilerin şifrelenmesi
- Şifrelerin hash'lenmesi (bcrypt)

---

## 📊 Veritabanı Şeması

### Tablolar:

1. **users** (Kullanıcılar)
   - id, username, email, password_hash, role, created_at

2. **staff** (Personel)
   - id, user_id, first_name, last_name, phone, working_hours (JSON), created_at

3. **members** (Üyeler)
   - id, name, phone, email, notes, created_at

4. **rooms** (Odalar)
   - id, name, devices, created_at

5. **sessions** (Seanslar)
   - id, staff_id, member_id, room_id, start_ts, end_ts, note, created_at, updated_at

6. **working_hours** (Çalışma Saatleri)
   - id, day_of_week, start_time, end_time, enabled

---

## 🔌 API Endpoint'leri

### Authentication
- `POST /api/auth/login` - Giriş yap
- `POST /api/auth/logout` - Çıkış yap
- `POST /api/auth/refresh` - Token yenile

### Sessions (Seanslar)
- `GET /api/sessions` - Seansları listele (filtreleme ile)
- `POST /api/sessions` - Yeni seans oluştur
- `PUT /api/sessions/:id` - Seans güncelle
- `DELETE /api/sessions/:id` - Seans sil
- `DELETE /api/sessions/group` - Grup seansları sil

### Staff (Personel)
- `GET /api/staff` - Personel listesi
- `POST /api/staff` - Yeni personel ekle
- `PUT /api/staff/:id` - Personel güncelle
- `DELETE /api/staff/:id` - Personel sil

### Members (Üyeler)
- `GET /api/members` - Üye listesi
- `POST /api/members` - Yeni üye ekle
- `PUT /api/members/:id` - Üye güncelle
- `DELETE /api/members/:id` - Üye sil

### Rooms (Odalar)
- `GET /api/rooms` - Oda listesi
- `POST /api/rooms` - Yeni oda ekle
- `PUT /api/rooms/:id` - Oda güncelle
- `DELETE /api/rooms/:id` - Oda sil

### Settings (Ayarlar)
- `GET /api/settings/working-hours` - Çalışma saatleri
- `PUT /api/settings/working-hours` - Çalışma saatlerini güncelle

---

## 🌐 Deployment Seçenekleri

### 1. Bulut Platformları

**a) Vercel (Önerilen - Frontend için)**
- ✅ Ücretsiz tier
- ✅ Otomatik deployment
- ✅ CDN entegrasyonu

**b) Railway**
- ✅ Node.js desteği
- ✅ PostgreSQL entegrasyonu
- ✅ Kolay deployment

**c) Render**
- ✅ Ücretsiz tier
- ✅ PostgreSQL desteği
- ✅ Otomatik SSL

**d) DigitalOcean**
- ✅ Düşük maliyet
- ✅ Tam kontrol
- ✅ Ölçeklenebilir

### 2. Kendi Sunucunuz

**Gereksinimler:**
- Ubuntu/Debian sunucu
- Node.js 18+ kurulumu
- PostgreSQL kurulumu
- Nginx reverse proxy
- PM2 (process manager)

---

## 📦 Kurulum Adımları

### 1. Backend Projesi Oluşturma

```bash
mkdir backend
cd backend
npm init -y
npm install express cors helmet morgan dotenv
npm install jsonwebtoken bcrypt
npm install pg (PostgreSQL için)
npm install --save-dev nodemon
```

### 2. Veritabanı Kurulumu

```sql
-- PostgreSQL'de veritabanı oluştur
CREATE DATABASE session_tracker;

-- Tabloları oluştur (schema.sql dosyasında)
```

### 3. Environment Variables

```env
# .env dosyası
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=session_tracker
DB_USER=your_user
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=24h
NODE_ENV=production
```

---

## 🔒 Güvenlik Checklist

- [ ] HTTPS/SSL sertifikası aktif
- [ ] JWT token güvenliği (secret key güçlü)
- [ ] Şifreler bcrypt ile hash'leniyor
- [ ] CORS ayarları yapılandırıldı
- [ ] Rate limiting aktif
- [ ] Input validation tüm endpoint'lerde
- [ ] SQL injection koruması
- [ ] XSS koruması
- [ ] Environment variables güvenli
- [ ] Veritabanı bağlantıları şifrelenmiş
- [ ] Loglama ve monitoring aktif
- [ ] Yedekleme stratejisi

---

## 🚀 Hızlı Başlangıç (Önerilen Yol)

1. **Backend klasörü oluştur** ve Express API kur
2. **PostgreSQL veritabanı** kur ve şema oluştur
3. **Authentication sistemi** kur (JWT)
4. **API endpoint'leri** oluştur
5. **Frontend'i backend'e bağla** (localStorage yerine API)
6. **Güvenlik önlemlerini** ekle
7. **Test et** (local)
8. **Deploy et** (Railway/Render/Vercel)

---

## 📝 Sonraki Adımlar

1. Backend klasör yapısını oluştur
2. Veritabanı şemasını hazırla
3. API endpoint'lerini kodla
4. Frontend'i backend'e entegre et
5. Güvenlik testleri yap
6. Production'a deploy et

---

## 💡 Öneriler

- **Aşamalı geçiş**: Önce backend'i kur, sonra frontend'i entegre et
- **Test ortamı**: Production'dan önce test ortamı kur
- **Yedekleme**: Düzenli veritabanı yedekleri al
- **Monitoring**: Hata takibi için Sentry gibi araçlar kullan
- **Dokümantasyon**: API dokümantasyonu hazırla (Swagger)
