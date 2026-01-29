# PostgreSQL Çakışma Çözümü – Eski C:\postgresql ile

## Durum
- Daha önce **C:\postgresql** ile başka bir proje için kurulum yaptınız.
- Şu an **postgresql-x64-17** servisi çalışmıyor.
- Çakışma olabilir: birden fazla PostgreSQL servisi, aynı port veya eski data yolu.

**Önemli:** Eski **C:\postgresql** klasörüne dokunmayacağız. Bu proje (FizyoPark) için **sadece** **C:\FizyoPark_PostgreSQL** kullanacağız.

---

## Hızlı teşhis (önce bunu yapın)

**Yönetici PowerShell** açıp proje klasörüne gidin, şu komutu çalıştırın:

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
.\postgresql_teshis.ps1
```

Çıktıyı (ekran görüntüsü veya kopyala-yapıştır) kaydedin. Bu bilgilerle bir sonraki adımda tam olarak ne yapacağınızı söyleyebiliriz.

---

## Tek seferde yapılacaklar (C:\postgresql’e dokunmadan)

| Sıra | Ne yapılacak |
|------|----------------|
| 1 | **postgresql-x64-17** dışındaki PostgreSQL servislerini **başlatmayın** (C:\postgresql kullanan varsa kapalı kalsın). |
| 2 | **C:\FizyoPark_PostgreSQL** klasörünü oluşturun; NT AUTHORITY\NetworkService’e Tam Denetim verin. |
| 3 | Bu klasörde initdb çalıştırın: `-D "C:\FizyoPark_PostgreSQL"` ve `--locale=C`. |
| 4 | Registry’de **postgresql-x64-17** → ImagePath içindeki **-D** değerini **"C:\FizyoPark_PostgreSQL"** yapın. |
| 5 | Port 5432 meşgulse eski servisi durdurun veya bu kurulumu 5433’te çalıştırın. |
| 6 | **postgresql-x64-17**’yi başlatın; FizyoPark_MM_GH oluşturup schema.sql uygulayın. |

Eski **C:\postgresql**’i kullanan servisi **açmayın**; sadece **postgresql-x64-17** çalışsın.

---

## ADIM 1: Hangi PostgreSQL Servisleri Var?

1. `Win + R` → `services.msc` → Enter
2. Listeyi **isim**e göre sıralayın (PostgreSQL ile başlayanlara odaklanın)
3. Şunları not edin:
   - **postgresql-x64-17** (yeni kurduğunuz)
   - **PostgreSQL** veya **postgresql-x64-XX** (eski kurulum olabilir)
   - Her birinin **Durum**u: Çalışıyor / Durduruldu

Kaç tane PostgreSQL servisi görüyorsunuz ve isimleri tam olarak ne?

---

## ADIM 2: Her Servisin Hangi data Klasörünü Kullandığını Görün

1. `Win + R` → `regedit` → Enter (Yönetici)
2. Şu dala gidin:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services
   ```
3. Solda **postgresql** geçen tüm anahtarları bulun (postgresql-x64-17, vs.)
4. Her birinde **ImagePath** değerine bakın:
   - **-D "..."** kısmı o servisin data klasörü

Örnek:
- `-D "C:\Program Files\PostgreSQL\17\data"` → Program Files
- `-D "C:\postgresql\data"` veya `-D "C:\postgresql"` → eski proje
- `-D "C:\PostgreSQLData"` → yeni önerdiğimiz

**postgresql-x64-17** servisinin ImagePath’inde şu an **-D** ile hangi klasör yazıyor? Onu not edin.

---

## ADIM 3: FizyoPark İçin Tek ve Net Bir Klasör Kullanalım

Eski **C:\postgresql**’e dokunmayalım; bu proje için **ayrı** bir data klasörü kullanalım.

**Öneri:**  
**C:\FizyoPark_PostgreSQL**  
(Böylece C:\postgresql ile isim ve yol olarak çakışmaz.)

Yapılacaklar:
1. **C:\FizyoPark_PostgreSQL** klasörünü oluşturun
2. Sadece **postgresql-x64-17** servisini bu klasöre yönlendirin
3. Eski C:\postgresql’i kullanan servis varsa **şimdilik kapalı** kalsın veya farklı portta çalışsın

---

## ADIM 4: Sadece postgresql-x64-17’yi C:\FizyoPark_PostgreSQL’e Bağlama

### 4.1. postgresql-x64-17’nin data klasörünü değiştirme

1. **services.msc**’de **postgresql-x64-17**’nin **Durduruldu** olduğundan emin olun (sadece “Başlat” görünüyorsa zaten durmuştur).
2. **regedit** →  
   `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\postgresql-x64-17`
