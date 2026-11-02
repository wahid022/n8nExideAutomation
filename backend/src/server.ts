
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
// Sales module APIs (authenticated)
// -----------------------------------------------------------------------------

type SalesLineInput = {
  productId?: number | null;
  productName: string;
  productCode?: string;
  brand?: string;
  modelSku?: string;
  mrp?: number | null;
  quantity?: unknown;
  unitPrice?: unknown;
  discountPercent?: unknown;
  taxPercent?: unknown;
};

function buildSalesLines(raw: unknown) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500) return null;
  const lines: Array<Record<string, string | number | null>> = [];
  let subtotal = 0;
  let discountTotal = 0;
  let taxableValue = 0;
  let taxTotal = 0;
  for (const item of raw as SalesLineInput[]) {
    const name = typeof item.productName === 'string' ? item.productName.trim() : '';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discountPercent = Number(item.discountPercent ?? 0);
    const taxPercent = Number(item.taxPercent ?? 0);
    if (!name || name.length > 250 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 ||
      !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000 ||
      !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) return null;
    const gross = quantity * unitPrice;
    const discount = gross * discountPercent / 100;
    const taxable = gross - discount;
    const tax = taxable * taxPercent / 100;
    subtotal += gross; discountTotal += discount; taxableValue += taxable; taxTotal += tax;
    lines.push({
      productId: Number.isSafeInteger(Number(item.productId)) &&
        Number(item.productId) > 0
        ? Number(item.productId)
        : null,
      productName: name,
      productCode: typeof item.productCode === 'string'
        ? item.productCode.slice(0, 100)
        : '',
      brand: typeof item.brand === 'string' ? item.brand.slice(0, 100) : '',
      modelSku: typeof item.modelSku === 'string' ? item.modelSku.slice(0, 100) : '',
      mrp: Number.isFinite(Number(item.mrp)) && Number(item.mrp) >= 0
        ? Number(Number(item.mrp).toFixed(2))
        : null,
      quantity,
    });
  }
  return {
    lines, subtotal: Number(subtotal.toFixed(2)), discountTotal: Number(discountTotal.toFixed(2)),
    taxableValue: Number(taxableValue.toFixed(2)), taxTotal: Number(taxTotal.toFixed(2)), grandTotal: Number((taxableValue + taxTotal).toFixed(2))
  };
}

function customerSnapshot(customer: Record<string, unknown>) {
  return {
    id: customer.id ?? null,
    businessName: String(customer.businessName ?? '').trim().slice(0, 200),
    contactName: String(customer.contactName ?? '').trim().slice(0, 200),
    phone: String(customer.phone ?? '').trim().slice(0, 40),
    gstin: String(customer.gstin ?? '').trim().slice(0, 15),
    billingAddress: String(customer.billingAddress ?? '').trim().slice(0, 1000),
    state: String(customer.state ?? '').trim().slice(0, 100),
  };
}

function validCustomerId(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

app.get('/api/sales/summary', requireSupabaseUser, async (_req, res) => {
  try {
    const [orders, invoices, payments] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(grand_total) FILTER (WHERE status <> 'Cancelled'),0)::numeric(14,2) AS value FROM public.sales_orders`),
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(grand_total),0)::numeric(14,2) AS value, COALESCE(SUM(grand_total - COALESCE((SELECT SUM(cp.amount) FROM public.customer_payments cp WHERE cp.invoice_id = si.id AND cp.status = 'Received'),0)),0)::numeric(14,2) AS outstanding FROM public.sales_invoices si WHERE si.status <> 'Void'`),
      pool.query(`SELECT COALESCE(SUM(amount),0)::numeric(14,2) AS received FROM public.customer_payments WHERE status = 'Received'`),
    ]);
    res.json({ orders: orders.rows[0], invoices: invoices.rows[0], payments: payments.rows[0] });
  } catch (error) {
    console.error('Sales summary failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Unable to load sales summary.' });
  }
});

