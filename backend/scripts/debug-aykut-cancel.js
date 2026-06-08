import db from '../config/database.js';
import { addNextSessionAfterLastForPackage } from '../utils/packageSessions.js';

const member = await db.query(
  `SELECT m.id, m.name, m.user_id FROM members m WHERE m.name ILIKE '%Aykut%Özer%' OR m.first_name ILIKE '%Aykut%' LIMIT 3`
);
console.log('Member:', member.rows);

const memberId = member.rows[0]?.id;
if (!memberId) {
  console.log('Üye bulunamadı');
  process.exit(1);
}

const target = new Date(2026, 6, 6, 8, 0, 0, 0).getTime();
const window = await db.query(
  `SELECT s.*, p.package_type, mp.status AS pkg_status, mp.end_date, p.lesson_count
   FROM sessions s
   LEFT JOIN member_packages mp ON mp.id = s.member_package_id
   LEFT JOIN packages p ON p.id = mp.package_id
   WHERE s.member_id = $1
     AND s.start_ts >= $2 AND s.start_ts < $3
   ORDER BY s.start_ts`,
  [memberId, target - 3600000, target + 3600000]
);
console.log('\nSessions around 06.07.2026 08:00:');
for (const s of window.rows) {
  console.log({
    id: s.id,
    start: new Date(Number(s.start_ts)).toLocaleString('tr-TR'),
    deleted: !!s.deleted_at,
    mpId: s.member_package_id,
    pkgStatus: s.pkg_status,
    pkgType: s.package_type,
  });
}

const active = window.rows.filter((s) => !s.deleted_at);
if (active.length === 1) {
  const s = active[0];
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  console.log('\nCancel rules check:');
  console.log('  isPast (before today):', s.start_ts < todayStart.getTime());
  console.log('  package flexible:', s.package_type === 'flexible');
  console.log('  pkg active:', s.pkg_status === 'active');
  console.log('  2h rule ok:', Number(s.start_ts) - now >= 2 * 60 * 60 * 1000);
  console.log('  now:', new Date(now).toLocaleString('tr-TR'));

  const countBefore = await db.query(
    'SELECT COUNT(*)::int AS c FROM sessions WHERE member_package_id = $1 AND deleted_at IS NULL',
    [s.member_package_id]
  );
  console.log('\nActive count before:', countBefore.rows[0].c, '/', s.lesson_count);

  await db.query(
    'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 999 WHERE id = $1',
    [s.id]
  );
  const repl = await addNextSessionAfterLastForPackage(db, s.member_package_id, {
    afterCancelTs: s.start_ts,
  });
  console.log('Replenish result:', repl);

  const countAfter = await db.query(
    'SELECT COUNT(*)::int AS c FROM sessions WHERE member_package_id = $1 AND deleted_at IS NULL',
    [s.member_package_id]
  );
  console.log('Active count after:', countAfter.rows[0].c);

  const newest = await db.query(
    `SELECT id, start_ts FROM sessions WHERE member_package_id = $1 AND deleted_at IS NULL ORDER BY start_ts DESC LIMIT 3`,
    [s.member_package_id]
  );
  console.log('Last active sessions:', newest.rows.map((r) => ({
    id: r.id,
    start: new Date(Number(r.start_ts)).toLocaleString('tr-TR'),
  })));

  // rollback test delete for user - actually we modified DB, undo delete for safety?
  await db.query('UPDATE sessions SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', [s.id]);
  if (repl.added && repl.sessionId) {
    await db.query('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [repl.sessionId]);
  }
  console.log('\n(Test değişiklikleri geri alındı)');
}

process.exit(0);