3. **ImagePath**’e çift tıklayın.
4. **-D** kısmını **tamamen** şununla değiştirin:
   ```
   -D "C:\FizyoPark_PostgreSQL"
   ```
   Örnek tam satır:
   ```
   "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\FizyoPark_PostgreSQL"
   ```
5. Tamam → regedit’i kapatın.

### 4.2. C:\FizyoPark_PostgreSQL’de data yoksa initdb

**C:\FizyoPark_PostgreSQL** henüz boşsa veya hiç initdb çalışmadıysa:

1. **C:\FizyoPark_PostgreSQL** klasörünü oluşturun (içi boş olsun).
2. Bu klasöre **sağ tık** → **Özellikler** → **Güvenlik** → **Düzenle** → **Ekle** → `NT AUTHORITY\NetworkService` → **Tam Denetim** verin.
3. **Yönetici PowerShell**’de:
   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "C:\FizyoPark_PostgreSQL" -U postgres -A trust -E UTF8 --locale=C
   ```

### 4.3. C:\PostgreSQLData kullandıysanız

Daha önce **C:\PostgreSQLData** ile initdb yaptıysanız ve orada “Success” gördüyseniz, iki seçenek var:

**A) Aynı klasörü kullan**  
ImagePath’te **-D "C:\PostgreSQLData"** kalsın, C:\FizyoPark_PostgreSQL yapmayın.

**B) Sıfırdan C:\FizyoPark_PostgreSQL kullan**  
- ImagePath’te **-D "C:\FizyoPark_PostgreSQL"** yapın (yukarıdaki gibi).
- **C:\FizyoPark_PostgreSQL**’de initdb’yi (4.2) çalıştırın.

---

## ADIM 5: Port 5432 Başka Bir Şey Tarafından Kullanılıyor mu?

Birden fazla PostgreSQL veya başka bir program 5432’yi kullanıyorsa servis açılamaz.

**Yönetici PowerShell**’de:
```powershell
netstat -ano | findstr :5432
```

Çıktı varsa 5432 **meşgul** demektir.

Ne yapılabilir:
- Eski C:\postgresql’i kullanan servisi **durdurun** (veya)
- PostgreSQL 17’yi **5433** portunda çalıştırın:
  1. `C:\FizyoPark_PostgreSQL\postgresql.conf` (veya data klasörünüzdeki postgresql.conf) içinde  
     `port = 5432` satırını bulun,  
     `port = 5433` yapın.
  2. Servisi başlatın.
  3. Bağlanırken hep `-p 5433` kullanın.

---

## ADIM 6: Servisi Başlatıp FizyoPark Veritabanını Oluşturma

1. **services.msc** → **postgresql-x64-17** → Sağ tık → **Başlat**.
2. Birkaç saniye bekleyin; durum **“Çalışıyor”** olsun.
3. PowerShell’de (data klasörü **C:\FizyoPark_PostgreSQL** veya **C:\PostgreSQLData** ise, port 5432):
   ```powershell
   cd D:\26-01-2026-Cursor-Takip\FP_MM
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c 'CREATE DATABASE "FizyoPark_MM_GH";'
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
   ```
   Port 5433 kullanıyorsanız komutlara **-p 5433** ekleyin.

---

## Özet – Çakışmayı Önlemek İçin

| Ne yaptık? |
|------------|
| 1. Tüm PostgreSQL servislerini ve hangi -D yolunu kullandıklarını listeledik |
| 2. Bu proje için tek bir data klasörü seçtik: **C:\FizyoPark_PostgreSQL** (veya zaten çalışan C:\PostgreSQLData) |
| 3. Sadece **postgresql-x64-17**’nin ImagePath’ini bu klasöre yönlendirdik |
| 4. Gerekirse port 5432’yi boşalttık veya 5433 kullandık |
| 5. Servisi başlattık ve FizyoPark_MM_GH + schema.sql uyguladık |

Eski **C:\postgresql**’i kullanan servisi **açmayın**; sadece **postgresql-x64-17** çalışsın. Böylece çakışma olmaz.

---

## Sizin Netleştirmeniz İçin (Bu Bilgileri Yazarsanız Devam Edebiliriz)

1. **services.msc**’de “PostgreSQL” veya “postgres” geçen **tüm** servis isimleri neler?
2. **postgresql-x64-17**’nin **ImagePath**’inde şu an **-D "..."** kısmında tam olarak ne yazıyor?
3. **C:\PostgreSQLData** veya **C:\FizyoPark_PostgreSQL** içinde `postgresql.conf` veya `PG_VERSION` var mı? (initdb orada çalışmış mı?)
4. `netstat -ano | findstr :5432` çıktısı var mı, varsa tam satır ne?

Bu dört maddeyi kısaca yazarsanız, bir sonraki adımı bire bir söyleyebilirim.
