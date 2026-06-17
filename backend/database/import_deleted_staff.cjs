const sql = require("mssql");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const mssqlConfig = {
  user: "SA", password: "Fizyopark2026!", server: "localhost", port: 1433,
  database: "FizyoparkDatabase",
  options: { encrypt: false, trustServerCertificate: true },
};

async function main() {
  const pool = await sql.connect(mssqlConfig);
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  const result = await pool.request().query(`
    SELECT KullaniciId, AdiSoyadi, Telefonu
    FROM view_KG_KullaniciListesi
    WHERE Tipi IN (2,3) AND Silindi = 1
    ORDER BY KullaniciId
  `);

  const hash = await bcrypt.hash("disabled", 10);

  // Eski KullaniciDiger.Id -> yeni staff.id
  const staffMap = new Map();

  for (const row of result.recordset) {
    const name = row.AdiSoyadi.trim();
    const parts = name.split(" ");
    const lastName = parts.pop();
    const firstName = parts.join(" ");
    const rawPhone = (row.Telefonu || "").trim();
    const phone = rawPhone.replace(/^0+/, "") || null;

    // username: ad soyad slugify + kullanici id (cakisma onleme)
    const slug = name.toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, (c) => {
        const map = { "ı":"i","ğ":"g","ü":"u","ş":"s","ö":"o","ç":"c","İ":"i","Ğ":"g","Ü":"u","Ş":"s","Ö":"o","Ç":"c" };
        return map[c] || "";
      });
    const username = slug + "_" + row.KullaniciId;
    const email = username + "@fizyopark.com";

    const uRes = await pg.query(
      `INSERT INTO users (username, email, password_hash, role, is_active, display_name, phone)
       VALUES ($1, $2, $3, 'staff', false, $4, $5)
       ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [username, email, hash, name, phone]
    );
    const userId = uRes.rows[0].id;

    const existing = await pg.query("SELECT id FROM staff WHERE user_id = $1", [userId]);
    let staffId;
    if (existing.rows.length > 0) {
      staffId = existing.rows[0].id;
    } else {
      const sRes = await pg.query(
        "INSERT INTO staff (user_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, firstName, lastName, phone]
      );
      staffId = sRes.rows[0].id;
    }

    staffMap.set(row.KullaniciId, staffId);
    console.log("OK eski:" + row.KullaniciId + " " + name + " -> staff.id=" + staffId + " (inactive)");
  }

  await pool.close();
  await pg.end();

  // Mapping'i yazdir
  console.log("\n--- STAFF MAP (eski KullaniciId -> yeni staff.id) ---");
  for (const [k, v] of staffMap) console.log(k + " -> " + v);
}

main().catch(console.error);
