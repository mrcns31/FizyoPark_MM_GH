# Tatil/Kapanış Günleri Yönetimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin'in bir tarih aralığını "kapalı gün" (tatil/resmi tatil/merkez kaynaklı kapanış) olarak işaretleyebilmesi; bu işlem o aralıktaki seansları otomatik ileri tarihe kaydırsın ve tüm aktif üye paketlerinin kullanım süresini aynı gün sayısı kadar uzatsın.

**Architecture:** Yeni `closure_periods` tablosu + `backend/utils/closurePeriods.js` içindeki `applyClosurePeriod` fonksiyonu (mevcut `cancelPackageSessionsAtSlot`/`addNextSessionAfterLastForPackage` iptal-ve-yeniden-yerleştirme mantığını yeniden kullanır) + `backend/routes/closure-periods.js` REST endpoint'leri + admin "Ayarlar" hub'ında yeni "Kapalı Günler" paneli (form + liste).

**Tech Stack:** Node.js/Express, PostgreSQL (pg), düz HTML/CSS/vanilla JS (index.html, app.js, api.js).

**İlgili spec:** `docs/superpowers/specs/2026-06-14-tatil-kapanis-gunleri-design.md`

---

## File Structure

- **Create:** `backend/database/migration_closure_periods.sql` — `closure_periods` tablosu.
- **Create:** `backend/utils/closurePeriods.js` — `applyClosurePeriod`, `listClosurePeriods`, `deleteClosurePeriod`.
- **Create:** `backend/scripts/test-closure-periods.js` — transaction içinde çalışıp ROLLBACK yapan doğrulama scripti.
- **Create:** `backend/routes/closure-periods.js` — `GET /`, `POST /`, `DELETE /:id` (admin/manager).
- **Modify:** `backend/server.js` — yeni route'u `/api/closure-periods` altında bağla.
- **Modify:** `api.js` — `getClosurePeriods`, `createClosurePeriod`, `deleteClosurePeriod` istemci fonksiyonları.
- **Modify:** `index.html` — Ayarlar (`#adminHubModal`) nav'ına "Kapalı Günler" girişi + yeni panel (form + liste).
- **Modify:** `app.js` — yeni element id'lerinin kaydı, panel render/kaydetme/silme mantığı, `refreshAdminHubSection` entegrasyonu.

---

### Task 1: Veritabanı migration'ı — `closure_periods` tablosu

**Files:**
- Create: `backend/database/migration_closure_periods.sql`

- [ ] **Step 1: Migration dosyasını yaz**

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

- [ ] **Step 2: Migration'ı çalıştır**

Run: `cd backend && npm run migrate:run -- migration_closure_periods.sql`
Expected: `✅ Migration tamamlandı: migration_closure_periods.sql`

- [ ] **Step 3: Tablo oluştuğunu doğrula**

Run (backend dizininde, Node ile hızlı kontrol):
```bash
node -e "import('./config/database.js').then(async ({default: db}) => { const r = await db.query(\"SELECT to_regclass('closure_periods') AS t\"); console.log(r.rows[0]); await db.pool.end(); })"
```
Expected: `{ t: 'closure_periods' }`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migration_closure_periods.sql
git commit -m "Kapanış günleri için closure_periods tablosu migration'ı ekle"
```

---

### Task 2: Backend mantığı — `backend/utils/closurePeriods.js`

**Files:**
- Create: `backend/utils/closurePeriods.js`
- Create: `backend/scripts/test-closure-periods.js`

**Bağımlılıklar (mevcut kod, sadece referans — değiştirilmeyecek):**
- `backend/utils/packageSessions.js` → `cancelPackageSessionsAtSlot(db, { memberId, startTs, memberPackageId, deletedBy })`: seansı soft-delete eder ve `addNextSessionAfterLastForPackage` ile bir sonraki uygun slota yerleştirir. Döner: `{ cancelledIds, replenished: { added, sessionId?, reason? }, memberPackageId }`.
- `backend/utils/staffWorkingHours.js` → `dayStartMs(dateStr)`, `dayEndMs(dateStr)`, `localDateStrFromTs(ts)`: `YYYY-MM-DD` ↔ ms dönüşümleri.
- `backend/utils/memberPackageDto.js` → `toDateOnlyString(val)`: PostgreSQL DATE değerini `YYYY-MM-DD` string'e çevirir (timezone kayması olmadan).

- [ ] **Step 1: `backend/utils/closurePeriods.js` dosyasını yaz**

```javascript
import { cancelPackageSessionsAtSlot } from './packageSessions.js';
import { dayStartMs, dayEndMs } from './staffWorkingHours.js';
import { toDateOnlyString } from './memberPackageDto.js';

