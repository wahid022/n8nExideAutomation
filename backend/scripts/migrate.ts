
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const migrations = [
  {
    version: '001_product_catalog',
    file: '../sql/migrations/001_product_catalog.sql',
  },
  {
    version: '002_import_fingerprint',
    file: '../sql/migrations/002_import_fingerprint.sql',
  },
  {
    version: '003_price_change_audit',
    file: '../sql/migrations/003_price_change_audit.sql',
  },
  {
    version: '004_customers_quotations',
    file: '../sql/migrations/004_customers_quotations.sql',
  },
  {
    version: '005_sales_documents',
    file: '../sql/migrations/005_sales_documents.sql',
  },
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const client = await pool.connect();

  try {
    for (const migration of migrations) {
      const applied = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE version = $1',
        [migration.version],
      );

      if (applied.rowCount) {
        console.log(`${migration.version} already applied.`);
        continue;
      }

      if (migration.version === '001_product_catalog') {
        throw new Error(
          'Migration 001 is missing from migration history. Inspect the database before proceeding.',
        );
      }

      if (migration.version === '002_import_fingerprint') {
        const column = await client.query(
          `SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'import_batches'
             AND column_name = 'source_sha256'`,
        );

        if (column.rowCount) {
          throw new Error(
            'source_sha256 already exists but migration 002 is unrecorded. Inspect the database before proceeding.',
          );
        }
      }

      const sql = await readFile(
        path.resolve(scriptDir, migration.file),
        'utf8',
      );

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (version) VALUES ($1)',
          [migration.version],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      console.log(`${migration.version} applied successfully.`);
    }
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      'Migration failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
