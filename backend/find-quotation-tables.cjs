require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

p.query("SELECT * FROM public.quotations ORDER BY created_at DESC LIMIT 10")
  .then(r => {
    console.log(r.rows);
    return p.end();
  })
  .catch(async e => {
    console.error(e.message);
    await p.end();
  });
