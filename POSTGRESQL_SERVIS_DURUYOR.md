# PostgreSQL "Başladı ve Durdu" Hatası - Çözüm

## Hata
> Yerel Bilgisayar üzerindeki postgresql-x64-17 hizmeti başladı ve durdu. Bazı hizmetler başka hizmetler veya programlar tarafından kullanılmıyorsa, otomatik olarak durabilir.

**Anlamı:** PostgreSQL servisi başlıyor ama hemen kapanıyor. Genelde port, veri klasörü veya ayar dosyası kaynaklıdır.

---

## ADIM 1: Log Dosyasına Bakın (En Önemli)

PostgreSQL neden durduğunu log'a yazar.

1. Şu klasöre gidin:
   ```
   C:\Program Files\PostgreSQL\17\data\log\
   ```
2. En **yeni** tarihli `.log` dosyasını açın (Not Defteri ile).
3. **En alttaki satırlara** bakın – hata mesajı orada olur.

**Sık görülen mesajlar:**

| Log’da yazan | Anlamı | Yapılacak |
|--------------|--------|-----------|
| `port 5432 already in use` | 5432 portu başka programda | ADIM 2 |
| `could not create lock file` | Veri klasörü izin/kilidi | ADIM 3 |
| `data directory` / `permission` | Klasör izin hatası | ADIM 3 |
| `FATAL: database files are incompatible` | Sürüm/veri uyumsuzluğu | ADIM 4 |

Log’da gördüğünüz **tam hata cümlesini** not edin.

---

## ADIM 2: Port 5432 Meşgul mü Kontrol Edin

Başka bir program 5432 kullanıyorsa PostgreSQL açılamaz.

**PowerShell’de (Yönetici olarak):**
```powershell
netstat -ano | findstr :5432
```

Çıktı varsa 5432 dolu demektir.

**Ne yapabilirsiniz:**

**A) 5432’yi kullanan programı kapatın**
- Örn. başka bir PostgreSQL, bazı Docker konteynerleri, bazı araçlar
- Görev Yöneticisi’nde (Ctrl+Shift+Esc) ilgili programı kapatmayı deneyin

**B) PostgreSQL’i farklı portta çalıştırın (örn. 5433)**
1. Şu dosyayı düzenleyin:
   ```
   C:\Program Files\PostgreSQL\17\data\postgresql.conf
   ```
2. Şu satırı bulun:
   ```
   #port = 5432
   ```
3. Şöyle yapın:
   ```
   port = 5433
   ```
4. Dosyayı kaydedin.
5. Servisi tekrar başlatın: `services.msc` → PostgreSQL → Başlat.

Sonra bağlanırken portu belirtin:
```bash
psql -U postgres -p 5433 -d FizyoPark_MM_GH -f backend/database/schema.sql
```

---

## ADIM 3: Veri Klasörü İzinlerini Kontrol Edin

Servis, `data` klasörüne yazamıyorsa durur.

1. Şu klasöre gidin:
   ```
   C:\Program Files\PostgreSQL\17\data
   ```
2. Klasöre **sağ tık** → **Özellikler** → **Güvenlik** sekmesi.
3. **Düzenle** → **Ekle** → kullanıcı adı olarak `Everyone` veya `NT AUTHORITY\NETWORK SERVICE` yazın → **Adları Denetle** → Tamam.
4. **Tam Denetim** (ve en azından “Değiştir”) verin → Tamam.

Alternatif: `C:\Program Files\PostgreSQL\17\data` klasörüne sağ tık → Özellikler → Güvenlik → **Gelişmiş** → “Üst nesneden izinleri devral” açık olsun.

Sonra servisi yeniden başlatın.

---

## ADIM 4: Veri Klasörü Bozuk / Uyumsuzsa – Temiz Kurulum

Log’da veri dosyaları veya sürüm uyumsuzluğu geçiyorsa, sıfırdan data oluşturmak gerekir.

**Dikkat:** Mevcut `data` içindeki tüm veritabanları silinir.

1. **Servisi durdurun**
   - `services.msc` → postgresql-x64-17 → Durdur.

2. **Eski data’yı yedekleyip yeniden adlandırın**
   - Klasör: `C:\Program Files\PostgreSQL\17\data`
   - Bu klasörü örn. `data_eski` olarak yeniden adlandırın (silmeden yedek).

3. **Yeni data oluşturun**
   - **Yönetici** CMD veya PowerShell açın.
   - Çalıştırın:
   ```bat
   "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D "C:\Program Files\PostgreSQL\17\data"
   ```

4. **Servisi başlatın**
   - `services.msc` → postgresql-x64-17 → Başlat.

5. **Varsayılan şifreyi ayarlayın**
   - İlk kez:
   ```bash
   psql -U postgres -c "ALTER USER postgres PASSWORD 'yeni_sifre';"
   ```
   Sonra normalde `FizyoPark_MM_GH` oluşturup şemayı uygularsınız.

---

## ADIM 5: Servis “Başlangıç Türü”nü Kontrol Edin

Bazen “Otomatik” yerine “El ile” daha az sorun çıkarır.

1. `Win + R` → `services.msc` → Enter.
2. **postgresql-x64-17** → sağ tık → Özellikler.
3. **Başlangıç türü:** “El ile” seçin.
4. Tamam.
5. Sonra servisi elle **Başlat** ile çalıştırın.

---

## Özet Kontrol Listesi

1. **Log:** `C:\Program Files\PostgreSQL\17\data\log\` içindeki en son .log → en alttaki hata.
2. **Port:** `netstat -ano | findstr :5432` → 5432 boş mu?
3. **İzin:** `...\PostgreSQL\17\data` klasöründe servis kullanıcısının yazma izni var mı?
4. **Gerekirse:** Data’yı yedekleyip `initdb` ile sıfırdan kur.

Log’da gördüğünüz **tam hata mesajını** paylaşırsanız, bir sonraki adımı net söyleyebilirim.
