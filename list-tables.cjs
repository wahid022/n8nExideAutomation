require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});

p.query(`
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
AND table_type='BASE TABLE'
ORDER BY table_name
`)
.then(r=>{
 console.log(r.rows.map(x=>x.table_name));
 return p.end();
})
.catch(async e=>{
 console.error(e.message);
 await p.end();
});
