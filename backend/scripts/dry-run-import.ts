import 'dotenv/config';
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(
  scriptDir,
  '../../Unified_Product_Price_Master_Refined_Final.xlsx',
);

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function money(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  const normalized = raw.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid monetary value: ${raw}`);
  }

  return normalized;
}

function rate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Invalid GST rate: ${raw}`);
  }

  const numeric = Number(raw);
  if (numeric < 0 || numeric > 100) {
    throw new Error(`GST rate outside 0–100: ${raw}`);
  }

  return raw;
}

function date(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Expected YYYY-MM-DD date, received: ${raw}`);
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

async function main(): Promise<void> {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const sheet = workbook.Sheets['Product Master'];

  if (!sheet) throw new Error('Missing worksheet: Product Master');

  // Header is Excel row 5; data starts at Excel row 6.
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    range: 4,
    defval: null,
    raw: false,
  });

  const seenCodes = new Set<string>();
  const skuCounts = new Map<string, number>();
  const errors: Array<{ excelRow: number; code: string; error: string }> = [];
  const warnings: Array<{ excelRow: number; code: string; warning: string }> = [];
  let missingDealerPrice = 0;
  let missingMrp = 0;
  let missingHsn = 0;
  let missingGst = 0;
  let missingDate = 0;
  let zeroMrp = 0;

  const validCodes: string[] = [];

  rows.forEach((row, index) => {
    const excelRow = index + 6;
    const code = text(row['Product Code']);
    const sku = text(row['Model / SKU']);

    try {
      if (!code) throw new Error('Product Code is missing');
      if (!text(row.Brand)) throw new Error('Brand is missing');
      if (!text(row.Category)) throw new Error('Category is missing');
      if (!sku) throw new Error('Model / SKU is missing');

      if (seenCodes.has(code)) {
        throw new Error(`Duplicate Product Code in workbook: ${code}`);
      }
      seenCodes.add(code);

      money(row['Dealer Price']);
      const mrp = money(row.MRP);
      rate(row['GST Rate %']);
      date(row['Effective From']);

      validCodes.push(code);
      skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);

      if (!text(row['Dealer Price'])) missingDealerPrice++;
      if (!text(row.MRP)) missingMrp++;
      if (!text(row.HSN)) missingHsn++;
      if (!text(row['GST Rate %'])) missingGst++;
      if (!text(row['Effective From'])) missingDate++;
      if (mrp === '0' || mrp === '0.00') {
        zeroMrp++;
        warnings.push({
          excelRow,
          code,
          warning: 'MRP is zero; preserve and review',
        });
      }

      if (!text(row.HSN)) {
        warnings.push({
          excelRow,
          code,
          warning: 'HSN is missing',
        });
      }
    } catch (error) {
      errors.push({
        excelRow,
        code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Read-only conflict check. This script performs no database writes.
  const existingResult = await pool.query<{ product_code: string }>(
    'SELECT product_code FROM public.products WHERE product_code = ANY($1::text[])',
    [validCodes],
  );

  const existingCodes = new Set(
    existingResult.rows.map((row) => row.product_code),
  );

  const conflicts = validCodes.filter((code) => existingCodes.has(code));
  const duplicateSkus = [...skuCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sku, count]) => ({ sku, count }));

  console.log('\n=== PRODUCT CATALOG DRY RUN ===');
  console.log(JSON.stringify({
    workbook: workbookPath,
    sheet: 'Product Master',
    sourceRows: rows.length,
    validRows: rows.length - errors.length,
    rejectedRows: errors.length,
    uniqueProductCodes: seenCodes.size,
    existingProductCodeConflicts: conflicts.length,
    existingCodeSamples: conflicts.slice(0, 20),
    duplicateSkuGroups: duplicateSkus,
    missingDealerPrice,
    missingMrp,
    missingHsn,
    missingGst,
    missingEffectiveDate: missingDate,
    zeroMrp,
    warningCount: warnings.length,
    errorCount: errors.length,
  }, null, 2));

  if (errors.length) {
    console.log('\n=== VALIDATION ERRORS (first 50) ===');
    console.log(JSON.stringify(errors.slice(0, 50), null, 2));
  }

  if (warnings.length) {
    console.log('\n=== REVIEW WARNINGS (first 30) ===');
    console.log(JSON.stringify(warnings.slice(0, 30), null, 2));
  }

  console.log('\nDRY RUN ONLY: no database records were inserted, updated, or deleted.');
}

main()
  .catch((error: unknown) => {
    console.error(
      'Dry run failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
