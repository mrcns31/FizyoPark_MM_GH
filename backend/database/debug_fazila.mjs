import db from '../config/database.js';

const r1 = await db.query(`
  SELECT id, end_ts, checked_in_at, attendance_outcome, deleted_at
  FROM sessions
  WHERE member_id = (SELECT id FROM members WHERE name ILIKE '%fazıla%' LIMIT 1)
  ORDER BY start_ts
`);
console.log('--- Sessions ---');
r1.rows.forEach((r, i) => {
  const nowMs = Date.now();
  const burned = r.deleted_at == null && r.checked_in_at == null && r.attendance_outcome !== 'no_show' && Number(r.end_ts) < nowMs;
  const consumed = r.checked_in_at != null || r.attendance_outcome === 'no_show' || burned;
  console.log(`${i+1}. end_ts=${r.end_ts} checked_in=${r.checked_in_at != null} outcome=${r.attendance_outcome} deleted=${r.deleted_at != null} consumed=${consumed}`);
});

const r2 = await db.query("SELECT EXTRACT(EPOCH FROM NOW()) * 1000 AS now_ms");
console.log('now_ms DB:', r2.rows[0].now_ms);
console.log('now_ms JS:', Date.now());

const r3 = await db.query(`
  SELECT mp.id, mp.status, p.lesson_count,
    (SELECT COUNT(*) FROM sessions s WHERE s.member_package_id = mp.id AND s.deleted_at IS NULL
     AND (s.checked_in_at IS NOT NULL OR s.attendance_outcome = 'no_show'
          OR s.end_ts < EXTRACT(EPOCH FROM NOW()) * 1000)) AS consumed_count
  FROM member_packages mp
  JOIN packages p ON p.id = mp.package_id
  JOIN members m ON m.id = mp.member_id
  WHERE m.name ILIKE '%fazıla%'
`);
console.log('--- Package ---');
console.log(r3.rows);

process.exit(0);
