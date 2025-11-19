import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add new fields to conversations, offers, and company_profiles tables
 * - Conversations: resolved, resolvedAt, resolvedBy (for thread resolution)
 * - Offers: exclusivityRequired, contentApprovalRequired (for contract terms)
 * - Company Profiles: linkedinUrl, twitterUrl, facebookUrl, instagramUrl (social media)
 */
export async function addConversationOfferCompanyFields() {
  try {
    console.log("Adding new fields to conversations, offers, and company_profiles tables...");

    // Add fields to conversations table
    await db.execute(sql`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS resolved_at timestamp,
      ADD COLUMN IF NOT EXISTS resolved_by varchar
    `);
    console.log("✅ Added resolution fields to conversations table");

    // Add fields to offers table
    await db.execute(sql`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS exclusivity_required boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS content_approval_required boolean DEFAULT false
    `);
    console.log("✅ Added contract fields to offers table");

    // Add fields to company_profiles table
    await db.execute(sql`
      ALTER TABLE company_profiles
      ADD COLUMN IF NOT EXISTS linkedin_url varchar,
      ADD COLUMN IF NOT EXISTS twitter_url varchar,
      ADD COLUMN IF NOT EXISTS facebook_url varchar,
      ADD COLUMN IF NOT EXISTS instagram_url varchar
    `);
    console.log("✅ Added social media fields to company_profiles table");

    console.log("✅ Successfully completed all schema updates");
  } catch (error) {
    console.error("❌ Error adding fields:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addConversationOfferCompanyFields()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
