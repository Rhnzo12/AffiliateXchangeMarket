#!/usr/bin/env tsx
/**
 * Payment Data Seeding Script
 *
 * This script populates the database with sample payment data to demonstrate
 * the payment management system with real calculated fees.
 *
 * What this script does:
 * 1. Creates sample users (creators, companies, admin) if they don't exist
 * 2. Creates sample company profiles
 * 3. Creates sample offers with different commission types
 * 4. Creates approved applications linking creators to offers
 * 5. Simulates conversions to generate payment records
 * 6. Creates payments with correct fee calculations (4% + 3% = 7%)
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db.js";
import {
  users,
  companyProfiles,
  offers,
  applications,
  payments,
  analytics,
} from "../shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

interface SeedData {
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: "creator" | "company" | "admin";
  }>;
  companies: Array<{
    id: string;
    userId: string;
    companyName: string;
  }>;
  offers: Array<{
    id: string;
    companyId: string;
    title: string;
    commissionType: string;
    commissionAmount?: string;
    commissionPercentage?: string;
  }>;
  applications: Array<{
    id: string;
    creatorId: string;
    offerId: string;
  }>;
  payments: Array<{
    applicationId: string;
    creatorId: string;
    companyId: string;
    offerId: string;
    grossAmount: number;
    status: string;
    description: string;
  }>;
}

function generateId(): string {
  return randomUUID();
}

function calculateFees(grossAmount: number) {
  const platformFee = grossAmount * 0.04; // 4%
  const stripeFee = grossAmount * 0.03;   // 3%
  const netAmount = grossAmount - platformFee - stripeFee; // 93%

  return {
    platformFeeAmount: platformFee.toFixed(2),
    stripeFeeAmount: stripeFee.toFixed(2),
    netAmount: netAmount.toFixed(2),
  };
}

async function seedData() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║         Payment Data Seeding Script                 ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  try {
    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("⚠️  Database already contains data.");
      console.log("This script will add additional sample payment data.\n");
    }

    const hashedPassword = await bcrypt.hash("password123", 10);

    // Prepare seed data
    const seedData: SeedData = {
      users: [
        {
          id: generateId(),
          username: "john_creator",
          email: "john@creator.com",
          role: "creator" as const,
        },
        {
          id: generateId(),
          username: "sarah_influencer",
          email: "sarah@influencer.com",
          role: "creator" as const,
        },
        {
          id: generateId(),
          username: "techcorp",
          email: "contact@techcorp.com",
          role: "company" as const,
        },
        {
          id: generateId(),
          username: "brandco",
          email: "partnerships@brandco.com",
          role: "company" as const,
        },
        {
          id: generateId(),
          username: "admin",
          email: "admin@platform.com",
          role: "admin" as const,
        },
      ],
      companies: [],
      offers: [],
      applications: [],
      payments: [],
    };

    // Step 1: Create Users
    console.log("📝 Step 1: Creating sample users...");
    for (const userData of seedData.users) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(users).values({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✓ Created ${userData.role}: ${userData.username}`);
      } else {
        console.log(`   ⊕ ${userData.username} already exists, using existing user`);
        seedData.users = seedData.users.map((u) =>
          u.email === userData.email ? { ...u, id: existing[0].id } : u
        );
      }
    }

    // Step 2: Create Company Profiles
    console.log("\n📝 Step 2: Creating company profiles...");
    const companyUsers = seedData.users.filter((u) => u.role === "company");

    for (const companyUser of companyUsers) {
      const companyId = generateId();

      const existing = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.userId, companyUser.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(companyProfiles).values({
          id: companyId,
          userId: companyUser.id,
          companyName:
            companyUser.username === "techcorp" ? "TechCorp Inc." : "BrandCo Ltd.",
          description: `Sample company profile for ${companyUser.username}`,
          website: `https://${companyUser.username}.com`,
          industry: "Technology",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        seedData.companies.push({
          id: companyId,
          userId: companyUser.id,
          companyName:
            companyUser.username === "techcorp" ? "TechCorp Inc." : "BrandCo Ltd.",
        });

        console.log(`   ✓ Created company profile: ${companyUser.username}`);
      } else {
        seedData.companies.push({
          id: existing[0].id,
          userId: existing[0].userId,
          companyName: existing[0].companyName,
        });
        console.log(`   ⊕ ${companyUser.username} profile exists, using existing`);
      }
    }

    // Step 3: Create Offers
    console.log("\n📝 Step 3: Creating sample offers...");
    const offerTemplates = [
      {
        title: "Premium SaaS Affiliate Program",
        commissionType: "per_sale",
        commissionPercentage: "15",
        description: "Earn 15% on every sale you generate",
      },
      {
        title: "Lead Generation Campaign",
        commissionType: "per_lead",
        commissionAmount: "50",
        description: "Get $50 for each qualified lead",
      },
      {
        title: "Click-Through Program",
        commissionType: "per_click",
        commissionAmount: "2.5",
        description: "Earn $2.50 per click on your affiliate link",
      },
      {
        title: "E-commerce Partnership",
        commissionType: "per_sale",
        commissionPercentage: "10",
        description: "10% commission on all product sales",
      },
    ];

    for (let i = 0; i < offerTemplates.length; i++) {
      const template = offerTemplates[i];
      const company = seedData.companies[i % seedData.companies.length];
      const offerId = generateId();

      await db.insert(offers).values({
        id: offerId,
        companyId: company.id,
        title: template.title,
        description: template.description,
        commissionType: template.commissionType as any,
        commissionAmount: template.commissionAmount || null,
        commissionPercentage: template.commissionPercentage || null,
        status: "open",
        niche: "Technology",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      seedData.offers.push({
        id: offerId,
        companyId: company.id,
        title: template.title,
        commissionType: template.commissionType,
        commissionAmount: template.commissionAmount,
        commissionPercentage: template.commissionPercentage,
      });

      console.log(`   ✓ Created offer: ${template.title}`);
    }

    // Step 4: Create Applications (approved)
    console.log("\n📝 Step 4: Creating approved applications...");
    const creatorUsers = seedData.users.filter((u) => u.role === "creator");

    for (const creator of creatorUsers) {
      for (const offer of seedData.offers) {
        const applicationId = generateId();

        await db.insert(applications).values({
          id: applicationId,
          creatorId: creator.id,
          offerId: offer.id,
          status: "approved",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        seedData.applications.push({
          id: applicationId,
          creatorId: creator.id,
          offerId: offer.id,
        });

        console.log(`   ✓ Application: ${creator.username} → ${offer.title.substring(0, 30)}...`);
      }
    }

    // Step 5: Create Payments with Real Calculations
    console.log("\n📝 Step 5: Creating payments with calculated fees...");

    const paymentScenarios = [
      { gross: 1000, status: "completed", desc: "Large sale commission" },
      { gross: 500, status: "completed", desc: "Medium sale commission" },
      { gross: 250, status: "pending", desc: "Recent conversion" },
      { gross: 150, status: "processing", desc: "Processing payment" },
      { gross: 750, status: "completed", desc: "Monthly commission" },
      { gross: 50, status: "pending", desc: "Lead generation payment" },
      { gross: 2.5, status: "completed", desc: "Per-click commission" },
      { gross: 300, status: "pending", desc: "Affiliate sale" },
    ];

    for (let i = 0; i < Math.min(paymentScenarios.length, seedData.applications.length); i++) {
      const scenario = paymentScenarios[i];
      const application = seedData.applications[i];
      const offer = seedData.offers.find((o) => o.id === application.offerId)!;
      const company = seedData.companies.find((c) => c.id === offer.companyId)!;

      const fees = calculateFees(scenario.gross);

      await db.insert(payments).values({
        id: generateId(),
        applicationId: application.id,
        creatorId: application.creatorId,
        companyId: company.id,
        offerId: offer.id,
        grossAmount: scenario.gross.toFixed(2),
        platformFeeAmount: fees.platformFeeAmount,
        stripeFeeAmount: fees.stripeFeeAmount,
        netAmount: fees.netAmount,
        status: scenario.status as any,
        description: scenario.desc,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
        updatedAt: new Date(),
      });

      console.log(`   ✓ Payment: $${scenario.gross} (Platform: $${fees.platformFeeAmount}, Stripe: $${fees.stripeFeeAmount}, Net: $${fees.netAmount}) - ${scenario.status}`);
    }

    // Step 6: Create Analytics Records
    console.log("\n📝 Step 6: Creating analytics records...");
    for (const application of seedData.applications) {
      const randomEarnings = Math.floor(Math.random() * 500) + 100;

      await db.insert(analytics).values({
        id: generateId(),
        applicationId: application.id,
        offerId: application.offerId,
        creatorId: application.creatorId,
        date: new Date(),
        clicks: Math.floor(Math.random() * 1000) + 100,
        uniqueClicks: Math.floor(Math.random() * 500) + 50,
        conversions: Math.floor(Math.random() * 10) + 1,
        earnings: randomEarnings.toFixed(2),
        earningsPaid: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log("   ✓ Analytics data created");

    // Summary
    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║              Seeding Complete! ✅                     ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    console.log("📊 Summary:");
    console.log(`   Users created: ${seedData.users.length}`);
    console.log(`   Company profiles: ${seedData.companies.length}`);
    console.log(`   Offers created: ${seedData.offers.length}`);
    console.log(`   Applications: ${seedData.applications.length}`);
    console.log(`   Payments with fees: ${paymentScenarios.length}`);

    console.log("\n🔑 Test Credentials:");
    console.log("   Username: john_creator | Password: password123");
    console.log("   Username: sarah_influencer | Password: password123");
    console.log("   Username: techcorp | Password: password123");
    console.log("   Username: brandco | Password: password123");
    console.log("   Username: admin | Password: password123");

    console.log("\n📈 Payment Fee Verification:");
    console.log("   All payments use the correct fee structure:");
    console.log("   - Platform Fee: 4% of gross");
    console.log("   - Stripe Fee: 3% of gross");
    console.log("   - Net to Creator: 93% of gross");

    console.log("\n🎯 Next Steps:");
    console.log("   1. Start the development server: npm run dev");
    console.log("   2. Login with any test account above");
    console.log("   3. Navigate to /payment-settings");
    console.log("   4. View payment data with real fee calculations");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Error during seeding:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedData();
