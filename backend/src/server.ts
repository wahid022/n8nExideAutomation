
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

// -----------------------------------------------------------------------------
// Supabase authentication
// -----------------------------------------------------------------------------

type AuthenticatedUser = {
  id: string;
  email?: string;
};

async function requireSupabaseUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    console.error('Supabase backend authentication is not configured.');
    res.status(503).json({
      error: 'Authentication service unavailable.',
    });
    return;
  }

  try {
    // Ask Supabase Auth to validate the access token.
    // Never trust a user ID or email supplied in the request body.
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      res.status(401).json({
        error: 'Invalid or expired session.',
      });
      return;
    }

    const user = (await response.json()) as AuthenticatedUser;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (typeof user.id !== 'string' || !uuidPattern.test(user.id)) {
      res.status(401).json({
        error: 'Invalid authenticated user.',
      });
      return;
    }

    res.locals.authenticatedUser = user;
    next();
  } catch (error) {
    console.error(
      'Supabase token verification failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.status(503).json({
      error: 'Unable to verify session.',
    });
  }
}

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, current_user AS user',
    );

    res.json({
      status: 'ok',
      database: result.rows[0].database,
      user: result.rows[0].user,
    });
  } catch (error) {
    console.error(
      'Database health check failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

// -----------------------------------------------------------------------------
// Shared query helpers
// -----------------------------------------------------------------------------

function parsePositiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number | null {
  if (value === undefined) return fallback;

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed <= max
    ? parsed
    : null;
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
        ` OR COALESCE(p.specs_capacity, '') ILIKE $${values.length} ESCAPE E'\\\\')`,
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
    where: conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '',
    values,
  };
}

// -----------------------------------------------------------------------------
// Product catalogue: paginated search and filters
// -----------------------------------------------------------------------------

app.get('/api/products', async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 1_000_000);
  const pageSize = parsePositiveInt(req.query.pageSize, 20, 100);

  if (page === null || pageSize === null) {
    res.status(400).json({
      error:
        'Invalid pagination parameters. Use page >= 1 and pageSize between 1 and 100.',
    });
    return;
  }

  const filters = buildFilters(req.query);

  if (filters.error) {
    res.status(400).json({
      error:
        'Search, brand and category must be strings of at most 100 characters.',
    });
    return;
  }

  try {
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM public.products p
       ${filters.where}`,
      filters.values,
    );

    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const dataValues = [...filters.values, pageSize, offset];
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
      dataValues,
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
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.status(500).json({
      error: 'Unable to retrieve products.',
    });
  }
});

// -----------------------------------------------------------------------------
// Single product detail
// -----------------------------------------------------------------------------

app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id;

  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    res.status(400).json({
      error: 'Product ID must be a positive integer.',
    });
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
      [id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    res.json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Product detail query failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.status(500).json({
      error: 'Unable to retrieve product.',
    });
  }
});

// -----------------------------------------------------------------------------
// Update MRP or Dealer Price and record an audit entry
// Requires an authenticated Supabase user.
// -----------------------------------------------------------------------------

app.patch(
  '/api/products/:productCode/price',
  requireSupabaseUser,
  async (req, res) => {
    const productCode = req.params.productCode;
    const { field, value } = req.body ?? {};
    const user = res.locals.authenticatedUser as AuthenticatedUser;

    // Only these two database columns can be changed through this endpoint.
    const column =
      field === 'MRP'
        ? 'mrp'
        : field === 'Dealer Price'
          ? 'dealer_price'
          : null;

    if (!column) {
      res.status(400).json({
        error: 'Field must be MRP or Dealer Price.',
      });
      return;
    }

    if (
      typeof productCode !== 'string' ||
      productCode.trim().length === 0 ||
      productCode.length > 100
    ) {
      res.status(400).json({
        error: 'Invalid product code.',
      });
      return;
    }

    // NUMERIC(12,2) allows up to 10 integer digits and 2 decimal digits.
    if (
      value !== null &&
      (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 9_999_999_999.99 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-7
      )
    ) {
      res.status(400).json({
        error:
          'Price must be null or a non-negative amount with at most two decimal places.',
      });
      return;
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;

      // Lock the product to serialize concurrent price edits for this product.
      const productResult = await client.query<{
        id: string;
        product_code: string;
      }>(
        `SELECT id, product_code
         FROM public.products
         WHERE product_code = $1
         FOR UPDATE`,
        [productCode],
      );

      if (productResult.rowCount === 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        res.status(404).json({
          error: 'Product not found.',
        });
        return;
      }

      const product = productResult.rows[0];

      // Match the exact selection order used by the catalogue GET endpoints.
      const priceResult = await client.query<{
        id: string;
        dealer_price: string | null;
        mrp: string | null;
        gst_rate: string | null;
        effective_from: string | null;
      }>(
        `SELECT
           id,
           dealer_price,
           mrp,
           gst_rate,
           effective_from
         FROM public.product_prices
         WHERE product_id = $1
           AND (
             effective_from IS NULL
             OR effective_from <= CURRENT_DATE
           )
         ORDER BY
           effective_from DESC NULLS LAST,
           created_at DESC,
           id DESC
         LIMIT 1
         FOR UPDATE`,
        [product.id],
      );

      let priceRecordId: string;
      let oldValue: string | null;

      if ((priceResult.rowCount ?? 0) > 0) {
        const priceRow = priceResult.rows[0];

        priceRecordId = priceRow.id;
        oldValue = priceRow[column];

        // The table constraint requires at least one field to be populated.
        // Prevent clearing the last populated field of this price record.
        if (value === null) {
          const otherPrice =
            column === 'mrp'
              ? priceRow.dealer_price
              : priceRow.mrp;

          if (
            otherPrice === null &&
            priceRow.gst_rate === null &&
            priceRow.effective_from === null
          ) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            res.status(409).json({
              error:
                'Cannot clear the last populated field of this price record.',
            });
            return;
          }
        }

        const unchanged =
          oldValue === null
            ? value === null
            : value !== null && Number(oldValue) === value;

        if (unchanged) {
          await client.query('COMMIT');
          transactionStarted = false;

          res.json({
            success: true,
            changed: false,
            productCode: product.product_code,
            field,
            value: oldValue === null ? null : Number(oldValue),
            message: 'No changes to save.',
          });
          return;
        }

        await client.query(
          `UPDATE public.product_prices
           SET ${column} = $1
           WHERE id = $2`,
          [value, priceRecordId],
        );
      } else {
        // There is no currently applicable price record.
        // Clearing a nonexistent price is not a meaningful update.
        if (value === null) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          res.status(409).json({
            error: 'This product has no current price to clear.',
          });
          return;
        }

        const insertResult = await client.query<{ id: string }>(
          `INSERT INTO public.product_prices
             (product_id, dealer_price, mrp)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [
            product.id,
            column === 'dealer_price' ? value : null,
            column === 'mrp' ? value : null,
          ],
        );

        priceRecordId = insertResult.rows[0].id;
        oldValue = null;
      }

      // Record the audit event in the same transaction as the price update.
      await client.query(
        `INSERT INTO public.price_change_audit (
           product_id,
           product_price_id,
           product_code,
           price_field,
           old_value,
           new_value,
           actor_user_id,
           actor_email
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          product.id,
          priceRecordId,
          product.product_code,
          column,
          oldValue,
          value,
          user.id,
          user.email ?? null,
        ],
      );

      await client.query('COMMIT');
      transactionStarted = false;

      res.json({
        success: true,
        changed: true,
        productCode: product.product_code,
        field,
        value,
        auditRecorded: true,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }

      console.error(
        'Price update failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      res.status(500).json({
        error: 'Unable to update product price.',
      });
    } finally {
      client.release();
    }
  },
);

// -----------------------------------------------------------------------------
// Customer and quotation persistence
// -----------------------------------------------------------------------------

app.get('/api/customers', requireSupabaseUser, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const result = await pool.query(
      `SELECT id, business_name AS "businessName", contact_name AS "contactName",
              phone, gstin, billing_address AS "billingAddress", state,
              customer_type AS "customerType"
       FROM public.customers
       WHERE $1 = '' OR business_name ILIKE $2 OR contact_name ILIKE $2
          OR phone ILIKE $2 OR COALESCE(gstin, '') ILIKE $2
          OR COALESCE(billing_address, '') ILIKE $2 OR COALESCE(state, '') ILIKE $2
       ORDER BY business_name ASC LIMIT 50`,
      [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`],
    );
    res.json({ data: result.rows });
  } catch (error) {
    const pgError = error as { code?: string };
    console.error('Customer lookup failed:', error instanceof Error ? error.message : error);
    if (pgError.code === '42P01') {
      res.status(503).json({ error: 'Customer tables are not installed yet. From the backend folder, run npm.cmd run migrate and then restart the backend.' });
      return;
    }
    res.status(500).json({ error: 'Unable to load customers.' });
  }
});