app.get('/api/sales/orders', requireSupabaseUser, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const dbCheck = await pool.query(`
  SELECT current_database() AS db,
         current_user AS usr,
         COUNT(*) AS orders_count
  FROM public.sales_orders
`);
    console.log('[Sales Orders Diagnostic]', dbCheck.rows[0]);
    const result = await pool.query(`SELECT id, order_number AS "orderNumber", customer_snapshot AS customer, items,
      subtotal, discount_total AS "discountTotal", taxable_value AS "taxableValue", tax_total AS "taxTotal", grand_total AS "grandTotal",
      status, order_date AS "orderDate", notes, created_at AS "createdAt"
      FROM public.sales_orders WHERE ($1 = '' OR order_number ILIKE $2 OR customer_snapshot->>'businessName' ILIKE $2)
      ORDER BY created_at DESC LIMIT 200`, [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`]);
    res.json({ data: result.rows });
  } catch (error) { console.error('Sales orders lookup failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to load sales orders.' }); }
});

app.post('/api/sales/orders', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser;
  const body = req.body as Record<string, unknown>;
  const customer = body.customer && typeof body.customer === 'object' ? customerSnapshot(body.customer as Record<string, unknown>) : null;
  const totals = buildSalesLines(body.items);
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().slice(0, 80) : '';
  const customerId = validCustomerId(customer?.id);
  if (!orderNumber || !customer?.businessName || !customerId || !totals) { res.status(400).json({ error: 'Provide a unique order number, saved customer, and valid order items.' }); return; }
  try {
    const exists = await pool.query('SELECT 1 FROM public.customers WHERE id = $1', [customerId]);
    if (!exists.rowCount) { res.status(400).json({ error: 'Selected customer was not found.' }); return; }
    const result = await pool.query(`INSERT INTO public.sales_orders
      (order_number, customer_id, customer_snapshot, items, subtotal, discount_total, taxable_value, tax_total, grand_total, status, order_date, notes, created_by)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,COALESCE(NULLIF($11,'')::date,CURRENT_DATE),NULLIF($12,''),$13)
      RETURNING id, order_number AS "orderNumber", status, grand_total AS "grandTotal", created_at AS "createdAt"`,
      [orderNumber, customerId, JSON.stringify(customer), JSON.stringify(totals.lines), totals.subtotal, totals.discountTotal, totals.taxableValue, totals.taxTotal, totals.grandTotal,
        body.status === 'Confirmed' ? 'Confirmed' : 'Draft', typeof body.orderDate === 'string' ? body.orderDate : '', typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '', user.id]);
    res.status(201).json({ success: true, order: result.rows[0] });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') { res.status(409).json({ error: 'That sales order number already exists.' }); return; }
    console.error('Sales order creation failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to create sales order.' });
  }
});

app.get('/api/sales/invoices', requireSupabaseUser, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const result = await pool.query(`SELECT si.id, si.invoice_number AS "invoiceNumber", si.customer_snapshot AS customer, si.items,
      si.invoice_date AS "invoiceDate", si.due_date AS "dueDate", si.subtotal, si.discount_total AS "discountTotal",
      si.tax_total AS "taxTotal", si.grand_total AS "grandTotal", si.status, si.notes,
      COALESCE((SELECT SUM(cp.amount) FROM public.customer_payments cp WHERE cp.invoice_id = si.id AND cp.status='Received'),0)::numeric(14,2) AS "amountPaid"
      FROM public.sales_invoices si WHERE ($1 = '' OR si.invoice_number ILIKE $2 OR si.customer_snapshot->>'businessName' ILIKE $2)
      ORDER BY si.created_at DESC LIMIT 200`, [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`]);
    res.json({ data: result.rows });
  } catch (error) { console.error('Invoice lookup failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to load invoices.' }); }
});

