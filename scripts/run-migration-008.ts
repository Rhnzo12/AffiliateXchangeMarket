#!/usr/bin/env tsx
/**
 * Script to run migration 008: Add payment notification types to notification_type enum
 * Usage: tsx --env-file=.env scripts/run-migration-008.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  try {
    console.log("[Migration] Running migration 008: Add payment notification types to notification_type enum");

    console.log("[Migration] Adding 'payment_failed_insufficient_funds' to enum...");
    await db.execute(sql.raw(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds'`));
    console.log("[Migration] \u2705 Added 'payment_failed_insufficient_funds'");

    console.log("[Migration] Adding 'payment_approved' to enum...");
    await db.execute(sql.raw(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_approved'`));
    console.log("[Migration] \u2705 Added 'payment_approved'");

    console.log("[Migration] \u2705 Migration completed successfully!");
    console.log("[Migration] Both notification types have been added to the database.");

    process.exit(0);
  } catch (error: any) {
    console.error("[Migration] \u274C Migration failed:", error);

    // Check if the value already exists
    if (error.message?.includes("already exists")) {
      console.log("[Migration] \u2139\uFE0F  The values already exist in the enum.");
      process.exit(0);
    }

    process.exit(1);
  }
}

runMigration();
