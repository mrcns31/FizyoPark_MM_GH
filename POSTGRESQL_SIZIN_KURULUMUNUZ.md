# Sizin PostgreSQL 17 Kurulumunuza Göre Adımlar

## Kurulum Özetiniz
- **Klasör:** `C:\Program Files\PostgreSQL\17`
- **Veri klasörü:** `C:\Program Files\PostgreSQL\17\data`
- **Port:** 5432
- **Kullanıcı:** postgres
- **Servis adı:** postgresql-x64-17
- **Servis çalıştığı hesap:** NT AUTHORITY\NetworkService

---

## 1. Log’a bakın (neden durduğunu görmek için)

1. Şu klasöre gidin:
   ```
   C:\Program Files\PostgreSQL\17\data\log
   ```
2. En yeni tarihli `.log` dosyasını açın.
3. **En alttaki 5–10 satırı** okuyun; hata orada yazar.

Bu satırları (veya en azından “FATAL”, “ERROR”, “could not” geçen kısımları) bir yere kopyalayın.

---

## 2. Veri klasörüne NetworkService izni verin

Servis **NT AUTHORITY\NetworkService** hesabıyla çalışıyor. Bu hesabın `data` klasöründe tam yetkisi olmalı.

1. Bu klasöre gidin:
   ```
   C:\Program Files\PostgreSQL\17\data
   ```
2. **data** klasörüne **sağ tık** → **Özellikler** → **Güvenlik** sekmesi.
3. **Düzenle** → **Ekle**.
4. “Şu nesne türlerini seçin” kısmında **Hesap adları** seçili olsun.
5. “Seçilecek nesne adlarını girin” kutusuna tam olarak yazın:
   ```
   NT AUTHORITY\NetworkService
   ```
6. **Adları Denetle** → **Tamam**.
7. Alt listede **NetworkService** seçiliyken, **Tam Denetim** kutusunu işaretleyin (veya en azından Değiştir + Yazma).
8. **Tamam** → **Tamam**.
9. Servisi yeniden başlatın:
   - `Win + R` → `services.msc` → **postgresql-x64-17** → Sağ tık → **Başlat**.

---

## 3. Port 5432 meşgul mü kontrol edin

PowerShell’de (isterseniz Yönetici olarak):

```powershell
netstat -ano | findstr :5432
```

Çıktı varsa 5432 kullanılıyor demektir. O zaman ya:
- O programı kapatın, ya da
- PostgreSQL’i 5433’te çalıştırın:

1. Dosyayı açın:
   ```
   C:\Program Files\PostgreSQL\17\data\postgresql.conf
   ```
2. `#port = 5432` satırını bulun, şöyle yapın:
   ```
   port = 5433
   ```
3. Kaydedin, servisi tekrar başlatın.
4. Bağlanırken:
   ```bash
   psql -U postgres -p 5433 -d FizyoPark_MM_GH -f backend/database/schema.sql
   ```

---

## 4. Bağlantı ve şema komutları (sizin kurulumunuza göre)

Servis düzgün çalışıyorsa:

**Veritabanı listesi:**
```bash
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -l
```

**FizyoPark_MM_GH oluşturma:**
```bash
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c 'CREATE DATABASE "FizyoPark_MM_GH";'
```

**Şemayı uygulama (FP_MM klasöründen):**
```bash
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d FizyoPark_MM_GH -f backend/database/schema.sql
```

Şifre sorarsa kurulumda postgres kullanıcısına verdiğiniz şifreyi girin.

---

## 5. Hâlâ “başlayıp duruyorsa” – log’u paylaşın

`C:\Program Files\PostgreSQL\17\data\log\` içindeki en son .log dosyasının **en sonundaki** satırları (özellikle FATAL/ERROR geçen kısımlar) paylaşırsanız, bir sonraki adımı net söyleyebilirim.
