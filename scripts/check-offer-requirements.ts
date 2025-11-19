#!/usr/bin/env tsx
/**
 * Script to check if an offer has creator requirements data
 * Usage: tsx scripts/check-offer-requirements.ts <offer-id>
 */

import { db } from "../server/db";
import { offers } from "../shared/schema";
import { eq } from "drizzle-orm";

const offerId = process.argv[2];

if (!offerId) {
  console.error("❌ Please provide an offer ID");
  console.error("Usage: tsx scripts/check-offer-requirements.ts <offer-id>");
  process.exit(1);
}

async function checkOfferRequirements() {
  try {
    console.log(`🔍 Checking offer ${offerId}...\n`);

    const result = await db
      .select({
        id: offers.id,
        title: offers.title,
        minimumFollowers: offers.minimumFollowers,
        allowedPlatforms: offers.allowedPlatforms,
        geographicRestrictions: offers.geographicRestrictions,
        ageRestriction: offers.ageRestriction,
        contentStyleRequirements: offers.contentStyleRequirements,
        brandSafetyRequirements: offers.brandSafetyRequirements,
      })
      .from(offers)
      .where(eq(offers.id, offerId));

    if (result.length === 0) {
      console.error(`❌ Offer ${offerId} not found`);
      process.exit(1);
    }

    const offer = result[0];
    console.log(`✅ Offer found: "${offer.title}"\n`);
    console.log("📋 Creator Requirements Data:");
    console.log("─".repeat(60));
    console.log(`Minimum Followers: ${offer.minimumFollowers || "NULL (not set)"}`);
    console.log(`Allowed Platforms: ${offer.allowedPlatforms?.length ? offer.allowedPlatforms.join(", ") : "NULL (not set)"}`);
    console.log(`Geographic Restrictions: ${offer.geographicRestrictions?.length ? offer.geographicRestrictions.join(", ") : "NULL (not set)"}`);
    console.log(`Age Restriction: ${offer.ageRestriction || "NULL (not set)"}`);
    console.log(`Content Style Requirements: ${offer.contentStyleRequirements ? offer.contentStyleRequirements.substring(0, 50) + "..." : "NULL (not set)"}`);
    console.log(`Brand Safety Requirements: ${offer.brandSafetyRequirements ? offer.brandSafetyRequirements.substring(0, 50) + "..." : "NULL (not set)"}`);
    console.log("─".repeat(60));

    const hasAnyRequirements =
      offer.minimumFollowers ||
      (offer.allowedPlatforms && offer.allowedPlatforms.length > 0) ||
      (offer.geographicRestrictions && offer.geographicRestrictions.length > 0) ||
      offer.ageRestriction ||
      offer.contentStyleRequirements ||
      offer.brandSafetyRequirements;

    if (hasAnyRequirements) {
      console.log("\n✅ This offer HAS creator requirements set");
      console.log("   They should be visible on the offer detail page");
    } else {
      console.log("\n⚠️  This offer has NO creator requirements set");
      console.log("   The page will show 'No specific requirements - All creators welcome'");
      console.log("\n💡 To add requirements, run:");
      console.log(`   npm run update:offer-requirements ${offerId}`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Check failed:", error.message);
    process.exit(1);
  }
}

checkOfferRequirements();
