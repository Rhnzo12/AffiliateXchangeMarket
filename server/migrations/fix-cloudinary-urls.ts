/**
 * Migration script to fix normalized Cloudinary URLs in the database
 *
 * This script converts paths like "/objects/w0s0crgydl2ynbbskd9w" back to
 * full Cloudinary URLs like "https://res.cloudinary.com/CLOUD_NAME/image/upload/v123.../w0s0crgydl2ynbbskd9w.jpg"
 *
 * Run with: npx tsx server/migrations/fix-cloudinary-urls.ts
 */

import { db } from "../db";
import { offers, offerVideos, companyProfiles } from "../../shared/schema";
import { eq, like, or } from "drizzle-orm";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dilp6tuin";

// Function to convert normalized path back to Cloudinary URL
function denormalizeCloudinaryPath(normalizedPath: string, resourceType: 'image' | 'video' = 'image'): string {
  if (!normalizedPath || !normalizedPath.startsWith('/objects/')) {
    // Already a full URL or empty
    return normalizedPath;
  }

  // Extract the public ID from the path
  const publicId = normalizedPath.replace('/objects/', '');

  // Reconstruct the Cloudinary URL
  // Note: We assume .jpg extension for images and .mp4 for videos
  const extension = resourceType === 'video' ? 'mp4' : 'jpg';
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  // We can't restore the exact version number, but Cloudinary will redirect to the latest
  return `${baseUrl}/${publicId}.${extension}`;
}

async function fixOfferThumbnails() {
  console.log('\n=== Fixing Offer Featured Images ===');

  // Find all offers with normalized featured image URLs
  const offersWithNormalizedUrls = await db
    .select()
    .from(offers)
    .where(like(offers.featuredImageUrl, '/objects/%'));

  console.log(`Found ${offersWithNormalizedUrls.length} offers with normalized featured image URLs`);

  for (const offer of offersWithNormalizedUrls) {
    if (offer.featuredImageUrl) {
      const denormalizedUrl = denormalizeCloudinaryPath(offer.featuredImageUrl, 'image');
      console.log(`  Offer ${offer.id}:`);
      console.log(`    Old: ${offer.featuredImageUrl}`);
      console.log(`    New: ${denormalizedUrl}`);

      await db
        .update(offers)
        .set({ featuredImageUrl: denormalizedUrl })
        .where(eq(offers.id, offer.id));
    }
  }

  console.log('\u2713 Offer featured images updated');
}

async function fixVideoThumbnails() {
  console.log('\n=== Fixing Video Thumbnails ===');

  // Find all videos with normalized thumbnail URLs
  const videosWithNormalizedThumbnails = await db
    .select()
    .from(offerVideos)
    .where(like(offerVideos.thumbnailUrl, '/objects/%'));

  console.log(`Found ${videosWithNormalizedThumbnails.length} videos with normalized thumbnail URLs`);

  for (const video of videosWithNormalizedThumbnails) {
    if (video.thumbnailUrl) {
      const denormalizedUrl = denormalizeCloudinaryPath(video.thumbnailUrl, 'image');
      console.log(`  Video ${video.id} (${video.title}):`);
      console.log(`    Old: ${video.thumbnailUrl}`);
      console.log(`    New: ${denormalizedUrl}`);

      await db
        .update(offerVideos)
        .set({ thumbnailUrl: denormalizedUrl })
        .where(eq(offerVideos.id, video.id));
    }
  }

  console.log('\u2713 Video thumbnails updated');
}

async function fixVideoUrls() {
  console.log('\n=== Fixing Video URLs ===');

  // Find all videos with normalized video URLs
  const videosWithNormalizedUrls = await db
    .select()
    .from(offerVideos)
    .where(like(offerVideos.videoUrl, '/objects/%'));

  console.log(`Found ${videosWithNormalizedUrls.length} videos with normalized video URLs`);

  for (const video of videosWithNormalizedUrls) {
    if (video.videoUrl) {
      const denormalizedUrl = denormalizeCloudinaryPath(video.videoUrl, 'video');
      console.log(`  Video ${video.id} (${video.title}):`);
      console.log(`    Old: ${video.videoUrl}`);
      console.log(`    New: ${denormalizedUrl}`);

      await db
        .update(offerVideos)
        .set({ videoUrl: denormalizedUrl })
        .where(eq(offerVideos.id, video.id));
    }
  }

  console.log('\u2713 Video URLs updated');
}

async function fixCompanyLogos() {
  console.log('\n=== Fixing Company Logos ===');

  // Find all companies with normalized logo URLs
  const companiesWithNormalizedLogos = await db
    .select()
    .from(companyProfiles)
    .where(like(companyProfiles.logoUrl, '/objects/%'));

  console.log(`Found ${companiesWithNormalizedLogos.length} companies with normalized logo URLs`);

  for (const company of companiesWithNormalizedLogos) {
    if (company.logoUrl) {
      const denormalizedUrl = denormalizeCloudinaryPath(company.logoUrl, 'image');
      console.log(`  Company ${company.id} (${company.legalName || company.tradeName}):`);
      console.log(`    Old: ${company.logoUrl}`);
      console.log(`    New: ${denormalizedUrl}`);

      await db
        .update(companyProfiles)
        .set({ logoUrl: denormalizedUrl })
        .where(eq(companyProfiles.id, company.id));
    }
  }

  console.log('\u2713 Company logos updated');
}

async function main() {
  console.log('Starting Cloudinary URL migration...');
  console.log(`Cloud Name: ${CLOUDINARY_CLOUD_NAME}`);

  try {
    await fixOfferThumbnails();
    await fixVideoThumbnails();
    await fixVideoUrls();
    await fixCompanyLogos();

    console.log('\n\u2713 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

main();
