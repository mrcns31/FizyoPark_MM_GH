# Teşhis Sonucu – Yapılacaklar

## Sizin çıktınıza göre

| Kontrol | Sonuç |
|---------|--------|
| Servis | Sadece **postgresql-x64-17**, durdurulmuş |
| ImagePath -D | `C:\PostgreSQLData\17\data` |
| Gerçek data | **C:\PostgreSQLData** içinde PG_VERSION var (initdb orada çalışmış) |
| Port 5432 | Boş |

**Sorun:** Servis **C:\PostgreSQLData\17\data** klasörüne bakıyor; oysa geçerli PostgreSQL verisi **C:\PostgreSQLData** (alt klasörsüz) içinde. Bu yüzden servis açılamıyor.

**Çözüm:** Registry’de **-D** değerini **C:\PostgreSQLData** yapın. Eski C:\postgresql yok, çakışma yok; port da boş.

---

## Adım 1: Registry’de -D’yi düzeltin

1. `Win + R` → **regedit** → Enter (Yönetici olarak açın).
2. Şu dala gidin:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\postgresql-x64-17
   ```
3. Sağda **ImagePath**’e çift tıklayın.
4. Şu an buna benzer bir şey vardır:
   ```
   "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\PostgreSQLData\17\data" -w
   ```
5. **Sadece -D kısmını** değiştirin. Yeni tam satır:
   ```
   "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\PostgreSQLData" -w
   ```
   Yani **-D "C:\PostgreSQLData\17\data"** yerine **-D "C:\PostgreSQLData"** olacak.
6. **Tamam** → regedit’i kapatın.

---

## Adım 2: Servisi başlatın

1. `Win + R` → **services.msc** → Enter
2. **postgresql-x64-17** → Sağ tık → **Başlat**
3. Durum **“Çalışıyor”** olana kadar birkaç saniye bekleyin.

---

## Adım 3: FizyoPark veritabanını oluşturup şemayı uygulayın

**PowerShell**’de (proje klasöründeyken):

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -c 'CREATE DATABASE "FizyoPark_MM_GH";'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d FizyoPark_MM_GH -f backend/database/schema.sql
```

Veritabanı **küçük harfle** `fizyopark_mm_gh` olarak oluşmuşsa ("fizyopark_mm_gh already exists" hatası gördüyseniz), şemayı şöyle uygulayın ve backend **.env** içinde `DB_NAME=fizyopark_mm_gh` kullanın:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d fizyopark_mm_gh -f backend/database/schema.sql
```

**Notlar:**
- `-c` için **tek tırnak** (`'...'`) kullanın; çift tırnak içinde `\"` bozulur.
- **-h 127.0.0.1** ile her iki komut aynı sunucuya (IPv4) gider; bazen IPv6 (::1) yüzünden “database does not exist” hatası bu şekilde çözülür.

---

## Özet

| Ne yaptık? |
|------------|
| 1. ImagePath’te **-D "C:\PostgreSQLData\17\data"** → **-D "C:\PostgreSQLData"** yaptık (veri orada) |
| 2. postgresql-x64-17 servisini başlattık |
| 3. FizyoPark_MM_GH oluşturup schema.sql uyguladık |

C:\postgresql zaten yok; sadece **C:\PostgreSQLData** kullanılıyor, çakışma yok.

---

## Hâlâ “Çalışıyor” olmazsa

- **C:\PostgreSQLData** klasörüne **sağ tık** → **Özellikler** → **Güvenlik** → **Düzenle** → **Ekle** → `NT AUTHORITY\NetworkService` → **Tam Denetim** verin; sonra servisi tekrar başlatın.
- Olay Görüntüleyicisi’nde (**eventvwr.msc**) Windows Günlükleri → Uygulama içinde “postgres” veya “PostgreSQL” hatalarını kontrol edin; hata mesajını paylaşırsanız bir sonraki adımı söyleyebilirim.
