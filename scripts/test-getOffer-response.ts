#!/usr/bin/env tsx
/**
 * Script to test what getOffer actually returns (simulating the API endpoint)
 * Usage: tsx scripts/test-getOffer-response.ts <offer-id>
 */

import { storage } from "../server/storage";

const offerId = process.argv[2];

if (!offerId) {
  console.error("❌ Please provide an offer ID");
  console.error("Usage: tsx scripts/test-getOffer-response.ts <offer-id>");
  process.exit(1);
}

async function testGetOfferResponse() {
  try {
    console.log(`🔍 Testing getOffer() response for offer ${offerId}...\n`);

    const offer = await storage.getOffer(offerId);

    if (!offer) {
      console.error(`❌ Offer ${offerId} not found`);
      process.exit(1);
    }

    console.log(`✅ Offer found: "${offer.title}"\n`);

    console.log("📋 Checking Creator Requirements Fields in API Response:");
    console.log("─".repeat(70));

    // Check camelCase (what frontend expects)
    console.log("\n🔤 CamelCase fields (what frontend uses):");
    console.log(`offer.minimumFollowers:           ${JSON.stringify((offer as any).minimumFollowers)}`);
    console.log(`offer.allowedPlatforms:           ${JSON.stringify((offer as any).allowedPlatforms)}`);
    console.log(`offer.geographicRestrictions:     ${JSON.stringify((offer as any).geographicRestrictions)}`);
    console.log(`offer.ageRestriction:             ${JSON.stringify((offer as any).ageRestriction)}`);
    console.log(`offer.contentStyleRequirements:   ${JSON.stringify((offer as any).contentStyleRequirements)?.substring(0, 40)}`);
    console.log(`offer.brandSafetyRequirements:    ${JSON.stringify((offer as any).brandSafetyRequirements)?.substring(0, 40)}`);

    // Check snake_case (database format)
    console.log("\n🐍 Snake_case fields (database format):");
    console.log(`offer.minimum_followers:          ${JSON.stringify((offer as any).minimum_followers)}`);
    console.log(`offer.allowed_platforms:          ${JSON.stringify((offer as any).allowed_platforms)}`);
    console.log(`offer.geographic_restrictions:    ${JSON.stringify((offer as any).geographic_restrictions)}`);
    console.log(`offer.age_restriction:            ${JSON.stringify((offer as any).age_restriction)}`);
    console.log(`offer.content_style_requirements: ${JSON.stringify((offer as any).content_style_requirements)?.substring(0, 40)}`);
    console.log(`offer.brand_safety_requirements:  ${JSON.stringify((offer as any).brand_safety_requirements)?.substring(0, 40)}`);

    console.log("\n─".repeat(70));

    // Determine the issue
    const hasCamelCase = (offer as any).minimumFollowers !== undefined;
    const hasSnakeCase = (offer as any).minimum_followers !== undefined;

    console.log("\n📊 Analysis:");
    if (hasCamelCase) {
      console.log("✅ API returns camelCase fields (CORRECT)");
      console.log("   Frontend should be able to read: offer.minimumFollowers, etc.");
      console.log("\n🔧 If still not showing on frontend:");
      console.log("   1. Open browser DevTools (F12)");
      console.log("   2. Go to Network tab");
      console.log("   3. Refresh the offer page");
      console.log("   4. Find the request to /api/offers/" + offerId);
      console.log("   5. Check the Response tab - do you see minimumFollowers?");
      console.log("\n   If YES → Frontend code issue (check React component)");
      console.log("   If NO → Server not returning the data (cache/restart issue)");
    } else if (hasSnakeCase) {
      console.log("❌ API returns snake_case fields (WRONG)");
      console.log("   Frontend expects camelCase but API is returning snake_case");
      console.log("\n🔧 FIX: This is a Drizzle ORM configuration issue");
      console.log("   The schema should convert snake_case to camelCase automatically");
    } else {
      console.log("❌ API returns NEITHER format");
      console.log("   Data is completely missing from the response");
      console.log("\n🔧 FIX: Check if getOffer is selecting all columns");
    }

    console.log("\n✨ Full offer object keys:");
    console.log(Object.keys(offer).filter(k => k.includes('estrict') || k.includes('ollower') || k.includes('latform') || k.includes('equirement')).join(', '));

    console.log("\n✨ Test complete!\n");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

testGetOfferResponse();
