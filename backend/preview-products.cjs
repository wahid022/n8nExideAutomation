require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});

p.query(`
SELECT
  p.id,
  p.product_code,
  p.brand,
  p.category,
  p.model_sku,
  p.specs_capacity,
  pp.dealer_price,
  pp.mrp,
  pp.gst_rate
FROM public.products p
LEFT JOIN public.product_prices pp ON pp.product_id = p.id
ORDER BY p.id
LIMIT 10
`)
.then(r=>{
  console.table(r.rows);
  return p.end();
})
.catch(async e=>{
  console.error(e.message);
  await p.end();
});