app.post('/api/sales/invoices', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser;
  const body = req.body as Record<string, unknown>;
  const customer = body.customer && typeof body.customer === 'object' ? customerSnapshot(body.customer as Record<string, unknown>) : null;
  const totals = buildSalesLines(body.items);
  const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim().slice(0, 80) : '';
  const customerId = validCustomerId(customer?.id);
  const invoiceDate = typeof body.invoiceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.invoiceDate) ? body.invoiceDate : new Date().toISOString().slice(0, 10);
  const dueDate = typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
  if (!invoiceNumber || !customer?.businessName || !customerId || !totals || (dueDate && dueDate < invoiceDate)) { res.status(400).json({ error: 'Provide a unique invoice number, saved customer, valid items, and a due date on or after the invoice date.' }); return; }
  try {
    const result = await pool.query(`INSERT INTO public.sales_invoices
      (invoice_number, customer_id, customer_snapshot, supplier_snapshot, items, invoice_date, due_date, subtotal, discount_total, taxable_value, tax_total, grand_total, status, notes, created_by)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,NULLIF($7,'')::date,$8,$9,$10,$11,$12,$13,NULLIF($14,''),$15)
      RETURNING id, invoice_number AS "invoiceNumber", status, grand_total AS "grandTotal", invoice_date AS "invoiceDate"`,
      [invoiceNumber, customerId, JSON.stringify(customer), JSON.stringify(body.supplier && typeof body.supplier === 'object' ? body.supplier : {}), JSON.stringify(totals.lines), invoiceDate, dueDate || '', totals.subtotal, totals.discountTotal, totals.taxableValue, totals.taxTotal, totals.grandTotal, body.status === 'Issued' ? 'Issued' : 'Draft', typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '', user.id]);
    res.status(201).json({ success: true, invoice: result.rows[0] });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') { res.status(409).json({ error: 'That invoice number already exists.' }); return; }
    console.error('Invoice creation failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to create invoice.' });
  }
});

