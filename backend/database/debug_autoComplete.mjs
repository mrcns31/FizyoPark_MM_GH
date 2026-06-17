import db from '../config/database.js';

// Test: autoCompletePackageIfExhausted SQL'ini direkt çalıştır
const sql = `
  UPDATE member_packages mp
  SET status = 'completed', updated_at = CURRENT_TIMESTAMP
  FROM packages p
  WHERE mp.package_id = p.id
    AND mp.status = 'active'
    AND (
      SELECT COUNT(*)
      FROM sessions s
      WHERE s.member_package_id = mp.id
        AND s.deleted_at IS NULL
        AND (
          s.checked_in_at IS NOT NULL
          OR s.attendance_outcome = 'no_show'
          OR s.end_ts < EXTRACT(EPOCH FROM NOW()) * 1000
        )
    ) >= p.lesson_count
  RETURNING mp.id
`;

try {
  const result = await db.query(sql, []);
  console.log('UPDATE etkilenen paketler:', result.rows);
  console.log('rowCount:', result.rowCount);
} catch (err) {
  console.error('SQL HATASI:', err.message);
  console.error(err);
}

// Package 288'i ayrı kontrol et
const r2 = await db.query('SELECT id, status FROM member_packages WHERE id = 288');
console.log('Package 288 sonrası:', r2.rows);

process.exit(0);
