/**
 * Otomatik seans atamasında kullanılır: çalışma saati, personel saati ve oda kapasitesi kontrolü yapar,
 * uygunsa bir room_id önerir.
 * Kural: Aynı oda/saat diliminde yalnızca bir personel olabilir; o personel odadaki alet sayısı kadar seans alabilir.
 * @param {object} db - database pool/query
 * @param {object} params - { staffId, startTs, endTs }
 * @returns {Promise<{ ok: boolean, roomId?: number }>}
 */

async function countSessionsInRoom(db, roomId, startTs, endTs, excludeSessionId = null) {
  const params = [roomId, startTs, endTs];
  let sql = `SELECT COUNT(*)::int AS cnt FROM sessions
    WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2 AND deleted_at IS NULL`;
  if (excludeSessionId != null) {
    sql += ' AND id != $4';
    params.push(excludeSessionId);
  }
  const r = await db.query(sql, params);
  return r.rows[0]?.cnt ?? 0;
}

async function roomHasOtherStaff(db, roomId, staffId, startTs, endTs, excludeSessionId = null) {
  const params = [roomId, startTs, endTs, staffId];
  let sql = `SELECT id FROM sessions
    WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2
      AND staff_id IS NOT NULL AND staff_id != $4
      AND deleted_at IS NULL`;
  if (excludeSessionId != null) {
    sql += ' AND id != $5';
    params.push(excludeSessionId);
  }
  sql += ' LIMIT 1';
  const r = await db.query(sql, params);
  return r.rows.length > 0;
}

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

/**
 * Belirli oda/personel/saat için kapasite + tek personel kuralını doğrular.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function validateRoomForSession(db, { roomId, staffId, startTs, endTs, excludeSessionId = null }) {
  const roomRow = await db.query('SELECT id, name, devices FROM rooms WHERE id = $1', [roomId]);
  if (roomRow.rows.length === 0) {
    return { ok: false, error: 'Oda bulunamadı' };
  }
  const room = roomRow.rows[0];
  const devices = Math.max(1, parseInt(room.devices, 10) || 0);
  const cnt = await countSessionsInRoom(db, roomId, startTs, endTs, excludeSessionId);
  if (cnt >= devices) {
    return { ok: false, error: `"${room.name}" için bu saat aralığında kapasite dolu (alet: ${devices}).` };
  }
  const otherStaff = await roomHasOtherStaff(db, roomId, staffId, startTs, endTs, excludeSessionId);
  if (otherStaff) {
    return { ok: false, error: `"${room.name}" odasında bu saat aralığında başka bir personel var.` };
  }
  return { ok: true };
}

async function isRoomAvailableForStaff(db, room, staffId, startTs, endTs, excludeSessionId = null) {
  const devices = Math.max(1, parseInt(room.devices, 10) || 0);
  const cnt = await countSessionsInRoom(db, room.id, startTs, endTs, excludeSessionId);
  if (cnt >= devices) return false;
  const otherStaff = await roomHasOtherStaff(db, room.id, staffId, startTs, endTs, excludeSessionId);
  return !otherStaff;
}

export async function validateAndPickRoom(db, { staffId, startTs, endTs, excludeSessionId = null }) {
  const startDate = new Date(Number(startTs));
  const dayOfWeek = startDate.getDay();
  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
  const endMin = startDate.getHours() * 60 + startDate.getMinutes() + Math.round((Number(endTs) - Number(startTs)) / 60000);

  // 1) Global çalışma saatleri: o gün açık mı, seans saati aralıkta mı?
  // Tablo hiç yapılandırılmamışsa (satır yok) kısıt uygulanmaz.
  const whRow = await db.query(
    'SELECT enabled, start_time, end_time FROM working_hours WHERE day_of_week = $1',
    [dayOfWeek]
  );
  if (whRow.rows.length > 0) {
    const wh = whRow.rows[0];
    if (!wh.enabled) return { ok: false };
    const [whStartH, whStartM] = (wh.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
    const [whEndH, whEndM] = (wh.end_time + '').split(':').map((x) => parseInt(x, 10) || 0);
    const whStartMin = whStartH * 60 + whStartM;
    const whEndMin = whEndH * 60 + whEndM;
    if (startMin < whStartMin || endMin > whEndMin) return { ok: false };
  }

  // 2) Personel çalışma saati: bu personel o gün o saatte çalışıyor mu?
  const staffRow = await db.query('SELECT working_hours FROM staff WHERE id = $1', [staffId]);
  if (staffRow.rows.length === 0) return { ok: false };
  const staffWhRaw = staffRow.rows[0].working_hours;
  const staffWh = typeof staffWhRaw === 'string' ? (() => { try { return JSON.parse(staffWhRaw); } catch { return {}; } })() : (staffWhRaw || {});
  const dayWh = staffWh[String(dayOfWeek)] || staffWh[dayOfWeek];
  if (dayWh && (dayWh.enabled === false || !dayWh.start || !dayWh.end)) return { ok: false };
  if (dayWh && dayWh.start && dayWh.end) {
    const toMin = (t) => {
      const p = (t + '').split(':').map((x) => parseInt(x, 10) || 0);
      return (p[0] || 0) * 60 + (p[1] || 0);
    };
    const sMin = toMin(dayWh.start);
    const eMin = toMin(dayWh.end);
    if (startMin < sMin || endMin > eMin) return { ok: false };
  }

  // 3) Oda: aynı saatte bu personelin seansı varsa o odası tercih; yoksa uygun oda seç
  const rooms = await db.query('SELECT id, name, devices FROM rooms ORDER BY id');
  if (rooms.rows.length === 0) return { ok: false };

  const staffSessionRoom = await db.query(
    `SELECT room_id FROM sessions
     WHERE staff_id = $1 AND room_id IS NOT NULL
       AND start_ts < $3 AND end_ts > $2 AND (deleted_at IS NULL)
     LIMIT 1`,
    [staffId, startTs, endTs]
  );
  const preferredRoomId = staffSessionRoom.rows[0]?.room_id || null;

  if (preferredRoomId != null) {
    const room = rooms.rows.find((r) => r.id === preferredRoomId);
    if (room) {
      const ok = await isRoomAvailableForStaff(db, room, staffId, startTs, endTs, excludeSessionId);
      if (ok) return { ok: true, roomId: room.id };
    }
  }

  for (const room of rooms.rows) {
    const ok = await isRoomAvailableForStaff(db, room, staffId, startTs, endTs, excludeSessionId);
    if (ok) return { ok: true, roomId: room.id };
  }
  return { ok: false };
}

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

  const roomsRes = await db.query('SELECT id, devices FROM rooms ORDER BY id');
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

/**
 * Yeni bir seansı, gerekirse aynı slottaki diğer personellerin odalarını
 * yeniden dağıtarak ekler. Hipotetik fizibilite kontrolü infeasible ise
 * hiçbir şey yazılmadan hata döner.
 * @param {object} db - database pool/query (db.pool gereklidir)
 * @param {object} params - { staffId, startTs, endTs, memberId, memberPackageId }
 * @returns {Promise<{ ok: boolean, sessionId?: number, error?: string }>}
 */
