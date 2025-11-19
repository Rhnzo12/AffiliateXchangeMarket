#!/usr/bin/env tsx
/**
 * Manual Scheduler Test Script
 * Tests the Priority Listing Scheduler (Feature 8) manually
 */

import { db } from '../db/index.js';
import { offers } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';

async function testScheduler() {
  console.log('\n🕐 Testing Priority Listing Scheduler (Feature 8)\n');
  console.log('='.repeat(60));

  try {
    // 1. Find all priority listings
    console.log('\n1️⃣  Checking all priority listings...');
    const priorityOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.isPriorityListing, true));

    console.log(`   Found ${priorityOffers.length} priority listings`);

    if (priorityOffers.length === 0) {
      console.log('\n⚠️  No priority listings found.');
      console.log('   Create a test priority listing in the UI first.');
      return;
    }

    // 2. Check for expired listings
    console.log('\n2️⃣  Checking for expired listings...');
    const now = new Date();
    const expiredOffers = priorityOffers.filter(
      offer => offer.priorityExpiresAt && new Date(offer.priorityExpiresAt) < now
    );

    console.log(`   Found ${expiredOffers.length} expired listings`);

    // 3. Display all priority listings with status
    console.log('\n3️⃣  Priority Listings Status:\n');
    priorityOffers.forEach(offer => {
      const expiresAt = offer.priorityExpiresAt ? new Date(offer.priorityExpiresAt) : null;
      const isExpired = expiresAt && expiresAt < now;
      const daysUntilExpiry = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      console.log(`   📦 ${offer.title}`);
      console.log(`      ID: ${offer.id}`);
      console.log(`      Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
      console.log(`      Expires: ${expiresAt?.toLocaleDateString() || 'N/A'}`);
      if (!isExpired && daysUntilExpiry !== null) {
        console.log(`      Days remaining: ${daysUntilExpiry}`);
        if (daysUntilExpiry <= 7) {
          console.log(`      ⚠️  Reminder email should be sent`);
        }
      }
      console.log();
    });

    // 4. Simulate expiration (for testing)
    console.log('\n4️⃣  Simulate expiration check...');

    if (expiredOffers.length > 0) {
      console.log(`\n   Would expire the following offers:`);
      expiredOffers.forEach(offer => {
        console.log(`   - ${offer.title} (ID: ${offer.id})`);
      });

      console.log('\n   💡 To actually expire these listings, the scheduler will:');
      console.log('      1. Set isPriorityListing = false');
      console.log('      2. Send expiration notification email');
      console.log('      3. Remove PRIORITY badge from browse page');
    } else {
      console.log('   ✅ No listings to expire');
    }

    // 5. Check for reminder candidates (7 days before)
    console.log('\n5️⃣  Checking for reminder email candidates...');
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const reminderCandidates = priorityOffers.filter(offer => {
      if (!offer.priorityExpiresAt) return false;
      const expiresAt = new Date(offer.priorityExpiresAt);
      const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil === 7;
    });

    console.log(`   Found ${reminderCandidates.length} offers expiring in ~7 days`);
    if (reminderCandidates.length > 0) {
      reminderCandidates.forEach(offer => {
        console.log(`   - ${offer.title} (ID: ${offer.id})`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Scheduler test complete!');
    console.log('\n💡 To run the actual scheduler:');
    console.log('   - It runs automatically daily at 2:00 AM');
    console.log('   - Or restart the server to trigger initialization');

  } catch (error) {
    console.error('\n❌ Error testing scheduler:', error);
    throw error;
  }
}

// Run the test
testScheduler()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
