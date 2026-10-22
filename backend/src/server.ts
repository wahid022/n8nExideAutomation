import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin =
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: frontendOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, current_user AS user'
    );

    res.json({
      status: 'ok',
      database: result.rows[0].database,
      user: result.rows[0].user,
    });
  } catch (error) {
    console.error(
      'Database health check failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

function parsePositiveInt(
  value: unknown,
  fallback: number,
  max: number
): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

function queryText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed.length > 100) return null;
  return trimmed;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildFilters(query: express.Request['query']) {
  const search = queryText(query.search);
  const brand = queryText(query.brand);
  const category = queryText(query.category);

  if (search === null || brand === null || category === null) {
    return { error: true as const };
  }

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${escapeLike(search)}%`);
    conditions.push(
      `(p.product_code ILIKE $${values.length} ESCAPE E'\\\\'` +
      ` OR p.brand ILIKE $${values.length} ESCAPE E'\\\\'` +
      ` OR p.category ILIKE $${values.length} ESCAPE E'\\\\'` +
      ` OR COALESCE(p.sub_category, '') ILIKE $${values.length} ESCAPE E'\\\\'` +
      ` OR p.model_sku ILIKE $${values.length} ESCAPE E'\\\\'` +
      ` OR COALESCE(p.specs_capacity, '') ILIKE $${values.length} ESCAPE E'\\\\')`
    );
  }

  if (brand) {
    values.push(brand);
    conditions.push(`p.brand = $${values.length}`);
  }

  if (category) {
    values.push(category);
    conditions.push(`p.category = $${values.length}`);
  }

  return {
    error: false as const,
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

app.get('/api/products', async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 1_000_000);
  const pageSize = parsePositiveInt(req.query.pageSize, 20, 100);

  if (page === null || pageSize === null) {
    res.status(400).json({
      error: 'Invalid pagination parameters. Use page >= 1 and pageSize between 1 and 100.',
    });
    return;
  }

  const filters = buildFilters(req.query);
  if (filters.error) {
    res.status(400).json({
      error: 'Search, brand and category must be strings of at most 100 characters.',
    });
    return;
  }

  try {
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM public.products p
       ${filters.where}`,
      filters.values
    );

    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const dataValues = [...filters.values, pageSize, offset];
    const limitPosition = dataValues.length - 1;
    const pageSizePosition = dataValues.length - 1;
    const offsetPosition = dataValues.length;

    const result = await pool.query(
      `SELECT
         p.id,
         p.product_code AS "productCode",
         p.brand,
         p.category,
         p.sub_category AS "subCategory",
         p.model_sku AS "modelSku",
         p.specs_capacity AS "specsCapacity",
         p.warranty,
         p.hsn,
         price.dealer_price AS "dealerPrice",
         price.mrp,
         price.gst_rate AS "gstRate",
         price.effective_from AS "effectiveFrom"
       FROM public.products p
       LEFT JOIN LATERAL (
         SELECT
           pp.dealer_price,
           pp.mrp,
           pp.gst_rate,
           pp.effective_from
         FROM public.product_prices pp
         WHERE pp.product_id = p.id
           AND (
             pp.effective_from IS NULL
             OR pp.effective_from <= CURRENT_DATE
           )
         ORDER BY
           pp.effective_from DESC NULLS LAST,
           pp.created_at DESC,
           pp.id DESC
         LIMIT 1
       ) price ON TRUE
       ${filters.where}
       ORDER BY p.product_code ASC, p.id ASC
       LIMIT $${pageSizePosition}
       OFFSET $${offsetPosition}`,
      dataValues
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error(
      'Product catalogue query failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    res.status(500).json({
      error: 'Unable to retrieve products.',
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id;

  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    res.status(400).json({ error: 'Product ID must be a positive integer.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.product_code AS "productCode",
         p.brand,
         p.category,
         p.sub_category AS "subCategory",
         p.model_sku AS "modelSku",
         p.specs_capacity AS "specsCapacity",
         p.warranty,
         p.hsn,
         price.dealer_price AS "dealerPrice",
         price.mrp,
         price.gst_rate AS "gstRate",
         price.effective_from AS "effectiveFrom"
       FROM public.products p
       LEFT JOIN LATERAL (
         SELECT
           pp.dealer_price,
           pp.mrp,
           pp.gst_rate,
           pp.effective_from
         FROM public.product_prices pp
         WHERE pp.product_id = p.id
           AND (
             pp.effective_from IS NULL
             OR pp.effective_from <= CURRENT_DATE
           )
         ORDER BY
           pp.effective_from DESC NULLS LAST,
           pp.created_at DESC,
           pp.id DESC
         LIMIT 1
       ) price ON TRUE
       WHERE p.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(
      'Product detail query failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    res.status(500).json({ error: 'Unable to retrieve product.' });
  }
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Backend listening at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
