# Otomatik Oda Dengeleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No automated tests:** This project does not use automated test files for this change. Each task ends with a "Manuel test" step describing exactly what to do in the running app / via psql to verify behavior. Do not create test files.

**Goal:** Replace the greedy, non-rebalancing room assignment (`validateAndPickRoom`) with a smart assignment that can rearrange other staff's room placements in the same time slot, so that aggregate room capacity is used optimally. All-or-nothing: if total demand exceeds total capacity at a slot, nothing is written.

**Architecture:** Two new functions in `backend/utils/sessionSlot.js`:
- `rebalanceSlotRooms(db, { startTs, endTs })` — sorted greedy matching (staff demand desc ↔ room devices desc), rewrites `room_id` for affected sessions.
- `placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId })` — working-hours checks, hypothetical feasibility simulation, then insert + rebalance in one transaction.

These replace `validateAndPickRoom` calls in two integration points: `generateSessionsForMemberPackage` (backend/routes/member-packages.js) and `addNextSessionAfterLastForPackage` (backend/utils/packageSessions.js). `validateAndPickRoom` itself stays unchanged.

**Tech Stack:** Node.js, Express, `pg` (PostgreSQL), existing `db.pool` transaction pattern (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT` / `ROLLBACK`).

---

## File Structure

- **Modify:** `backend/utils/sessionSlot.js` — add `rebalanceSlotRooms` and `placeSessionWithRebalance`, plus a small shared helper to run the sorted-matching simulation (used by both, to avoid duplication).
- **Modify:** `backend/routes/member-packages.js` — in `generateSessionsForMemberPackage`, replace the `validateAndPickRoom` + manual capacity/lock block (~lines 303-355) with a single `placeSessionWithRebalance` call; keep existing conflict/rollback flow.
- **Modify:** `backend/utils/packageSessions.js` — in `addNextSessionAfterLastForPackage`, replace the `validateAndPickRoom` call (~line 176) with `placeSessionWithRebalance`; on infeasible, continue to next day as before.

No new files. No test files.

---

### Task 1: Shared matching helper + `rebalanceSlotRooms`

**Files:**
- Modify: `backend/utils/sessionSlot.js`

- [ ] **Step 1: Implement the shared sorted-matching helper**

Add this near the top of `backend/utils/sessionSlot.js`, after the existing helper functions (`countSessionsInRoom`, `roomHasOtherStaff`) and before `validateRoomForSession`:

```js
/**
 * Verilen talep haritası (staffId -> demand) ve oda listesine ([{id, devices}])
 * göre sıralı greedy eşleştirme yapar.
 * Personeller talebe göre azalan, odalar devices'a göre azalan sıralanır,
 * i. personel i. odaya eşlenir.
 * @returns {{ feasible: boolean, assignments?: Array<{ staffId: number, roomId: number, demand: number }> }}
 */
function matchStaffToRooms(demandByStaff, rooms) {
  const staffEntries = Object.entries(demandByStaff)
    .map(([staffId, demand]) => ({ staffId: Number(staffId), demand }))
    .sort((a, b) => b.demand - a.demand);
  const sortedRooms = [...rooms].sort((a, b) => b.devices - a.devices);

  if (staffEntries.length > sortedRooms.length) {
    return { feasible: false };
  }

  const assignments = [];
  for (let i = 0; i < staffEntries.length; i++) {
    const staff = staffEntries[i];
    const room = sortedRooms[i];
    if (staff.demand > room.devices) {
      return { feasible: false };
    }
    assignments.push({ staffId: staff.staffId, roomId: room.id, demand: staff.demand });
  }
  return { feasible: true, assignments };
}

/**
 * [startTs, endTs) anındaki silinmemiş seansları staff_id'ye göre gruplar,
 * her personelin talebini (seans sayısı) döner.
 * @returns {Promise<Record<number, number>>}
 */
async function getDemandByStaff(db, startTs, endTs) {
  const r = await db.query(
    `SELECT staff_id, COUNT(*)::int AS cnt FROM sessions
     WHERE start_ts < $2 AND end_ts > $1 AND staff_id IS NOT NULL AND deleted_at IS NULL
     GROUP BY staff_id`,
    [startTs, endTs]
  );
  const demand = {};
  for (const row of r.rows) {
    demand[row.staff_id] = row.cnt;
  }
  return demand;
}
```

- [ ] **Step 2: Implement `rebalanceSlotRooms`**

Add after the helper functions from Step 1 (and after `validateAndPickRoom`, or anywhere in the file as long as it's exported — place it right after `validateAndPickRoom` for readability):

```js
/**
 * [startTs, endTs) anındaki tüm personel-oda atamalarını, talebe göre azalan
 * personel ↔ kapasiteye göre azalan oda eşleştirmesiyle yeniden dağıtır.
 * Infeasible ise hiçbir değişiklik yapmaz.
 * @param {object} db - database pool/query (transaction client veya pool)
 * @param {object} params - { startTs, endTs }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function rebalanceSlotRooms(db, { startTs, endTs }) {
  const demandByStaff = await getDemandByStaff(db, startTs, endTs);
  if (Object.keys(demandByStaff).length === 0) {
    return { ok: true };
  }

  const roomsRes = await db.query('SELECT id, devices FROM rooms');
  const rooms = roomsRes.rows.map((r) => ({ id: r.id, devices: Math.max(1, parseInt(r.devices, 10) || 0) }));

  const match = matchStaffToRooms(demandByStaff, rooms);
  if (!match.feasible) {
    return { ok: false, error: 'Bu saatte toplam oda kapasitesi yetersiz.' };
  }

  for (const { staffId, roomId } of match.assignments) {
    await db.query(
      `UPDATE sessions SET room_id = $1
       WHERE staff_id = $2 AND start_ts < $4 AND end_ts > $3
         AND deleted_at IS NULL AND room_id IS DISTINCT FROM $1`,
      [roomId, staffId, startTs, endTs]
    );
  }

  return { ok: true };
}
```

- [ ] **Step 3: Manuel test (psql)**

Bu adımda henüz `placeSessionWithRebalance` yok, sadece `rebalanceSlotRooms`'u bağımsız doğrula. PowerShell'de:

```powershell
cd backend
node -e "
import('./utils/sessionSlot.js').then(async (m) => {
  const db = (await import('./config/database.js')).default;
  // Örnek: 15.06.2026 13:00-14:00 (epoch ms hesapla)
  const start = new Date('2026-06-15T13:00:00').getTime();
  const end = new Date('2026-06-15T14:00:00').getTime();
  const result = await m.rebalanceSlotRooms(db, { startTs: start, endTs: end });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
});
"
```

Beklenen: `{ "ok": true }` (eğer o saatteki talep/kapasite zaten uyumluysa hiçbir UPDATE olmaz; uyumsuzsa odalar yeniden dağıtılır). Çalıştırdıktan sonra:

```sql
SELECT id, staff_id, room_id, start_ts FROM sessions
WHERE start_ts < (extract(epoch from '2026-06-15T14:00:00'::timestamp)*1000)::bigint
  AND end_ts   > (extract(epoch from '2026-06-15T13:00:00'::timestamp)*1000)::bigint
  AND deleted_at IS NULL
ORDER BY staff_id;
```

ile `room_id` dağılımının personel taleplerine göre mantıklı olduğunu (yüksek talepli personel büyük odada) gözle kontrol et.

- [ ] **Step 4: Commit**

```bash
git add backend/utils/sessionSlot.js
git commit -m "feat: rebalanceSlotRooms ile slot bazlı oda dengeleme ekle"
```

---

### Task 2: `placeSessionWithRebalance`

**Files:**
- Modify: `backend/utils/sessionSlot.js`

- [ ] **Step 1: Implement `placeSessionWithRebalance`**

Add after `rebalanceSlotRooms` in `backend/utils/sessionSlot.js`:

```js
/**
 * Yeni bir seansı, gerekirse aynı slottaki diğer personellerin odalarını
 * yeniden dağıtarak ekler. Hipotetik fizibilite kontrolü infeasible ise
 * hiçbir şey yazılmadan hata döner.
 * @param {object} db - database pool/query (db.pool gereklidir)
 * @param {object} params - { staffId, startTs, endTs, memberId, memberPackageId }
 * @returns {Promise<{ ok: boolean, sessionId?: number, error?: string }>}
 */
export async function placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId }) {
  // 1) Çalışma saati kontrolleri (validateAndPickRoom adım 1-2 ile aynı)
  const startDate = new Date(Number(startTs));
  const dayOfWeek = startDate.getDay();
  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
  const endMin = startDate.getHours() * 60 + startDate.getMinutes() + Math.round((Number(endTs) - Number(startTs)) / 60000);

  const whRow = await db.query(
    'SELECT enabled, start_time, end_time FROM working_hours WHERE day_of_week = $1',
    [dayOfWeek]
  );
  if (whRow.rows.length === 0) return { ok: false, error: 'Çalışma saati dışında' };
  const wh = whRow.rows[0];
  if (!wh.enabled) return { ok: false, error: 'Çalışma saati dışında' };
  const [whStartH, whStartM] = (wh.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
  const [whEndH, whEndM] = (wh.end_time + '').split(':').map((x) => parseInt(x, 10) || 0);
  const whStartMin = whStartH * 60 + whStartM;
  const whEndMin = whEndH * 60 + whEndM;
  if (startMin < whStartMin || endMin > whEndMin) return { ok: false, error: 'Çalışma saati dışında' };

  const staffRow = await db.query('SELECT working_hours FROM staff WHERE id = $1', [staffId]);
  if (staffRow.rows.length === 0) return { ok: false, error: 'Çalışma saati dışında' };
  const staffWhRaw = staffRow.rows[0].working_hours;
  const staffWh = typeof staffWhRaw === 'string' ? (() => { try { return JSON.parse(staffWhRaw); } catch { return {}; } })() : (staffWhRaw || {});
  const dayWh = staffWh[String(dayOfWeek)] || staffWh[dayOfWeek];
  if (dayWh && (dayWh.enabled === false || !dayWh.start || !dayWh.end)) return { ok: false, error: 'Çalışma saati dışında' };
  if (dayWh && dayWh.start && dayWh.end) {
    const toMin = (t) => {
      const p = (t + '').split(':').map((x) => parseInt(x, 10) || 0);
      return (p[0] || 0) * 60 + (p[1] || 0);
    };
    const sMin = toMin(dayWh.start);
    const eMin = toMin(dayWh.end);
    if (startMin < sMin || endMin > eMin) return { ok: false, error: 'Çalışma saati dışında' };
  }

  // 2) Hipotetik fizibilite kontrolü: mevcut taleplere staffId için +1 ekle
  const demandByStaff = await getDemandByStaff(db, startTs, endTs);
  demandByStaff[staffId] = (demandByStaff[staffId] || 0) + 1;

  const roomsRes = await db.query('SELECT id, devices FROM rooms');
  const rooms = roomsRes.rows.map((r) => ({ id: r.id, devices: Math.max(1, parseInt(r.devices, 10) || 0) }));
  if (rooms.length === 0) return { ok: false, error: 'Bu saatte toplam oda kapasitesi yetersiz.' };

  const match = matchStaffToRooms(demandByStaff, rooms);
  if (!match.feasible) {
    return { ok: false, error: 'Bu saatte toplam oda kapasitesi yetersiz.' };
  }

  // 3) Transaction: herhangi bir odaya ekle, sonra rebalance
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Etkilenecek odaları kilitle (yarış durumu önleme)
    await client.query('SELECT id FROM rooms ORDER BY id FOR UPDATE');

    const anyRoomId = rooms[0].id;
    const insertResult = await client.query(
      `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
       VALUES ($1, $2, $3, $4, $5, NULL, $6) RETURNING id`,
      [staffId, memberId, anyRoomId, startTs, endTs, memberPackageId ?? null]
    );
    const sessionId = insertResult.rows[0]?.id;

    const rebalanceResult = await rebalanceSlotRooms(client, { startTs, endTs });
    if (!rebalanceResult.ok) {
      await client.query('ROLLBACK');
      return { ok: false, error: rebalanceResult.error || 'Bu saatte toplam oda kapasitesi yetersiz.' };
    }

    await client.query('COMMIT');
    return { ok: true, sessionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, error: 'Seans eklenirken hata' };
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Manuel test (psql + node)**

Gerçek senaryo (Şerife/Seda örneği) ile manuel doğrulama. PowerShell'de:

```powershell
cd backend
node -e "
import('./utils/sessionSlot.js').then(async (m) => {
  const db = (await import('./config/database.js')).default;
  const start = new Date('2026-06-15T13:00:00').getTime();
  const end = new Date('2026-06-15T14:00:00').getTime();
  // staffId = Şerife Akgül'ün id'si, memberId = Seda Parlak'ın id'si (350)
  const result = await m.placeSessionWithRebalance(db, { staffId: <SERIFE_ID>, startTs: start, endTs: end, memberId: 350, memberPackageId: <MP_ID> });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
});
"
```

Beklenen: `{ "ok": true, "sessionId": <id> }`. Ardından:

```sql
SELECT s.id, s.staff_id, s.room_id, st.first_name || ' ' || st.last_name AS staff
FROM sessions s LEFT JOIN staff st ON st.id = s.staff_id
WHERE s.start_ts < (extract(epoch from '2026-06-15T14:00:00'::timestamp)*1000)::bigint
  AND s.end_ts   > (extract(epoch from '2026-06-15T13:00:00'::timestamp)*1000)::bigint
  AND s.deleted_at IS NULL
ORDER BY s.staff_id;
```

ile her personelin yeni `room_id`'sinin talebine uygun odaya (≥ talep alet sayılı) düştüğünü gözle doğrula. Test bittiğinde eklenen seansı geri almak istersen:

```sql
DELETE FROM sessions WHERE id = <sessionId döndürülen değer>;
```

- [ ] **Step 3: Commit**

```bash
git add backend/utils/sessionSlot.js
git commit -m "feat: placeSessionWithRebalance ile fizibilite kontrollü seans ekleme"
```

---

### Task 3: `generateSessionsForMemberPackage` entegrasyonu

**Files:**
- Modify: `backend/routes/member-packages.js` (~lines 293-371)

- [ ] **Step 1: Replace the validateAndPickRoom + manual transaction block**

Mevcut blok (satır 293-367 civarı):

```js
  for (const row of inserts) {
    const pushConflict = (message) => {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message,
      });
    };
    const validation = await validateAndPickRoom(db, {
      staffId: row.staff_id,
      startTs: row.start_ts,
      endTs: row.end_ts,
    });
    if (!validation.ok) {
      pushConflict('Bu saatte oda müsait değil (kapasite dolu veya çalışma saati dışında)');
      break;
    }
    const roomId = validation.roomId ?? null;
    if (roomId == null) {
      pushConflict('Bu saatte uygun oda bulunamadı');
      break;
    }
    // Transaction + oda kilidi: paralel isteklerde kapasite aşımını engeller
    let client;
    let insertedId = null;
    try {
      client = await db.pool.connect();
      await client.query('BEGIN');
      const roomRow = await client.query('SELECT id, devices FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
      if (roomRow.rows.length === 0) {
        await client.query('ROLLBACK');
        pushConflict('Oda bulunamadı');
        break;
      }
      const devices = Math.max(1, parseInt(roomRow.rows[0].devices, 10) || 0);
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM sessions WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2 AND (deleted_at IS NULL)`,
        [roomId, row.start_ts, row.end_ts]
      );
      const currentSessions = parseInt(countResult.rows[0]?.cnt, 10) || 0;
      if (currentSessions >= devices) {
        await client.query('ROLLBACK');
        pushConflict('Bu saatte oda müsait değil (kapasite dolu)');
        break;
      }
      const roomValidation = await validateRoomForSession(client, {
        roomId,
        staffId: row.staff_id,
        startTs: row.start_ts,
        endTs: row.end_ts,
      });
      if (!roomValidation.ok) {
        await client.query('ROLLBACK');
        pushConflict(roomValidation.error || 'Bu saatte oda müsait değil');
        break;
      }
      const insertResult = await client.query(
        `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
         VALUES ($1, $2, $3, $4, $5, NULL, $6) RETURNING id`,
        [row.staff_id, row.member_id, roomId, row.start_ts, row.end_ts, row.member_package_id]
      );
      insertedId = insertResult.rows[0]?.id ?? null;
      await client.query('COMMIT');
      if (insertedId != null) insertedSessionIds.push(insertedId);
      sessionsCreated += 1;
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      pushConflict('Seans eklenirken hata');
      break;
    } finally {
      if (client) client.release();
    }
  }
