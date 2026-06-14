# Tatil / Kapanış Günleri Yönetimi — Tasarım

**Tarih:** 2026-06-14
**Durum:** Onaylandı, plan aşamasına geçiliyor
**İlişkili sonraki iş:** Sub-project B (Üye Bildirim Sistemi) — bu spec'in kapsamı dışında, ayrı bir spec/plan ile ele alınacak.

## Amaç

Bayram tatili, resmi tatil veya merkez kaynaklı (su/elektrik kesintisi, tadilat vb.) kapanış günleri admin tarafından tek bir form üzerinden işaretlenebilsin. Bu işaretleme yapıldığında otomatik olarak:

1. O tarih aralığına denk gelen seanslar, mevcut "iptal → bir sonraki uygun slota kaydır" mantığı kullanılarak ileri tarihe alınır.
2. Tüm aktif (`status = 'active'`) üye paketlerinin kullanım süresi (`end_date`), kapanış gün sayısı kadar uzatılır.

Bu, üyelerin kapanış nedeniyle seans/süre kaybetmemesini sağlar ve admin'in her kapanış için manuel olarak üye üye seans kaydırması/paket uzatması yapmasını ortadan kaldırır.

## Kapsam Dışı

- Bildirim sistemi (Sub-project B — ayrı spec).
- Kapanış kaydının düzenlenmesi (sadece oluşturma ve silme desteklenir).
- Silinen kapanış kayıtlarının etkilerinin geri alınması (undo).
- Pakete bağlı olmayan (`member_package_id IS NULL`) seansların otomatik yeniden planlanması.

## Veri Modeli

Yeni migration: `backend/database/migration_closure_periods.sql`

```sql
-- Tatil/kapanış günleri: admin tarafından işaretlenen, işyerinin kapalı olduğu tarih aralıkları.
-- Çalıştırma: cd backend && npm run migrate:run -- migration_closure_periods.sql

CREATE TABLE IF NOT EXISTS closure_periods (
    id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT closure_periods_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_closure_periods_start_date ON closure_periods (start_date DESC);

COMMENT ON TABLE closure_periods IS 'Admin tarafından işaretlenen kapanış (tatil) tarih aralıkları; kayıt anında seans kaydırma ve paket süresi uzatma uygulanır.';
```

Kayıt silindiğinde etkiler geri alınmadığından, ek bir "uygulanma durumu" alanına gerek yoktur — kayıt oluşturulduğu anda etkiler senkron uygulanır ve kalıcıdır.

## Backend Mantığı — `backend/utils/closurePeriods.js`

### `applyClosurePeriod(db, { startDate, endDate, description, createdBy })`

Adımlar:

1. **Kayıt ekleme:** `closure_periods` tablosuna `(start_date, end_date, description, created_by)` eklenir, eklenen satır (id dahil) alınır.
2. **Gün sayısı hesaplama:** `dayCount = (endDate - startDate gün farkı) + 1` (kapsayıcı — örn. 22-31 Mayıs = 10 gün).
3. **Paket uzatma (önce yapılır):**
   ```sql
   UPDATE member_packages
   SET end_date = end_date + ($dayCount || ' days')::interval, updated_at = CURRENT_TIMESTAMP
   WHERE status = 'active'
   RETURNING id
   ```
   Bu adım önce yapılır; böylece adım 4'teki yeniden planlama, paketin (artık uzamış) `end_date` sınırı içinde yer bulabilir.
4. **Seans kaydırma (while-loop ile cascade desteği):**
   - `startTs = startDate 00:00:00.000` (yerel), `endTs = endDate 23:59:59.999` (yerel) hesaplanır.
   - Döngü (üst sınır **500 iterasyon**, aşılırsa `console.error` ile loglanıp döngü sonlandırılır):
     ```sql
     SELECT id, member_id, member_package_id, start_ts FROM sessions
     WHERE deleted_at IS NULL AND start_ts >= $startTs AND start_ts <= $endTs
     ORDER BY start_ts ASC LIMIT 1
     ```
     - Sonuç yoksa döngüden çık.
     - `member_package_id` **dolu** ise: `cancelPackageSessionsAtSlot(db, { memberId: member_id, startTs: start_ts, memberPackageId: member_package_id, deletedBy: createdBy })` çağrılır. Bu fonksiyon zaten seansı soft-delete edip `addNextSessionAfterLastForPackage` ile bir sonraki uygun slota yerleştiriyor (mevcut MP-03 iptal akışıyla birebir aynı davranış). Eğer yeniden yerleştirme `reason: 'no_available_slot'` veya `'package_full'` ile başarısız olursa, seans sadece iptal edilmiş kalır — ek bir hata gösterilmez (mevcut iptal akışındaki davranışla aynı).
     - `member_package_id` **null** ise: doğrudan
       ```sql
       UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $createdBy
       WHERE id = $id
       ```
       ile soft-delete edilir, yeniden planlama yapılmaz.
   - **Cascade gerekçesi:** `addNextSessionAfterLastForPackage`, iptal edilen seansın gününden sonraki ilk uygun slotu arar. Paket `end_date`'i uzatıldığı için yeni slot genelde kapanış aralığının dışına düşer; ancak nadiren (örn. çok kısa haftalık desen + uzun kapanış) yeni slot da `[startDate, endDate]` içine denk gelebilir. Bu yüzden tek seferlik tarih taraması yerine "aralıkta seans kalmayana kadar" tekrar eden bir döngü kullanılır.
