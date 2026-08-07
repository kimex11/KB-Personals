import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const [, , migrationFile] = process.argv;
if (!migrationFile) {
  console.error('Usage: node scripts/db/apply-migration.mjs <path-to-sql-file>');
  process.exit(1);
}

const sql = readFileSync(migrationFile, 'utf-8');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${migrationFile}`);
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
