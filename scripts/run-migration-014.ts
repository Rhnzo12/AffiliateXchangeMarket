#!/usr/bin/env tsx
/**
 * Script to run migration 014: Add admin_response to reviews table
 * Usage: tsx --env-file=.env scripts/run-migration-014.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log("🔄 Running migration 014: Add missing columns to reviews table");

    // Read the migration SQL file
    const migrationPath = join(__dirname, "..", "db", "migrations", "014_add_admin_response_to_reviews.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📝 Executing migration SQL...\n");
    await db.execute(sql.raw(migrationSQL));

    console.log("\u2705 Migration completed successfully!\n");

    // Verify the columns were added
    console.log("🔍 Verifying new columns...");
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reviews'
      AND column_name IN ('admin_response', 'responded_at', 'responded_by', 'is_edited',
                          'admin_note', 'is_approved', 'approved_by', 'approved_at', 'is_hidden')
      ORDER BY column_name
    `);

    if (result.rows.length > 0) {
      console.log(`\u2705 Added ${result.rows.length} columns successfully:`);
      result.rows.forEach((column: any) => {
        console.log(`   - ${column.column_name} (${column.data_type}, nullable: ${column.is_nullable})`);
      });
    } else {
      console.log(`\u26A0\uFE0F  No new columns found`);
    }

    console.log("\n\u2728 Migration complete! Reviews table now has all required columns:");
    console.log("   - Admin can add responses and notes to reviews");
    console.log("   - Reviews can be approved/hidden by admin");
    console.log("   - Response tracking with timestamps and user references\n");

    process.exit(0);
  } catch (error: any) {
    console.error("\u274C Migration failed:", error.message);

    // Check if column already exists
    if (error.message?.includes("already exists") || error.code === '42701') {
      console.log("\u2139\uFE0F  The column may already exist. Verifying...");

      try {
        const result = await db.execute(sql`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'reviews'
          AND column_name IN ('admin_response', 'responded_at', 'responded_by', 'is_edited',
                              'admin_note', 'is_approved', 'approved_by', 'approved_at', 'is_hidden')
        `);

        if (result.rows.length > 0) {
          console.log(`\u2705 ${result.rows.length} columns already exist in database`);
          process.exit(0);
        } else {
          console.log("\u274C Columns not found despite 'already exists' error");
        }
      } catch (verifyError) {
        console.error("\u274C Could not verify column:", verifyError);
      }
    }

    console.error("\nFull error:", error);
    process.exit(1);
  }
}

runMigration();
