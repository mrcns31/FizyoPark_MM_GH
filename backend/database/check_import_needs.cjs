const sql = require("mssql");
const config = {
  user:"SA", password:"Fizyopark2026!", server:"localhost", port:1433,
  database:"FizyoparkDatabase",
  options:{ encrypt:false, trustServerCertificate:true }
};

const IDS = [14915,16002,15988,14886,14903,14943,14885,8676,13826,16023,13834,15999,3338,14874];
const PAKET_MAP = new Set([1,2,3,4,5,24,9,10,11,14,15,20,27,26,16,28]);

async function main() {
  const pool = await sql.connect(config);
  const idList = IDS.join(",");
  const pr = await pool.request().query(
    "SELECT DISTINCT up.PaketId FROM KG_UyePaket up WHERE up.KullaniciId IN (" + idList + ") ORDER BY up.PaketId"
  );
  console.log("Kullanilan PaketId'ler:");
  pr.recordset.forEach(r => {
    const mapped = PAKET_MAP.has(r.PaketId) ? "OK" : "EKSIK!";
    console.log("  PaketId:" + r.PaketId + " [" + mapped + "]");
  });
  await pool.close();
}
main().catch(console.error);