app.get('/api/sales/payments', requireSupabaseUser, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT cp.id, cp.receipt_number AS "receiptNumber", cp.customer_id AS "customerId", cp.invoice_id AS "invoiceId",
      cp.payment_date AS "paymentDate", cp.amount, cp.payment_method AS "paymentMethod", cp.reference_number AS "referenceNumber", cp.status,
      cp.notes, cp.created_at AS "createdAt", cp.receipt_number AS "receiptNumber",
      si.invoice_number AS "invoiceNumber", cp.customer_id AS "customerId", si.customer_snapshot->>'businessName' AS "businessName"
      FROM public.customer_payments cp LEFT JOIN public.sales_invoices si ON si.id=cp.invoice_id ORDER BY cp.created_at DESC LIMIT 200`);
    res.json({ data: result.rows });
  } catch (error) { console.error('Payments lookup failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to load payments.' }); }
});

app.post('/api/sales/payments', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser;
  const body = req.body as Record<string, unknown>;
  const receiptNumber = typeof body.receiptNumber === 'string' ? body.receiptNumber.trim().slice(0, 80) : '';
  const customerId = validCustomerId(body.customerId);
  const invoiceId = body.invoiceId === '' || body.invoiceId == null ? null : validCustomerId(body.invoiceId);
  const amount = Number(body.amount);
  const methods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
  const method = String(body.paymentMethod ?? '');
  const paymentDate = typeof body.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate) ? body.paymentDate : new Date().toISOString().slice(0, 10);
  if (!receiptNumber || !customerId || (body.invoiceId != null && body.invoiceId !== '' && !invoiceId) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || !methods.includes(method)) {
    res.status(400).json({ error: 'Provide a receipt number, customer, positive amount, and valid payment method.' }); return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer = await client.query('SELECT id FROM public.customers WHERE id=$1', [customerId]);
    if (!customer.rowCount) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Selected customer was not found.' }); return; }
    if (invoiceId) {
      const invoice = await client.query('SELECT id, customer_id, grand_total FROM public.sales_invoices WHERE id=$1 FOR UPDATE', [invoiceId]);
      if (!invoice.rowCount || Number(invoice.rows[0].customer_id) !== customerId) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Invoice does not belong to the selected customer.' }); return; }
      const paid = await client.query(`SELECT COALESCE(SUM(amount),0) AS paid FROM public.customer_payments WHERE invoice_id=$1 AND status='Received'`, [invoiceId]);
      if (Number(paid.rows[0].paid) + amount > Number(invoice.rows[0].grand_total) + 0.01) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Payment exceeds the invoice outstanding balance.' }); return; }
    }
    const result = await client.query(`INSERT INTO public.customer_payments (receipt_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),$9) RETURNING id, receipt_number AS "receiptNumber", amount, payment_date AS "paymentDate", payment_method AS "paymentMethod"`,
      [receiptNumber, customerId, invoiceId, paymentDate, amount, method, typeof body.referenceNumber === 'string' ? body.referenceNumber.slice(0, 120) : '', typeof body.notes === 'string' ? body.notes.slice(0, 1000) : '', user.id]);
    if (invoiceId) {
      const totals = await client.query(`SELECT si.grand_total, COALESCE(SUM(cp.amount) FILTER (WHERE cp.status='Received'),0) AS paid
        FROM public.sales_invoices si LEFT JOIN public.customer_payments cp ON cp.invoice_id=si.id WHERE si.id=$1 GROUP BY si.id`, [invoiceId]);
      const paid = Number(totals.rows[0].paid); const total = Number(totals.rows[0].grand_total);
      await client.query(`UPDATE public.sales_invoices SET status=$2, updated_at=NOW() WHERE id=$1 AND status <> 'Void'`, [invoiceId, paid >= total - 0.01 ? 'Paid' : 'Partially Paid']);
    }
    await client.query('COMMIT'); res.status(201).json({ success: true, payment: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const pgError = error as { code?: string };
    if (pgError.code === '23505') { res.status(409).json({ error: 'That receipt number already exists.' }); return; }
    console.error('Payment recording failed:', error instanceof Error ? error.message : error); res.status(500).json({ error: 'Unable to record payment.' });
  } finally { client.release(); }
});

// Additional Sales workflows: challans, credit notes, recurring templates, quotation conversion and document actions.
app.get('/api/sales/challans', requireSupabaseUser, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const result = await pool.query(`SELECT id, challan_number AS "challanNumber", sales_order_id AS "salesOrderId", customer_id AS "customerId", customer_snapshot AS customer, items, challan_date AS "challanDate", status, notes FROM public.delivery_challans WHERE ($1='' OR challan_number ILIKE $2 OR customer_snapshot->>'businessName' ILIKE $2) ORDER BY created_at DESC LIMIT 200`, [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`]);
    res.json({ data: result.rows });
  } catch (e) { console.error('Challans lookup failed:', e); res.status(500).json({ error: 'Unable to load delivery challans.' }); }
});
app.post('/api/sales/challans', requireSupabaseUser, async (req, res) => {
  const user = res.locals.authenticatedUser as AuthenticatedUser; const b = req.body as Record<string, unknown>;
  const customer = b.customer && typeof b.customer === 'object' ? customerSnapshot(b.customer as Record<string, unknown>) : null;
  const lines = buildSalesLines(b.items); const customerId = validCustomerId(customer?.id); const number = typeof b.challanNumber === 'string' ? b.challanNumber.trim().slice(0, 80) : '';
  const orderId = b.salesOrderId == null || b.salesOrderId === '' ? null : validCustomerId(b.salesOrderId); const date = typeof b.challanDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.challanDate) ? b.challanDate : new Date().toISOString().slice(0, 10);
  if (!number || !customerId || !customer?.businessName || !lines) { res.status(400).json({ error: 'Provide a challan number, saved customer and valid item lines.' }); return; }
  const client = await pool.connect(); try {
    await client.query('BEGIN');
    const c = await client.query('SELECT id FROM public.customers WHERE id=$1', [customerId]); if (!c.rowCount) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Customer not found.' }); return; }
    if (orderId) { const o = await client.query('SELECT id,customer_id,status FROM public.sales_orders WHERE id=$1 FOR UPDATE', [orderId]); if (!o.rowCount || Number(o.rows[0].customer_id) !== customerId || o.rows[0].status === 'Cancelled') { await client.query('ROLLBACK'); res.status(400).json({ error: 'Sales order is missing, cancelled or belongs to another customer.' }); return; } }
    const r = await client.query(`INSERT INTO public.delivery_challans(challan_number,sales_order_id,customer_id,customer_snapshot,items,challan_date,status,notes,created_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,NULLIF($8,''),$9) RETURNING id,challan_number AS "challanNumber",status`, [number, orderId, customerId, JSON.stringify(customer), JSON.stringify(lines.lines), date, b.status === 'Dispatched' ? 'Dispatched' : 'Draft', typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '', user.id]);
    await client.query(`INSERT INTO public.sales_document_audit(document_type,document_id,action,after_data,actor_id) VALUES('Delivery Challan',$1,'created',$2::jsonb,$3)`, [r.rows[0].id, JSON.stringify(r.rows[0]), user.id]); await client.query('COMMIT'); res.status(201).json({ success: true, challan: r.rows[0] });
  } catch (e) { await client.query('ROLLBACK').catch(() => undefined); const pe = e as { code?: string }; if (pe.code === '23505') { res.status(409).json({ error: 'Challan number already exists.' }); return; } console.error('Challan create failed:', e); res.status(500).json({ error: 'Unable to create challan.' }); } finally { client.release(); }
});
app.patch('/api/sales/challans/:id/status', requireSupabaseUser, async (req, res) => { const id = validCustomerId(req.params.id); const status = String(req.body?.status || ''); if (!id || !['Dispatched', 'Delivered', 'Cancelled'].includes(status)) { res.status(400).json({ error: 'Invalid challan or status.' }); return; } try { const r = await pool.query(`UPDATE public.delivery_challans SET status=$2,updated_at=NOW() WHERE id=$1 AND status<>'Cancelled' RETURNING id,status`, [id, status]); if (!r.rowCount) { res.status(404).json({ error: 'Challan not found or already cancelled.' }); return; } res.json({ success: true, challan: r.rows[0] }); } catch (e) { res.status(500).json({ error: 'Unable to update challan status.' }); } });

