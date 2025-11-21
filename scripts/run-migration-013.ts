#!/usr/bin/env tsx
/**
 * Script to run migration 013: Add Stripe Connect account ID to payment_settings
 * Usage: tsx --env-file=.env scripts/run-migration-013.ts
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
    console.log("🔄 Running migration 013: Add Stripe Connect account ID");

    // Read the migration SQL file
    const migrationPath = join(__dirname, "..", "db", "migrations", "013_add_stripe_connect_account_id.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📝 Executing migration SQL...\n");
    await db.execute(sql.raw(migrationSQL));

    console.log("✅ Migration completed successfully!\n");

    // Verify the column was added
    console.log("🔍 Verifying new column...");
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_settings'
      AND column_name = 'stripe_account_id'
    `);

    if (result.rows.length === 1) {
      const column: any = result.rows[0];
      console.log("✅ Column added successfully:");
      console.log(`   - ${column.column_name} (${column.data_type}, nullable: ${column.is_nullable})`);

      // Check if index was created
      const indexResult = await db.execute(sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'payment_settings'
        AND indexname = 'idx_payment_settings_stripe_account_id'
      `);

      if (indexResult.rows.length === 1) {
        console.log("✅ Index created successfully:");
        console.log(`   - idx_payment_settings_stripe_account_id`);
      } else {
        console.log("⚠️  Index not found (may need manual creation)");
      }
    } else {
      console.log(`⚠️  Expected 1 column, found ${result.rows.length}`);
    }

    console.log("\n✨ Migration complete! You can now:");
    console.log("   1. Restart your application");
    console.log("   2. Set up Stripe Connect for e-transfer payments");
    console.log("   3. Refer to STRIPE_CONNECT_SETUP.md for next steps\n");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);

    // Check if column already exists
    if (error.message?.includes("already exists") || error.code === '42701') {
      console.log("ℹ️  The column may already exist. Verifying...");

      try {
        const result = await db.execute(sql`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'payment_settings'
          AND column_name = 'stripe_account_id'
        `);

        if (result.rows.length === 1) {
          console.log("✅ Column already exists in database");
          process.exit(0);
        } else {
          console.log("❌ Column not found despite 'already exists' error");
        }
      } catch (verifyError) {
        console.error("❌ Could not verify column:", verifyError);
      }
    }

    console.error("\nFull error:", error);
    process.exit(1);
  }
}

runMigration();
