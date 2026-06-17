const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
c.connect()
  .then(() => c.query("SELECT id, name, card_no FROM members WHERE card_no = '0020765282'"))
  .then(r => { console.log(r.rows); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