app.get('/api/sales/credit-notes', requireSupabaseUser, async (req, res) => { const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''; try { const r = await pool.query(`SELECT cn.id,cn.credit_note_number AS "creditNoteNumber",cn.invoice_id AS "invoiceId",cn.customer_id AS "customerId",cn.customer_snapshot AS customer,cn.items,cn.credit_date AS "creditDate",cn.amount,cn.reason,cn.status,si.invoice_number AS "invoiceNumber" FROM public.credit_notes cn LEFT JOIN public.sales_invoices si ON si.id=cn.invoice_id WHERE ($1='' OR cn.credit_note_number ILIKE $2 OR cn.customer_snapshot->>'businessName' ILIKE $2) ORDER BY cn.created_at DESC LIMIT 200`, [search, `%${search.replace(/[\\%_]/g, '\\$&')}%`]); res.json({ data: r.rows }); } catch (e) { res.status(500).json({ error: 'Unable to load credit notes.' }); } });
app.post('/api/sales/credit-notes', requireSupabaseUser, async (req, res) => { const user = res.locals.authenticatedUser as AuthenticatedUser; const b = req.body as Record<string, unknown>; const number = typeof b.creditNoteNumber === 'string' ? b.creditNoteNumber.trim().slice(0, 80) : ''; const customerId = validCustomerId(b.customerId); const invoiceId = b.invoiceId == null || b.invoiceId === '' ? null : validCustomerId(b.invoiceId); const amount = Number(b.amount); const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 1000) : ''; if (!number || !customerId || !Number.isFinite(amount) || amount <= 0 || !reason) { res.status(400).json({ error: 'Provide credit note number, customer, positive amount and reason.' }); return; } const client = await pool.connect(); try { await client.query('BEGIN'); const c = await client.query('SELECT id,business_name,contact_name,phone,gstin,billing_address,state FROM public.customers WHERE id=$1', [customerId]); if (!c.rowCount) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Customer not found.' }); return; } if (invoiceId) { const inv = await client.query('SELECT id,customer_id,grand_total,status FROM public.sales_invoices WHERE id=$1 FOR UPDATE', [invoiceId]); if (!inv.rowCount || Number(inv.rows[0].customer_id) !== customerId || inv.rows[0].status === 'Void' || amount > Number(inv.rows[0].grand_total)) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Invoice is invalid for this customer or credit amount exceeds invoice total.' }); return; } } const snap = { id: c.rows[0].id, businessName: c.rows[0].business_name, contactName: c.rows[0].contact_name, phone: c.rows[0].phone, gstin: c.rows[0].gstin, billingAddress: c.rows[0].billing_address, state: c.rows[0].state }; const r = await client.query(`INSERT INTO public.credit_notes(credit_note_number,invoice_id,customer_id,customer_snapshot,items,credit_date,amount,reason,status,created_by) VALUES($1,$2,$3,$4::jsonb,'[]'::jsonb,COALESCE(NULLIF($5,'')::date,CURRENT_DATE),$6,$7,$8,$9) RETURNING id,credit_note_number AS "creditNoteNumber",amount,status`, [number, invoiceId, customerId, JSON.stringify(snap), typeof b.creditDate === 'string' ? b.creditDate : '', amount, reason, b.status === 'Issued' ? 'Issued' : 'Draft', user.id]); await client.query(`INSERT INTO public.sales_document_audit(document_type,document_id,action,after_data,actor_id) VALUES('Credit Note',$1,'created',$2::jsonb,$3)`, [r.rows[0].id, JSON.stringify(r.rows[0]), user.id]); await client.query('COMMIT'); res.status(201).json({ success: true, creditNote: r.rows[0] }); } catch (e) { await client.query('ROLLBACK').catch(() => undefined); const pe = e as { code?: string }; if (pe.code === '23505') { res.status(409).json({ error: 'Credit note number already exists.' }); return; } console.error('Credit note create failed:', e); res.status(500).json({ error: 'Unable to create credit note.' }); } finally { client.release(); } });
app.patch('/api/sales/credit-notes/:id/status', requireSupabaseUser, async (req, res) => { const id = validCustomerId(req.params.id); const status = String(req.body?.status || ''); if (!id || !['Issued', 'Applied', 'Void'].includes(status)) { res.status(400).json({ error: 'Invalid credit note status.' }); return; } try { const r = await pool.query(`UPDATE public.credit_notes SET status=$2,updated_at=NOW() WHERE id=$1 AND status<>'Void' RETURNING id,status`, [id, status]); if (!r.rowCount) { res.status(404).json({ error: 'Credit note not found or void.' }); return; } res.json({ success: true, creditNote: r.rows[0] }); } catch (e) { res.status(500).json({ error: 'Unable to update credit note.' }); } });

