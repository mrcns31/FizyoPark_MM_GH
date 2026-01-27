# 🚀 Adım Adım Kurulum Rehberi (Başlangıç Seviyesi)

Bu rehber, hiç bilgisi olmayan biri için hazırlanmıştır. Her adımı sırayla takip edin.

---

## 📋 GENEL BAKIŞ

Sisteminizi online yapmak için 3 ana bölüm var:
1. **Backend (Sunucu)** - Verileri saklayan ve işleyen kısım
2. **Veritabanı** - Bilgilerin saklandığı yer
3. **Deployment (Yayınlama)** - İnternete koyma

---

## 🎯 SEÇENEK 1: EN KOLAY YOL (Railway - Ücretsiz)

Bu yöntem en kolay ve ücretsizdir. Adım adım takip edin:

### ADIM 1: GitHub Hesabı Oluştur (5 dakika)

1. https://github.com adresine gidin
2. "Sign up" butonuna tıklayın
3. Email, şifre ve kullanıcı adı girin
4. Hesabınızı doğrulayın

**Neden gerekli?** Kodlarınızı GitHub'a yükleyeceğiz, Railway oradan alacak.

### ADIM 2: Projeyi GitHub'a Yükle (10 dakika)

#### 2.1. Git Kurulumu (Eğer yoksa)

**Windows için:**
1. https://git-scm.com/download/win adresine gidin
2. İndirin ve kurun (varsayılan ayarlarla)
3. Kurulumdan sonra bilgisayarı yeniden başlatın

**Kontrol:**
- Windows'ta "Git Bash" veya "Command Prompt" açın
- Şu komutu yazın: `git --version`
- Bir versiyon numarası görünmeli

#### 2.2. Projeyi GitHub'a Yükle

1. **GitHub'da yeni repository oluştur:**
   - GitHub'a giriş yapın
   - Sağ üstteki "+" butonuna tıklayın
   - "New repository" seçin
   - Repository adı: `session-tracker` (veya istediğiniz bir isim)
   - "Public" seçin
   - "Create repository" butonuna tıklayın

2. **Bilgisayarınızda projeyi hazırlayın:**
   
   Proje klasörünüzde (FP_MM) terminal/komut satırı açın:
   
   ```bash
   # Git'i başlat
   git init
   
   # Tüm dosyaları ekle
   git add .
   
   # İlk kayıt
   git commit -m "İlk commit"
   
   # GitHub'a bağla (YOUR_USERNAME yerine GitHub kullanıcı adınızı yazın)
   git remote add origin https://github.com/YOUR_USERNAME/session-tracker.git
   
   # GitHub'a yükle
   git branch -M main
   git push -u origin main
   ```
   
   **Not:** İlk kez push yaparken GitHub kullanıcı adı ve şifre isteyebilir.

### ADIM 3: Railway Hesabı Oluştur (5 dakika)

1. https://railway.app adresine gidin
2. "Start a New Project" butonuna tıklayın
3. "Login with GitHub" seçin
4. GitHub hesabınızla giriş yapın
5. Railway'e erişim izni verin

### ADIM 4: Backend'i Railway'e Deploy Et (15 dakika)

1. **Yeni Proje Oluştur:**
   - Railway dashboard'da "New Project" butonuna tıklayın
   - "Deploy from GitHub repo" seçin
   - `session-tracker` repository'nizi seçin

2. **Backend Klasörünü Seç:**
   - Railway otomatik olarak projeyi algılar
   - "Root Directory" kısmına `backend` yazın
   - "Deploy" butonuna tıklayın

3. **Environment Variables Ekle:**
   - Railway'de projenize tıklayın
   - "Variables" sekmesine gidin
   - Şu değişkenleri ekleyin:
   
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=buraya_cok_gizli_bir_sifre_yazin_123456789
   CORS_ORIGIN=https://your-frontend-url.railway.app
   ```

### ADIM 5: PostgreSQL Veritabanı Ekle (10 dakika)

1. Railway dashboard'da projenize tıklayın
2. "+ New" butonuna tıklayın
3. "Database" → "Add PostgreSQL" seçin
4. PostgreSQL otomatik oluşturulur

5. **Veritabanı Bağlantı Bilgilerini Al:**
   - PostgreSQL servisine tıklayın
   - "Variables" sekmesine gidin
   - Şu bilgileri kopyalayın:
     - `PGHOST`
     - `PGPORT`
     - `PGDATABASE`
     - `PGUSER`
     - `PGPASSWORD`

6. **Backend'e Veritabanı Bilgilerini Ekle:**
   - Backend servisine geri dönün
   - "Variables" sekmesine gidin
   - Şu değişkenleri ekleyin (PostgreSQL'den kopyaladığınız değerlerle):
   
   ```
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_NAME=${{Postgres.PGDATABASE}}
   DB_USER=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   ```
   
   **Önemli:** `${{Postgres.PGHOST}}` formatını kullanın, Railway otomatik değerleri doldurur.

7. **Veritabanı Şemasını Oluştur:**
   - PostgreSQL servisine tıklayın
   - "Data" sekmesine gidin
   - "Query" butonuna tıklayın
   - `backend/database/schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
   - "Run" butonuna tıklayın

