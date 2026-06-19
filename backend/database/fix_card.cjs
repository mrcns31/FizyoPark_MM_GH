const { Client } = require("pg");
const pg = new Client({ host:"localhost", port:5432, database:"fizyopark_mm_gh", user:"postgres", password:"" });
pg.connect().then(async () => {
  await pg.query(
    "INSERT INTO member_cards (member_id, card_no, is_primary) VALUES (242, '0010292510', true) ON CONFLICT (card_no) DO NOTHING"
  );
  console.log("Tamam: 0010292510 kartı Melek Yılmaztürk (id:242) e eklendi");
  await pg.end();
}).catch(console.error);
