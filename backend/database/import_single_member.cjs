const sql = require("mssql");
const { Client } = require("pg");

const STAFF_MAP = new Map([
  [5436,1],[3,2],[14879,3],[15982,4],[5478,5],
  [7,6],[24,7],[26,8],[30,9],[32,10],[1055,11],
  [1133,12],[1134,13],[1201,14],[1222,15],[1223,16],
  [1291,17],[3395,18],[3396,19],[5431,20],[5470,21],
  [5476,22],[5477,23],
]);

const PAKET_MAP = new Map([
  [1,1],[2,2],[3,3],[4,4],[5,5],[24,6],
]);

const TZ = 3 * 60 * 60 * 1000;
const SESSION_DURATION_MS = 60 * 60 * 1000;
const TODAY = new Date("2026-06-17");

// Tum KullaniciId'ler - canonical: 1110
const ALL_IDS = [44, 45, 1061, 1110];

const mssqlConfig = {
  user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
  database: "FizyoparkDatabase",
  options: { encrypt: false, trustServerCertificate: true },
};

async function main() {
  const pool = await sql.connect(mssqlConfig);
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  // --- 1. UYE ---
  const mRes = await pg.query(`
    INSERT INTO members (name, first_name, last_name, phone)
    VALUES ($1,$2,$3,$4) RETURNING id`,
    ["Bekir Artam Atalay", "Bekir Artam", "Atalay", "5326951136"]
  );
  const memberId = mRes.rows[0].id;
  await pg.query("UPDATE members SET member_no=$1 WHERE id=$2", ["U"+memberId, memberId]);
  console.log("Uye -> id=" + memberId + " member_no=U" + memberId);

  // --- 2. KARTLAR ---
  await pg.query(
    "INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,true) ON CONFLICT (card_no) DO NOTHING",
    [memberId, "0010832207"]
  );
  await pg.query(
    "INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,false) ON CONFLICT (card_no) DO NOTHING",
    [memberId, "0000017817"]
  );
  console.log("Kartlar eklendi: 0010832207 (ana), 0000017817");

  // --- 3. TUM PAKETLER ---
  const pkgRes = await pool.request().query(`
    SELECT up.Id as UyePaketId, up.PaketId, up.BaslamaTarihi, up.BitisTarihi
    FROM KG_UyePaket up
    WHERE up.KullaniciId IN (${ALL_IDS.join(",")})
    ORDER BY up.BaslamaTarihi, up.Id
  `);

  const mpMap = new Map();
  for (const row of pkgRes.recordset) {
    const newPaketId = PAKET_MAP.get(row.PaketId);
    if (!newPaketId) {
      console.log("ATILDI paket PaketId=" + row.PaketId + " (tabloda yok)");
      continue;
    }
    const endDate = new Date(row.BitisTarihi);
    const status = endDate > TODAY ? "active" : "completed";
    const r = await pg.query(
      "INSERT INTO member_packages (member_id, package_id, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [memberId, newPaketId, row.BaslamaTarihi.toISOString().slice(0,10), endDate.toISOString().slice(0,10), status]
    );
    mpMap.set(row.UyePaketId, r.rows[0].id);
    console.log("Paket " + row.UyePaketId + " PaketId=" + row.PaketId + " -> mp.id=" + r.rows[0].id + " [" + status + "]");
  }

  // --- 4. SEANSLAR (SilindiMi=0) ---
  const sesRes = await pool.request().query(`
    SELECT Id, Tarih, TerapistId, UyePaketId
    FROM KG_UyeTerapistDagilim
    WHERE KullaniciId IN (${ALL_IDS.join(",")}) AND SilindiMi=0
    ORDER BY Tarih
  `);

  const sessionIdMap = new Map();
  for (const row of sesRes.recordset) {
    const startTs = new Date(row.Tarih).getTime() - TZ;
    const endTs = startTs + SESSION_DURATION_MS;
    const staffId = STAFF_MAP.get(row.TerapistId) || null;
    const mpId = mpMap.get(row.UyePaketId) || null;
    const r = await pg.query(
      "INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [memberId, staffId, mpId, startTs, endTs]
    );
    sessionIdMap.set(row.Id, r.rows[0].id);
  }
  console.log("Seans eklendi: " + sesRes.recordset.length);

  // --- 5. GIRIS SAATI + YONTEMI ---
  const oldIds = sesRes.recordset.map(r => r.Id).join(",");
  if (oldIds) {
    const checkinRes = await pool.request().query(`
      SELECT DusulenDagilimId, Tarih as GirisTarih, KartNo
      FROM KG_KapiGecis WHERE DusulenDagilimId IN (${oldIds})
    `);
    let updated = 0;
    for (const row of checkinRes.recordset) {
      const newId = sessionIdMap.get(row.DusulenDagilimId);
      if (!newId) continue;
      const checkedInAt = new Date(new Date(row.GirisTarih).getTime() - TZ);
      const method = row.KartNo === "Manuel" ? "admin" : "card";
      await pg.query(
        "UPDATE sessions SET checked_in_at=$1, check_in_method=$2, attendance_outcome='present' WHERE id=$3",
        [checkedInAt, method, newId]
      );
      updated++;
    }
    console.log("Giris guncellendi: " + updated);
  }

  await pool.close();
  await pg.end();
  console.log("TAMAMLANDI member_id=" + memberId);
}

main().catch(console.error);
