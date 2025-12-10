// Apply migration 007: Add payment processing features
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('🔄 Applying migration 007_add_payment_processing.sql...');

  if (!process.env.DATABASE_URL) {
    console.error('\u274C DATABASE_URL is not set. Please ensure the database is provisioned.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'db', 'migrations', '007_add_payment_processing.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing SQL migration...');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('\u2705 Migration 007 applied successfully!');
    console.log('');
    console.log('Created:');
    console.log('  - platform_funding_accounts table');
    console.log('  - payments.provider_transaction_id column');
    console.log('  - payments.provider_response column');
    console.log('  - retainer_payments enhancements for monthly payments:');
    console.log('    • month_number, payment_type columns');
    console.log('    • gross_amount, platform_fee_amount, processing_fee_amount, net_amount');
    console.log('    • provider_transaction_id, provider_response');
    console.log('    • payment_method, initiated_at, completed_at, failed_at');
    console.log('  - Indexes for performance');

  } catch (error: any) {
    console.error('\u274C Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();