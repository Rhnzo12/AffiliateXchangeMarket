import { pool } from "../db";

/**
 * Migration: Add priority listing fields to offers table
 * - priorityExpiresAt: timestamp when priority listing expires
 * - priorityPurchasedAt: timestamp when priority listing was purchased
 */
export async function addPriorityListingFields() {
  const client = await pool.connect();

  try {
    console.log("[Migration] Adding priority listing fields to offers table...");

    // Add priorityExpiresAt column
    await client.query(`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS priority_expires_at TIMESTAMP;
    `);

    // Add priorityPurchasedAt column
    await client.query(`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS priority_purchased_at TIMESTAMP;
    `);

    // Create index for efficient querying of expired priority listings
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_offers_priority_expires_at
      ON offers(priority_expires_at)
      WHERE priority_expires_at IS NOT NULL;
    `);

    // Insert default platform settings for priority listing
    await client.query(`
      INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'priority_listing_fee', '199', 'Fee for priority listing in dollars', 'pricing', NOW(), NOW()),
        (gen_random_uuid(), 'priority_listing_duration_days', '30', 'Duration of priority listing in days', 'features', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("[Migration] Priority listing fields added successfully!");
  } catch (error) {
    console.error("[Migration] Error adding priority listing fields:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
// ES module syntax: check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  addPriorityListingFields()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
