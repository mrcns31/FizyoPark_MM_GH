const { Client } = require("pg");

// Eski DB'den cekildi: KullaniciId 1089 (Gokmen Erdem), PaketId=1 -> yeni packages.id=1
const PACKAGES = [
  { start: "2020-06-22", end: "2020-10-05" },
  { start: "2020-10-07", end: "2021-01-06" },
  { start: "2021-01-14", end: "2021-06-01" },
  { start: "2021-06-06", end: "2021-10-02" },
  { start: "2021-10-04", end: "2022-01-15" },
  { start: "2022-01-16", end: "2022-04-13" },
  { start: "2022-04-15", end: "2022-04-16" },
  { start: "2023-12-01", end: "2024-04-19" },
  { start: "2024-04-22", end: "2024-09-09" },
  { start: "2024-09-12", end: "2025-01-20" },
  { start: "2025-01-23", end: "2025-06-23" },
  { start: "2025-06-23", end: "2025-11-10" },
  { start: "2025-11-13", end: "2026-04-07" },
  { start: "2026-04-09", end: "2026-10-09" }, // aktif paket
];

async function main() {
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  const today = new Date("2026-06-16");
  const memberId = 1; // Gokmen Erdem
  const packageId = 1; // 36 Seans Paketi

  for (const p of PACKAGES) {
    const endDate = new Date(p.end);
    const status = endDate > today ? "active" : "completed";

    const r = await pg.query(
      "INSERT INTO member_packages (member_id, package_id, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [memberId, packageId, p.start, p.end, status]
    );
    console.log(p.start + " -> " + p.end + " [" + status + "] id=" + r.rows[0].id);
  }

  await pg.end();
  console.log("Gokmen Erdem paketleri aktarildi.");
}

main().catch(console.error);
