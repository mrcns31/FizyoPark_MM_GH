const sql = require("mssql");
const { Client } = require("pg");

const STAFF_MAP = new Map([
  [5436,1],[3,2],[14879,3],[15982,4],[5478,5],
  [7,6],[24,7],[26,8],[30,9],[32,10],[1055,11],
  [1133,12],[1134,13],[1201,14],[1222,15],[1223,16],
  [1291,17],[3395,18],[3396,19],[5431,20],[5470,21],
  [5476,22],[5477,23],
]);

// PaketId (eski) → packages.id (yeni) — 7-13 bu scriptte ekleniyor
const PAKET_MAP = new Map([
  [1,1],[2,2],[3,3],[4,4],[5,5],[24,6],
  [9,7],[10,8],[11,9],[14,10],[15,11],[20,12],
  [27,13],[26,14],[16,15],[28,16],
]);

const TZ = 3 * 60 * 60 * 1000;
const SESSION_DURATION_MS = 60 * 60 * 1000;
const TODAY = new Date("2026-06-17");

// "V/Y/Z" harfi ile başlayan üyeler — hepsi tek kayıt (Zzz A id:14856 atlandı)
const MEMBER_GROUPS = [
  { allIds: [14915], canonicalId: 14915 }, // Volkan Özdemir
  { allIds: [16002], canonicalId: 16002 }, // Yağmur Demir
  { allIds: [15988], canonicalId: 15988 }, // Yasemin Gülcü
  { allIds: [14886], canonicalId: 14886 }, // Yasemin Özkan
  { allIds: [14903], canonicalId: 14903 }, // Yeşim Fatma Kalender Öksüz
  { allIds: [14943], canonicalId: 14943 }, // Yeşim Özdemir
  { allIds: [14885], canonicalId: 14885 }, // Yiğit Karahan
  { allIds: [8676],  canonicalId: 8676  }, // Zeynep Çelik
  { allIds: [13826], canonicalId: 13826 }, // Zeynep Eraydın
  { allIds: [16023], canonicalId: 16023 }, // Zeynep Eryılmaz
  { allIds: [13834], canonicalId: 13834 }, // Zeynep Kılınç
  { allIds: [15999], canonicalId: 15999 }, // Zeynep Özbay
  { allIds: [3338],  canonicalId: 3338  }, // Zeynep Sümer
  { allIds: [14874], canonicalId: 14874 }, // Zeynep Yılmaz Kalınöz
];

const mssqlConfig = {
  user:"SA", password:"Fizyopark2026!", server:"localhost", port:1433,
  database:"FizyoparkDatabase",
  options:{ encrypt:false, trustServerCertificate:true }
};

