const { Client } = require("pg");
const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
pg.connect().then(async () => {
  const r = await pg.query(`
    DELETE FROM sessions
    WHERE member_id IS NULL AND member_package_id IS NULL AND deleted_at IS NULL
    RETURNING id
  `);
  console.log("Silinen hayalet seans:", r.rows.length);
  await pg.end();
}).catch(console.error);
