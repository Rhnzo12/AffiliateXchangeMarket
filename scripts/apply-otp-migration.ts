import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('\u274C DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, '../db/migrations/016_add_account_deletion_otp.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('\u1F680 Applying OTP migration...\n');

    // Execute statements directly
    console.log('1️⃣ Adding account_deletion_otp column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deletion_otp varchar`;
    console.log('\u2705 account_deletion_otp column added\n');

    console.log('2️⃣ Adding account_deletion_otp_expiry column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deletion_otp_expiry timestamp`;
    console.log('\u2705 account_deletion_otp_expiry column added\n');

    console.log('3️⃣ Creating index for OTP lookups...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_account_deletion_otp ON users(account_deletion_otp) WHERE account_deletion_otp IS NOT NULL`;
    console.log('\u2705 Index created\n');

    console.log('\u2705 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  • Added account_deletion_otp column');
    console.log('  • Added account_deletion_otp_expiry column');
    console.log('  • Created index for faster OTP lookups');
    console.log('\n\u1F389 Account deletion with OTP is now ready to use!');

  } catch (error: any) {
    console.error('\u274C Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