export async function placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId, skipStaffHoursCheck = false }) {
  // 1) Çalışma saati kontrolleri — skipStaffHoursCheck=true ise personel saati kontrolü atlanır (admin onaylı)
  const startDate = new Date(Number(startTs));
  const dayOfWeek = startDate.getDay();
  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
  const endMin = startDate.getHours() * 60 + startDate.getMinutes() + Math.round((Number(endTs) - Number(startTs)) / 60000);

  const whRow = await db.query(
    'SELECT enabled, start_time, end_time FROM working_hours WHERE day_of_week = $1',
    [dayOfWeek]
  );
  if (whRow.rows.length > 0) {
    const wh = whRow.rows[0];
    if (!wh.enabled) return { ok: false, error: 'Çalışma saati dışında' };
    const [whStartH, whStartM] = (wh.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
    const [whEndH, whEndM] = (wh.end_time + '').split(':').map((x) => parseInt(x, 10) || 0);
    const whStartMin = whStartH * 60 + whStartM;
    const whEndMin = whEndH * 60 + whEndM;
    if (startMin < whStartMin || endMin > whEndMin) return { ok: false, error: 'Çalışma saati dışında' };
  }

  if (!skipStaffHoursCheck) {
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
  }

  // 2) Hipotetik fizibilite kontrolü: mevcut taleplere staffId için +1 ekle
  const demandByStaff = await getDemandByStaff(db, startTs, endTs);
  demandByStaff[staffId] = (demandByStaff[staffId] || 0) + 1;

  const roomsRes = await db.query('SELECT id, devices FROM rooms ORDER BY id');
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
