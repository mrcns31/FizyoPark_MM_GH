const { Client } = require("pg");

const PACKAGES = [
  { name: "36 Seans Paketi", lesson_count: 36, month_overrun: 6, weekly_lesson_count: null, package_type: "flexible" },
  { name: "24 Seans Paketi", lesson_count: 24, month_overrun: 4, weekly_lesson_count: null, package_type: "flexible" },
  { name: "12 Seans Paketi", lesson_count: 12, month_overrun: 2, weekly_lesson_count: null, package_type: "flexible" },
  { name: "Aylik8 Paketi",   lesson_count: 8,  month_overrun: 1, weekly_lesson_count: 3,    package_type: "fixed"    },
];

async function main() {
  const pg = new Client({ host: "localhost", port: 5432, database: "fizyopark_mm_gh", user: "postgres", password: "" });
  await pg.connect();

  for (const p of PACKAGES) {
    const r = await pg.query(
      "INSERT INTO packages (name, lesson_count, month_overrun, weekly_lesson_count, package_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [p.name, p.lesson_count, p.month_overrun, p.weekly_lesson_count, p.package_type]
    );
    console.log("OK " + p.name + " -> id=" + r.rows[0].id);
  }

  await pg.end();
}

main().catch(console.error);
