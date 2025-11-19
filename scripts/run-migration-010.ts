#!/usr/bin/env tsx
/**
 * Script to run migration 010: Create niches table and migrate data
 * Usage: tsx --env-file=.env scripts/run-migration-010.ts
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
    console.log("[Migration] Running migration 010: Create niches table");

    // Read the migration SQL file
    const migrationPath = join(__dirname, "..", "db", "migrations", "010_create_niches_table.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("[Migration] Executing migration SQL...");
    await db.execute(sql.raw(migrationSQL));

    console.log("[Migration] ✅ Migration completed successfully!");
    console.log("[Migration] Niches table has been created and data migrated.");

    // Verify the table was created
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM niches`);
    console.log(`[Migration] ℹ️  Niches table now contains ${(result.rows[0] as any).count} records.`);

    process.exit(0);
  } catch (error: any) {
    console.error("[Migration] ❌ Migration failed:", error);

    // Check if the table already exists
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ℹ️  The niches table already exists.");
      process.exit(0);
    }

    process.exit(1);
  }
}

runMigration();