const MAX_RESCHEDULE_ITERATIONS = 500;

/** İki YYYY-MM-DD tarihi arasındaki gün sayısı (kapsayıcı, örn. 22-31 Mayıs = 10). */
export function dayCountInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

function closurePeriodToDto(row) {
  return {
    id: row.id,
    startDate: toDateOnlyString(row.start_date),
    endDate: toDateOnlyString(row.end_date),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Kapanış dönemi kaydeder; tüm aktif paketlerin bitiş tarihini uzatır ve
 * kapanış aralığındaki seansları iptal/yeniden planlama ile ileri tarihe alır.
 * @returns {Promise<{ closurePeriod: object, summary: { dayCount: number, extendedPackageCount: number, rescheduledCount: number, cancelledOnlyCount: number } }>}
 */
export async function applyClosurePeriod(db, { startDate, endDate, description, createdBy }) {
  const inserted = await db.query(
    `INSERT INTO closure_periods (start_date, end_date, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, start_date, end_date, description, created_by, created_at`,
    [startDate, endDate, description, createdBy]
  );
  const closurePeriod = inserted.rows[0];
  const dayCount = dayCountInclusive(startDate, endDate);

  const extendRes = await db.query(
    `UPDATE member_packages SET end_date = end_date + $1::int, updated_at = CURRENT_TIMESTAMP
     WHERE status = 'active'
     RETURNING id`,
    [dayCount]
  );
  const extendedPackageCount = extendRes.rows.length;

  const rangeStart = dayStartMs(startDate);
  const rangeEnd = dayEndMs(endDate);

  let rescheduledCount = 0;
  let cancelledOnlyCount = 0;

  for (let i = 0; i < MAX_RESCHEDULE_ITERATIONS; i++) {
    const next = await db.query(
      `SELECT id, member_id, member_package_id, start_ts FROM sessions
       WHERE deleted_at IS NULL AND start_ts >= $1 AND start_ts <= $2
       ORDER BY start_ts ASC LIMIT 1`,
      [rangeStart, rangeEnd]
    );
    if (next.rows.length === 0) break;

    const row = next.rows[0];
    const startTs = Number(row.start_ts);

    if (row.member_package_id != null) {
      const result = await cancelPackageSessionsAtSlot(db, {
        memberId: row.member_id,
        startTs,
        memberPackageId: row.member_package_id,
        deletedBy: createdBy,
      });
      if (result.replenished && result.replenished.added) {
        rescheduledCount += 1;
      } else {
        cancelledOnlyCount += 1;
      }
    } else {
      await db.query(
        `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2 WHERE id = $1`,
        [row.id, createdBy]
      );
      cancelledOnlyCount += 1;
    }

    if (i === MAX_RESCHEDULE_ITERATIONS - 1) {
      console.error('applyClosurePeriod: iterasyon sınırına ulaşıldı', { closurePeriodId: closurePeriod.id });
    }
  }

  return {
    closurePeriod: closurePeriodToDto(closurePeriod),
    summary: { dayCount, extendedPackageCount, rescheduledCount, cancelledOnlyCount },
  };
}

/** Tüm kapanış dönemlerini en yeniden eskiye listeler. */
export async function listClosurePeriods(db) {
  const res = await db.query(
    `SELECT id, start_date, end_date, description, created_by, created_at
     FROM closure_periods ORDER BY created_at DESC`
  );
  return res.rows.map(closurePeriodToDto);
}

/** Kapanış kaydını siler. Daha önce uygulanan seans kaydırma/paket uzatma etkileri geri alınmaz. */
export async function deleteClosurePeriod(db, id) {
  const res = await db.query('DELETE FROM closure_periods WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}
```

- [ ] **Step 2: `backend/scripts/test-closure-periods.js` doğrulama scriptini yaz**

Bu script gerçek dev veritabanına bağlanır, bir transaction (`BEGIN`) açar, `applyClosurePeriod`'u çağırır, sonuçları kontrol eder ve **`ROLLBACK`** yaparak veritabanını değiştirmeden bırakır.

```javascript
/**
 * applyClosurePeriod için transaction içinde çalışan doğrulama scripti.
 * Veritabanını DEĞİŞTİRMEZ (ROLLBACK ile biter).
 * Kullanım: cd backend && node scripts/test-closure-periods.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { applyClosurePeriod, dayCountInclusive } from '../utils/closurePeriods.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const client = await db.pool.connect();
  let failed = false;
  try {
    await client.query('BEGIN');

    // 30 gün sonrasından başlayan 2 günlük bir kapanış aralığı seç (gerçek verilerle çakışma riskini azaltmak için ileri tarih).
    const startDate = addDaysToDateStr(new Date().toISOString().slice(0, 10), 30);
    const endDate = addDaysToDateStr(startDate, 1);
    const dayCount = dayCountInclusive(startDate, endDate);
    console.log(`Test aralığı: ${startDate} -> ${endDate} (dayCount=${dayCount})`);

    const before = await client.query(
      `SELECT id, end_date FROM member_packages WHERE status = 'active' ORDER BY id`
    );
    console.log(`Aktif paket sayısı: ${before.rows.length}`);

    const result = await applyClosurePeriod(client, {
      startDate,
      endDate,
      description: 'Test kapanışı (otomatik doğrulama)',
      createdBy: null,
    });
    console.log('applyClosurePeriod sonucu:', JSON.stringify(result, null, 2));

    if (result.summary.dayCount !== dayCount) {
      console.error(`HATA: dayCount beklenen ${dayCount}, dönen ${result.summary.dayCount}`);
      failed = true;
    }
    if (result.summary.extendedPackageCount !== before.rows.length) {
      console.error(`HATA: extendedPackageCount beklenen ${before.rows.length}, dönen ${result.summary.extendedPackageCount}`);
      failed = true;
    }

    const after = await client.query(
      `SELECT id, end_date FROM member_packages WHERE id = ANY($1::int[]) ORDER BY id`,
      [before.rows.map((r) => r.id)]
    );
    for (let i = 0; i < before.rows.length; i++) {
      const beforeEnd = new Date(before.rows[i].end_date).getTime();
      const afterEnd = new Date(after.rows[i].end_date).getTime();
      const diffDays = Math.round((afterEnd - beforeEnd) / 86400000);
      if (diffDays !== dayCount) {
        console.error(`HATA: paket ${before.rows[i].id} end_date ${diffDays} gün arttı, beklenen ${dayCount}`);
        failed = true;
      }
    }

    const remaining = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM sessions
       WHERE deleted_at IS NULL AND start_ts >= $1 AND start_ts <= $2`,
      [
        new Date(`${startDate}T00:00:00`).getTime(),
        new Date(`${endDate}T23:59:59.999`).getTime(),
      ]
    );
    if (remaining.rows[0].cnt !== 0) {
      console.error(`HATA: kapanış aralığında ${remaining.rows[0].cnt} silinmemiş seans kaldı`);
      failed = true;
    }

    await client.query('ROLLBACK');
    console.log('ROLLBACK yapıldı, veritabanı değişmedi.');

    if (failed) {
      console.error('❌ Doğrulama başarısız.');
      process.exitCode = 1;
    } else {
      console.log('✅ Doğrulama başarılı.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Script hatası:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

run();
```

- [ ] **Step 3: Scripti çalıştır ve doğrula**

Run: `cd backend && node scripts/test-closure-periods.js`
Expected: Sonuçta `✅ Doğrulama başarılı.` ve `ROLLBACK yapıldı, veritabanı değişmedi.` satırları. `HATA:` ile başlayan satır olmamalı.

(Not: Eğer ortamda hiç `status='active'` paket yoksa `extendedPackageCount` 0 olur ve karşılaştırmalar 0===0 ile geçer — script bu durumda da `✅` döner.)

- [ ] **Step 4: Commit**

```bash
git add backend/utils/closurePeriods.js backend/scripts/test-closure-periods.js
git commit -m "Kapanış dönemi uygulama mantığını ekle (applyClosurePeriod + doğrulama scripti)"
```

---

### Task 3: API endpoint'leri — `backend/routes/closure-periods.js`

**Files:**
- Create: `backend/routes/closure-periods.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Route dosyasını yaz**

```javascript
import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { applyClosurePeriod, listClosurePeriods, deleteClosurePeriod } from '../utils/closurePeriods.js';
import { localDateStrFromTs } from '../utils/staffWorkingHours.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
}

// Admin: kapanış dönemleri listesi
router.get('/', requireAdmin, async (req, res) => {
  try {
    const closurePeriods = await listClosurePeriods(db);
    res.json({ closurePeriods });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Kapanış günleri henüz etkin değil. migration_closure_periods.sql çalıştırın.' });
    }
    console.error('Closure periods list error:', error);
    res.status(500).json({ error: 'Kapanış günleri listelenirken hata oluştu' });
  }
});

// Admin: yeni kapanış dönemi kaydet ve etkilerini uygula
router.post('/', requireAdmin, [
  body('startDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('endDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('description').isString().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { startDate, endDate } = req.body;
    const description = req.body.description.trim();

    if (endDate < startDate) {
      return res.status(400).json({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz' });
    }
    const todayStr = localDateStrFromTs(Date.now());
    if (startDate < todayStr) {
      return res.status(400).json({ error: 'Geçmiş tarihli kapanış girilemez' });
    }

    const result = await applyClosurePeriod(db, {
      startDate,
      endDate,
      description,
      createdBy: req.user.userId,
    });

    await activityLog(req, {
      action: 'closure_period.create',
      entityType: 'closure_period',
      entityId: result.closurePeriod.id,
      details: { startDate, endDate, description, summary: result.summary },
    }).catch(() => {});

    res.status(201).json(result);
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Kapanış günleri henüz etkin değil. migration_closure_periods.sql çalıştırın.' });
    }
    console.error('Closure period create error:', error);
    res.status(500).json({ error: 'Kapanış günü kaydedilirken hata oluştu' });
  }
});

// Admin: kapanış kaydını sil (etkiler geri alınmaz)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteClosurePeriod(db, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Kapanış kaydı bulunamadı' });
    }
    await activityLog(req, {
      action: 'closure_period.delete',
      entityType: 'closure_period',
      entityId: deleted.id,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    console.error('Closure period delete error:', error);
    res.status(500).json({ error: 'Kapanış kaydı silinirken hata oluştu' });
  }
});

export default router;
```

- [ ] **Step 2: `backend/server.js`'e route'u bağla**

`backend/server.js` içinde diğer route import'larının yanına ekle (örn. `packageRequestsRoutes` import satırının altına):

```javascript
import closurePeriodsRoutes from './routes/closure-periods.js';
```

Ve `app.use('/api/package-requests', packageRequestsRoutes);` satırının altına ekle:

```javascript
app.use('/api/closure-periods', closurePeriodsRoutes);
```

- [ ] **Step 3: `node --check` ile sözdizimi kontrolü**

Run: `cd backend && node --check routes/closure-periods.js && node --check server.js`
Expected: Hata çıkmaması (sessiz çıkış).

- [ ] **Step 4: Dev sunucusunu başlat ve curl ile doğrula**

Dev sunucusu çalışmıyorsa: `cd backend && npm run dev` (arka planda).

Admin token al (varsayılan dev admin: `admin@local` / `admin123` — farklıysa mevcut admin hesabınızı kullanın):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@local","password":"admin123"}' | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).token))")
```

Boş liste kontrolü:
```bash
curl -s http://localhost:3000/api/closure-periods -H "Authorization: Bearer $TOKEN"
```
Expected: `{"closurePeriods":[]}` (veya önceden eklenmiş kayıtlar varsa onların listesi).

Geçmiş tarih reddi:
```bash
curl -s -X POST http://localhost:3000/api/closure-periods -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"startDate":"2020-01-01","endDate":"2020-01-02","description":"Test"}'
```
Expected: `{"error":"Geçmiş tarihli kapanış girilemez"}` (HTTP 400)

Geçerli (ileri tarihli, kısa) bir kapanış oluştur — **bu kayıt KALICI olarak veritabanına eklenir**, test sonrası `DELETE` ile kaydı silin (etkiler geri alınmaz, bu yüzden çok ileri ve kısa bir aralık seçin, örn. 60 gün sonrası, 1 gün):
```bash
curl -s -X POST http://localhost:3000/api/closure-periods -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"startDate":"2026-08-13","endDate":"2026-08-13","description":"Test Kapanışı"}'
```
Expected: HTTP 201, `{"closurePeriod": {...}, "summary": {"dayCount":1, ...}}`

Listeyi tekrar kontrol et (yeni kayıt görünmeli), sonra dönen `closurePeriod.id` ile sil:
```bash
curl -s -X DELETE http://localhost:3000/api/closure-periods/<ID> -H "Authorization: Bearer $TOKEN"
```
Expected: `{"ok":true}`

- [ ] **Step 5: Commit**

```bash
git add backend/routes/closure-periods.js backend/server.js
git commit -m "Kapanış günleri için REST endpoint'lerini ekle"
```

---

### Task 4: Frontend API istemcisi — `api.js`

**Files:**
- Modify: `api.js`

- [ ] **Step 1: `getPackageRequests` fonksiyonunun yakınına yeni fonksiyonları ekle**

`async function getPackageRequests(status) {...}` fonksiyonundan önce veya sonra ekle:

```javascript
  async function getClosurePeriods() {
    return apiFetch('/closure-periods');
  }

  async function createClosurePeriod(body) {
    return apiFetch('/closure-periods', { method: 'POST', body: JSON.stringify(body) });
  }

  async function deleteClosurePeriod(id) {
    return apiFetch('/closure-periods/' + id, { method: 'DELETE' });
  }
```

- [ ] **Step 2: `window.API` nesnesine ekle**

`window.API = { ... }` içinde `getPackageRequests,` satırının yanına ekle:

```javascript
    getClosurePeriods,
    createClosurePeriod,
    deleteClosurePeriod,
```

- [ ] **Step 3: Sözdizimi kontrolü**

Run: `node --check api.js`
Expected: Hata çıkmaması.

- [ ] **Step 4: Commit**

```bash
git add api.js
git commit -m "Kapanış günleri için API istemci fonksiyonlarını ekle"
```

---

### Task 5: Admin UI — `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Ayarlar hub navigasyonuna "Kapalı Günler" ekle**

[index.html:906](index.html#L906) — "Personel Listesi" satırının altına ekle:

```html
                <button type="button" class="member-profile-nav__btn btn btn--ghost admin-hub-nav__item" data-admin-hub-section="staff-list" data-admin-hub-admin-only="1">Personel Listesi</button>
                <button type="button" class="member-profile-nav__btn btn btn--ghost admin-hub-nav__item" data-admin-hub-section="closure-days" data-admin-hub-admin-only="1">Kapalı Günler</button>
```

(İlk satır mevcut, sadece referans — yeni satırı onun altına ekleyin.)

- [ ] **Step 2: Yeni paneli ekle**

[index.html:992-998](index.html#L992-L998) — `staff-list` panelinin `</section>` kapanışından (satır 998) sonra, `dev-reset` panelinden (satır 999) önce ekle:

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

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Ayarlar hub'ına Kapalı Günler panelini ekle"
```

---

### Task 6: Admin UI mantığı — `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Yeni element id'lerini kayıt listesine ekle**

[app.js:1360](app.js#L1360) civarında, `"adminHubDevResetNav",` satırının yanına (els kayıt dizisine) ekle:

```javascript
    "closurePeriodStart",
    "closurePeriodEnd",
    "closurePeriodDescription",
    "closurePeriodError",
    "closurePeriodSummary",
    "saveClosurePeriodBtn",
    "closurePeriodsList",
```

- [ ] **Step 2: Tarih formatlama yardımcı fonksiyonunu ekle**

`escapeHtml` fonksiyonunun yakınına ([app.js:3965](app.js#L3965) civarı) ekle:

```javascript
function formatDateTR(dateStr) {
  if (!dateStr) return "";
  var parts = String(dateStr).slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  return parts[2] + "." + parts[1] + "." + parts[0];
}
```

- [ ] **Step 3: Panel render/hazırlama/kaydetme/silme fonksiyonlarını ekle**

`prepareRoomsPanel` fonksiyonunun yakınına ([app.js:4054](app.js#L4054) civarı) ekle:

```javascript
function renderClosurePeriods(list) {
  var wrap = els.closurePeriodsList;
  if (!wrap) return;
  wrap.innerHTML = "";
  (list || []).forEach(function (cp) {
    var item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML =
      '<div class="listItem__left">' +
        '<div class="listItem__title">' + escapeHtml(formatDateTR(cp.startDate)) + ' – ' + escapeHtml(formatDateTR(cp.endDate)) + '</div>' +
        '<div class="listItem__meta">' + escapeHtml(cp.description) + '</div>' +
      '</div>' +
      '<div class="listItem__actions">' +
        '<button class="btn btn--xs btn--ghost" type="button">Sil</button>' +
      '</div>';
    item.querySelector("button").addEventListener("click", function () {
      deleteClosurePeriodRow(cp.id);
    });
    wrap.appendChild(item);
  });
}

async function loadClosurePeriods() {
  if (!window.API) return;
  try {
    var result = await window.API.getClosurePeriods();
    renderClosurePeriods(result.closurePeriods || []);
  } catch (e) {
    if (els.closurePeriodError) {
      els.closurePeriodError.textContent = (e.data && e.data.error) || e.message || "Liste yüklenemedi.";
      els.closurePeriodError.classList.remove("hidden");
    }
  }
}

function prepareClosureDaysPanel() {
  if (els.closurePeriodError) els.closurePeriodError.classList.add("hidden");
  if (els.closurePeriodSummary) els.closurePeriodSummary.classList.add("hidden");
  if (els.closurePeriodStart) els.closurePeriodStart.value = "";
  if (els.closurePeriodEnd) els.closurePeriodEnd.value = "";
  if (els.closurePeriodDescription) els.closurePeriodDescription.value = "";
  loadClosurePeriods();
}

async function saveClosurePeriod() {
  if (!els.closurePeriodError) return;
  els.closurePeriodError.classList.add("hidden");
  if (els.closurePeriodSummary) els.closurePeriodSummary.classList.add("hidden");

  var startDate = (els.closurePeriodStart.value || "").trim();
  var endDate = (els.closurePeriodEnd.value || "").trim();
  var description = (els.closurePeriodDescription.value || "").trim();
  var todayStr = new Date().toISOString().slice(0, 10);

  if (!startDate || !endDate || !description) {
    els.closurePeriodError.textContent = "Tüm alanları doldurun.";
    els.closurePeriodError.classList.remove("hidden");
    return;
  }
  if (endDate < startDate) {
    els.closurePeriodError.textContent = "Bitiş tarihi başlangıç tarihinden önce olamaz.";
    els.closurePeriodError.classList.remove("hidden");
    return;
  }
  if (startDate < todayStr) {
    els.closurePeriodError.textContent = "Geçmiş tarihli kapanış girilemez.";
    els.closurePeriodError.classList.remove("hidden");
    return;
  }

  if (!window.API) return;
  try {
    var result = await window.API.createClosurePeriod({ startDate: startDate, endDate: endDate, description: description });
    var s = result.summary || {};
    if (els.closurePeriodSummary) {
      els.closurePeriodSummary.textContent =
        s.dayCount + " günlük kapanış kaydedildi. " +
        s.extendedPackageCount + " aktif paketin süresi " + s.dayCount + " gün uzatıldı, " +
        s.rescheduledCount + " seans ileri tarihe alındı" +
        (s.cancelledOnlyCount > 0 ? ", " + s.cancelledOnlyCount + " seans yeniden planlanamadığı için sadece iptal edildi." : ".");
      els.closurePeriodSummary.classList.remove("hidden");
    }
    els.closurePeriodStart.value = "";
    els.closurePeriodEnd.value = "";
    els.closurePeriodDescription.value = "";
    loadClosurePeriods();
  } catch (e) {
    els.closurePeriodError.textContent = (e.data && e.data.error) || e.message || "Kapanış kaydedilemedi.";
    els.closurePeriodError.classList.remove("hidden");
  }
}

async function deleteClosurePeriodRow(id) {
  if (!(await showAppConfirm("Bu kapanış kaydını silmek istediğinize emin misiniz? Daha önce yapılan seans kaydırma ve paket uzatma işlemleri geri alınmaz."))) return;
  if (!window.API) return;
  try {
    await window.API.deleteClosurePeriod(id);
    loadClosurePeriods();
  } catch (e) {
    if (els.closurePeriodError) {
      els.closurePeriodError.textContent = (e.data && e.data.error) || e.message || "Kayıt silinemedi.";
      els.closurePeriodError.classList.remove("hidden");
    }
  }
}
```

- [ ] **Step 4: `refreshAdminHubSection`'a yeni bölümü ekle**

[app.js:6456-6464](app.js#L6456-L6464):

```javascript
function refreshAdminHubSection(section) {
  if (section === "working-hours") prepareWorkingHoursPanel();
  else if (section === "rooms") prepareRoomsPanel();
  else if (section === "packages") preparePackagesPanel();
  else if (section === "staff-list") prepareStaffListPanel();
  else if (section === "closure-days") prepareClosureDaysPanel();
  else if (section === "dev-reset") prepareDevResetPanel();
  else if (section === "dev-seed") prepareDevSeedPanel();
  else if (section === "profile") fillAdminProfileModal();
}
```

(Sadece `else if (section === "closure-days") prepareClosureDaysPanel();` satırını ekleyin, diğerleri mevcut.)

- [ ] **Step 5: Kaydet butonunu bağla**

[app.js:10920](app.js#L10920) civarındaki `els.addRoomBtn.addEventListener(...)` bloğunun yakınına ekle:

```javascript
  if (els.saveClosurePeriodBtn) {
    els.saveClosurePeriodBtn.addEventListener("click", saveClosurePeriod);
  }
```

- [ ] **Step 6: Sözdizimi kontrolü**

Run: `node --check app.js`
Expected: Hata çıkmaması.

- [ ] **Step 7: Manuel test (tarayıcıda)**

1. Dev sunucusunu başlatın (`cd backend && npm run dev`) ve frontend'i tarayıcıda açın.
2. Admin olarak giriş yapın, **Ayarlar → Kapalı Günler** sekmesine gidin.
3. Boş alanla "Kaydet" → "Tüm alanları doldurun." hatası görünmeli.
4. Geçmiş bir tarih girip "Kaydet" → "Geçmiş tarihli kapanış girilemez." hatası görünmeli.
5. İleri tarihli (örn. 60+ gün sonrası), 1 günlük bir aralık + açıklama girip "Kaydet" → özet mesajı görünmeli, liste güncellenmeli.
6. Listede yeni satırın **Sil** butonuna tıklayın → onay penceresi çıkmalı; onaylayınca satır listeden kaybolmalı.
7. (Opsiyonel ek doğrulama) Adım 5'te oluşturulan kapanışın etkilerini kontrol etmek isterseniz, kapanış tarihine denk gelen bir üyenin paket `end_date`'inin uzadığını admin panelinden kontrol edin. Bu etkiler kayıt silinse de geri alınmaz — gerekirse test verisini manuel olarak eski haline getirin.

- [ ] **Step 8: Commit**

```bash
git add app.js
git commit -m "Kapalı Günler panelinin frontend mantığını ekle"
```

---

## Self-Review Notlari

- **Spec kapsaması:** Veri modeli (Task 1), backend mantığı + cascade (Task 2), API + doğrulama/kenar durumlar (Task 3), admin UI giriş noktası ve form (Task 5-6), liste + silme + onay (Task 6) — spec'in tüm bölümleri karşılanıyor.
- **Yer tutucu taraması:** Yok — her adımda tam kod var.
- **Tip/isim tutarlılığı:** `applyClosurePeriod`/`listClosurePeriods`/`deleteClosurePeriod` (Task 2) isimleri Task 3 route'unda ve Task 4 `api.js` fonksiyonlarında (`getClosurePeriods`/`createClosurePeriod`/`deleteClosurePeriod`) aynı şekilde kullanılıyor; `summary` alanları (`dayCount`, `extendedPackageCount`, `rescheduledCount`, `cancelledOnlyCount`) Task 2, Task 3 ve Task 6'da aynı isimlerle eşleşiyor.