5. **Özet döndürme:**
   ```js
   {
     closurePeriodId,
     dayCount,
     extendedPackageCount,   // adım 3'te uzatılan paket sayısı
     rescheduledCount,       // adım 4'te başarıyla yeniden yerleştirilen seans sayısı
     cancelledOnlyCount,     // adım 4'te sadece iptal edilen (yeniden yerleştirilemeyen veya pakete bağlı olmayan) seans sayısı
   }
   ```

### Yardımcı fonksiyonlar

- `listClosurePeriods(db)` → `SELECT * FROM closure_periods ORDER BY created_at DESC`.
- `deleteClosurePeriod(db, id)` → `DELETE FROM closure_periods WHERE id = $1 RETURNING id` (kayıt bulunamazsa `null` döner).

## API — `backend/routes/closure-periods.js`

Tüm endpoint'ler admin/manager rolü gerektirir (mevcut auth middleware ile aynı yetki kontrolü, örn. `requireRole(['admin', 'manager'])` — projede kullanılan mevcut middleware ismi plan aşamasında doğrulanacak).

- **`POST /admin/closure-periods`**
  - Body: `{ startDate: "2026-05-22", endDate: "2026-05-31", description: "Kurban Bayramı Tatili" }`
  - Doğrulama:
    - `startDate`, `endDate` geçerli `YYYY-MM-DD` formatında olmalı.
    - `startDate <= endDate` (aksi halde 400).
    - `startDate >= bugünün tarihi` — geçmiş tarihli kapanış girilemez (aksi halde 400).
    - `description` boş/whitespace olamaz (aksi halde 400).
  - Başarılı: `applyClosurePeriod` çağrılır, `{ closurePeriod, summary }` döner (201).

- **`GET /admin/closure-periods`**
  - `{ closurePeriods: [...] }` döner, `created_at DESC` sıralı.

- **`DELETE /admin/closure-periods/:id`**
  - Sadece `closure_periods` kaydını siler. Daha önce uygulanan seans kaydırmaları ve paket uzatmaları **geri alınmaz**.
  - Kayıt bulunamazsa 404.

## Admin UI

### Giriş Noktası

