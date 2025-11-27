import { db, pool } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration to add deleted_for column to messages table
 * This enables soft delete functionality for messages
 */
async function migrate() {
  console.log("[Migration] Starting: add-message-deleted-for");

  try {
    // Add deleted_for column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS deleted_for TEXT[] DEFAULT ARRAY[]::TEXT[]
    `);
    console.log("[Migration] Added deleted_for column to messages table");

    // Create index for faster filtering
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_messages_deleted_for ON messages USING GIN (deleted_for)
    `);
    console.log("[Migration] Created index on deleted_for column");

    console.log("[Migration] Completed: add-message-deleted-for");
  } catch (error) {
    console.error("[Migration] Error:", error);
    throw error;
  }
}

// Run migration if executed directly
migrate()
  .then(() => {
    console.log("[Migration] Success!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Migration] Failed:", error);
    process.exit(1);
  });

export { migrate };
