/**
 * Aynı üye + aynı start_ts mükerrer aktif seansları temizler, eksikse telafi ekler.
 * Kullanım: cd backend && node scripts/fix-duplicate-sessions.js
 */
import db from '../config/database.js';
import { addNextSessionAfterLastForPackage } from '../utils/packageSessions.js';

const dups = await db.query(`
  SELECT member_id, member_package_id, start_ts, COUNT(*)::int AS cnt
  FROM sessions
  WHERE deleted_at IS NULL AND member_package_id IS NOT NULL
  GROUP BY member_id, member_package_id, start_ts
  HAVING COUNT(*) > 1
`);

for (const row of dups.rows) {
  const ids = await db.query(
    `SELECT id FROM sessions
     WHERE member_id = $1 AND member_package_id = $2 AND start_ts = $3 AND deleted_at IS NULL
     ORDER BY id ASC`,
    [row.member_id, row.member_package_id, row.start_ts]
  );
  const keep = ids.rows[ids.rows.length - 1].id;
  const remove = ids.rows.filter((r) => r.id !== keep).map((r) => r.id);
  if (remove.length) {
    await db.query(
      'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ANY($1::int[])',
      [remove]
    );
    console.log('Mükerrer silindi:', remove, 'tutulan:', keep);
  }
}

// Aykut 06.07.2026 — hâlâ aktif varsa iptal + telafi
const july6 = await db.query(
  `SELECT id, start_ts, member_package_id FROM sessions
   WHERE member_id = 27 AND deleted_at IS NULL
     AND start_ts >= $1 AND start_ts < $2`,
  [new Date(2026, 6, 6, 0, 0, 0, 0).getTime(), new Date(2026, 6, 7, 0, 0, 0, 0).getTime()]
);
for (const s of july6.rows) {
  await db.query('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [s.id]);
  console.log('İptal:', s.id);
  if (s.member_package_id) {
    const r = await addNextSessionAfterLastForPackage(db, s.member_package_id, {
      afterCancelTs: s.start_ts,
      skipStartTs: s.start_ts,
    });
    console.log('Telafi:', r);
  }
}

process.exit(0);
