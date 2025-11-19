import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add attachments field to messages table
 * Allows users to attach images/files to messages for proof of work
 */
export async function addMessageAttachments() {
  try {
    console.log("Adding attachments column to messages table...");

    await db.execute(sql`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT ARRAY[]::text[]
    `);

    console.log("✅ Successfully added attachments column to messages table");
  } catch (error) {
    console.error("❌ Error adding attachments column:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addMessageAttachments()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
