import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function verifyNewFields() {
  try {
    console.log("Verifying new fields in database...\n");

    // Check conversations table
    const conversationsCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      AND column_name IN ('resolved', 'resolved_at', 'resolved_by')
      ORDER BY column_name
    `);

    console.log("✓ Conversations table fields:");
    if (conversationsCheck.rows.length > 0) {
      conversationsCheck.rows.forEach((row: any) => {
        console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
      });
    } else {
      console.log("  ❌ No resolution fields found");
    }
    console.log();

    // Check offers table
    const offersCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'offers'
      AND column_name IN ('exclusivity_required', 'content_approval_required')
      ORDER BY column_name
    `);

    console.log("✓ Offers table fields:");
    if (offersCheck.rows.length > 0) {
      offersCheck.rows.forEach((row: any) => {
        console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
      });
    } else {
      console.log("  ❌ No contract fields found");
    }
    console.log();

    // Check company_profiles table
    const companyCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'company_profiles'
      AND column_name IN ('linkedin_url', 'twitter_url', 'facebook_url', 'instagram_url')
      ORDER BY column_name
    `);

    console.log("✓ Company Profiles table fields:");
    if (companyCheck.rows.length > 0) {
      companyCheck.rows.forEach((row: any) => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log("  ❌ No social media fields found");
    }
    console.log();

    const totalFields = conversationsCheck.rows.length + offersCheck.rows.length + companyCheck.rows.length;
    const expectedFields = 3 + 2 + 4; // 3 + 2 + 4 = 9 total fields

    if (totalFields === expectedFields) {
      console.log("✅ SUCCESS! All 9 new fields have been added to the database.");
      console.log("\nSummary:");
      console.log(`  - Conversations: ${conversationsCheck.rows.length}/3 fields`);
      console.log(`  - Offers: ${offersCheck.rows.length}/2 fields`);
      console.log(`  - Company Profiles: ${companyCheck.rows.length}/4 fields`);
    } else {
      console.log(`⚠️  WARNING: Found ${totalFields}/${expectedFields} fields. Some may be missing.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error verifying fields:", error);
    process.exit(1);
  }
}

verifyNewFields();
