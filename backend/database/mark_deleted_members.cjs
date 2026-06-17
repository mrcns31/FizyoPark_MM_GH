const sql = require("mssql");
const config = {
  user:"SA", password:"Fizyopark2026!", server:"localhost", port:1433,
  database:"FizyoparkDatabase",
  options:{ encrypt:false, trustServerCertificate:true }
};

const ALL_IDS = [
  37,1089, 1143,1207,1208, 44,45,1061,1110,
  42,43,1078, 1106,1107,1108, 1117,1121,1126, 1254,1264,1273,
  12794,16018, 1116,1120, 12744,12751, 1228,1234, 3352,3355,
  47,1053, 1057,1059, 49,1063, 1068,1085, 8694,8695,
  5471,14963, 3363,3364, 7540,7541, 1058,1060, 1118,1122,
  14888,14919, 1145,1146, 15979,15980, 1141,1142, 50,1050,
  8683,8687, 1092,1103, 35,1231, 1221,1240, 6526,6529,
  1127,1150, 1072,1073, 1137,1151, 1082,1084, 1087,1088,
  1101,1102, 1112,1113, 4413,4414
];

async function del(pool, table, col) {
  const idList = ALL_IDS.join(",");
  const r = await pool.request().query(`DELETE FROM ${table} WHERE ${col} IN (${idList})`);
  console.log(`${table} (${col}): ${r.rowsAffected[0]}`);
}

async function main() {
  const pool = await sql.connect(config);
  const idList = ALL_IDS.join(",");

  const ortRes = await pool.request().query(
    `SELECT DISTINCT OrtKullaniciId FROM KG_KullaniciDiger WHERE Id IN (${idList})`
  );
  const ortIds = ortRes.recordset.map(r => r.OrtKullaniciId).join(",");
  console.log("ORT_Kullanici hedef:", ortRes.recordset.length);

  await del(pool, "KG_KullaniciDurum",       "KullaniciId");
  await del(pool, "KG_KullaniciKart",         "KullaniciId");
  await del(pool, "KG_KullaniciQRCodeGecis",  "KullaniciId");
  await del(pool, "KG_UyeFatura",             "KullaniciId");

  const r1 = await pool.request().query(`DELETE FROM KG_KullaniciDiger WHERE Id IN (${idList})`);
  console.log(`KG_KullaniciDiger: ${r1.rowsAffected[0]}`);

  const r2 = await pool.request().query(`DELETE FROM ORT_Kullanici WHERE Id IN (${ortIds})`);
  console.log(`ORT_Kullanici: ${r2.rowsAffected[0]}`);

  await pool.close();
  console.log("TAMAMLANDI");
}
main().catch(console.error);
