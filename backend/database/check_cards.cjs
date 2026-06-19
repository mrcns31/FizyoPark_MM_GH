const sql = require("mssql");
const { Client } = require("pg");
const mssqlConfig = {
  user:"SA", password:"Fizyopark2026!", server:"localhost", port:1433,
  database:"FizyoparkDatabase",
  options:{ encrypt:false, trustServerCertificate:true }
};

async function main() {
  // Yeni DB'de kartı olmayan üyeler
  const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
  await pg.connect();

  const noCard = await pg.query(`
    SELECT m.id, m.name FROM members m
    WHERE m.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM member_cards mc WHERE mc.member_id = m.id)
    ORDER BY m.name
  `);
  console.log("Yeni DB'de kartsız üye sayısı:", noCard.rows.length);

  // Tüm mevcut kartlar
  const existingCards = await pg.query("SELECT card_no, member_id FROM member_cards");
  const cardMap = new Map(existingCards.rows.map(r => [r.card_no, r.member_id]));
  const memberNames = new Map(noCard.rows.map(r => [r.id, r.name]));
  noCard.rows.forEach(r => memberNames.set(r.id, r.name));

  // Yeni DB üye adı → id map
  const allMembers = await pg.query("SELECT id, name FROM members WHERE deleted_at IS NULL");
  const nameToNewId = new Map(allMembers.rows.map(r => [r.name, r.id]));

  await pg.end();

  // Eski DB'de bu üyelerin kartlarını bul
  const pool = await sql.connect(mssqlConfig);

  console.log("\n=== Yeni DB'de kartı olmayan ama eski DB'de kartı olan üyeler ===");
  let problemCount = 0;

  for (const member of noCard.rows) {
    // Eski DB'de bu üyeyi isimle bul
    const r = await pool.request().query(`
      SELECT KullaniciId FROM view_KG_KullaniciListesi
      WHERE AdiSoyadi = N'${member.name.replace("'", "''")}' AND Tipi=1
    `);
    if (!r.recordset.length) continue;
    const oldIds = r.recordset.map(x => x.KullaniciId).join(",");

    // Eski DB'deki kartları
    const cards = await pool.request().query(
      "SELECT DISTINCT KartNo FROM KG_KapiGecis WHERE KullaniciId IN (" + oldIds + ") AND KartNo <> 'Manuel'"
    );
    if (!cards.recordset.length) continue;

    // Bu kartlar yeni DB'de kime atanmış?
    for (const c of cards.recordset) {
      const assignedTo = cardMap.get(c.KartNo);
      if (assignedTo && assignedTo !== member.id) {
        // Kart başka birine atanmış
        const pg2 = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
        await pg2.connect();
        const owner = await pg2.query("SELECT name FROM members WHERE id=$1", [assignedTo]);
        await pg2.end();
        console.log("SORUN | " + member.name + " kartı " + c.KartNo + " → yeni DB'de " + (owner.rows[0]?.name || "?") + " adına kayıtlı");
        problemCount++;
      }
    }
  }

  if (problemCount === 0) console.log("Başka sorun yok.");
  console.log("\nToplam sorun:", problemCount);
  await pool.close();
}
main().catch(console.error);
