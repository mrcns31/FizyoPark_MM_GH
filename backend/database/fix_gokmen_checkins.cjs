const sql = require("mssql");
const { Client } = require("pg");

const TZ_OFFSET = 3 * 60 * 60 * 1000; // UTC+3

async function main() {
  const pool = await sql.connect({
    user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
    database: "FizyoparkDatabase",
    options: { encrypt: false, trustServerCertificate: true },
  });
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  // Randevu tarihi (start_ts eslesme icin) + giris tarihi + giris tipi
  const result = await pool.request().query(`
    SELECT
      d.Tarih          AS RandevuTarih,
      kg.Tarih         AS GirisTarih,
      kg.KartNo
    FROM KG_KapiGecis kg
    JOIN KG_UyeTerapistDagilim d ON d.Id = kg.DusulenDagilimId
    WHERE d.KullaniciId IN (37, 1089) AND d.SilindiMi = 0
  `);

  let updated = 0, notFound = 0;

  for (const row of result.recordset) {
    const startTs = new Date(row.RandevuTarih).getTime() - TZ_OFFSET;
    const checkedInAt = new Date(new Date(row.GirisTarih).getTime() - TZ_OFFSET);
    const method = (row.KartNo === "Manuel") ? "manual" : "card";

    const r = await pg.query(
      `UPDATE sessions SET checked_in_at = $1, check_in_method = $2
       WHERE member_id = 1 AND start_ts = $3`,
      [checkedInAt, method, startTs]
    );

    if (r.rowCount > 0) updated++;
    else notFound++;
  }

  console.log("Guncellendi: " + updated + " | Eslesmedi: " + notFound);
  await pool.close();
  await pg.end();
}

main().catch(console.error);
