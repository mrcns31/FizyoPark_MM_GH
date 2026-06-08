import db from '../config/database.js';
import { addNextSessionAfterLastForPackage } from '../utils/packageSessions.js';

const member = await db.query(
  `SELECT m.id, m.name, m.user_id FROM members m WHERE LOWER(name) LIKE '%aykut%özer%' OR LOWER(first_name) LIKE '%aykut%'`
);
console.log('Member:', member.rows);

const mid = member.rows[0]?.id;
if (!mid) process.exit(1);

const target = new Date(2026, 6, 6, 8, 0, 0, 0); // 06.07.2026 local
const targetTs = target.getTime();
console.log('Target ts:', targetTs, target.toLocaleString('tr-TR'));

const sessions = await db.query(
  `SELECT s.id, s.start_ts, s.deleted_at, s.member_package_id, p.package_type, mp.status
   FROM sessions s
   LEFT JOIN member_packages mp ON mp.id = s.member_package_id
   LEFT JOIN packages p ON p.id = mp.package_id
   WHERE s.member_id = $1
   ORDER BY s.start_ts`,
  [mid]
);
console.log('All sessions (July 2026 highlighted):');
for (const s of sessions.rows) {
  const d = new Date(Number(s.start_ts));
  if (d.getMonth() !== 6 && d.getFullYear() !== 2026) continue;
  console.log({
    id: s.id,
    date: d.toLocaleString('tr-TR'),
    deleted: !!s.deleted_at,
    mpId: s.member_package_id,
    type: s.package_type,
    pkgStatus: s.status,
  });
}

const s815 = await db.query('SELECT * FROM sessions WHERE id = 815');
console.log('\nSession 815:', s815.rows[0] ? {
  id: 815,
  date: new Date(Number(s815.rows[0].start_ts)).toLocaleString('tr-TR'),
  deleted: !!s815.rows[0].deleted_at,
} : 'not found');

const active = await db.query(
  `SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_id = $1 AND member_package_id = 37 AND deleted_at IS NULL`,
  [mid]
);
console.log('Active sessions MP37:', active.rows[0].cnt);

const dup = sessions.rows.filter((s) => !s.deleted_at);
if (dup.length) {
  const s = dup[0];
  console.log('\nSimulate replenishment after cancel on', s.id);
  const r = await addNextSessionAfterLastForPackage(db, s.member_package_id, { afterCancelTs: s.start_ts });
  console.log('Replenish result:', r);
}

process.exit(0);