### ADIM 6: İlk Kullanıcı Oluştur (5 dakika)

1. PostgreSQL "Query" ekranında şu SQL'i çalıştırın:

```sql
-- Önce bcrypt hash oluşturmak için bir araç kullanmalıyız
-- Online bcrypt generator: https://bcrypt-generator.com/
-- Şifre: admin123 için hash oluşturun

-- Örnek (şifre: admin123):
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'admin',
  'admin@example.com',
  '$2b$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ',
  'admin'
);
```

**Bcrypt Hash Nasıl Oluşturulur:**
1. https://bcrypt-generator.com/ adresine gidin
2. "Rounds" kısmına `10` yazın
3. "Password" kısmına `admin123` yazın
4. "Hash" butonuna tıklayın
5. Çıkan hash'i kopyalayıp SQL'deki `$2b$10$...` kısmının yerine yapıştırın

### ADIM 7: Frontend'i Deploy Et (10 dakika)

1. Railway'de yeni bir servis oluşturun
2. GitHub repo'nuzu seçin
3. "Root Directory" kısmına hiçbir şey yazmayın (frontend root'ta)
4. "Build Command": Boş bırakın
5. "Start Command": `node server.js` yazın

6. **Environment Variables:**
   ```
   PORT=5173
   ```

7. **Backend URL'ini Frontend'e Ekle:**
   - Frontend servisinde "Variables" sekmesine gidin
   - Backend servisinizin URL'ini bulun (Railway'de "Settings" → "Domains")
   - Şu değişkeni ekleyin:
   ```
   API_URL=https://your-backend-url.railway.app
   ```

### ADIM 8: Domain Ayarları (Opsiyonel - 5 dakika)

1. Her iki serviste de (Backend ve Frontend) "Settings" → "Generate Domain" butonuna tıklayın
2. Railway otomatik domain verir
3. Veya kendi domain'inizi bağlayabilirsiniz

### ADIM 9: Test Et (5 dakika)

1. Frontend URL'inizi tarayıcıda açın
2. Giriş yapın:
   - Kullanıcı adı: `admin`
   - Şifre: `admin123`
3. Sistem çalışıyorsa başarılı!

---

## 🎯 SEÇENEK 2: KENDİ BİLGİSAYARINIZDA ÇALIŞTIRMA (Local)

Eğer sadece kendi bilgisayarınızda test etmek istiyorsanız:

### ADIM 1: Node.js Kur (10 dakika)

1. https://nodejs.org adresine gidin
2. "LTS" versiyonunu indirin (önerilen)
3. Kurulumu yapın (varsayılan ayarlarla)
4. Bilgisayarı yeniden başlatın

**Kontrol:**
- Terminal/Command Prompt açın
- `node --version` yazın
- Versiyon numarası görünmeli

### ADIM 2: PostgreSQL Kur (20 dakika)

**Windows için:**
1. https://www.postgresql.org/download/windows/ adresine gidin
2. "Download the installer" butonuna tıklayın
3. İndirin ve kurun
4. Kurulum sırasında:
   - Şifre belirleyin (unutmayın!)
   - Port: 5432 (varsayılan)
   - Locale: Turkish, Turkey

**Kontrol:**
- Windows'ta "pgAdmin" veya "SQL Shell" açın
- Şifrenizi girin
- `\l` yazın (veritabanı listesi görünmeli)

### ADIM 3: Veritabanı Oluştur (5 dakika)

SQL Shell'de veya pgAdmin'de:

```sql
-- Veritabanı oluştur
CREATE DATABASE session_tracker;

-- Kullanıcı oluştur (opsiyonel)
CREATE USER session_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE session_tracker TO session_user;
```

### ADIM 4: Backend Kurulumu (10 dakika)

