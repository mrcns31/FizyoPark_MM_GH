const sql = require("mssql");
const { Client } = require("pg");

const STAFF_MAP = new Map([
  [5436,1],[3,2],[14879,3],[15982,4],[5478,5],
  [7,6],[24,7],[26,8],[30,9],[32,10],[1055,11],
  [1133,12],[1134,13],[1201,14],[1222,15],[1223,16],
  [1291,17],[3395,18],[3396,19],[5431,20],[5470,21],
  [5476,22],[5477,23],
]);
const PAKET_MAP = new Map([[1,1],[2,2],[3,3],[4,4],[5,5],[24,6]]);
const TZ = 3 * 60 * 60 * 1000;
const SESSION_DURATION_MS = 60 * 60 * 1000;
const TODAY = new Date("2026-06-17");
const DELETED_AT = new Date("2026-06-17T00:00:00.000Z");

const MEMBERS = [
  {
    name: "Asuman Bozkurt", firstName: "Asuman", lastName: "Bozkurt",
    email: null, phone: "5336076097",
    allIds: [42, 43, 1078],
    cards: [{ no: "0010900932", primary: true }],
  },
  {
    name: "Banu Baydar", firstName: "Banu", lastName: "Baydar",
    email: null, phone: "5068542758",
    allIds: [1106, 1107, 1108],
    cards: [{ no: "0010890247", primary: true }],
  },
  {
    name: "Doga Celeb", firstName: "Doga", lastName: "Celeb",
    email: "dogaceleb@gmail.com", phone: "5331910016",
    birthDate: "2006-12-12", profession: "Ogrenci",
    allIds: [1117, 1121, 1126],
    cards: [{ no: "0010769925", primary: true }],
  },
  {
    name: "Sevgi Catak", firstName: "Sevgi", lastName: "Catak",
    email: null, phone: "5336546611",
    allIds: [1254, 1264, 1273],
    cards: [],
  },
];

const mssqlConfig = {
  user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
  database: "FizyoparkDatabase",
  options: { encrypt: false, trustServerCertificate: true },
};

async function importMember(pool, pg, m) {
  const idList = m.allIds.join(",");

  // 1. UYE
  const mRes = await pg.query(`
    INSERT INTO members (name, first_name, last_name, email, phone, birth_date, profession, deleted_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [m.name, m.firstName, m.lastName, m.email||null, m.phone,
     m.birthDate||null, m.profession||null, DELETED_AT]
  );
  const memberId = mRes.rows[0].id;
  await pg.query("UPDATE members SET member_no=$1 WHERE id=$2", ["U"+memberId, memberId]);

  // 2. KARTLAR
  for (const c of m.cards) {
    await pg.query(
      "INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,$3) ON CONFLICT (card_no) DO NOTHING",
      [memberId, c.no, c.primary]
    );
  }

  // 3. PAKETLER
  const pkgRes = await pool.request().query(`
    SELECT up.Id as UyePaketId, up.PaketId, up.BaslamaTarihi, up.BitisTarihi
    FROM KG_UyePaket up WHERE up.KullaniciId IN (${idList})
    ORDER BY up.BaslamaTarihi, up.Id
  `);
  const mpMap = new Map();
  for (const row of pkgRes.recordset) {
    const newPaketId = PAKET_MAP.get(row.PaketId);
    if (!newPaketId) continue;
    const endDate = new Date(row.BitisTarihi);
    const status = endDate > TODAY ? "active" : "completed";
    const r = await pg.query(
      "INSERT INTO member_packages (member_id, package_id, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [memberId, newPaketId, row.BaslamaTarihi.toISOString().slice(0,10), endDate.toISOString().slice(0,10), status]
    );
    mpMap.set(row.UyePaketId, r.rows[0].id);
  }

  // 4. SEANSLAR
  const sesRes = await pool.request().query(`
    SELECT Id, Tarih, TerapistId, UyePaketId
    FROM KG_UyeTerapistDagilim
    WHERE KullaniciId IN (${idList}) AND SilindiMi=0
    ORDER BY Tarih
  `);
  const sessionIdMap = new Map();
  for (const row of sesRes.recordset) {
    const startTs = new Date(row.Tarih).getTime() - TZ;
    const r = await pg.query(
      "INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [memberId, STAFF_MAP.get(row.TerapistId)||null, mpMap.get(row.UyePaketId)||null,
       startTs, startTs + SESSION_DURATION_MS]
    );
    sessionIdMap.set(row.Id, r.rows[0].id);
  }

  // 5. GIRIS SAATI
  let updated = 0;
  if (sesRes.recordset.length > 0) {
    const oldIds = sesRes.recordset.map(r => r.Id).join(",");
    const ciRes = await pool.request().query(`
      SELECT DusulenDagilimId, Tarih as GT, KartNo FROM KG_KapiGecis
      WHERE DusulenDagilimId IN (${oldIds})
    `);
    for (const row of ciRes.recordset) {
      const newId = sessionIdMap.get(row.DusulenDagilimId);
      if (!newId) continue;
      const checkedInAt = new Date(new Date(row.GT).getTime() - TZ);
      const method = row.KartNo === "Manuel" ? "admin" : "card";
      await pg.query(
        "UPDATE sessions SET checked_in_at=$1, check_in_method=$2, attendance_outcome='present' WHERE id=$3",
        [checkedInAt, method, newId]
      );
      updated++;
    }
  }

  console.log(`OK ${m.name} | id=${memberId} | paket=${mpMap.size} | seans=${sesRes.recordset.length} | giris=${updated}`);
}

async function main() {
  const pool = await sql.connect(mssqlConfig);
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  for (const m of MEMBERS) {
    await importMember(pool, pg, m);
  }

  await pool.close();
  await pg.end();
  console.log("TAMAMLANDI");
}

main().catch(console.error);
