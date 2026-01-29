# PostgreSQL "Connection Refused" Hatası - Çözüm

## Hata
```
connection to server at "localhost" (::1), port 5432 failed: Connection refused
```

**Anlamı:** Bilgisayarınızda PostgreSQL sunucusu çalışmıyor veya 5432 portunu dinlemiyor.

---

## Çözüm Adımları (Windows)

### ADIM 1: PostgreSQL Kurulu mu Kontrol Edin

**Yol 1 - Servisler üzerinden:**
1. `Win + R` tuşlarına basın
2. `services.msc` yazıp Enter'a basın
3. Açılan pencerede listede **"postgresql"** veya **"PostgreSQL"** arayın

**Yol 2 - Klasör kontrolü:**
- `C:\Program Files\PostgreSQL\` klasörü var mı bakın
- Varsa kurulu demektir

**Kurulu değilse:**  
https://www.postgresql.org/download/windows/ adresinden indirip kurun, sonra aşağıdaki “Servisi Başlat” adımına geçin.

---

### ADIM 2: PostgreSQL Servisini Başlatın

#### Yöntem A – Servisler penceresi (services.msc)
1. `Win + R` → `services.msc` → Enter
2. Listede **"PostgreSQL"** veya **"postgresql-x64-16"** (sayı sürüm olabilir) bulun
3. Üzerine çift tıklayın
4. **"Başlat"** (Start) butonuna tıklayın
5. **Başlangıç türü:** "Otomatik" yapın (isteğe bağlı)
6. Tamam → Kapat

#### Yöntem B – PowerShell (Yönetici olarak)
1. PowerShell’i **Yönetici olarak çalıştırın**
2. Servis adını bulun:
   ```powershell
   Get-Service -Name *postgres*
   ```
3. Gördüğünüz isim örn. `postgresql-x64-16` ise:
   ```powershell
   Start-Service -Name "postgresql-x64-16"
   ```
   (Tırnak içindeki ismi kendi listelediğiniz isimle değiştirin.)

#### Yöntem C – pg_ctl (PostgreSQL kurulum klasöründen)
1. Örnek klasör: `C:\Program Files\PostgreSQL\16\bin\`
2. Bu klasörde **Yönetici olarak** CMD/PowerShell açın
3. Çalıştırın:
   ```bat
   pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
   ```
   (16 ve `data` yolu kendi kurulumunuza göre değişebilir.)

---

### ADIM 3: Bağlantıyı Tekrar Deneyin

Servisi başlattıktan sonra 10–20 saniye bekleyin, sonra:

```bash
psql -U user -d FizyoPark_MM_GH -f backend/database/schema.sql
```

Kullanıcı adı `postgres` ise:
```bash
psql -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
```

---

### ADIM 4: Hala "Connection Refused" Alırsanız

**Port 5432 açık mı?**
- Firewall veya güvenlik duvarı 5432’yi engelliyor olabilir.
- Geçici test: Windows Güvenlik Duvarı’nda “PostgreSQL” veya 5432 için izin verin.

**Farklı port:**
- Kurulumda 5432 dışında port seçtiyseniz (örn. 5433) bağlantıda port belirtin:
  ```bash
  psql -U user -d FizyoPark_MM_GH -p 5433 -f backend/database/schema.sql
  ```

**Kullanıcı adı:**
- Windows kurulumunda genelde varsayılan kullanıcı **postgres**’tir. Önce şunu deneyin:
  ```bash
  psql -U postgres -l
  ```

---

## Özet Kontrol Listesi

- [ ] PostgreSQL kurulu (Program Files altında klasör var)
- [ ] `services.msc` içinde PostgreSQL servisi “Çalışıyor”
- [ ] Komutta doğru kullanıcı: `-U postgres` veya `-U user`
- [ ] Doğru veritabanı: `-d FizyoPark_MM_GH`
- [ ] Şema yolu: `backend/database/schema.sql` (FP_MM klasöründen)

Servisi başlattıktan sonra aldığınız yeni hata veya çıktıyı paylaşırsanız bir sonraki adımı netleştirebiliriz.
