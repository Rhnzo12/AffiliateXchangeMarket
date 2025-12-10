/**
 * Migration runner for 015_fix_content_flags_uuid_types.sql
 * Converts content_flags and banned_keywords columns from VARCHAR to UUID
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('\u274C ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('\u2705 Connected successfully\n');

    // Read the migration SQL file
    const sqlPath = join(__dirname, '..', 'db', 'migrations', '015_fix_content_flags_uuid_types.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📝 Running migration to fix UUID type mismatches...\n');

    // Execute the migration
    await client.query(sql);

    console.log('\n\u2705 Migration completed successfully!');
    console.log('\n📊 Converted columns:');
    console.log('  \u2713 content_flags.id → UUID');
    console.log('  \u2713 content_flags.user_id → UUID');
    console.log('  \u2713 content_flags.reviewed_by → UUID');
    console.log('  \u2713 banned_keywords.id → UUID');
    console.log('  \u2713 banned_keywords.created_by → UUID');

    client.release();

  } catch (error: any) {
    console.error('\n\u274C Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('╔════════════════════════════════════════════════╗');
console.log('║   Fix Content Flags UUID Type Migration       ║');
console.log('║   Converts VARCHAR to UUID                     ║');
console.log('╚════════════════════════════════════════════════╝\n');

runMigration();