app.post('/api/customers', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser;
  const body = req.body as Record<string, unknown>;
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const gstin = typeof body.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
  const billingAddress = typeof body.billingAddress === 'string' ? body.billingAddress.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const customerType = ['Retailer', 'Wholesaler', 'Other'].includes(String(body.customerType)) ? String(body.customerType) : 'Retailer';

  if (!businessName || !contactName || !phone || businessName.length > 200 || contactName.length > 200 || phone.length > 40 || gstin.length > 15 || billingAddress.length > 1000 || state.length > 100) {
    res.status(400).json({ error: 'Enter a valid business name, contact name and phone number.' });
    return;
  }
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) {
    res.status(400).json({ error: 'GSTIN must contain 15 letters/numbers.' });
    return;
  }

  try {
    const duplicate = await pool.query(
      `SELECT id, business_name AS "businessName", contact_name AS "contactName", phone,
              gstin, billing_address AS "billingAddress", state, customer_type AS "customerType"
       FROM public.customers
       WHERE (phone = $1 AND lower(business_name) = lower($2))
          OR ($3 <> '' AND gstin = $3)
       ORDER BY id LIMIT 1`,
      [phone, businessName, gstin],
    );
    if (duplicate.rowCount) {
      res.status(409).json({ error: 'A customer with this business name and phone, or this GSTIN, already exists.', customer: duplicate.rows[0] });
      return;
    }
    const result = await pool.query(
      `INSERT INTO public.customers (business_name, contact_name, phone, gstin, billing_address, state, customer_type, created_by)
       VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),$7,$8)
       RETURNING id, business_name AS "businessName", contact_name AS "contactName", phone, gstin,
                 billing_address AS "billingAddress", state, customer_type AS "customerType"`,
      [businessName, contactName, phone, gstin, billingAddress, state, customerType, user.id],
    );
    res.status(201).json({ success: true, customer: result.rows[0] });
  } catch (error) {
    const pgError = error as { code?: string };
    console.error('Customer creation failed:', error instanceof Error ? error.message : error);
    if (pgError.code === '42P01') {
      res.status(503).json({ error: 'Customer tables are not installed yet. From the backend folder, run npm.cmd run migrate and then restart the backend.' });
      return;
    }
    res.status(500).json({ error: 'Unable to save customer.' });
  }
});


