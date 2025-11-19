/**
 * Migration script to add new offer management fields
 *
 * Adds fields for:
 * - Rejection tracking (rejectedAt, rejectionReason)
 * - Homepage featuring (featuredOnHomepage)
 * - Listing fees (listingFee)
 * - Edit requests history (editRequests)
 *
 * Run with: npx tsx server/migrations/add-offer-management-fields.ts
 */

import { sql } from "drizzle-orm";
import { pool } from "../db";

async function main() {
  console.log('Starting offer management fields migration...');

  try {
    const client = await pool.connect();

    try {
      // Add rejectedAt column
      console.log('Adding rejectedAt column...');
      await client.query(`
        ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
      `);

      // Add rejectionReason column
      console.log('Adding rejectionReason column...');
      await client.query(`
        ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      `);

      // Add featuredOnHomepage column
      console.log('Adding featuredOnHomepage column...');
      await client.query(`
        ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS featured_on_homepage BOOLEAN DEFAULT false;
      `);

      // Add listingFee column
      console.log('Adding listingFee column...');
      await client.query(`
        ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS listing_fee NUMERIC(10, 2) DEFAULT 0;
      `);

      // Add editRequests column
      console.log('Adding editRequests column...');
      await client.query(`
        ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS edit_requests JSONB DEFAULT '[]'::jsonb;
      `);

      console.log('\n✓ Migration completed successfully!');
      console.log('New columns added:');
      console.log('  - rejected_at');
      console.log('  - rejection_reason');
      console.log('  - featured_on_homepage');
      console.log('  - listing_fee');
      console.log('  - edit_requests');
    } finally {
      client.release();
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

main();
