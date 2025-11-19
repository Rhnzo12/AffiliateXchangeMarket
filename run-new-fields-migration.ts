import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Starting migration: Adding new fields...\n");

    // Add fields to conversations table
    console.log("1. Adding resolution fields to conversations table...");
    await db.execute(sql`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS resolved_at timestamp,
      ADD COLUMN IF NOT EXISTS resolved_by varchar
    `);
    console.log("   ✅ Done\n");

    // Add fields to offers table
    console.log("2. Adding contract fields to offers table...");
    await db.execute(sql`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS exclusivity_required boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS content_approval_required boolean DEFAULT false
    `);
    console.log("   ✅ Done\n");

    // Add fields to company_profiles table
    console.log("3. Adding social media fields to company_profiles table...");
    await db.execute(sql`
      ALTER TABLE company_profiles
      ADD COLUMN IF NOT EXISTS linkedin_url varchar,
      ADD COLUMN IF NOT EXISTS twitter_url varchar,
      ADD COLUMN IF NOT EXISTS facebook_url varchar,
      ADD COLUMN IF NOT EXISTS instagram_url varchar
    `);
    console.log("   ✅ Done\n");

    console.log("✅ Migration completed successfully!");
    console.log("\nSummary:");
    console.log("  - Conversations: resolved, resolved_at, resolved_by");
    console.log("  - Offers: exclusivity_required, content_approval_required");
    console.log("  - Company Profiles: linkedin_url, twitter_url, facebook_url, instagram_url");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
