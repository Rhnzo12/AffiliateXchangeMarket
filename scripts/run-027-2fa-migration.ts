import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('Applying Two-Factor Authentication (2FA) migration...\n');

    console.log('1. Adding two_factor_secret column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64)`;
    console.log('   two_factor_secret column added\n');

    console.log('2. Adding two_factor_enabled column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
    console.log('   two_factor_enabled column added\n');

    console.log('3. Adding two_factor_backup_codes column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT`;
    console.log('   two_factor_backup_codes column added\n');

    console.log('4. Creating index for 2FA lookups...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE`;
    console.log('   Index created\n');

    console.log('Migration completed successfully!');
    console.log('\nSummary:');
    console.log('  - Added two_factor_secret column (stores TOTP secret)');
    console.log('  - Added two_factor_enabled column (boolean flag)');
    console.log('  - Added two_factor_backup_codes column (JSON array of hashed codes)');
    console.log('  - Created index for faster 2FA lookups');
    console.log('\nTwo-Factor Authentication is now ready to use!');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