```

Yeni hali:

```js
  for (const row of inserts) {
    const pushConflict = (message) => {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message,
      });
    };
    const placed = await placeSessionWithRebalance(db, {
      staffId: row.staff_id,
      startTs: row.start_ts,
      endTs: row.end_ts,
      memberId: row.member_id,
      memberPackageId: row.member_package_id,
    });
    if (!placed.ok) {
      pushConflict(placed.error || 'Bu saatte oda müsait değil');
      break;
    }
    insertedSessionIds.push(placed.sessionId);
    sessionsCreated += 1;
  }
```

- [ ] **Step 2: Update the import**

`backend/routes/member-packages.js` dosyasının başındaki import satırını bul (örn. `import { validateAndPickRoom, validateRoomForSession } from '../utils/sessionSlot.js';` veya benzeri) ve `placeSessionWithRebalance`'ı ekle/yerine koy. Eğer `validateAndPickRoom` ve `validateRoomForSession` bu dosyada başka yerde kullanılmıyorsa kaldır, kullanılıyorsa bırak:

```js
import { placeSessionWithRebalance } from '../utils/sessionSlot.js';
```

(Eğer aynı import satırında başka fonksiyonlar varsa, sadece gereksiz olanları satırdan çıkar, `placeSessionWithRebalance`'ı ekle.)

- [ ] **Step 3: Manuel test (uygulama üzerinden)**

1. Backend'i başlat: `cd backend && npm start` (veya mevcut dev script'i).
2. Frontend üzerinden, kapasiteyi aşacak şekilde yeni bir paket/gün dağılımı tanımla — örn. aynı saatte 3 personel olacak şekilde, toplam talep oda kapasitelerini (3+3+2=8) aşmayan ama tek tek odalara sığmayan bir senaryo kur (spesifikasyondaki personel1/2/3 örneği gibi).
3. Beklenen: paket başarıyla oluşturulur, seanslar arasında oda ataması personel1→3'lü oda, personel2→2'li oda, personel3→3'lü oda gibi dengeli dağılır (talep ≤ devices her personel için).
4. Şimdi toplam talebi kapasiteyi aşacak şekilde dene (örn. 4. personeli aynı saate ekle, toplam talep > 8). Beklenen: "Bu saatte toplam oda kapasitesi yetersiz." conflict mesajı dönsün, hiçbir seans eklenmemiş olsun (DB'de `SELECT COUNT(*) FROM sessions WHERE member_package_id = <yeni mpId>` → 0).

- [ ] **Step 4: Commit**

```bash
git add backend/routes/member-packages.js
git commit -m "feat: generateSessionsForMemberPackage'da placeSessionWithRebalance kullan"
```

---

### Task 4: `addNextSessionAfterLastForPackage` entegrasyonu

**Files:**
- Modify: `backend/utils/packageSessions.js` (~lines 1, 176-186)

- [ ] **Step 1: Update the import**

Dosyanın 1. satırı:

```js
import { validateAndPickRoom } from './sessionSlot.js';
```

şu şekilde değiştir:

```js
import { placeSessionWithRebalance } from './sessionSlot.js';
```

(Eğer `validateAndPickRoom` bu dosyada başka yerde kullanılıyorsa, ikisini de import et: `import { validateAndPickRoom, placeSessionWithRebalance } from './sessionSlot.js';`. Bu plandaki diğer kullanımlar sadece satır 176'dadır, dolayısıyla `validateAndPickRoom` kaldırılabilir.)

- [ ] **Step 2: Replace the validateAndPickRoom call**

Mevcut kod (satır 176-186):

```js
        const validation = await validateAndPickRoom(db, { staffId: slot.staff_id, startTs, endTs });
        if (!validation.ok) continue;

        const roomId = validation.roomId ?? null;
        const ins = await db.query(
          `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
           VALUES ($1, $2, $3, $4, $5, NULL, $6)
           RETURNING id`,
          [slot.staff_id, member_id, roomId, startTs, endTs, memberPackageId]
        );
        return { added: true, sessionId: ins.rows[0]?.id };
