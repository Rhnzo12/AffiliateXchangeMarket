// Simple JavaScript migration script (works with Node.js directly)
// Run with: node scripts/run-priority-migration.js

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
    // Add priority_expires_at column
    console.log('Adding priority_expires_at column...');
    await sql`
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS priority_expires_at TIMESTAMP;
    `;
    console.log('✅ Added priority_expires_at column');

    // Add priority_purchased_at column
    console.log('Adding priority_purchased_at column...');
    await sql`
      ALTER TABLE offers ADD COLUMN IF NOT EXISTS priority_purchased_at TIMESTAMP;
    `;
    console.log('✅ Added priority_purchased_at column');

    // Create index
    console.log('Creating index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_offers_priority_expires_at
      ON offers(priority_expires_at)
      WHERE priority_expires_at IS NOT NULL;
    `;
    console.log('✅ Created index');

    // Add platform settings
    console.log('Adding platform settings...');
    await sql`
      INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'priority_listing_fee', '199', 'Fee for priority listing in dollars', 'pricing', NOW(), NOW()),
        (gen_random_uuid(), 'priority_listing_duration_days', '30', 'Duration of priority listing in days', 'features', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING;
    `;
    console.log('✅ Added platform settings');

    // Verify
    console.log('\n🔍 Verifying columns...');
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN ('priority_expires_at', 'priority_purchased_at');
    `;

    console.log('Columns found:', result);

    if (result.length === 2) {
      console.log('\n✅ Migration completed successfully!');
      console.log('🎉 Priority listing fields are now available');
    } else {
      console.log('\n⚠️ Migration may have issues - only found', result.length, 'columns');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