app.post('/api/sales/quotations/:id/convert', requireSupabaseUser, async (req, res) => { const user = res.locals.authenticatedUser as AuthenticatedUser; const id = validCustomerId(req.params.id); const number = typeof req.body?.orderNumber === 'string' ? req.body.orderNumber.trim().slice(0, 80) : ''; if (!id || !number) { res.status(400).json({ error: 'Quotation ID and order number are required.' }); return; } const client = await pool.connect(); try { await client.query('BEGIN'); const q = await client.query(`SELECT * FROM public.quotations WHERE id=$1 FOR UPDATE`, [id]); if (!q.rowCount) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Quotation not found.' }); return; } if (q.rows[0].status === 'Converted') { await client.query('ROLLBACK'); res.status(409).json({ error: 'Quotation has already been converted.' }); return; } const quote = q.rows[0]; const snap = quote.customer_snapshot as Record<string, unknown>; const customerId = validCustomerId(quote.customer_id); const rawItems = Array.isArray(quote.items) ? quote.items : []; const lines = buildSalesLines(rawItems); if (!customerId || !lines) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Quotation does not contain a saved customer and supported item structure. Create the order manually instead.' }); return; } const o = await client.query(`INSERT INTO public.sales_orders(order_number,quotation_id,customer_id,customer_snapshot,items,subtotal,discount_total,taxable_value,tax_total,grand_total,status,created_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,'Confirmed',$11) RETURNING id,order_number AS "orderNumber",grand_total AS "grandTotal",status`, [number, id, customerId, JSON.stringify(snap), JSON.stringify(lines.lines), lines.subtotal, lines.discountTotal, lines.taxableValue, lines.taxTotal, lines.grandTotal, user.id]); await client.query(`UPDATE public.quotations SET status='Converted',updated_at=NOW() WHERE id=$1`, [id]); await client.query(`INSERT INTO public.sales_document_audit(document_type,document_id,action,after_data,actor_id) VALUES('Order',$1,'converted from quotation',$2::jsonb,$3)`, [o.rows[0].id, JSON.stringify({ quotationId: id, order: o.rows[0] }), user.id]); await client.query('COMMIT'); res.status(201).json({ success: true, order: o.rows[0] }); } catch (e) { await client.query('ROLLBACK').catch(() => undefined); const pe = e as { code?: string }; if (pe.code === '23505') { res.status(409).json({ error: 'Order number already exists.' }); return; } console.error('Quotation conversion failed:', e); res.status(500).json({ error: 'Unable to convert quotation.' }); } finally { client.release(); } });

