import { db } from "../server/db";
import { applications } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Migration script to fix tracking codes for existing approved applications
 * Run with: npm run fix:tracking
 */

async function fixTrackingCodes() {
  console.log('🔧 Starting tracking code migration...\n');

  try {
    // Get all approved applications
    const allApprovedApplications = await db
      .select()
      .from(applications)
      .where(eq(applications.status, 'approved'));

    console.log(`📊 Found ${allApprovedApplications.length} approved applications\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const application of allApprovedApplications) {
      try {
        // Check if tracking code needs updating (missing, null, or old format)
        const needsUpdate =
          !application.trackingCode ||
          !application.trackingLink ||
          // Old format check: CR-XXXXXXXX-YYYYYYYY (only 2 parts after CR-)
          (application.trackingCode && application.trackingCode.split('-').length < 4);

        if (needsUpdate) {
          const oldCode = application.trackingCode || '(missing)';

          // Generate new unique tracking code
          const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${application.id.substring(0, 8)}`;
          const port = process.env.PORT || 3000;
          const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
          const trackingLink = `${baseURL}/go/${trackingCode}`;

          // Update the application
          await db
            .update(applications)
            .set({
              trackingCode,
              trackingLink,
              updatedAt: new Date(),
            })
            .where(eq(applications.id, application.id));

          console.log(`\u2705 Fixed application ${application.id.substring(0, 8)}`);
          console.log(`   Old: ${oldCode}`);
          console.log(`   New: ${trackingCode}\n`);

          fixed++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`\u274C Error fixing application ${application.id}:`, error);
        errors++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   \u2705 Fixed: ${fixed}`);
    console.log(`   ⏭️  Skipped (already correct): ${skipped}`);
    console.log(`   \u274C Errors: ${errors}`);
    console.log(`   📊 Total: ${allApprovedApplications.length}`);

    if (fixed > 0) {
      console.log('\n\u2728 Migration complete! All tracking codes have been updated.');
      console.log('   Users can now use their new tracking links.');
    } else {
      console.log('\n\u2728 No updates needed - all tracking codes are already correct!');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n\u274C Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixTrackingCodes();
