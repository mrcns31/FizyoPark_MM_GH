const sql = require("mssql");
const { Client } = require("pg");

// Eski TerapistId (KG_KullaniciDiger.Id) -> yeni staff.id
const STAFF_MAP = new Map([
  [5436, 1],  // Arzum Cinar
  [3,    2],  // Cansu Mullaoglu
  [14879,3],  // Damla Durgun
  [15982,4],  // Melis Gozde Yildirim
  [5478, 5],  // Serife Akgul
]);

// Eski UyePaketId -> yeni member_packages.id
const MP_MAP = new Map([
  [1078, 1], [1188, 2], [1278, 3], [2377, 4],
  [6517, 5], [8666, 6], [9787, 7], [24791, 8],
  [29082, 9], [30267, 10], [32471, 11], [34684, 12],
  [37867, 13], [39078, 14],
]);

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 saat

async function main() {
  const mssqlConfig = {
    user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
    database: "FizyoparkDatabase",
    options: { encrypt: false, trustServerCertificate: true },
  };

  const pool = await sql.connect(mssqlConfig);
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  const result = await pool.request().query(`
    SELECT Id, Tarih, TerapistId, UyePaketId
    FROM KG_UyeTerapistDagilim
    WHERE KullaniciId IN (37, 1089) AND SilindiMi = 0
    ORDER BY Tarih
  `);

  const rows = result.recordset;
  console.log("Aktarilacak seans sayisi: " + rows.length);

  let inserted = 0, skipped = 0;

  for (const row of rows) {
    const startTs = new Date(row.Tarih).getTime();
    const endTs = startTs + SESSION_DURATION_MS;
    const staffId = STAFF_MAP.get(row.TerapistId) || null;
    const mpId = MP_MAP.get(row.UyePaketId) || null;

    await pg.query(
      "INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts) VALUES ($1, $2, $3, $4, $5)",
      [1, staffId, mpId, startTs, endTs]
    );
    inserted++;
  }

  console.log("Eklendi: " + inserted + ", Atlandi: " + skipped);
  await pool.close();
  await pg.end();
}

main().catch(console.error);