app.patch('/api/customers/:id', requireSupabaseUser, async (req, res) => {
  const rawId = req.params.id;
  if (
    typeof rawId !== 'string' ||
    !/^\d+$/.test(rawId) ||
    !Number.isSafeInteger(Number(rawId))
  ) {
    res.status(400).json({ error: 'Invalid customer ID.' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const gstin = typeof body.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
  const billingAddress = typeof body.billingAddress === 'string' ? body.billingAddress.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const customerType = ['Retailer', 'Wholesaler', 'Other'].includes(String(body.customerType)) ? String(body.customerType) : 'Retailer';

  if (!businessName || !contactName || !phone || businessName.length > 200 || contactName.length > 200 || phone.length > 40 || gstin.length > 15 || billingAddress.length > 1000 || state.length > 100) {
    res.status(400).json({ error: 'Enter a valid business name, contact name and phone number.' });
    return;
  }
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) {
    res.status(400).json({ error: 'GSTIN must contain 15 letters/numbers.' });
    return;
  }

  try {
    const duplicate = await pool.query(
      `SELECT id FROM public.customers
       WHERE id <> $1 AND ((phone = $2 AND lower(business_name) = lower($3)) OR ($4 <> '' AND gstin = $4))
       LIMIT 1`,
      [Number(rawId), phone, businessName, gstin],
    );
    if (duplicate.rowCount) {
      res.status(409).json({ error: 'Another customer already uses this business name and phone, or this GSTIN.' });
      return;
    }
    const result = await pool.query(
      `UPDATE public.customers
       SET business_name = $2, contact_name = $3, phone = $4, gstin = NULLIF($5, ''),
           billing_address = NULLIF($6, ''), state = NULLIF($7, ''), customer_type = $8, updated_at = NOW()
       WHERE id = $1
       RETURNING id, business_name AS "businessName", contact_name AS "contactName", phone, gstin,
                 billing_address AS "billingAddress", state, customer_type AS "customerType"`,
      [Number(rawId), businessName, contactName, phone, gstin, billingAddress, state, customerType],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    const pgError = error as { code?: string };
    console.error('Customer update failed:', error instanceof Error ? error.message : error);
    if (pgError.code === '42P01') {
      res.status(503).json({ error: 'Customer tables are not installed yet. Run npm.cmd run migrate from the backend folder.' });
      return;
    }
    res.status(500).json({ error: 'Unable to update customer.' });
  }
});

app.post('/api/quotations', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser;
  const body = req.body as Record<string, unknown>;
  const number = typeof body.quotationNumber === 'string' ? body.quotationNumber.trim() : '';
  const items = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : null;
  const supplier = body.supplier && typeof body.supplier === 'object' ? body.supplier : {};
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
  const subtotal = Number(body.subtotal);
  const discountTotal = Number(body.discountTotal ?? 0);
  const taxableValue = Number(body.taxableValue ?? subtotal - discountTotal);
  const taxTotal = Number(body.taxTotal ?? 0);
  const roundOff = Number(body.roundOff ?? 0);
  const grandTotal = Number(body.grandTotal);

  if (!number || number.length > 80 || !customer || items.length === 0 || items.length > 500 ||
      ![subtotal, discountTotal, taxableValue, taxTotal, roundOff, grandTotal].every(Number.isFinite) ||
      [subtotal, discountTotal, taxableValue, taxTotal, grandTotal].some((n) => n < 0)) {
    res.status(400).json({ error: 'Quotation details are incomplete or invalid.' });
    return;
  }

  try {
    const rawCustomerId = customer ? (customer as Record<string, unknown>).id : null;
    const customerId = typeof rawCustomerId === 'number' && Number.isSafeInteger(rawCustomerId)
      ? rawCustomerId
      : typeof rawCustomerId === 'string' && /^\d+$/.test(rawCustomerId)
        ? rawCustomerId
        : null;
    const result = await pool.query(
      `INSERT INTO public.quotations
        (quotation_number, customer_id, customer_snapshot, supplier_snapshot, items, settings, subtotal, discount_total,
         taxable_value, tax_total, round_off, grand_total, status, created_by)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (quotation_number) DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         customer_snapshot = EXCLUDED.customer_snapshot,
         supplier_snapshot = EXCLUDED.supplier_snapshot,
         items = EXCLUDED.items,
         settings = EXCLUDED.settings,
         subtotal = EXCLUDED.subtotal,
         discount_total = EXCLUDED.discount_total,
         taxable_value = EXCLUDED.taxable_value,
         tax_total = EXCLUDED.tax_total,
         round_off = EXCLUDED.round_off,
         grand_total = EXCLUDED.grand_total,
         status = EXCLUDED.status,
         updated_at = NOW()
       WHERE public.quotations.created_by = EXCLUDED.created_by
       RETURNING id, quotation_number AS "quotationNumber", status, created_at AS "createdAt"`,
      [number, customerId, JSON.stringify(customer), JSON.stringify(supplier), JSON.stringify(items), JSON.stringify(settings),
       subtotal, discountTotal, taxableValue, taxTotal, roundOff, grandTotal,
       body.status === 'Generated' ? 'Generated' : 'Draft', user.id],
    );
    if (!result.rowCount) {
      res.status(409).json({ error: 'This quotation number belongs to another user. Use a different number.' });
      return;
    }
    res.status(201).json({ success: true, quotation: result.rows[0] });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(409).json({ error: 'This quotation number already exists. Use a different number.' });
      return;
    }
    console.error('Quotation save failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Unable to save quotation.' });
  }
});

// -----------------------------------------------------------------------------
// Start server and handle shutdown
// -----------------------------------------------------------------------------

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
