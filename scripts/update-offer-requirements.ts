#!/usr/bin/env tsx
/**
 * Script to update an existing offer with creator requirements
 * Usage: tsx scripts/update-offer-requirements.ts <offer-id>
 */

import { db } from "../server/db";
import { offers } from "../shared/schema";
import { eq } from "drizzle-orm";

const offerId = process.argv[2];

if (!offerId) {
  console.error("❌ Please provide an offer ID");
  console.error("Usage: tsx scripts/update-offer-requirements.ts <offer-id>");
  process.exit(1);
}

async function updateOfferRequirements() {
  try {
    console.log(`🔄 Updating offer ${offerId} with creator requirements...\n`);

    // Example requirements - modify these as needed
    const requirements = {
      minimumFollowers: 5000,
      allowedPlatforms: ["YouTube", "TikTok", "Instagram"],
      geographicRestrictions: ["United States", "Canada", "United Kingdom"],
      ageRestriction: "18+",
      contentStyleRequirements: "We're looking for authentic product reviews and tutorials that showcase real-world use cases. Content should be engaging, informative, and maintain a professional yet approachable tone.",
      brandSafetyRequirements: "Family-friendly content only. No profanity, controversial topics, or content that conflicts with our brand values. All promotional content must be clearly disclosed as sponsored.",
    };

    const result = await db
      .update(offers)
      .set(requirements)
      .where(eq(offers.id, offerId))
      .returning();

    if (result.length === 0) {
      console.error(`❌ Offer ${offerId} not found`);
      process.exit(1);
    }

    console.log("✅ Offer updated successfully!\n");
    console.log("Updated requirements:");
    console.log(`   - Minimum Followers: ${requirements.minimumFollowers}`);
    console.log(`   - Allowed Platforms: ${requirements.allowedPlatforms.join(", ")}`);
    console.log(`   - Geographic Restrictions: ${requirements.geographicRestrictions.join(", ")}`);
    console.log(`   - Age Restriction: ${requirements.ageRestriction}`);
    console.log(`   - Content Style: ${requirements.contentStyleRequirements}`);
    console.log(`   - Brand Safety: ${requirements.brandSafetyRequirements}`);

    console.log("\n✨ View the offer at: /offers/" + offerId);

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Update failed:", error.message);
    process.exit(1);
  }
}

updateOfferRequirements();
