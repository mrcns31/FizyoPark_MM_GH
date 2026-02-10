# Çalıştırma Rehberi – Sorunsuz Adımlar

Bu rehber, programı yerelde sorunsuz çalıştırmak için yapılacakları sırayla anlatır.

---

## Ön koşul

- **PostgreSQL 17** servisi çalışıyor olmalı (veritabanı: `fizyopark_mm_gh`).
- Şema uygulanmış olmalı: `backend/database/schema.sql`

Eğer henüz değilse: **POSTGRESQL_TESHIS_SONUCU.md** ve **backend/.env** (DB_NAME=fizyopark_mm_gh) ile kurulumu tamamlayın.

---

## Adım 1: İlk admin kullanıcıyı oluşturun

Backend’e giriş yapabilmek için bir admin kullanıcı gerekir. **Bir kez** çalıştırın:

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM\backend
npm run seed
```

Çıktıda **"Admin kullanıcı oluşturuldu: username=admin, password=admin123"** görünmeli.image.png

---

## Adım 2: Backend’i başlatın

**PowerShell (1. pencere):**

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM\backend
npm start
```

"Server çalışıyor: http://localhost:3000" mesajını görene kadar bekleyin. Bu pencereyi kapatmayın.

---

## Adım 3: Frontend’i başlatın

**PowerShell (2. pencere):**

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
node server.js
```

"Server çalışıyor: http://localhost:5173" mesajını görene kadar bekleyin.

---

## Adım 4: Tarayıcıda açın

Tarayıcıda şu adresi açın:

**http://localhost:5173**

- Token yoksa **giriş ekranı** gelir.
- **Kullanıcı adı:** `admin`  
- **Şifre:** `admin123`  
- **Giriş**’e tıklayın.

Girişten sonra uygulama açılır ve veriler **backend (PostgreSQL)** üzerinden yüklenir.

---

## Özet – Ne çalışıyor olmalı?

| Bileşen    | Adres / Bilgi                              |
|-----------|---------------------------------------------|
| PostgreSQL| Servis: postgresql-x64-17, veritabanı: fizyopark_mm_gh |
| Backend   | http://localhost:3000                       |
| Frontend  | http://localhost:5173                       |
| Giriş     | admin / admin123 (seed ile oluşturuldu)     |

---

## İşlem logları (audit)

Tüm önemli işlemler (üye ekleme/silme, seans oluşturma, giriş vb.) **activity_logs** tablosuna yazılır; böylece ileride "kim, ne zaman, ne yaptı" takip edilebilir.

- **Tablo:** Migration ile oluşturulur. Bir kez çalıştırın:
  ```powershell
  cd backend
  node scripts/run-migration.js migration_activity_logs.sql
  ```
- **Log listesi API:** Sadece admin/manager rolü `GET /api/activity-logs` ile logları listeleyebilir (sayfalama: `?page=1&limit=50`, filtre: `?action=member.create`, `?entityType=session`, `?from=`, `?to=`).

---

## Sık karşılaşılan durumlar

- **"Token bulunamadı" / giriş ekranı sürekli geliyor**  
  Backend çalışıyor mu kontrol edin (`http://localhost:3000/health` açılmalı).  
  Girişte kullandığınız kullanıcı adı ve şifre doğru mu, seed’i tekrar çalıştırdınız mı kontrol edin.

- **"Giriş başarısız"**  
  `npm run seed` ile admin kullanıcıyı oluşturduğunuzdan emin olun.  
  Veritabanı adının `.env` içinde `fizyopark_mm_gh` olduğunu kontrol edin.

- **CORS hatası**  
  Backend’te `.env` içinde `CORS_ORIGIN=http://localhost:5173` olmalı.  
  Frontend’i her zaman **http://localhost:5173** üzerinden açın (dosyayı doğrudan açmayın).

- **Veriler boş geliyor**  
  Normal; ilk açılışta personel, oda, üye, seans boş olabilir.  
  Ayarlar / Personel / Odalar / Üyeler ekleyip seans oluşturabilirsiniz.  
  Şu an eklediğiniz veriler **sayfa yenilenene kadar** bellekte kalır; kalıcı kayıt için ileride API’ye yazma adımları eklenebilir.

---

## Kapatma

- Her iki PowerShell penceresinde **Ctrl+C** ile backend ve frontend sunucularını durdurun.
- PostgreSQL servisini durdurmak isterseniz: `services.msc` → postgresql-x64-17 → Durdur.
