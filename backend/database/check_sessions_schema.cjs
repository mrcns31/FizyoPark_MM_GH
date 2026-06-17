const { Client } = require("pg");
const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
pg.connect().then(async () => {
  // memberPackages sorgu süresi
  let t0 = Date.now();
  const mp = await pg.query(`
    SELECT mp.id, mp.member_id, mp.package_id, mp.start_date, mp.end_date, mp.status,
           p.name as package_name, p.lesson_count, p.month_overrun,
           COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') as member_name,
           m.member_no
    FROM member_packages mp
    JOIN packages p ON p.id = mp.package_id
    JOIN members m ON m.id = mp.member_id AND m.deleted_at IS NULL
    ORDER BY mp.start_date DESC
  `);
  console.log("memberPackages ms:", Date.now()-t0, "rows:", mp.rowCount);

  // sessions sorgu süresi (1 ay)
  t0 = Date.now();
  const s = await pg.query(`
    SELECT s.id, s.member_id, s.staff_id, s.start_ts, s.end_ts,
           s.checked_in_at, s.check_in_method, s.attendance_outcome, s.deleted_at, s.member_package_id,
           st.first_name || ' ' || st.last_name as staff_name,
           COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name
    FROM sessions s
    LEFT JOIN staff st ON s.staff_id = st.id
    LEFT JOIN members m ON s.member_id = m.id
    WHERE s.deleted_at IS NULL
      AND s.start_ts >= $1 AND s.end_ts <= $2
    ORDER BY s.start_ts ASC
  `, [new Date("2026-06-03").getTime(), new Date("2026-07-01").getTime()]);
  console.log("sessions ms:", Date.now()-t0, "rows:", s.rowCount);

  // members sorgu
  t0 = Date.now();
  const m2 = await pg.query("SELECT * FROM members WHERE deleted_at IS NULL ORDER BY name");
  console.log("members ms:", Date.now()-t0, "rows:", m2.rowCount);

  // mp.* ile karşılaştır
  t0 = Date.now();
  const mpStar = await pg.query(`
    SELECT mp.*, p.name as package_name, p.lesson_count, p.month_overrun,
           COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') as member_name, m.member_no
    FROM member_packages mp
    JOIN packages p ON p.id = mp.package_id
    JOIN members m ON m.id = mp.member_id AND m.deleted_at IS NULL
    ORDER BY mp.start_date DESC
  `);
  console.log("memberPackages mp.* ms:", Date.now()-t0, "cols:", Object.keys(mpStar.rows[0]).join(", "));

  await pg.end();
}).catch(console.error);