app.get('/api/sales/recurring-invoices', requireSupabaseUser, async (_req, res) => { try { const r = await pool.query(`SELECT id,template_number AS "templateNumber",customer_id AS "customerId",customer_snapshot AS customer,items,frequency,next_run_date AS "nextRunDate",end_date AS "endDate",due_days AS "dueDays",active,notes FROM public.recurring_invoices ORDER BY next_run_date LIMIT 200`); res.json({ data: r.rows }); } catch (e) { res.status(500).json({ error: 'Unable to load recurring invoice templates.' }); } });
app.post('/api/sales/recurring-invoices', requireSupabaseUser, async (req, res) => { const user = res.locals.authenticatedUser as AuthenticatedUser; const b = req.body as Record<string, unknown>; const number = typeof b.templateNumber === 'string' ? b.templateNumber.trim().slice(0, 80) : ''; const customer = b.customer && typeof b.customer === 'object' ? customerSnapshot(b.customer as Record<string, unknown>) : null; const customerId = validCustomerId(customer?.id); const lines = buildSalesLines(b.items); const frequency = String(b.frequency || ''); const next = String(b.nextRunDate || ''); if (!number || !customerId || !customer?.businessName || !lines || !['Weekly', 'Monthly', 'Quarterly', 'Yearly'].includes(frequency) || !/^\d{4}-\d{2}-\d{2}$/.test(next)) { res.status(400).json({ error: 'Provide template number, saved customer, items, frequency and next run date.' }); return; } try { const r = await pool.query(`INSERT INTO public.recurring_invoices(template_number,customer_id,customer_snapshot,items,frequency,next_run_date,end_date,due_days,active,notes,created_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6,NULLIF($7,'')::date,$8,$9,NULLIF($10,''),$11) RETURNING id,template_number AS "templateNumber",frequency,next_run_date AS "nextRunDate",active`, [number, customerId, JSON.stringify(customer), JSON.stringify(lines.lines), frequency, next, typeof b.endDate === 'string' ? b.endDate : '', Math.max(0, Math.min(365, Number(b.dueDays) || 30)), b.active !== false, typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '', user.id]); res.status(201).json({ success: true, template: r.rows[0] }); } catch (e) { const pe = e as { code?: string }; if (pe.code === '23505') { res.status(409).json({ error: 'Template number already exists.' }); return; } console.error('Recurring template create failed:', e); res.status(500).json({ error: 'Unable to create recurring template.' }); } });
app.post('/api/sales/recurring-invoices/run-due', requireSupabaseUser, async (req, res) => { const user = res.locals.authenticatedUser as AuthenticatedUser; const client = await pool.connect(); const today = new Date().toISOString().slice(0, 10); let created = 0; try { await client.query('BEGIN'); const due = await client.query(`SELECT * FROM public.recurring_invoices WHERE active=TRUE AND next_run_date <= $1 AND (end_date IS NULL OR next_run_date <= end_date) ORDER BY next_run_date FOR UPDATE SKIP LOCKED LIMIT 100`, [today]); for (const t of due.rows) { const totals = buildSalesLines(t.items); if (!totals || !t.customer_id) continue; const invoiceNumber = `INV-${String(t.template_number).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40)}-${String(t.next_run_date).slice(0, 10).replaceAll('-', '')}`.slice(0, 80); const dueDate = new Date(`${String(t.next_run_date).slice(0, 10)}T00:00:00Z`); dueDate.setUTCDate(dueDate.getUTCDate() + Number(t.due_days)); await client.query(`INSERT INTO public.sales_invoices(invoice_number,customer_id,customer_snapshot,supplier_snapshot,items,invoice_date,due_date,subtotal,discount_total,taxable_value,tax_total,grand_total,status,notes,created_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,'Issued',NULLIF($13,''),$14) ON CONFLICT(invoice_number) DO NOTHING`, [invoiceNumber, t.customer_id, JSON.stringify(t.customer_snapshot), JSON.stringify(t.supplier_snapshot || {}), JSON.stringify(totals.lines), String(t.next_run_date).slice(0, 10), dueDate.toISOString().slice(0, 10), totals.subtotal, totals.discountTotal, totals.taxableValue, totals.taxTotal, totals.grandTotal, `Generated from recurring template ${t.template_number}. ${t.notes || ''}`.slice(0, 2000), user.id]); const next = await client.query(`SELECT CASE frequency WHEN 'Weekly' THEN next_run_date + INTERVAL '7 days' WHEN 'Monthly' THEN next_run_date + INTERVAL '1 month' WHEN 'Quarterly' THEN next_run_date + INTERVAL '3 months' ELSE next_run_date + INTERVAL '1 year' END AS next_date FROM public.recurring_invoices WHERE id=$1`, [t.id]); await client.query(`UPDATE public.recurring_invoices SET next_run_date=$2::date,active=CASE WHEN end_date IS NOT NULL AND $2::date>end_date THEN FALSE ELSE active END,updated_at=NOW() WHERE id=$1`, [t.id, String(next.rows[0].next_date).slice(0, 10)]); created++; } await client.query('COMMIT'); res.json({ success: true, generated: created, checked: due.rowCount }); } catch (e) { await client.query('ROLLBACK').catch(() => undefined); console.error('Recurring invoice run failed:', e); res.status(500).json({ error: 'Unable to generate recurring invoices.' }); } finally { client.release(); } });
app.patch('/api/sales/recurring-invoices/:id', requireSupabaseUser, async (req, res) => { const id = validCustomerId(req.params.id); if (!id || typeof req.body?.active !== 'boolean') { res.status(400).json({ error: 'Provide a valid template ID and active boolean.' }); return; } try { const r = await pool.query(`UPDATE public.recurring_invoices SET active=$2,updated_at=NOW() WHERE id=$1 RETURNING id,active`, [id, req.body.active]); if (!r.rowCount) { res.status(404).json({ error: 'Recurring template not found.' }); return; } res.json({ success: true, template: r.rows[0] }); } catch (e) { res.status(500).json({ error: 'Unable to update recurring template.' }); } });
app.get('/api/sales/customer-ledger/:customerId', requireSupabaseUser, async (req, res) => { const id = validCustomerId(req.params.customerId); if (!id) { res.status(400).json({ error: 'Invalid customer ID.' }); return; } try { const [inv, pay, cn] = await Promise.all([pool.query(`SELECT id,invoice_number AS number,invoice_date AS date,grand_total AS amount,status FROM public.sales_invoices WHERE customer_id=$1 AND status<>'Void' ORDER BY invoice_date DESC`, [id]), pool.query(`SELECT id,receipt_number AS number,payment_date AS date,amount,payment_method AS method,status FROM public.customer_payments WHERE customer_id=$1 ORDER BY payment_date DESC`, [id]), pool.query(`SELECT id,credit_note_number AS number,credit_date AS date,amount,status FROM public.credit_notes WHERE customer_id=$1 AND status IN ('Issued','Applied') ORDER BY credit_date DESC`, [id])]); res.json({ invoices: inv.rows, payments: pay.rows, creditNotes: cn.rows }); } catch (e) { res.status(500).json({ error: 'Unable to load customer ledger.' }); } });
app.patch('/api/sales/invoices/:id/status', requireSupabaseUser, async (req, res) => { const id = validCustomerId(req.params.id); const status = String(req.body?.status || ''); if (!id || !['Issued', 'Void'].includes(status)) { res.status(400).json({ error: 'Only Issued or Void status is accepted here.' }); return; } const client = await pool.connect(); try { await client.query('BEGIN'); const inv = await client.query('SELECT id,status FROM public.sales_invoices WHERE id=$1 FOR UPDATE', [id]); if (!inv.rowCount) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Invoice not found.' }); return; } if (inv.rows[0].status !== 'Draft') { await client.query('ROLLBACK'); res.status(409).json({ error: 'Only draft invoices may be voided; void invoices cannot be changed.' }); return; } const r = await client.query(`UPDATE public.sales_invoices SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id,invoice_number AS "invoiceNumber",status`, [id, status]); await client.query(`INSERT INTO public.sales_document_audit(document_type,document_id,action,before_data,after_data,actor_id) VALUES('Invoice',$1,$2,$3::jsonb,$4::jsonb,$5)`, [id, 'status changed', JSON.stringify(inv.rows[0]), JSON.stringify(r.rows[0]), (res.locals.authenticatedUser as AuthenticatedUser).id]); await client.query('COMMIT'); res.json({ success: true, invoice: r.rows[0] }); } catch (e) { await client.query('ROLLBACK').catch(() => undefined); res.status(500).json({ error: 'Unable to update invoice status.' }); } finally { client.release(); } });

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