Mevcut **Ayarlar** modalı (`#adminHubModal`, [index.html:895-913](index.html#L895-L913)) navigasyonuna yeni satır eklenir:

```html
<button type="button" class="member-profile-nav__btn btn btn--ghost admin-hub-nav__item" data-admin-hub-section="closure-days" data-admin-hub-admin-only="1">Kapalı Günler</button>
```

### Panel

Yeni panel `data-admin-hub-panel="closure-days"`, mevcut panellerle aynı `.formGrid`/`.formRow`/`.label`/`.input` desenini kullanır:

```html
<section class="admin-hub-panel hidden" data-admin-hub-panel="closure-days" data-admin-hub-admin-only="1">
  <h2 class="member-profile-panel__title">Kapalı Günler</h2>
  <p class="hint" style="margin-top:0;">
    Bayram tatili, resmi tatil veya merkez kaynaklı kapanışlar için tarih aralığı girin.
    Bu aralıktaki seanslar otomatik olarak ileri tarihe alınır ve tüm aktif üyelerin
    paket süresi bu kadar gün uzatılır.
  </p>
  <div class="formGrid">
    <div class="formRow">
      <label class="label" for="closurePeriodStart">Tatil Başlangıç Tarihi</label>
      <input id="closurePeriodStart" class="input" type="date" />
    </div>
    <div class="formRow">
      <label class="label" for="closurePeriodEnd">Tatil Bitiş Tarihi</label>
      <input id="closurePeriodEnd" class="input" type="date" />
    </div>
    <div class="formRow formRow--full">
      <label class="label" for="closurePeriodDescription">Açıklama</label>
      <input id="closurePeriodDescription" class="input" type="text" placeholder="Örn. Kurban Bayramı Tatili" />
    </div>
  </div>
  <div id="closurePeriodError" class="error hidden"></div>
  <div id="closurePeriodSummary" class="hint hidden"></div>
  <div class="admin-hub-panel__actions">
    <button id="saveClosurePeriodBtn" class="btn btn--primary" type="button">Kaydet</button>
  </div>
  <h3 class="member-profile-panel__title" style="margin-top:20px;">Geçmiş Kayıtlar</h3>
  <div id="closurePeriodsList" class="list"></div>
</section>
```

### Davranış

- **Kaydet**: doğrulama (boş alan, `start <= end`, `start >= bugün`) frontend'de de tekrarlanır → `POST /admin/closure-periods` → başarılı olursa `closurePeriodSummary` alanında özet gösterilir, örn:
  > "10 günlük kapanış kaydedildi. 12 aktif paketin süresi 10 gün uzatıldı, 7 seans ileri tarihe alındı, 1 seans pakete bağlı olmadığı için sadece iptal edildi."
- Kayıt sonrası `closurePeriodsList` yeniden yüklenir (`GET /admin/closure-periods`).
- Liste her satırda: tarih aralığı (`22.05.2026 – 31.05.2026`), açıklama, oluşturulma tarihi, ve bir **Sil** butonu.
- **Sil** tıklanınca `confirm("Bu kapanış kaydını silmek istediğinize emin misiniz? Daha önce yapılan seans kaydırma ve paket uzatma işlemleri geri alınmaz.")` ile onay istenir; onaylanırsa `DELETE /admin/closure-periods/:id` çağrılır ve liste yenilenir.

## Doğrulama ve Kenar Durumlar

- `startDate <= endDate` — DB constraint (`closure_periods_date_check`) + backend + frontend doğrulaması.
- `startDate >= bugün` — geçmişe dönük kapanış girilemez.
- `description` boş olamaz.
- **Üst üste binen tarih aralıklarına izin verilir** — engelleme yapılmaz. Admin aynı/örtüşen günleri tekrar işaretlerse paketler tekrar uzar ve (varsa kalan) seanslar tekrar kaydırılır. Karmaşık çakışma kontrolü bu kapsamda YAGNI.
- `addNextSessionAfterLastForPackage` başarısız dönerse (`no_available_slot`, `package_full`) seans sadece iptal edilmiş kalır; bu durum `cancelledOnlyCount`'a dahil edilir ama hata olarak gösterilmez (mevcut iptal akışındaki davranışla tutarlı).
- 500 iterasyon üst sınırına ulaşılırsa (teorik olarak çok uzun kapanış + çok sık seans deseni), döngü durur ve `console.error` ile loglanır; kalan seanslar bir sonraki admin işlemi (manuel kaydırma) ile ele alınır.

## Test Planı

- **Birim testleri** (`backend/utils/closurePeriods.js`):
  - `dayCount` hesaplaması (tek gün, çok gün).
  - Tüm `status='active'` paketlerin `end_date`'inin doğru uzatıldığı, `status != 'active'` paketlerin etkilenmediği.
  - Pakete bağlı bir seansın iptal edilip yeniden yerleştirildiği (mock/gerçek DB ile).
  - Pakete bağlı olmayan bir seansın sadece iptal edildiği, yeniden yerleştirilmediği.
  - Cascade senaryosu: yeniden yerleştirilen seansın da kapanış aralığına denk geldiği durumda döngünün devam ettiği.
  - `no_available_slot` durumunda seansın sadece iptal kalması.
- **API testleri** (`backend/routes/closure-periods.js`):
  - Yetkisiz (admin/manager olmayan) erişim reddi.
  - Geçersiz tarih aralığı (`start > end`, `start < bugün`, boş açıklama) → 400.
  - Başarılı `POST` → 201 + özet alanları.
  - `GET` listesi sıralaması.
  - `DELETE` → kayıt silinir, 404 (bulunamayan id).
- **Manuel smoke test**: dev sunucusunda gerçek bir kapanış aralığı (örn. ileri tarihli 2 günlük) girilip `sessions` ve `member_packages` tablolarında beklenen değişiklikler doğrulanır, ardından test verisi geri yüklenir.
