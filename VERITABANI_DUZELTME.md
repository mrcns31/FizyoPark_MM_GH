# Veritabanı Düzeltme - FizyoPark_MM_GH

## Sorun
Şemayı yanlışlıkla `session_tracker` veritabanına uyguladınız.  
Doğru veritabanı: **FizyoPark_MM_GH**

---

## Çözüm

### ADIM 1: FizyoPark_MM_GH veritabanı var mı kontrol edin

Terminal / PowerShell'de:

```bash
psql -U user -l
```

(Listede `FizyoPark_MM_GH` görünmeli.)

---

### ADIM 2: Veritabanı yoksa oluşturun

Eğer listede **FizyoPark_MM_GH** yoksa:

```bash
psql -U user -d postgres -c "CREATE DATABASE \"FizyoPark_MM_GH\";"
```

(Tırnaklar, adında büyük harf olduğu için gerekli.)

---

### ADIM 3: Şemayı doğru veritabanına uygulayın

Proje klasöründe (FP_MM veya backend klasörünün bir üstü) şu komutu çalıştırın:

```bash
psql -U user -d FizyoPark_MM_GH -f database/schema.sql
```

**Eğer `database/schema.sql` backend klasöründeyse:**

```bash
psql -U user -d FizyoPark_MM_GH -f backend/database/schema.sql
```

**Hangi klasörde olduğunuz önemli:**

- `d:\26-01-2026-Cursor-Takip\FP_MM` içindeyseniz → `backend/database/schema.sql`
- `d:\26-01-2026-Cursor-Takip\FP_MM\backend` içindeyseniz → `database/schema.sql`

---

### ADIM 4: Hata alırsanız

**"database does not exist"**  
→ Önce ADIM 2 ile `FizyoPark_MM_GH` veritabanını oluşturun.

**"relation already exists"**  
→ Bu veritabanında tablolar zaten var. İsterseniz:
- Ya mevcut tablolarla devam edersiniz,
- Ya da veritabanını silip sıfırdan kurarsınız (tüm veri gider):

```bash
psql -U user -d postgres -c "DROP DATABASE \"FizyoPark_MM_GH\";"
psql -U user -d postgres -c "CREATE DATABASE \"FizyoPark_MM_GH\";"
psql -U user -d FizyoPark_MM_GH -f backend/database/schema.sql
```

**"role user does not exist"**  
→ `-U user` yerine PostgreSQL’de gerçekten kullandığınız kullanıcı adını yazın (örn. `postgres`):

```bash
psql -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
```

---

## Özet komutlar (kopyala-yapıştır)

**Proje kökündeyken (FP_MM):**
```bash
psql -U user -d FizyoPark_MM_GH -f backend/database/schema.sql
```

**Backend klasöründeyken:**
```bash
psql -U user -d FizyoPark_MM_GH -f database/schema.sql
```

Kullanıcı adı `user` değilse `-U` kısmını kendi kullanıcınızla değiştirin.
