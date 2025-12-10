#!/usr/bin/env tsx
/**
 * Script to test what the API returns for an offer
 * Usage: tsx scripts/test-api-offer.ts <offer-id>
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

const offerId = process.argv[2];

if (!offerId) {
  console.error("\u274C Please provide an offer ID");
  console.error("Usage: tsx scripts/test-api-offer.ts <offer-id>");
  process.exit(1);
}

async function testApiOffer() {
  try {
    console.log(`🔍 Testing API response for offer ${offerId}...\n`);

    // First, check if columns exist in the database
    console.log("📋 Step 1: Checking if columns exist in database...");
    const columnsResult = await db.execute(sql`
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

    if (columnsResult.rows.length === 0) {
      console.error("\n\u274C PROBLEM FOUND: Creator requirements columns DO NOT EXIST in database!");
      console.error("\n🔧 FIX: Run the migration:");
      console.error("   npm run migrate:creator-requirements\n");
      process.exit(1);
    }

    console.log(`\u2705 Found ${columnsResult.rows.length}/6 columns in database:`);
    columnsResult.rows.forEach((row: any) => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    if (columnsResult.rows.length < 6) {
      console.error("\n\u26A0\uFE0F  WARNING: Some columns are missing! Expected 6, found " + columnsResult.rows.length);
      console.error("   Run: npm run migrate:creator-requirements\n");
    }

    // Now query the actual offer data
    console.log("\n📋 Step 2: Querying offer data from database...");
    const offerResult = await db.execute(sql`
      SELECT
        id,
        title,
        minimum_followers,
        allowed_platforms,
        geographic_restrictions,
        age_restriction,
        content_style_requirements,
        brand_safety_requirements
      FROM offers
      WHERE id = ${offerId}
    `);

    if (offerResult.rows.length === 0) {
      console.error(`\n\u274C Offer ${offerId} not found in database`);
      process.exit(1);
    }

    const offer = offerResult.rows[0] as any;
    console.log(`\u2705 Offer found: "${offer.title}"`);

    console.log("\n📋 Step 3: Creator Requirements Data:");
    console.log("─".repeat(70));
    console.log(`minimum_followers:              ${offer.minimum_followers ?? "NULL"}`);
    console.log(`allowed_platforms:              ${offer.allowed_platforms ? JSON.stringify(offer.allowed_platforms) : "NULL"}`);
    console.log(`geographic_restrictions:        ${offer.geographic_restrictions ? JSON.stringify(offer.geographic_restrictions) : "NULL"}`);
    console.log(`age_restriction:                ${offer.age_restriction ?? "NULL"}`);
    console.log(`content_style_requirements:     ${offer.content_style_requirements ? offer.content_style_requirements.substring(0, 40) + "..." : "NULL"}`);
    console.log(`brand_safety_requirements:      ${offer.brand_safety_requirements ? offer.brand_safety_requirements.substring(0, 40) + "..." : "NULL"}`);
    console.log("─".repeat(70));

    const hasAnyData =
      offer.minimum_followers != null ||
      (offer.allowed_platforms && offer.allowed_platforms.length > 0) ||
      (offer.geographic_restrictions && offer.geographic_restrictions.length > 0) ||
      offer.age_restriction != null ||
      offer.content_style_requirements != null ||
      offer.brand_safety_requirements != null;

    console.log("\n📊 Analysis:");
    if (!hasAnyData) {
      console.log("\u274C This offer has NO creator requirements data");
      console.log("\n🔧 Possible causes:");
      console.log("   1. Offer was created BEFORE the backend fix");
      console.log("   2. Form fields were left empty when creating the offer");
      console.log("\n\u1F4A1 Solutions:");
      console.log("   • Update this offer:");
      console.log(`     npm run update:offer-requirements ${offerId}`);
      console.log("   • OR create a new offer with requirements filled in");
    } else {
      console.log("\u2705 This offer HAS creator requirements data!");
      console.log("   Data exists in database and should be returned by the API");
      console.log("\n🔧 If requirements still not showing on frontend:");
      console.log("   1. Check browser console for errors");
      console.log("   2. Verify dev server is running (npm run dev)");
      console.log("   3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)");
      console.log("   4. Check network tab to see API response");
    }

    console.log("\n\u2728 Test complete!\n");
    process.exit(0);
  } catch (error: any) {
    console.error("\n\u274C Test failed:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

testApiOffer();
