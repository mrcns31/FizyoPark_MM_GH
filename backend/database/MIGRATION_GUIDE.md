# Üye Migration Rehberi

## Sabitler

```javascript
const STAFF_MAP = new Map([
  [5436,1],[3,2],[14879,3],[15982,4],[5478,5],
  [7,6],[24,7],[26,8],[30,9],[32,10],[1055,11],
  [1133,12],[1134,13],[1201,14],[1222,15],[1223,16],
  [1291,17],[3395,18],[3396,19],[5431,20],[5470,21],
  [5476,22],[5477,23],
]);

const PAKET_MAP = new Map([
  [1,1],[2,2],[3,3],[4,4],[5,5],[24,6],
  [9,7],[10,8],[11,9],[14,10],[15,11],[20,12],
]);

const TZ = 3 * 60 * 60 * 1000;           // MSSQL saatler UTC+3 kaydedilmiş
const SESSION_DURATION_MS = 60 * 60 * 1000;
const TODAY = new Date("2026-06-17");
```

## Adım Adım Süreç

### 1. Eski DB'de üyeyi bul
```sql
SELECT AdiSoyadi, KullaniciId, Telefonu, Silindi, Tipi
FROM view_KG_KullaniciListesi
WHERE AdiSoyadi LIKE N'%Ad Soyad%' AND Tipi=1
```

### 2. Duplicate kontrolü
- Aynı ad/telefon ile birden fazla KullaniciId varsa → merge gerekli
- **Canonical ID seçimi:** En fazla seansı olan (SilindiMi=0), eşitse en yüksek KullaniciId

```sql
SELECT KullaniciId, COUNT(*) as cnt
FROM KG_UyeTerapistDagilim
WHERE KullaniciId IN (...) AND SilindiMi=0
GROUP BY KullaniciId ORDER BY cnt DESC
```

### 3. Yeni PaketId kontrolü
```sql
SELECT DISTINCT PaketId FROM KG_UyePaket WHERE KullaniciId IN (...)
```
- PAKET_MAP'te yoksa → `KG_Paketler`'den alıp PostgreSQL `packages` tablosuna ekle
- PaketTipi=1 → 'fixed', PaketTipi=2 → 'flexible'
- Kolon adları: `package_type`, `lesson_count`, `month_overrun`

### 4. Kişisel bilgileri al (canonical ID'den)
```sql
SELECT o.Ad, o.Soyad, d.Telefonu, o.EPosta, d.DogumTarihi, d.Meslegi, o.Silindi
FROM KG_KullaniciDiger d
JOIN ORT_Kullanici o ON o.Id = d.OrtKullaniciId
WHERE d.Id = <canonicalId>
```
- `o.Silindi = true` ise → `deleted_at = CURRENT_TIMESTAMP` (eski üye)
- `o.Silindi = false` ise → `deleted_at = NULL` (aktif üye)

### 5. PostgreSQL'e üye ekle
```sql
INSERT INTO members (name, first_name, last_name, email, phone, birth_date, profession, deleted_at)
VALUES (...)
```
- Phone: başındaki 0 düşür (`05...` → `5...`)
- `UPDATE members SET member_no='U'||id WHERE id=...`

### 6. Kartları ekle (tüm KullaniciId'lerden)
```sql
SELECT DISTINCT KartNo FROM KG_KapiGecis
WHERE KullaniciId IN (...) AND KartNo <> 'Manuel'
```
```sql
INSERT INTO member_cards (member_id, card_no, is_primary) VALUES (...)
ON CONFLICT (card_no) DO NOTHING
```

### 7. Paketleri ekle (tüm KullaniciId'lerden)
```sql
SELECT Id as UyePaketId, PaketId, BaslamaTarihi, BitisTarihi
FROM KG_UyePaket WHERE KullaniciId IN (...)
ORDER BY BaslamaTarihi, Id
```
- BitisTarihi < BaslamaTarihi ise → BitisTarihi = BaslamaTarihi (bozuk veri fix)
- BitisTarihi > TODAY → status='active', değilse → status='completed'

### 8. Seansları ekle (SilindiMi=0, tüm KullaniciId'lerden)
```sql
SELECT Id, Tarih, TerapistId, UyePaketId
FROM KG_UyeTerapistDagilim
WHERE KullaniciId IN (...) AND SilindiMi=0
ORDER BY Tarih
```
```javascript
const startTs = new Date(row.Tarih).getTime() - TZ;  // TZ offset!
INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts)
```
- TerapistId STAFF_MAP'te yoksa → staff_id = NULL

### 9. Giriş saatlerini güncelle (KG_KapiGecis)
```sql
SELECT DusulenDagilimId, Tarih as GT, KartNo FROM KG_KapiGecis
WHERE DusulenDagilimId IN (<eski session id listesi>)
```
```javascript
const checkedInAt = new Date(new Date(row.GT).getTime() - TZ);
const method = row.KartNo === "Manuel" ? "admin" : "card";
UPDATE sessions SET checked_in_at=$1, check_in_method=$2, attendance_outcome='present' WHERE id=$3
```

### 10. Duplicate seans temizliği
Her taşıma sonrası çalıştır:
```sql
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY member_id, start_ts
      ORDER BY CASE WHEN checked_in_at IS NOT NULL THEN 0 ELSE 1 END, id ASC
    ) AS rn
  FROM sessions WHERE deleted_at IS NULL
)
DELETE FROM sessions WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
```

### 11. Eski DB'den sil (kontrol ve onay sonrası)
Yeni DB'ye taşınan veriler test edilip onaylandıktan sonra ayrıca yapılır.
Hazır script: `backend/database/mark_deleted_members.cjs`

## Hazır Script: import_members.cjs

`backend/database/import_members.cjs` — toplu import için kullanılır.
`MEMBER_GROUPS` dizisine `{ allIds: [...], canonicalId: X }` ekleyip çalıştır.

## Dikkat Edilecekler

- Aynı kart numarası farklı KullaniciId'lerde olabilir → `ON CONFLICT DO NOTHING`
- BitisTarihi < BaslamaTarihi → BitisTarihi = BaslamaTarihi
- MSSQL tüm tarihleri UTC+3 (Türkiye saati) olarak kaydeder → `-TZ` gerekli
- Phone unique constraint: çakışma varsa NULL bırak
- member_id=NULL olan seanslar hayalet → temizle
- Duplicate seans kontrolü her toplu import sonrası yapılmalı
