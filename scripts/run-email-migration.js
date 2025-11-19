// Simple JavaScript migration script for email verification
// Run with: node scripts/run-email-migration.js

import { neon } from '@neondatabase/serverless';

async function runMigration() {
  // Get DATABASE_URL from environment
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  try {
    // Add email_verified column
    console.log('Adding email_verified column...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    `;
    console.log('✅ Added email_verified column');

    // Add email_verification_token column
    console.log('Adding email_verification_token column...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
    `;
    console.log('✅ Added email_verification_token column');

    // Add email_verification_token_expiry column
    console.log('Adding email_verification_token_expiry column...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expiry TIMESTAMP;
    `;
    console.log('✅ Added email_verification_token_expiry column');

    // Add password_reset_token column
    console.log('Adding password_reset_token column...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
    `;
    console.log('✅ Added password_reset_token column');

    // Add password_reset_token_expiry column
    console.log('Adding password_reset_token_expiry column...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;
    `;
    console.log('✅ Added password_reset_token_expiry column');

    // Set email_verified to true for Google OAuth users
    console.log('Setting email_verified for OAuth users...');
    const result = await sql`
      UPDATE users SET email_verified = true WHERE google_id IS NOT NULL;
    `;
    console.log('✅ Updated', result.length, 'OAuth users');

    // Create indexes
    console.log('Creating indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
    `;
    console.log('✅ Created indexes');

    // Verify
    console.log('\n🔍 Verifying columns...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN (
        'email_verified',
        'email_verification_token',
        'email_verification_token_expiry',
        'password_reset_token',
        'password_reset_token_expiry'
      )
      ORDER BY column_name;
    `;

    console.log('Columns found:', columns);

    if (columns.length === 5) {
      console.log('\n✅ Migration completed successfully!');
      console.log('🎉 Email verification fields are now available');
    } else {
      console.log('\n⚠️ Migration may have issues - only found', columns.length, 'columns');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
