# PostgreSQL data Klasörü Boş - Çözüm

## Sorun
`C:\Program Files\PostgreSQL\17\data` klasörü boş.

**Anlamı:** Veritabanı hiç başlatılmamış veya data hiç oluşturulmamış. Önce **data** klasörü oluşturulmalı (initdb).

---

## Çözüm: data Klasörünü Oluşturmak (initdb)

### ADIM 1: PostgreSQL Servisini Durdurun

1. `Win + R` → `services.msc` → Enter
2. **postgresql-x64-17** bulun
3. Sağ tık → **Durdur** (zaten duruyorsa geçin)

---

### ADIM 2: data Klasörünün Gerçekten Boş Olduğundan Emin Olun

1. Şu klasöre gidin:
   ```
   C:\Program Files\PostgreSQL\17\data
   ```
2. İçinde **hiç dosya/klasör yoksa** devam edin.
3. İçinde bir şeyler varsa (postgresql.conf, base vb.) **initdb çalıştırmayın**; o zaman sorun başka.

---

### ADIM 3: initdb ile data Oluşturun

**PowerShell veya CMD’yi Yönetici olarak açın:**

1. Başlat menüsünde **PowerShell** veya **CMD** yazın
2. **Sağ tık** → **Yönetici olarak çalıştır**

Sonra şu komutu **tam olarak** çalıştırın (yol sizin kurulumunuza göre 17):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "C:\Program Files\PostgreSQL\17\data" -U postgres -A trust -E UTF8 --locale=C
```

**Not:** `--locale=C` kullanın; Türkçe "Türkiye" locale adı non-ASCII karakter (ü) içerdiği için initdb hata verir. `C` locale ASCII uyumludur.

**Açıklama:**
- `-D "C:\Program Files\PostgreSQL\17\data"` → data klasörünün yolu
- `-U postgres` → süper kullanıcı adı
- `-A trust` → ilk kurulumda şifresiz local giriş (sonra şifre koyarsınız)
- `-E UTF8` → karakter seti

**Başarılı olursa** buna benzer bir çıktı görürsünüz:
```
The files belonging to this database system will be owned by user "postgres".
...
Success. You can now start the database server using:
    pg_ctl -D "C:\Program Files\PostgreSQL\17\data" -l logfile start
```

---

### ADIM 4: data Klasörüne İzin Verin (Önemli)

Servis **NT AUTHORITY\NetworkService** ile çalışıyor. Yeni oluşan `data` içeriğine bu hesabın erişmesi lazım.

1. `C:\Program Files\PostgreSQL\17\data` klasörüne gidin
2. **data** klasörüne **sağ tık** → **Özellikler** → **Güvenlik**
3. **Düzenle** → **Ekle** → `NT AUTHORITY\NetworkService` yazın → **Adları Denetle** → Tamam
4. **NetworkService** için **Tam Denetim** işaretleyin → Tamam → Tamam

**Üst klasör için de** (bazen gerekir):
- `C:\Program Files\PostgreSQL\17` klasörüne aynı şekilde **NT AUTHORITY\NetworkService** ekleyip **Tam Denetim** verin.

---

### ADIM 5: Servisi Başlatın

1. `Win + R` → `services.msc` → Enter
2. **postgresql-x64-17** → Sağ tık → **Başlat**

Birkaç saniye bekleyin. Durum **“Çalışıyor”** olmalı.

---

### ADIM 6: Şifre Belirleyin (İsteğe Bağlı ama Önerilen)

Servis çalışıyorsa, postgres kullanıcısına şifre koyun:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "ALTER USER postgres PASSWORD 'BurayaGucluBirSifreYazin';"
```

`BurayaGucluBirSifreYazin` kısmını kendi şifrenizle değiştirin.

---

### ADIM 7: FizyoPark_MM_GH ve Şema

**Veritabanı oluşturma:**
```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c 'CREATE DATABASE "FizyoPark_MM_GH";'
```

**Şemayı uygulama:**
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
```

Şifre koyduysanız, komut çalışırken ister.

---

## Hata Alırsanız

### "initdb: directory already exists and is not empty"
- data klasörü tam boş değil. İçinde ne var bir bakın; gerekirse klasörü `data_eski` yapıp, `data` adında boş bir klasör oluşturup tekrar initdb çalıştırın.

### "Access is denied" / "Permission denied"
- PowerShell/CMD’yi **Yönetici olarak** açın.
- Klasörü **Program Files** altında açarken bazen “Şu klasöre yazma izniniz yok” çıkar; o zaman initdb’yi çalıştıran hesabın bu klasöre yazma yetkisi olduğundan emin olun (veya geçici olarak data’yı başka bir dizinde oluşturup deneyin).

### Servis yine "başlayıp duruyor"
- `C:\Program Files\PostgreSQL\17\data\log\` içindeki en son .log dosyasının **en sonundaki** satırları (FATAL/ERROR olan kısımlar) paylaşın.

---

## Özet Sıra

1. Servisi durdurun  
2. Yönetici PowerShell/CMD’de:  
   `& "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "C:\Program Files\PostgreSQL\17\data" -U postgres -A trust -E UTF8`  
3. data klasörüne **NT AUTHORITY\NetworkService** ile **Tam Denetim** verin  
4. Servisi başlatın  
5. İsterseniz: `ALTER USER postgres PASSWORD '...'`  
6. `FizyoPark_MM_GH` oluşturup `schema.sql` uygulayın  

Bunları yaptıktan sonra data klasörü artık boş olmaz ve PostgreSQL düzgün çalışır.
