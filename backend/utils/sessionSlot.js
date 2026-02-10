/**
 * Otomatik seans atamasında kullanılır: çalışma saati, personel saati ve oda kapasitesi kontrolü yapar,
 * uygunsa bir room_id önerir.
 * @param {object} db - database pool/query
 * @param {object} params - { staffId, startTs, endTs }
 * @returns {Promise<{ ok: boolean, roomId?: number }>}
 */
export async function validateAndPickRoom(db, { staffId, startTs, endTs }) {
  const startDate = new Date(Number(startTs));
  const dayOfWeek = startDate.getDay();
  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
  const endMin = startDate.getHours() * 60 + startDate.getMinutes() + Math.round((Number(endTs) - Number(startTs)) / 60000);

  // 1) Global çalışma saatleri: o gün açık mı, seans saati aralıkta mı?
  const whRow = await db.query(
    'SELECT enabled, start_time, end_time FROM working_hours WHERE day_of_week = $1',
    [dayOfWeek]
  );
  if (whRow.rows.length === 0) return { ok: false };
  const wh = whRow.rows[0];
  if (!wh.enabled) return { ok: false };
  const [whStartH, whStartM] = (wh.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
  const [whEndH, whEndM] = (wh.end_time + '').split(':').map((x) => parseInt(x, 10) || 0);
  const whStartMin = whStartH * 60 + whStartM;
  const whEndMin = whEndH * 60 + whEndM;
  if (startMin < whStartMin || endMin > whEndMin) return { ok: false };

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

  // 3) Oda: aynı saatte bu personelin seansı varsa o odası tercih; yoksa kapasitesi uygun bir oda seç
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

  const countInRoom = async (roomId) => {
    const r = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM sessions
       WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2 AND (deleted_at IS NULL)`,
      [roomId, startTs, endTs]
    );
    return r.rows[0]?.cnt ?? 0;
  };

  const cap = (room) => Math.max(1, parseInt(room.devices, 10) || 0);

  if (preferredRoomId != null) {
    const room = rooms.rows.find((r) => r.id === preferredRoomId);
    if (room) {
      const cnt = await countInRoom(room.id);
      if (cnt < cap(room)) return { ok: true, roomId: room.id };
    }
  }

  for (const room of rooms.rows) {
    const cnt = await countInRoom(room.id);
    if (cnt < cap(room)) return { ok: true, roomId: room.id };
  }
  return { ok: false };
}
