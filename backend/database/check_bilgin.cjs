const sql = require("mssql");
const config = {
  user:"SA", password:"Fizyopark2026!", server:"localhost", port:1433,
  database:"FizyoparkDatabase",
  options:{ encrypt:false, trustServerCertificate:true }
};
async function main() {
  const pool = await sql.connect(config);
  const r = await pool.request().query(`
    SELECT AdiSoyadi,
           COUNT(DISTINCT KullaniciId) as cnt,
           STRING_AGG(CAST(KullaniciId AS VARCHAR), ',') WITHIN GROUP (ORDER BY KullaniciId) as ids,
           STRING_AGG(ISNULL(Telefonu,''), ',') WITHIN GROUP (ORDER BY KullaniciId) as phones
    FROM view_KG_KullaniciListesi
    WHERE Tipi=1 AND Silindi=0 AND (AdiSoyadi LIKE N'V%' OR AdiSoyadi LIKE N'Y%' OR AdiSoyadi LIKE N'Z%')
    GROUP BY AdiSoyadi
    ORDER BY AdiSoyadi
  `);
  console.log("Toplam:", r.recordset.length, "kisi");
  r.recordset.forEach(row =>
    console.log(row.AdiSoyadi + " | cnt:" + row.cnt + " | ids:" + row.ids + " | tel:" + row.phones)
  );
  await pool.close();
}
main().catch(console.error);
