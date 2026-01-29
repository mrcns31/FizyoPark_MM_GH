# PostgreSQL data Klasörü – Program Files Dışına Taşıma

## Sorun
initdb şu hatayı veriyor:
> "C:/Program Files/PostgreSQL/17/data" dizininin erişim hakları değiştirilemedi: Permission denied

**Sebep:** Program Files altında Windows izinleri sıkı; initdb izin “düzeltme” işlemini orada yapamıyor.

**Çözüm:** data klasörünü Program Files dışında, örn. **C:\PostgreSQLData** gibi bir yerde oluşturup orada initdb çalıştırmak, sonra servisi bu yolu kullanacak şekilde ayarlamak.

---

## ADIM 1: Servisi Durdurun (Zaten duruyorsa atlayın)

1. `Win + R` → `services.msc` → Enter
2. **postgresql-x64-17** → Sağ tık
3. Menüde **"Durdur"** görünüyorsa tıklayın. **Sadece "Başlat"** görünüyorsa servis zaten durmuş demektir, bu adımı atlayıp ADIM 2’ye geçin.

---

## ADIM 2: Yeni data Klasörü Oluşturun

1. **C:\** sürücüsünde (veya başka bir sürücüde) şu klasörü oluşturun:
   ```
   C:\PostgreSQLData
   ```
2. Bu klasöre **sağ tık** → **Özellikler** → **Güvenlik**
3. **Düzenle** → **Ekle** → `NT AUTHORITY\NetworkService` yazın → **Adları Denetle** → Tamam
4. **NetworkService** için **Tam Denetim** işaretleyin → Tamam → Tamam

(Bu izni servis çalışabilsin diye şimdiden veriyoruz.)

---

## ADIM 3: initdb ile data’yı Bu Klasörde Oluşturun

**Yönetici PowerShell** açın, şu komutu çalıştırın:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "C:\PostgreSQLData" -U postgres -A trust -E UTF8 --locale=C
```

Başarılı olursa “Success. You can now start the database server...” benzeri bir mesaj görürsünüz.

---

## ADIM 4: PostgreSQL Servisini Yeni data Yoluna Yönlendirin

Servisin **-D** parametresini `C:\PostgreSQLData` olacak şekilde değiştirmeniz gerekiyor.

### Yöntem: Kayıt Defteri (Registry)

1. `Win + R` → `regedit` → Enter (Yönetici olarak açın)
2. Şu dalı açın:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\postgresql-x64-17
   ```
3. Sağdaki listede **ImagePath** değerine **çift tıklayın**
4. Şu an buna benzer bir şey görürsünüz:
   ```
   "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\Program Files\PostgreSQL\17\data"
   ```
5. İçindeki **-D** kısmını değiştirin; tam satır şöyle olsun:
   ```
   "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\PostgreSQLData"
   ```
6. **Tamam** ile kaydedin, regedit’i kapatın.

---

## ADIM 5: Servisi Başlatın

1. `Win + R` → `services.msc` → Enter
2. **postgresql-x64-17** → Sağ tık → **Başlat**

Durum **“Çalışıyor”** olmalı.

---

## ADIM 6: Bağlantı ve FizyoPark_MM_GH

Servis çalışıyorsa, **-D** artık kullanılmıyor; bağlantıda sadece **port** ve **kullanıcı** önemli. Veritabanı yolu servis ayarında.

**FizyoPark_MM_GH oluşturma:**
```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c 'CREATE DATABASE "FizyoPark_MM_GH";'
```

**Şemayı uygulama:**
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
```

---

## Kısa Özet

| Ne yaptık? |
|------------|
| 1. Servisi durdurduk |
| 2. `C:\PostgreSQLData` oluşturup NetworkService’e Tam Denetim verdik |
| 3. initdb -D "C:\PostgreSQLData" … --locale=C çalıştırdık |
| 4. Servisin ImagePath’indeki -D değerini `"C:\PostgreSQLData"` yaptık |
| 5. Servisi başlattık |
| 6. FizyoPark_MM_GH oluşturup schema.sql uyguladık |

Bundan sonra PostgreSQL verisi **C:\PostgreSQLData** altında tutulur; Program Files izin sorunu olmaz.
