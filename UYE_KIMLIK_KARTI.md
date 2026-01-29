# Üye Kimlik Kartı

Üyeler için kimlik kartı alanları ve kullanımı.

## Zorunlu alanlar (*)

- **Üye Numarası** – Benzersiz üye kodu (örn. U001)
- **Ad / Soyad**
- **Telefon** – Kişiye özel; sistemde aynı numara iki üyede olamaz

## İsteğe bağlı alanlar

- E-Posta  
- Doğum Tarihi / Mesleği  
- Adresi  
- Yakını Adı Soyadı  
- Yakını Telefon  
- Sistematik Hastalıklar (Kalp, Tansiyon, Şeker vb.)  
- Klinik Rahatsızlıklar (Fıtık, Kireçlenme vb.)  
- Varsa Geçirdiği Operasyonlar  

## Veritabanı migration (bir kez)

Kimlik kartı alanlarının veritabanında olması için migration çalıştırılmalı:

```powershell
cd D:\26-01-2026-Cursor-Takip\FP_MM
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -d fizyopark_mm_gh -f backend/database/migration_members_kimlik.sql
```

Mevcut üyelerde **Ad/Soyad** `name` alanından, **Üye Numarası** `U`+id ile otomatik doldurulur.

## Arayüzde kullanım

1. **Üye Ekle** – Yeni üye için tüm kimlik alanlarını doldurup kaydedin.
2. Listede bir üyenin yanındaki **Kimlik Kartı** – O üyenin tüm bilgilerini görüntüleyip düzenleyin.
3. **Sil** – Üyeyi listeden ve veritabanından siler (ilgili seanslar boşalır).

Telefon numarası başka bir üyede kayıtlıysa kayıt/güncelleme yapılamaz; “Bu telefon numarası başka bir üyede kayıtlı” uyarısı çıkar.
