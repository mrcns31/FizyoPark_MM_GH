const sql = require("mssql");
const { Client } = require("pg");

// Eski TerapistId (KG_KullaniciDiger.Id) -> yeni staff.id
const STAFF_MAP = new Map([
  [5436, 1],  // Arzum Cinar
  [3,    2],  // Cansu Mullaoglu
  [14879,3],  // Damla Durgun
  [15982,4],  // Melis Gozde Yildirim
  [5478, 5],  // Serife Akgul
  // Silinmis personeller:
  [7,    6],  // Yaren Ayhan
  [24,   7],  // Dudu Ozdemir
  [26,   8],  // Ecem Mullaoglu
  [30,   9],  // Busra Korkmaz
  [32,  10],  // Gunes Aybuke Oduncu
  [1055,11],  // Yaren Ayhan (diger)
  [1133,12],  // Gokce Nur Sen
  [1134,13],  // Gokce Nur Sen (diger)
  [1201,14],  // Dudu Ozdemir (diger)
  [1222,15],  // Melike Tugce Vural
  [1223,16],  // Hulya Durmus
  [1291,17],  // Buse Selin Duran
  [3395,18],  // Beren Demirci
  [3396,19],  // Gulsen Yavuz
  [5431,20],  // Melike Tugce Vural (diger)
  [5470,21],  // Canan Eken
  [5476,22],  // Berin Su Gulatik
  [5477,23],  // Nurefsan Eksi
]);

const MP_MAP = new Map([
  [1078,1],[1188,2],[1278,3],[2377,4],[6517,5],[8666,6],[9787,7],
  [24791,8],[29082,9],[30267,10],[32471,11],[34684,12],[37867,13],[39078,14],
]);

const SESSION_DURATION_MS = 60 * 60 * 1000;

async function main() {
  const pool = await sql.connect({
    user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
    database: "FizyoparkDatabase",
    options: { encrypt: false, trustServerCertificate: true },
  });
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  // Mevcut seansları sil, yeniden dogru staff_id ile import et
  await pg.query("DELETE FROM sessions WHERE member_id = 1");

  const result = await pool.request().query(`
    SELECT Tarih, TerapistId, UyePaketId
    FROM KG_UyeTerapistDagilim
    WHERE KullaniciId IN (37, 1089) AND SilindiMi = 0
    ORDER BY Tarih
  `);

  let inserted = 0, noStaff = 0;
  for (const row of result.recordset) {
    const startTs = new Date(row.Tarih).getTime() - 3 * 60 * 60 * 1000;
    const endTs = startTs + SESSION_DURATION_MS;
    const staffId = STAFF_MAP.get(row.TerapistId) || null;
    const mpId = MP_MAP.get(row.UyePaketId) || null;
    if (!staffId) noStaff++;
    await pg.query(
      "INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts) VALUES ($1, $2, $3, $4, $5)",
      [1, staffId, mpId, startTs, endTs]
    );
    inserted++;
  }

  console.log("Eklendi: " + inserted + " | Staff bulunamayan: " + noStaff);
  await pool.close();
  await pg.end();
}

main().catch(console.error);
