// Apply migration 007: Add payment processing features
// Uses direct SQL execution without WebSocket
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  console.log('🔄 Applying migration 007_add_payment_processing.sql...');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Please ensure the database is provisioned.');
    process.exit(1);
  }

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'db', 'migrations', '007_add_payment_processing.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing SQL migration via HTTP...');

    // Use fetch to execute SQL via Neon's HTTP API
    const databaseUrl = new URL(process.env.DATABASE_URL);
    const [username, password] = (databaseUrl.username && databaseUrl.password)
      ? [databaseUrl.username, databaseUrl.password.split('@')[0]]
      : ['', ''];

    // Extract connection details
    const host = databaseUrl.hostname;
    const dbname = databaseUrl.pathname.slice(1);

    // Neon HTTP endpoint format
    const httpEndpoint = `https://${host.replace('-pooler', '')}/sql`;

    console.log('🌐 Connecting to:', httpEndpoint);

    const response = await fetch(httpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${password}`,
        'Neon-Connection-String': process.env.DATABASE_URL,
      },
      body: JSON.stringify({
        query: migrationSQL,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();

    console.log('✅ Migration 007 applied successfully!');
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
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();