1. Terminal'de proje klasörüne gidin:
   ```bash
   cd backend
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyası oluşturun:
   - `.env.example` dosyasını kopyalayın
   - `.env` olarak kaydedin
   - İçeriğini düzenleyin:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=session_tracker
   DB_USER=postgres
   DB_PASSWORD=kurulum_sırasında_belirlediğiniz_şifre
   JWT_SECRET=local_test_secret_key_123
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```

4. Veritabanı şemasını yükleyin:
   ```bash
   psql -U postgres -d session_tracker -f database/schema.sql
   ```
   
   Şifre istenirse, PostgreSQL kurulumunda belirlediğiniz şifreyi girin.

5. Backend'i başlatın:
   ```bash
   npm run dev
   ```
   
   "Server çalışıyor: http://localhost:3000" mesajını görmelisiniz.

### ADIM 5: İlk Kullanıcı Oluştur (5 dakika)

1. https://bcrypt-generator.com/ adresine gidin
2. Şifre: `admin123`, Rounds: `10`
3. Hash'i kopyalayın

4. PostgreSQL'de:
   ```sql
   INSERT INTO users (username, email, password_hash, role)
   VALUES (
     'admin',
     'admin@example.com',
     'BURAYA_BCRYPT_HASH_YAPIŞTIRIN',
     'admin'
   );
   ```

### ADIM 6: Frontend'i Başlat (5 dakika)

1. Yeni bir terminal açın
2. Proje klasörüne gidin:
   ```bash
   cd ..
   ```

3. Frontend sunucusunu başlatın:
   ```bash
   node server.js
   ```

4. Tarayıcıda http://localhost:5173 adresine gidin

### ADIM 7: Frontend'i Backend'e Bağla

**Bu kısım kod değişikliği gerektirir.** Frontend'deki `app.js` dosyasını düzenlemeniz gerekir.

Şimdilik localStorage çalışmaya devam eder. Backend entegrasyonu için ayrı bir rehber hazırlanabilir.

---

## ❓ SIK SORULAN SORULAR

### Soru 1: "npm install" hatası veriyor
**Çözüm:** Node.js'in doğru kurulduğundan emin olun. Terminal'i kapatıp yeniden açın.

### Soru 2: PostgreSQL bağlantı hatası
**Çözüm:** 
- PostgreSQL servisinin çalıştığından emin olun
- Şifrenin doğru olduğundan emin olun
- Port 5432'nin açık olduğundan emin olun

### Soru 3: Railway'de deploy hatası
**Çözüm:**
- GitHub repo'nun doğru yüklendiğinden emin olun
- Environment variables'ın doğru olduğundan emin olun
- Railway loglarına bakın (hata mesajlarını gösterir)

### Soru 4: Frontend backend'e bağlanamıyor
**Çözüm:**
- CORS ayarlarını kontrol edin
- Backend URL'inin doğru olduğundan emin olun
- Browser console'da hata mesajlarını kontrol edin

---

## 📞 YARDIM

Eğer bir adımda takılırsanız:

1. **Hata mesajını okuyun** - Genellikle neyin yanlış olduğunu söyler
2. **Google'da arayın** - Hata mesajını kopyalayıp Google'da arayın
3. **Logları kontrol edin** - Railway'de veya terminal'de hata mesajlarını okuyun

---

## ✅ KONTROL LİSTESİ

### Railway Deployment:
- [ ] GitHub hesabı oluşturuldu
- [ ] Proje GitHub'a yüklendi
- [ ] Railway hesabı oluşturuldu
- [ ] Backend deploy edildi
- [ ] PostgreSQL eklendi
- [ ] Environment variables ayarlandı
- [ ] Veritabanı şeması oluşturuldu
- [ ] İlk kullanıcı oluşturuldu
- [ ] Frontend deploy edildi
- [ ] Sistem test edildi

### Local Kurulum:
- [ ] Node.js kuruldu
- [ ] PostgreSQL kuruldu
- [ ] Veritabanı oluşturuldu
- [ ] Backend bağımlılıkları yüklendi
- [ ] .env dosyası oluşturuldu
- [ ] Veritabanı şeması yüklendi
- [ ] İlk kullanıcı oluşturuldu
- [ ] Backend çalışıyor
- [ ] Frontend çalışıyor

---

## 🎉 BAŞARILI!

Eğer tüm adımları tamamladıysanız, sisteminiz çalışıyor demektir!

**Sonraki adımlar:**
- Frontend'i backend'e bağlayın (API entegrasyonu)
- Daha fazla kullanıcı ekleyin
- Personel ve üye bilgilerini ekleyin
- Sisteminizi kullanmaya başlayın!
