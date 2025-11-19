// Migration to add missing notification_type enum values
import { pool } from '../db.js';

export async function up() {
  const client = await pool.connect();

  try {
    console.log('[Migration] Adding missing notification_type enum values...');

    // Check if enum values already exist and add missing ones
    const enumValues = [
      'payment_pending',
      'payment_approved',
      'payment_disputed',
      'payment_failed_insufficient_funds',
      'offer_edit_requested',
      'offer_removed',
      'work_completion_approval',
      'priority_listing_expiring',
      'deliverable_rejected'
    ];

    for (const value of enumValues) {
      try {
        await client.query(`
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '${value}';
        `);
        console.log(`[Migration] Added enum value: ${value}`);
      } catch (error: any) {
        // If value already exists, PostgreSQL will throw an error
        // We can safely ignore it
        if (error.code !== '42710') { // duplicate_object error code
          console.log(`[Migration] Note: ${value} may already exist or error occurred:`, error.message);
        }
      }
    }

    console.log('[Migration] Successfully added missing notification_type enum values');
  } catch (error) {
    console.error('[Migration] Error adding notification enum values:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down() {
  // Note: PostgreSQL doesn't support removing enum values easily
  // You would need to drop and recreate the enum type
  console.log('[Migration] Down migration not implemented for enum values');
  console.log('[Migration] Removing enum values requires dropping and recreating the type');
}
