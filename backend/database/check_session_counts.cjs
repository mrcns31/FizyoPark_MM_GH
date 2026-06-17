const { Client } = require("pg");
const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
pg.connect().then(async () => {
  const r = await pg.query(`
    SELECT m.name, s.start_ts, COUNT(*) as cnt,
           STRING_AGG(s.id::text, ',') as session_ids,
           STRING_AGG(COALESCE(s.checked_in_at::text, 'NULL'), ',') as checkins
    FROM sessions s
    JOIN members m ON m.id = s.member_id
    WHERE s.deleted_at IS NULL
    GROUP BY m.name, s.start_ts
    HAVING COUNT(*) > 1
    ORDER BY m.name, s.start_ts
  `);
  console.log("Duplicate seans sayisi:", r.rows.length);
  r.rows.forEach(row => {
    const ts = new Date(parseInt(row.start_ts)).toISOString().replace("T"," ").slice(0,16);
    console.log(row.name + " | " + ts + " | ids:" + row.session_ids + " | checkins:" + row.checkins);
  });
  await pg.end();
}).catch(console.error);