```

Yeni hali:

```js
        const placed = await placeSessionWithRebalance(db, {
          staffId: slot.staff_id,
          startTs,
          endTs,
          memberId: member_id,
          memberPackageId,
        });
        if (!placed.ok) continue;

        return { added: true, sessionId: placed.sessionId };
```

Not: `continue` mevcut "bir sonraki güne geç" davranışını korur — bu satır zaten bir `for` döngüsü içinde (yukarıdaki context'te görülen gün döngüsü).

- [ ] **Step 3: Manuel test (uygulama üzerinden)**

1. Backend'i başlat (eğer çalışmıyorsa).
2. Bir üyenin paketinden bir seansı iptal et (cancel) — bu `addNextSessionAfterLastForPackage`'ı tetikler.
3. Beklenen (kapasite uygunsa): `replenished.added === true`, yeni seans eklenmiş ve gerekirse aynı slottaki diğer personellerin `room_id`'leri dengeleme ile güncellenmiş olmalı.
4. Kapasitenin infeasible olacağı bir gün/slot senaryosu kurup aynı işlemi tekrarla. Beklenen: o gün atlanır, döngü bir sonraki uygun güne geçer (eski davranışla aynı), `addNextSessionAfterLastForPackage` sonunda `{ added: false, reason: 'no_available_slot' }` veya başka bir günde `{ added: true, ... }` döner — hata fırlatılmaz.

- [ ] **Step 4: Commit**

```bash
git add backend/utils/packageSessions.js
git commit -m "feat: addNextSessionAfterLastForPackage'da placeSessionWithRebalance kullan"
```

---

## Self-Review Notları

- **Spec kapsamı:** `rebalanceSlotRooms` (Task 1), `placeSessionWithRebalance` (Task 2), `generateSessionsForMemberPackage` entegrasyonu + rollback korunumu (Task 3), `addNextSessionAfterLastForPackage` entegrasyonu + `continue`/gün arama davranışı korunumu (Task 4) — spesifikasyonun tüm "Entegrasyon Noktaları" ve "Çözüm" bölümleri kapsanmıştır.
- **Kapsam — sadece gelecek:** Yeni seans eklemeleri (`placeSessionWithRebalance`) zaten her zaman bugünden ileri tarihlere yapılır; `rebalanceSlotRooms` belirli bir `[startTs, endTs)` için çağrılır ve bu her zaman yeni eklenen (gelecekteki) seansın slotu olur — geçmiş seanslara dokunulmaz, ek bir `startTs >= now` filtresine gerek yoktur çünkü zaten sadece yeni eklenen slot için çalıştırılıyor.
- **Placeholder taraması:** Yok — her adımda tam kod var.
- **Tip/isim tutarlılığı:** `rebalanceSlotRooms(db, { startTs, endTs })` ve `placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId })` imzaları Task 1-2'de tanımlandığı şekliyle Task 3-4'te aynen kullanılıyor. `{ ok, sessionId?, error? }` dönüş şekli tüm çağrı noktalarında tutarlı.
- **Rollback korunumu (Task 3):** `conflicts.length > 0 && insertedSessionIds.length > 0` bloğu (satır 368-371) değişmeden kalıyor — `placeSessionWithRebalance` infeasible durumunda hiçbir şey yazmadığı için, `break` öncesi eklenmiş seanslar varsa (önceki satırlardan) hâlâ doğru şekilde silinir.
