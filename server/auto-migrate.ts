/**
 * Auto-migration utility that runs on server startup
 * Adds missing columns to the offers table if they don't exist
 */

import { pool } from "./db";

export async function runAutoMigrations() {
  console.log('🔄 Checking for required database migrations...');

  const client = await pool.connect();

  try {
    // --- Offer management columns ---
    // Check if new columns exist
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN (
        'rejected_at',
        'rejection_reason',
        'featured_on_homepage',
        'listing_fee',
        'edit_requests'
      );
    `);

    const existingColumns = result.rows.map(row => row.column_name);
    const requiredColumns = [
      'rejected_at',
      'rejection_reason',
      'featured_on_homepage',
      'listing_fee',
      'edit_requests'
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('\u2713 All offer management columns exist');
    } else {
      console.log(`\u26A0\uFE0F  Missing columns: ${missingColumns.join(', ')}`);
      console.log('🔧 Adding missing columns...');

      // Add missing columns
      if (!existingColumns.includes('rejected_at')) {
        await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;');
        console.log('  \u2713 Added rejected_at');
      }

      if (!existingColumns.includes('rejection_reason')) {
        await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;');
        console.log('  \u2713 Added rejection_reason');
      }

      if (!existingColumns.includes('featured_on_homepage')) {
        await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS featured_on_homepage BOOLEAN DEFAULT false;');
        console.log('  \u2713 Added featured_on_homepage');
      }

      if (!existingColumns.includes('listing_fee')) {
        await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS listing_fee NUMERIC(10, 2) DEFAULT 0;');
        console.log('  \u2713 Added listing_fee');
      }

      if (!existingColumns.includes('edit_requests')) {
        await client.query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS edit_requests JSONB DEFAULT '[]'::jsonb;`);
        console.log('  \u2713 Added edit_requests');
      }
    }

    // Check if notification types need updating
    console.log('🔄 Checking notification types...');
    const notifResult = await client.query(`
      SELECT unnest(enum_range(NULL::notification_type))::text as enum_value;
    `);

    const existingNotifTypes = notifResult.rows.map(row => row.enum_value);
    const requiredNotifTypes = ['offer_edit_requested', 'offer_removed'];
    const missingNotifTypes = requiredNotifTypes.filter(t => !existingNotifTypes.includes(t));

    if (missingNotifTypes.length > 0) {
      console.log(`\u26A0\uFE0F  Missing notification types: ${missingNotifTypes.join(', ')}`);
      console.log('🔧 Adding notification types...');

      for (const notifType of missingNotifTypes) {
        try {
          await client.query(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '${notifType}';`);
          console.log(`  \u2713 Added ${notifType}`);
        } catch (error) {
          // Value might already exist, ignore error
          console.log(`  \u2139\uFE0F  ${notifType} may already exist`);
        }
      }
    } else {
      console.log('\u2713 All notification types exist');
    }

    // --- Retainer contract tiering/support columns ---
    // Ensure the new retainer contract fields (tiers, approvals, scheduling) exist so retainer
    // creation doesn't fail with missing-column errors.
    console.log('🔄 Checking retainer contract columns...');
    const retainerColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'retainer_contracts'
        AND column_name IN (
          'content_approval_required',
          'exclusivity_required',
          'minimum_video_length_seconds',
          'posting_schedule',
          'retainer_tiers'
        );
    `);

    const existingRetainerColumns = retainerColumnsResult.rows.map((row) => row.column_name);
    const requiredRetainerColumns = [
      'content_approval_required',
      'exclusivity_required',
      'minimum_video_length_seconds',
      'posting_schedule',
      'retainer_tiers',
    ];

    const missingRetainerColumns = requiredRetainerColumns.filter(
      (column) => !existingRetainerColumns.includes(column),
    );

    if (missingRetainerColumns.length === 0) {
      console.log('\u2713 All retainer contract columns exist');
    } else {
      console.log(`\u26A0\uFE0F  Missing retainer columns: ${missingRetainerColumns.join(', ')}`);
      console.log('🔧 Adding missing retainer columns...');

      await client.query(`
        ALTER TABLE retainer_contracts
          ADD COLUMN IF NOT EXISTS content_approval_required BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS exclusivity_required BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS minimum_video_length_seconds INTEGER,
          ADD COLUMN IF NOT EXISTS posting_schedule TEXT,
          ADD COLUMN IF NOT EXISTS retainer_tiers JSONB DEFAULT '[]'::jsonb;
      `);

      await client.query(`
        UPDATE retainer_contracts
        SET content_approval_required = COALESCE(content_approval_required, false),
            exclusivity_required = COALESCE(exclusivity_required, false)
        WHERE content_approval_required IS NULL OR exclusivity_required IS NULL;
      `);

      await client.query(`
        ALTER TABLE retainer_contracts
          ALTER COLUMN content_approval_required SET NOT NULL,
          ALTER COLUMN exclusivity_required SET NOT NULL;
      `);

      console.log('\u2713 Retainer contract columns added/updated');
    }

    console.log('\u2705 Database migrations completed successfully!');
  } catch (error) {
    console.error('\u274C Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
