#!/usr/bin/env tsx
/**
 * Script to run migration 011: Add creator requirements fields to offers table
 * Usage: tsx --env-file=.env scripts/run-migration-011.ts
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
    console.log("🔄 Running migration 011: Add creator requirements fields");

    // Read the migration SQL file
    const migrationPath = join(__dirname, "..", "db", "migrations", "011_add_creator_requirements_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📝 Executing migration SQL...\n");
    await db.execute(sql.raw(migrationSQL));

    console.log("✅ Migration completed successfully!\n");

    // Verify the columns were added
    console.log("🔍 Verifying new columns...");
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN (
        'minimum_followers',
        'allowed_platforms',
        'geographic_restrictions',
        'age_restriction',
        'content_style_requirements',
        'brand_safety_requirements'
      )
      ORDER BY column_name
    `);

    if (result.rows.length === 6) {
      console.log("✅ All 6 columns added successfully:");
      result.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log(`⚠️  Expected 6 columns, found ${result.rows.length}`);
      result.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }

    console.log("\n✨ Migration complete! You can now:");
    console.log("   1. Restart your application");
    console.log("   2. Create a new offer with creator requirements");
    console.log("   3. View the offer to see the requirements displayed\n");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);

    // Check if columns already exist
    if (error.message?.includes("already exists")) {
      console.log("ℹ️  The columns may already exist. Verifying...");

      try {
        const result = await db.execute(sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'offers'
          AND column_name IN (
            'minimum_followers',
            'allowed_platforms',
            'geographic_restrictions',
            'age_restriction',
            'content_style_requirements',
            'brand_safety_requirements'
          )
        `);

        console.log(`✅ Found ${result.rows.length}/6 columns already in database`);
        process.exit(0);
      } catch (verifyError) {
        console.error("❌ Could not verify columns:", verifyError);
      }
    }

    console.error("\nFull error:", error);
    process.exit(1);
  }
}

runMigration();
