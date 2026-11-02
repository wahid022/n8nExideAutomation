require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});

p.query(`
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
AND (
 table_name ILIKE '%product%'
 OR table_name ILIKE '%price%'
)
ORDER BY table_name, ordinal_position
`)
.then(r=>{
 console.table(r.rows);
 return p.end();
})
.catch(async e=>{
 console.error(e.message);
 await p.end();
});