async function addMissingPackages(pg) {
  const newPkgs = [
    { id:7,  name:"Birebir 10 Paketi", package_type:"flexible", lesson_count:10, month_overrun:2  },
    { id:8,  name:"Birebir 20 Paketi", package_type:"flexible", lesson_count:20, month_overrun:4  },
    { id:9,  name:"Birebir 30 Paketi", package_type:"flexible", lesson_count:30, month_overrun:6  },
    { id:10, name:"ONLINE8",           package_type:"fixed",    lesson_count:8,  month_overrun:1  },
    { id:11, name:"ONLINE12",          package_type:"fixed",    lesson_count:12, month_overrun:2  },
    { id:12, name:"DevredenPaket",     package_type:"flexible", lesson_count:4,  month_overrun:1  },
    { id:13, name:"3Paket",            package_type:"flexible", lesson_count:3,  month_overrun:1  },
    { id:14, name:"6 Seans Paketi",    package_type:"fixed",    lesson_count:6,  month_overrun:1  },
    { id:15, name:"LOSEV",             package_type:"fixed",    lesson_count:4,  month_overrun:1  },
    { id:16, name:"Yarı36Paketi",      package_type:"flexible", lesson_count:18, month_overrun:4  },
  ];
  for (const p of newPkgs) {
    await pg.query(
      `INSERT INTO packages (id, name, package_type, lesson_count, month_overrun)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, p.package_type, p.lesson_count, p.month_overrun]
    );
  }
  // sequence güncelle
  await pg.query("SELECT setval('packages_id_seq', (SELECT MAX(id) FROM packages))");
  console.log("Paketler eklendi (id 7-16)");
}

async function importGroup(pool, pg, group) {
  const { allIds, canonicalId } = group;
  const idList = allIds.join(",");

  // Üye bilgisi (canonical'dan — KG_KullaniciDiger JOIN ORT_Kullanici)
  const infoR = await pool.request().query(`
    SELECT TOP 1 o.Ad, o.Soyad, d.Telefonu, o.EPosta, d.DogumTarihi, d.Meslegi, o.Silindi
    FROM KG_KullaniciDiger d
    JOIN ORT_Kullanici o ON o.Id = d.OrtKullaniciId
    WHERE d.Id = ${canonicalId}
  `);
  if (!infoR.recordset.length) { console.log("UYARI: canonical bulunamadi", canonicalId); return; }
  const info = infoR.recordset[0];

  const firstName = (info.Ad || "").trim();
  const lastName  = (info.Soyad || "").trim();
  const fullName  = (firstName + " " + lastName).trim();
  const phone     = (info.Telefonu || "").replace(/\D/g,"").replace(/^0/,"") || null;
  const email     = (info.EPosta || "").trim() || null;
  const birthDate = info.DogumTarihi ? new Date(info.DogumTarihi).toISOString().slice(0,10) : null;
  const profession = (info.Meslegi || "").trim() || null;
  const deletedAt = info.Silindi ? new Date("2026-06-17T00:00:00.000Z") : null;

  // Üye ekle
  const mRes = await pg.query(
    `INSERT INTO members (name, first_name, last_name, email, phone, birth_date, profession, deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [fullName, firstName, lastName, email, phone, birthDate, profession, deletedAt]
  );
  const memberId = mRes.rows[0].id;
  await pg.query("UPDATE members SET member_no=$1 WHERE id=$2", ["U"+memberId, memberId]);

  // Kartlar (tüm ID'lerden, unique)
  const cardR = await pool.request().query(`
    SELECT DISTINCT KartNo FROM KG_KapiGecis
    WHERE KullaniciId IN (${idList}) AND KartNo <> 'Manuel'
  `);
  const seenCards = new Set();
  for (const c of cardR.recordset) {
    if (seenCards.has(c.KartNo)) continue;
    seenCards.add(c.KartNo);
    await pg.query(
      `INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,$3) ON CONFLICT (card_no) DO NOTHING`,
      [memberId, c.KartNo, seenCards.size === 1]
    );
  }

  // Paketler (tüm ID'lerden)
  const pkgR = await pool.request().query(`
    SELECT Id as UyePaketId, PaketId, BaslamaTarihi, BitisTarihi
    FROM KG_UyePaket WHERE KullaniciId IN (${idList})
    ORDER BY BaslamaTarihi, Id
  `);
  const mpMap = new Map();
  for (const row of pkgR.recordset) {
    const newPaketId = PAKET_MAP.get(row.PaketId);
    if (!newPaketId) { console.log("  BILINMEYEN PaketId:", row.PaketId); continue; }
    let endDate = new Date(row.BitisTarihi);
    const startDate = new Date(row.BaslamaTarihi);
    if (endDate < startDate) endDate = startDate; // eski DB'de bozuk veri
    const status  = endDate > TODAY ? "active" : "completed";
    const r = await pg.query(
      `INSERT INTO member_packages (member_id, package_id, start_date, end_date, status)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [memberId, newPaketId,
       new Date(row.BaslamaTarihi).toISOString().slice(0,10),
       endDate.toISOString().slice(0,10), status]
    );
    mpMap.set(row.UyePaketId, r.rows[0].id);
  }

  // Seanslar (SilindiMi=0)
  const sesR = await pool.request().query(`
    SELECT Id, Tarih, TerapistId, UyePaketId
    FROM KG_UyeTerapistDagilim
    WHERE KullaniciId IN (${idList}) AND SilindiMi=0
    ORDER BY Tarih
  `);
  const sessionIdMap = new Map();
  for (const row of sesR.recordset) {
    const startTs = new Date(row.Tarih).getTime() - TZ;
    const r = await pg.query(
      `INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [memberId, STAFF_MAP.get(row.TerapistId)||null, mpMap.get(row.UyePaketId)||null,
       startTs, startTs + SESSION_DURATION_MS]
    );
    sessionIdMap.set(row.Id, r.rows[0].id);
  }

  // Giriş saatleri
  let checkedIn = 0;
  if (sesR.recordset.length > 0) {
    const oldIds = sesR.recordset.map(r => r.Id).join(",");
    const ciR = await pool.request().query(`
      SELECT DusulenDagilimId, Tarih as GT, KartNo FROM KG_KapiGecis
      WHERE DusulenDagilimId IN (${oldIds})
    `);
    for (const row of ciR.recordset) {
      const newId = sessionIdMap.get(row.DusulenDagilimId);
      if (!newId) continue;
      const method = row.KartNo === "Manuel" ? "admin" : "card";
      await pg.query(
        `UPDATE sessions SET checked_in_at=$1, check_in_method=$2, attendance_outcome='present' WHERE id=$3`,
        [new Date(new Date(row.GT).getTime() - TZ), method, newId]
      );
      checkedIn++;
    }
  }

  const status = deletedAt ? "eski" : "aktif";
  console.log(`OK [${status}] ${fullName} | id=${memberId} | paket=${mpMap.size} | seans=${sesR.recordset.length} | giris=${checkedIn} | kart=${seenCards.size}`);
}

async function main() {
  const pool = await sql.connect(mssqlConfig);
  const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
  await pg.connect();

  await addMissingPackages(pg);

  for (const group of MEMBER_GROUPS) {
    await importGroup(pool, pg, group);
  }

  await pool.close();
  await pg.end();
  console.log("TAMAMLANDI");
}

main().catch(console.error);
