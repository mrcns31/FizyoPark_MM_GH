# Backend API - Seans Takip Sistemi

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Environment Variables
`.env.example` dosyasını `.env` olarak kopyalayın ve değerleri düzenleyin:
```bash
cp .env.example .env
nano .env
```

### 3. Veritabanı Kurulumu
`.env` dosyasındaki `DB_USER`, `DB_PASSWORD`, `DB_NAME` değerleriniz zaten kullanılır.

```bash
# Şemayı yükle (psql ile)
psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -f database/schema.sql

# Veya migration'ları proje ayarlarıyla çalıştır (kullanıcı/şifre .env'den okunur)
cd backend
npm run migrate
```

**Migration çalıştırma (kullanıcı adı/veritabanı elle yazılmaz, .env kullanılır):**
```bash
cd backend
npm run migrate
```
Bu komut `backend/.env` içindeki `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` ile bağlanıp `migration_one_active_package_per_member.sql` dosyasını çalıştırır.

Başka bir migration dosyası çalıştırmak için:
```bash
npm run migrate:run -- migration_packages.sql
```

### 4. İlk Kullanıcı Oluştur
```sql
-- PostgreSQL'de
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'admin',
  'admin@example.com',
  '$2b$10$...', -- bcrypt hash (şifre: admin123)
  'admin'
);
```

Şifre hash'i oluşturmak için:
```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('admin123', 10).then(hash => console.log(hash));
```

### 5. Sunucuyu Başlat
```bash
# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoint'leri

### Authentication
- `POST /api/auth/login` - Giriş yap
- `POST /api/auth/logout` - Çıkış yap
- `POST /api/auth/refresh` - Token yenile

### Sessions
- `GET /api/sessions` - Seansları listele
- `POST /api/sessions` - Yeni seans oluştur
- `PUT /api/sessions/:id` - Seans güncelle
- `DELETE /api/sessions/:id` - Seans sil
- `DELETE /api/sessions/group/bulk` - Grup seansları sil

### Staff
- `GET /api/staff` - Personel listesi
- `POST /api/staff` - Yeni personel ekle
- `PUT /api/staff/:id` - Personel güncelle
- `DELETE /api/staff/:id` - Personel sil

### Members
- `GET /api/members` - Üye listesi
- `POST /api/members` - Yeni üye ekle
- `PUT /api/members/:id` - Üye güncelle
- `DELETE /api/members/:id` - Üye sil

### Rooms
- `GET /api/rooms` - Oda listesi
- `POST /api/rooms` - Yeni oda ekle
- `PUT /api/rooms/:id` - Oda güncelle
- `DELETE /api/rooms/:id` - Oda sil

### Settings
- `GET /api/settings/working-hours` - Çalışma saatleri
- `PUT /api/settings/working-hours` - Çalışma saatlerini güncelle

## 🔐 Authentication

Tüm API istekleri (login hariç) JWT token gerektirir:

```javascript
// Header'da token gönder
Authorization: Bearer <your_jwt_token>
```

## 📝 Örnek İstekler

### Giriş Yap
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Seansları Listele
```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer <token>"
```

## 🧪 Test

```bash
# API testleri (gelecekte eklenecek)
npm test
```

## 📦 Production Deployment

Detaylar için `../DEPLOYMENT_GUIDE.md` dosyasına bakın.
