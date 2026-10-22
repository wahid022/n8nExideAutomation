import 'dotenv/config';
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { sha256File } from './file-hash.js';

type Row = Record<string, unknown>;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(
  scriptDir,
  '../../Unified_Product_Price_Master_Refined_Final.xlsx',
);
const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';

function str(value: unknown): string | null {
  const result = value == null ? '' : String(value).trim();
  return result || null;
}

function decimal(value: unknown, field: string): string | null {
  const raw = str(value);
  if (!raw) return null;

  const normalized = raw.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${field}: invalid number "${raw}"`);
  }

  return normalized;
}

function date(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Effective From: invalid date "${raw}"`);
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  ) {
    throw new Error(`Invalid calendar date: ${raw}`);
  }

  return raw;
}

function normalize(row: Row, index: number) {
  const excelRow = index + 6;
  const productCode = str(row['Product Code']);
  const brand = str(row.Brand);
  const category = str(row.Category);
  const sku = str(row['Model / SKU']);

  if (!productCode || !brand || !category || !sku) {
    throw new Error(`Required product fields missing at Excel row ${excelRow}`);
  }

  const dealerPrice = decimal(row['Dealer Price'], 'Dealer Price');
  const mrp = decimal(row.MRP, 'MRP');
  const gstRate = decimal(row['GST Rate %'], 'GST Rate');
  const effectiveFrom = date(row['Effective From']);

  if (gstRate !== null && (Number(gstRate) < 0 || Number(gstRate) > 100)) {
    throw new Error(`GST rate outside 0–100 at Excel row ${excelRow}`);
  }

  return {
    excelRow,
    productCode,
    brand,
    category,
    subCategory: str(row['Sub Category']),
    sku,
    specs: str(row['Specs / Capacity']),
    warranty: str(row.Warranty),
    hsn: str(row.HSN),
    dealerPrice,
    mrp,
    gstRate,
    effectiveFrom,
  };
}

async function main() {
  if (process.argv.includes('--apply') && process.argv.includes('--dry-run')) {
    throw new Error('Choose either --dry-run or --apply, not both.');
  }

  const initialHash = await sha256File(workbookPath);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const sheet = workbook.Sheets['Product Master'];

  if (!sheet) throw new Error('Product Master sheet not found.');

  const rawRows = XLSX.utils.sheet_to_json<Row>(sheet, {
    range: 4,
    defval: null,
    raw: false,
  });

  const seen = new Set<string>();
  const products = rawRows.map((row, index) => {
    const product = normalize(row, index);

    if (seen.has(product.productCode)) {
      throw new Error(`Duplicate Product Code: ${product.productCode}`);
    }

    seen.add(product.productCode);
    return product;
  });

  const priceRows = products.filter(
    (p) =>
      p.dealerPrice !== null ||
      p.mrp !== null ||
      p.gstRate !== null ||
      p.effectiveFrom !== null,
  );

  const existing = await pool.query<{ product_code: string }>(
    `SELECT product_code
     FROM public.products
     WHERE product_code = ANY($1::text[])`,
    [products.map((p) => p.productCode)],
  );

  const duplicateHash = await pool.query(
    `SELECT id, status
     FROM public.import_batches
     WHERE source_sha256 = $1`,
    [initialHash],
  );

  const existingCodes = existing.rows.map((row) => row.product_code);

  console.log(JSON.stringify({
    mode,
    sourceRows: products.length,
    sha256: initialHash,
    newProducts: products.length - existingCodes.length,
    existingProductConflicts: existingCodes.length,
    priceRowsWithValues: priceRows.length,
    duplicateImportBatches: duplicateHash.rows,
    missingDealerPrice: products.filter((p) => p.dealerPrice === null).length,
    missingMrp: products.filter((p) => p.mrp === null).length,
    missingHsn: products.filter((p) => p.hsn === null).length,
    missingGstRate: products.filter((p) => p.gstRate === null).length,
    missingEffectiveDate: products.filter((p) => p.effectiveFrom === null).length,
    zeroMrp: products.filter((p) => p.mrp !== null && Number(p.mrp) === 0).length,
  }, null, 2));

  if (mode === 'dry-run') {
    console.log('DRY RUN ONLY: no database writes performed.');
    return;
  }

  if (duplicateHash.rows.length > 0) {
    throw new Error('This exact workbook fingerprint has already been imported or recorded. No changes made.');
  }

  if (existingCodes.length > 0) {
    throw new Error('Existing product-code conflicts found. Review before importing.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize imports that use this importer, and recheck the source file.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('bharat_batteries_product_import'))",
    );

    const currentHash = await sha256File(workbookPath);
    if (currentHash !== initialHash) {
      throw new Error('Workbook changed during import preparation. Retry dry-run.');
    }

    const duplicate = await client.query(
      'SELECT 1 FROM public.import_batches WHERE source_sha256 = $1',
      [initialHash],
    );

    if (duplicate.rowCount) {
      throw new Error('This workbook was imported by another process.');
    }

    const conflicts = await client.query(
      'SELECT product_code FROM public.products WHERE product_code = ANY($1::text[])',
      [products.map((p) => p.productCode)],
    );

    if (conflicts.rowCount) {
      throw new Error('Product-code conflicts appeared during import. No changes made.');
    }

    const batchResult = await client.query<{ id: string }>(
      `INSERT INTO public.import_batches
        (source_file, source_sheet, source_sha256, status, total_rows)
       VALUES ($1, 'Product Master', $2, 'pending', $3)
       RETURNING id`,
      [path.basename(workbookPath), initialHash, products.length],
    );

    const batchId = batchResult.rows[0].id;

    for (const p of products) {
      const productResult = await client.query<{ id: string }>(
        `INSERT INTO public.products
          (product_code, brand, category, sub_category, model_sku,
           specs_capacity, warranty, hsn, source_batch_id, source_sheet, source_row)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Product Master',$10)
         RETURNING id`,
        [
          p.productCode, p.brand, p.category, p.subCategory, p.sku,
          p.specs, p.warranty, p.hsn, batchId, p.excelRow,
        ],
      );

      if (
        p.dealerPrice !== null ||
        p.mrp !== null ||
        p.gstRate !== null ||
        p.effectiveFrom !== null
      ) {
        await client.query(
          `INSERT INTO public.product_prices
            (product_id, dealer_price, mrp, gst_rate, effective_from,
             source_batch_id, source_sheet, source_row)
           VALUES ($1,$2,$3,$4,$5,$6,'Product Master',$7)`,
          [
            productResult.rows[0].id, p.dealerPrice, p.mrp,
            p.gstRate, p.effectiveFrom, batchId, p.excelRow,
          ],
        );
      }
    }

    await client.query(
      `UPDATE public.import_batches
       SET status = 'imported', inserted_rows = $1,
           completed_at = NOW()
       WHERE id = $2`,
      [products.length, batchId],
    );

    await client.query('COMMIT');
    console.log(`Import successful: ${products.length} products; batch ${batchId}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error('Import failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
