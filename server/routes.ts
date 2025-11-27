import type { Express, Request as ExpressRequest } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { parse as parseCookie } from "cookie";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { db } from "./db";
import { offerVideos, applications, analytics, offers, companyProfiles, payments, conversations, messages, bannedKeywords, contentFlags } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { checkClickFraud, logFraudDetection } from "./fraudDetection";
import { calculateFees, formatFeePercentage, DEFAULT_PLATFORM_FEE_PERCENTAGE, STRIPE_PROCESSING_FEE_PERCENTAGE, getCompanyPlatformFeePercentage } from "./feeCalculator";
import { NotificationService } from "./notifications/notificationService";
import bcrypt from "bcrypt";
import { PriorityListingScheduler } from "./priorityListingScheduler";
import * as QRCode from "qrcode";
// @ts-ignore - multer may not have types in all environments
import multer from "multer";

// Define multer file interface for type safety
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Extend Express Request type to include multer's file property
type Request = ExpressRequest;
import {
  insertCreatorProfileSchema,
  insertCompanyProfileSchema,
  insertOfferSchema,
  createOfferSchema,
  insertOfferVideoSchema,
  insertApplicationSchema,
  insertMessageSchema,
  insertReviewSchema,
  insertFavoriteSchema,
  insertPaymentSettingSchema,
  adminReviewUpdateSchema,
  adminNoteSchema,
  adminResponseSchema,
  createRetainerContractSchema,
  insertRetainerApplicationSchema,
  insertRetainerDeliverableSchema,
  insertBannedKeywordSchema,
  insertContentFlagSchema,
} from "../shared/schema";
import {
  checkContent,
  flagContent,
  moderateReview,
  moderateMessage,
  reviewFlaggedContent,
  getPendingFlags,
  getFlagStatistics,
} from "./moderation/moderationService";
import {
  getPlatformHealthReport,
  getRecentApiMetrics,
  getApiMetricsTimeSeries,
  getStorageMetricsTimeSeries,
  getVideoCostsTimeSeries,
  getRecentErrorLogs,
  getLatestHealthSnapshot,
  calculateStorageUsage,
  calculateVideoHostingCosts,
  createHealthSnapshot,
  recordDailyStorageMetrics,
  recordDailyVideoCosts,
  flushMetrics,
} from "./platformHealthService";

// Alias for convenience
const requireAuth = isAuthenticated;

// Middleware to ensure user has specific role
function requireRole(...roles: string[]) {
  return (req: Request, res: any, next: any) => {
    if (!req.user || !roles.includes((req.user as any).role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Local Auth
  await setupAuth(app);

  // Initialize notification service
  const notificationService = new NotificationService(storage);

  // Initialize priority listing scheduler
  const priorityListingScheduler = new PriorityListingScheduler(notificationService);

  // Run priority listing checks daily at 2 AM
  // In production, use a proper cron scheduler like node-cron
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      try {
        await priorityListingScheduler.runScheduledTasks();
      } catch (error) {
        console.error('[Priority Listing Scheduler] Error running scheduled tasks:', error);
      }
    }
  }, 60000); // Check every minute

  // Email change verification endpoint - validates password and checks email availability
  app.post("/api/auth/verify-email-change", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;
      const { password, newEmail } = req.body;

      if (!newEmail) {
        return res.status(400).json({ error: "New email is required" });
      }

      const normalizedCurrentEmail = (user.email || "").toLowerCase();
      if (newEmail.toLowerCase() === normalizedCurrentEmail) {
        return res.status(400).json({ error: "New email must be different from current email" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existingUser = await storage.getUserByEmail(newEmail);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Email is already registered to another account" });
      }

      if (user.googleId && !user.password) {
        return res.json({
          success: true,
          message: "Email change verified for OAuth account",
          canChange: true,
        });
      }

      if (!password) {
        return res.status(400).json({ error: "Password is required for email change" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || !currentUser.password) {
        return res.status(400).json({ error: "Account authentication error" });
      }

      const isValidPassword = await bcrypt.compare(password, currentUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      res.json({
        success: true,
        message: "Password verified successfully",
        canChange: true,
      });
    } catch (error: any) {
      console.error("Email change verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify email change" });
    }
  });

  // Update email endpoint - changes the email after verification
  app.put("/api/auth/email", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;
      const { newEmail, password } = req.body;

      if (!newEmail) {
        return res.status(400).json({ error: "New email is required" });
      }

      const normalizedCurrentEmail = (user.email || "").toLowerCase();
      if (newEmail.toLowerCase() === normalizedCurrentEmail) {
        return res.status(400).json({ error: "New email must be different from current email" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existingUser = await storage.getUserByEmail(newEmail);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Email is already registered to another account" });
      }

      const sendEmailChangeNotifications = async (oldEmail: string | null | undefined) => {
        if (!oldEmail) {
          return;
        }

        try {
          await notificationService.sendEmailNotification(
            oldEmail,
            "system_announcement",
            {
              userName: user.firstName || user.username,
              announcementTitle: "Email Address Changed",
              announcementMessage: `Your account email has been changed from ${oldEmail} to ${newEmail}. If you did not make this change, please contact support immediately.`,
            }
          );

          await notificationService.sendEmailNotification(
            newEmail,
            "system_announcement",
            {
              userName: user.firstName || user.username,
              announcementTitle: "Welcome to Your New Email",
              announcementMessage: `Your account email has been successfully updated to ${newEmail}. Please verify your new email address.`,
            }
          );
        } catch (emailError) {
          console.error("Failed to send email change notification:", emailError);
        }
      };

      if (user.googleId && !user.password) {
        const oldEmail = user.email;
        await storage.updateUser(userId, {
          email: newEmail,
          emailVerified: false,
        });

        await sendEmailChangeNotifications(oldEmail);

        if (req.user) {
          (req.user as any).email = newEmail;
          (req.user as any).emailVerified = false;
        }

        return res.json({
          success: true,
          message: "Email updated successfully",
          requiresVerification: true,
        });
      }

      if (!password) {
        return res.status(400).json({ error: "Password is required for email change" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || !currentUser.password) {
        return res.status(400).json({ error: "Account authentication error" });
      }

      const isValidPassword = await bcrypt.compare(password, currentUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      const oldEmail = currentUser.email || user.email;
      await storage.updateUser(userId, {
        email: newEmail,
        emailVerified: false,
      });

      await sendEmailChangeNotifications(oldEmail);

      if (req.user) {
        (req.user as any).email = newEmail;
        (req.user as any).emailVerified = false;
      }

      res.json({
        success: true,
        message: "Email updated successfully. Please verify your new email address.",
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error("Email update error:", error);
      res.status(500).json({ error: error.message || "Failed to update email" });
    }
  });

  // Profile routes
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;

      if (user.role === 'creator') {
        const profile = await storage.getCreatorProfile(userId);
        if (!profile) {
          // Create default profile if doesn't exist
          const newProfile = await storage.createCreatorProfile({ userId });
          return res.json(newProfile);
        }
        return res.json(profile);
      } else if (user.role === 'company') {
        const profile = await storage.getCompanyProfile(userId);
        return res.json(profile);
      }

      res.json(null);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;

      console.log("[Profile Update] User role:", user.role);
      console.log("[Profile Update] Request body:", req.body);

      // Extract profileImageUrl if provided (for user table update)
      const { profileImageUrl, ...profileData } = req.body;

      // Update user's profile image if provided
      if (profileImageUrl !== undefined) {
        await storage.updateUser(userId, { profileImageUrl });
      }

      if (user.role === 'creator') {
        const validated = insertCreatorProfileSchema.partial().parse(profileData);
        console.log("[Profile Update] Validated data:", validated);

        const profile = await storage.updateCreatorProfile(userId, validated);
        console.log("[Profile Update] Updated profile:", profile);
        return res.json(profile);
      } else if (user.role === 'company') {
        const validated = insertCompanyProfileSchema.partial().parse(profileData);
        const profile = await storage.updateCompanyProfile(userId, validated);
        return res.json(profile);
      }

      res.status(400).send("Invalid role");
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company onboarding
  app.post("/api/company/onboarding", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const {
        legalName,
        tradeName,
        industry,
        websiteUrl,
        companySize,
        yearFounded,
        logoUrl,
        description,
        contactName,
        contactJobTitle,
        phoneNumber,
        businessAddress,
        verificationDocumentUrl,
        linkedinUrl,
        twitterUrl,
        facebookUrl,
        instagramUrl,
      } = req.body;

      // Validate required fields
      if (!legalName || !websiteUrl || !logoUrl || !description) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!contactName || !phoneNumber || !businessAddress) {
        return res.status(400).json({ error: "Missing required contact information" });
      }

      if (!verificationDocumentUrl) {
        return res.status(400).json({ error: "Verification document is required" });
      }

      // Update company profile with all onboarding data
      const profile = await storage.updateCompanyProfile(userId, {
        legalName,
        tradeName,
        industry,
        websiteUrl,
        companySize,
        yearFounded,
        logoUrl,
        description,
        contactName,
        contactJobTitle,
        phoneNumber,
        businessAddress,
        verificationDocumentUrl,
        linkedinUrl,
        twitterUrl,
        facebookUrl,
        instagramUrl,
        status: 'pending', // Keep as pending for admin approval
      });

      return res.json({ success: true, profile });
    } catch (error: any) {
      console.error("Company onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to complete onboarding" });
    }
  });

  // Get company profile by ID (public/authenticated)
  app.get("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const company = await storage.getCompanyProfile(id);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get associated user info
      const user = await storage.getUserById(company.userId);

      // Return company profile with limited user info
      return res.json({
        ...company,
        user: user ? {
          id: user.id,
          email: user.email,
          username: user.username,
        } : null,
      });
    } catch (error: any) {
      console.error("Get company profile error:", error);
      res.status(500).json({ error: error.message || "Failed to get company profile" });
    }
  });

  // ===== Company Fee Info Route =====

  // Get fee info for the logged-in company
  app.get("/api/company/fee", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const { percentage: platformFeePercentage, isCustom } = await getCompanyPlatformFeePercentage(companyProfile.id);
      const totalFeePercentage = platformFeePercentage + STRIPE_PROCESSING_FEE_PERCENTAGE;
      const creatorPayoutPercentage = 1 - totalFeePercentage;

      return res.json({
        platformFeePercentage,
        platformFeeDisplay: formatFeePercentage(platformFeePercentage),
        processingFeePercentage: STRIPE_PROCESSING_FEE_PERCENTAGE,
        processingFeeDisplay: formatFeePercentage(STRIPE_PROCESSING_FEE_PERCENTAGE),
        totalFeePercentage,
        totalFeeDisplay: formatFeePercentage(totalFeePercentage),
        creatorPayoutPercentage,
        creatorPayoutDisplay: formatFeePercentage(creatorPayoutPercentage),
        isCustomFee: isCustom,
        defaultPlatformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        defaultPlatformFeeDisplay: formatFeePercentage(DEFAULT_PLATFORM_FEE_PERCENTAGE),
      });
    } catch (error: any) {
      console.error("Get company fee info error:", error);
      res.status(500).json({ error: error.message || "Failed to get company fee info" });
    }
  });

  // ===== Company Verification Documents Routes =====

  // Get verification documents for the logged-in company user
  app.get("/api/company/verification-documents", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const documents = await storage.getVerificationDocumentsByUserId(userId);
      return res.json(documents);
    } catch (error: any) {
      console.error("Get verification documents error:", error);
      res.status(500).json({ error: error.message || "Failed to get verification documents" });
    }
  });

  // Add a new verification document
  app.post("/api/company/verification-documents", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { documentUrl, documentName, documentType, fileSize } = req.body;

      if (!documentUrl || !documentName || !documentType) {
        return res.status(400).json({ error: "Missing required fields: documentUrl, documentName, documentType" });
      }

      // Get company profile for this user
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const document = await storage.addVerificationDocument({
        companyId: companyProfile.id,
        documentUrl,
        documentName,
        documentType,
        fileSize: fileSize || null,
      });

      return res.json({ success: true, document });
    } catch (error: any) {
      console.error("Add verification document error:", error);
      res.status(500).json({ error: error.message || "Failed to add verification document" });
    }
  });

  // Delete a verification document
  app.delete("/api/company/verification-documents/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const documentId = req.params.id;

      // Get the document and verify ownership
      const document = await storage.getVerificationDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get company profile and verify the document belongs to this company
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || document.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Not authorized to delete this document" });
      }

      // Delete from cloud storage first
      if (document.documentUrl) {
        try {
          const objectStorageService = new ObjectStorageService();
          // Extract file path from GCS URL
          // URL format: https://storage.googleapis.com/bucket-name/path/to/file
          const url = new URL(document.documentUrl);
          const pathParts = url.pathname.split('/');
          // Remove empty string and bucket name, keep the rest as file path
          const filePath = pathParts.slice(2).join('/');

          if (filePath) {
            await objectStorageService.deleteResource(filePath, 'raw');
            console.log('[Verification Documents] Deleted file from GCS:', filePath);
          }
        } catch (storageError) {
          console.error('[Verification Documents] Error deleting from cloud storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      const deleted = await storage.deleteVerificationDocument(documentId);
      if (deleted) {
        return res.json({ success: true });
      } else {
        return res.status(500).json({ error: "Failed to delete document" });
      }
    } catch (error: any) {
      console.error("Delete verification document error:", error);
      res.status(500).json({ error: error.message || "Failed to delete verification document" });
    }
  });

  // Admin: Get verification documents for a specific company
  app.get("/api/admin/companies/:id/verification-documents", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const documents = await storage.getVerificationDocumentsByCompanyId(companyId);
      return res.json(documents);
    } catch (error: any) {
      console.error("Admin get verification documents error:", error);
      res.status(500).json({ error: error.message || "Failed to get verification documents" });
    }
  });

  // Creator stats
  app.get("/api/creator/stats", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getApplicationsByCreator(userId);
      const analyticsData = await storage.getAnalyticsByCreator(userId);
      const unreadMessages = await storage.getUnreadMessageCountForCreator(userId);

      const formatCurrency = (value: number) => Number(value || 0).toFixed(2);

      const stats = {
        totalEarnings: formatCurrency(analyticsData?.totalEarnings || 0),
        monthlyEarnings: formatCurrency(analyticsData?.monthlyEarnings || 0),
        activeOffers: applications.filter(a => a.status === 'active' || a.status === 'approved').length,
        pendingApplications: applications.filter(a => a.status === 'pending').length,
        totalClicks: analyticsData?.totalClicks || 0,
        monthlyClicks: analyticsData?.monthlyClicks || 0,
        unreadMessages,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Offers routes
  app.get("/api/offers", requireAuth, async (req, res) => {
    try {
      const offers = await storage.getOffers(req.query);
      res.json(offers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/offers/trending", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offers = await storage.getTrendingOffers(limit);
      res.json(offers);
    } catch (error: any) {
      console.error('[Trending Offers] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/offers/recommended", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;

      // Get creator profile with niches
      const creatorProfile = await storage.getCreatorProfile(userId);
      if (!creatorProfile) {
        console.log('[Recommendations] Profile not found for user:', userId);
        return res.status(404).json({
          error: 'profile_not_found',
          message: 'Creator profile not found. Please complete your profile first.'
        });
      }

  const creatorNiches = (creatorProfile.niches || []).map((n: string) => (n || '').toString().trim()).filter(Boolean);
  console.log('[Recommendations] User niches:', creatorNiches);

      // Check if user has set any niches
      if (creatorNiches.length === 0) {
        console.log('[Recommendations] No niches set for user:', userId);
        return res.status(200).json({
          error: 'no_niches',
          message: 'Please set your content niches in your profile to get personalized recommendations.'
        });
      }

      // Normalize niches for case-insensitive comparison
      const creatorNichesNorm = creatorNiches.map((n: string) => n.toLowerCase());

      // Get all approved offers
      const allOffers = await storage.getOffers({ status: 'approved' });
      console.log('[Recommendations] Total approved offers:', allOffers.length);
      console.log('[Recommendations] Sample offer niches:', allOffers.slice(0, 3).map(o => ({
        id: o.id,
        title: o.title,
        primaryNiche: o.primaryNiche,
        additionalNiches: o.additionalNiches
      })));

      // Get creator's past applications
      const pastApplications = await db
        .select({
          offerId: applications.offerId,
          status: applications.status,
        })
        .from(applications)
        .where(eq(applications.creatorId, userId));

      const appliedOfferIds = new Set(pastApplications.map(app => app.offerId));

      // Get creator's performance by niche
      const performanceByNiche: Record<string, number> = {};

      if (pastApplications.length > 0) {
        const approvedAppIds = pastApplications
          .filter(app => app.status === 'approved' || app.status === 'active')
          .map(app => app.offerId);

        if (approvedAppIds.length > 0) {
          // Get analytics for approved applications
          const performanceData = await db
            .select({
              offerId: analytics.offerId,
              totalConversions: sql<number>`SUM(${analytics.conversions})`,
              totalClicks: sql<number>`SUM(${analytics.clicks})`,
            })
            .from(analytics)
            .where(eq(analytics.creatorId, userId))
            .groupBy(analytics.offerId);

          // Map performance to niches
          for (const perf of performanceData) {
            const offer = allOffers.find(o => o.id === perf.offerId);
            if (offer) {
              const conversionRate = perf.totalClicks > 0
                ? (Number(perf.totalConversions) / Number(perf.totalClicks)) * 100
                : 0;

              // Track performance for primary niche (normalized key)
              if (offer.primaryNiche) {
                const key = (offer.primaryNiche || '').toString().toLowerCase();
                performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
              }

              // Track performance for additional niches (normalized keys)
              if (offer.additionalNiches) {
                for (const niche of offer.additionalNiches) {
                  const key = (niche || '').toString().toLowerCase();
                  performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
                }
              }
            }
          }
        }
      }

      // Score each offer - ONLY include offers with at least one matching niche
      const scoredOffers = allOffers
        .filter(offer => !appliedOfferIds.has(offer.id))
        .map(offer => {
          let score = 0;

          // 1. Niche matching (0-100 points)
          // Build raw and normalized niche lists for the offer
          const offerNichesRaw = [offer.primaryNiche, ...(offer.additionalNiches || [])].filter(Boolean);
          const offerNichesNorm = offerNichesRaw.map((n: string) => n.toString().toLowerCase());

          // Determine matching niches by normalized intersection
          const matchingNiches = offerNichesRaw.filter((n: string, idx: number) => creatorNichesNorm.includes(offerNichesNorm[idx]));

          // IMPORTANT: If no niche match, mark this offer as invalid
          if (matchingNiches.length === 0) {
            return null; // Will be filtered out later
          }

          // Primary niche match = 50 points, additional niche match = 25 points each
          if (offer.primaryNiche && creatorNichesNorm.includes((offer.primaryNiche || '').toString().toLowerCase())) {
            score += 50;
          }

          const additionalMatches = matchingNiches.filter(niche => niche !== offer.primaryNiche).length;
          score += additionalMatches * 25;

          // Cap niche score at 100
          const nicheScore = Math.min(score, 100);

          // 2. Performance in similar niches (0-50 points)
          let performanceScore = 0;
          for (const nicheNorm of offerNichesNorm) {
            if (performanceByNiche[nicheNorm]) {
              performanceScore += performanceByNiche[nicheNorm];
            }
          }
          performanceScore = Math.min(performanceScore, 50);

          // 3. Offer popularity (0-30 points)
          const viewScore = Math.min((offer.viewCount || 0) / 10, 15);
          const applicationScore = Math.min((offer.applicationCount || 0) / 5, 15);
          const popularityScore = viewScore + applicationScore;

          // 4. Commission attractiveness (0-20 points)
          let commissionScore = 0;
          if (offer.commissionType === 'per_sale' && offer.commissionAmount) {
            commissionScore = Math.min(Number(offer.commissionAmount) / 10, 20);
          } else if (offer.commissionType === 'per_sale' && offer.commissionPercentage) {
            commissionScore = Math.min(Number(offer.commissionPercentage) / 2, 20);
          } else if (offer.commissionType === 'monthly_retainer' && offer.retainerAmount) {
            commissionScore = Math.min(Number(offer.retainerAmount) / 100, 20);
          } else if (offer.commissionType === 'per_click') {
            commissionScore = 10; // Base score for per-click
          } else if (offer.commissionType === 'per_lead') {
            commissionScore = 12; // Base score for per-lead
          }

          const totalScore = nicheScore + performanceScore + popularityScore + commissionScore;

          return {
            offer,
            score: totalScore,
            matchingNiches: matchingNiches.length,
          };
        })
        .filter(item => item !== null) // Remove offers with no niche match
        .sort((a, b) => b!.score - a!.score);

      console.log('[Recommendations] Total scored offers with matching niches:', scoredOffers.length);
      console.log('[Recommendations] Top 3 scored offers:', scoredOffers.slice(0, 3).map(s => ({
        title: s!.offer.title,
        score: s!.score,
        matchingNiches: s!.matchingNiches,
        primaryNiche: s!.offer.primaryNiche
      })));

      // If no niche matches, fallback to popular offers
      let topOffers = scoredOffers.slice(0, 10).map(item => item!.offer);

      if (topOffers.length === 0) {
        console.log('[Recommendations] No niche matches found. Falling back to popular offers.');
        // Return popular offers that user hasn't applied to yet
        topOffers = allOffers
          .filter(offer => !appliedOfferIds.has(offer.id))
          .sort((a, b) => {
            const scoreA = (a.viewCount || 0) + (a.applicationCount || 0) * 2;
            const scoreB = (b.viewCount || 0) + (b.applicationCount || 0) * 2;
            return scoreB - scoreA;
          })
          .slice(0, 10);
        console.log('[Recommendations] Returning', topOffers.length, 'popular offers as fallback');
      } else {
        console.log('[Recommendations] Returning', topOffers.length, 'niche-matched offers');
      }

      res.json(topOffers);
    } catch (error: any) {
      console.error('[Recommendations] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Dev-only: debug recommendations for a specific user (bypass auth)
  // Usage: /api/debug/recommendations?userId=<userId>
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug/recommendations", async (req, res) => {
      try {
        const userId = String(req.query.userId || '');
        if (!userId) return res.status(400).json({ error: 'missing_userId' });

        // Reuse recommendation logic from /api/offers/recommended but bypass auth
        const creatorProfile = await storage.getCreatorProfile(userId);
        if (!creatorProfile) {
          return res.status(404).json({ error: 'profile_not_found' });
        }

        const creatorNiches = (creatorProfile.niches || []).map((n: string) => (n || '').toString().trim()).filter(Boolean);
        if (creatorNiches.length === 0) {
          return res.status(200).json({ error: 'no_niches' });
        }
        const creatorNichesNorm = creatorNiches.map((n: string) => n.toLowerCase());

        const allOffers = await storage.getOffers({ status: 'approved' });

        // Get creator's past applications
        const pastApplications = await db
          .select({ offerId: applications.offerId, status: applications.status })
          .from(applications)
          .where(eq(applications.creatorId, userId));

        const appliedOfferIds = new Set(pastApplications.map(app => app.offerId));

        // Compute performance by niche for this user
        const performanceByNiche: Record<string, number> = {};
        if (pastApplications.length > 0) {
          const approvedAppIds = pastApplications
            .filter(app => app.status === 'approved' || app.status === 'active')
            .map(app => app.offerId);

          if (approvedAppIds.length > 0) {
            const performanceData = await db
              .select({ offerId: analytics.offerId, totalConversions: sql<number>`SUM(${analytics.conversions})`, totalClicks: sql<number>`SUM(${analytics.clicks})` })
              .from(analytics)
              .where(eq(analytics.creatorId, userId))
              .groupBy(analytics.offerId);

            for (const perf of performanceData) {
              const offer = allOffers.find(o => o.id === perf.offerId);
              if (!offer) continue;
              const conversionRate = perf.totalClicks > 0 ? (Number(perf.totalConversions) / Number(perf.totalClicks)) * 100 : 0;
              if (offer.primaryNiche) {
                const key = (offer.primaryNiche || '').toString().toLowerCase();
                performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
              }
              if (offer.additionalNiches) {
                for (const niche of offer.additionalNiches) {
                  const key = (niche || '').toString().toLowerCase();
                  performanceByNiche[key] = (performanceByNiche[key] || 0) + conversionRate;
                }
              }
            }
          }
        }

        const scoredOffers = allOffers
          .filter(offer => !appliedOfferIds.has(offer.id))
          .map(offer => {
            let score = 0;
            const offerNichesRaw = [offer.primaryNiche, ...(offer.additionalNiches || [])].filter(Boolean);
            const offerNichesNorm = offerNichesRaw.map((n: string) => n.toString().toLowerCase());
            const matchingNiches = offerNichesRaw.filter((n: string, idx: number) => creatorNichesNorm.includes(offerNichesNorm[idx]));
            if (matchingNiches.length === 0) return null;
            if (offer.primaryNiche && creatorNichesNorm.includes((offer.primaryNiche || '').toString().toLowerCase())) score += 50;
            const additionalMatches = matchingNiches.filter(n => n !== offer.primaryNiche).length;
            score += additionalMatches * 25;
            const nicheScore = Math.min(score, 100);
            let performanceScore = 0;
            for (const nicheNorm of offerNichesNorm) {
              if (performanceByNiche[nicheNorm]) performanceScore += performanceByNiche[nicheNorm];
            }
            performanceScore = Math.min(performanceScore, 50);
            const viewScore = Math.min((offer.viewCount || 0) / 10, 15);
            const applicationScore = Math.min((offer.applicationCount || 0) / 5, 15);
            const popularityScore = viewScore + applicationScore;
            let commissionScore = 0;
            if (offer.commissionType === 'per_sale' && offer.commissionAmount) {
              commissionScore = Math.min(Number(offer.commissionAmount) / 10, 20);
            } else if (offer.commissionType === 'per_sale' && offer.commissionPercentage) {
              commissionScore = Math.min(Number(offer.commissionPercentage) / 2, 20);
            } else if (offer.commissionType === 'monthly_retainer' && offer.retainerAmount) {
              commissionScore = Math.min(Number(offer.retainerAmount) / 100, 20);
            } else if (offer.commissionType === 'per_click') {
              commissionScore = 10;
            } else if (offer.commissionType === 'per_lead') {
              commissionScore = 12;
            }
            const totalScore = nicheScore + performanceScore + popularityScore + commissionScore;
            return { offer, score: totalScore };
          })
          .filter(item => item !== null)
          .sort((a, b) => b!.score - a!.score);

        const topOffers = scoredOffers.slice(0, 10).map(item => item!.offer);
        return res.json(topOffers);
      } catch (error: any) {
        console.error('[Debug Recommendations] Error:', error);
        res.status(500).send(error.message);
      }
    });
  }

  app.get("/api/offers/:id", requireAuth, async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      // 🆕 INCREMENT VIEW COUNT
      await storage.incrementOfferViewCount(offer.id);

      const videos = await storage.getOfferVideos(offer.id);
      const company = await storage.getCompanyProfileById(offer.companyId);

      // 🆕 GET OFFER STATS
      const activeCreatorsCount = await storage.getActiveCreatorsCountForOffer(offer.id);
      const clickStats = await storage.getOfferClickStats(offer.id);

      res.json({
        ...offer,
        videos,
        company,
        activeCreatorsCount,
        totalClicks: clickStats.totalClicks,
        uniqueClicks: clickStats.uniqueClicks,
      });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get reviews for an offer (public endpoint)
  app.get("/api/offers/:id/reviews", async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      // Get reviews for the company that owns this offer
      const reviews = await storage.getReviewsByCompany(offer.companyId);

      // Filter out hidden reviews for non-admin users
      const visibleReviews = reviews.filter(review => !review.isHidden);

      res.json(visibleReviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching offer reviews:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/offers", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(403).json({ error: "Company profile not found" });
      }

      // DEBUG: Log what frontend is sending
      console.log('[CREATE OFFER] Received from frontend:', {
        minimumFollowers: req.body.minimumFollowers,
        allowedPlatforms: req.body.allowedPlatforms,
        geographicRestrictions: req.body.geographicRestrictions,
        ageRestriction: req.body.ageRestriction,
        contentStyleRequirements: req.body.contentStyleRequirements?.substring(0, 50),
        brandSafetyRequirements: req.body.brandSafetyRequirements?.substring(0, 50),
      });

      const validated = createOfferSchema.parse(req.body);

      // DEBUG: Log what Zod validated
      console.log('[CREATE OFFER] After Zod validation:', {
        minimumFollowers: validated.minimumFollowers,
        allowedPlatforms: validated.allowedPlatforms,
        geographicRestrictions: validated.geographicRestrictions,
        ageRestriction: validated.ageRestriction,
        contentStyleRequirements: validated.contentStyleRequirements?.substring(0, 50),
        brandSafetyRequirements: validated.brandSafetyRequirements?.substring(0, 50),
      });

      // Don't normalize featured image URLs - keep the full Cloudinary URL for proper display
      const featuredImagePath = validated.featuredImageUrl;

      // Always create offers as "draft" first
      // Offers are submitted for review via POST /api/offers/:id/submit-for-review
      const offer = await storage.createOffer({
        ...validated,
        featuredImageUrl: featuredImagePath,
        companyId: companyProfile.id,
        status: 'draft',
      });

      // Note: Admin notification happens when offer is submitted for review
      // via POST /api/offers/:id/submit-for-review endpoint

      res.json(offer);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('[offers] Error creating offer:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/offers/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      const validated = insertOfferSchema.partial().parse(req.body);

      // Don't normalize featured image URLs - keep the full Cloudinary URL for proper display
      // No ACL normalization needed for Cloudinary URLs

      const updatedOffer = await storage.updateOffer(offerId, validated);
      res.json(updatedOffer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // DELETE offer endpoint - FIXED
  app.delete("/api/offers/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      // Check for active applications
      const applications = await storage.getApplicationsByOffer(offerId);
      const hasActiveApplications = applications.some(
        app => app.status === 'active' || app.status === 'approved'
      );

      if (hasActiveApplications) {
        return res.status(400).json({
          error: "Cannot delete offer with active applications",
          message: "This offer has active applications. Please complete or reject them first."
        });
      }

      // Delete the offer (cascades to videos, applications, favorites per DB constraints)
      await storage.deleteOffer(offerId);

      res.json({ success: true, message: "Offer deleted successfully" });
    } catch (error: any) {
      console.error('[DELETE /api/offers/:id] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Submit offer for review - validates 6-12 video requirement
  app.post("/api/offers/:id/submit-for-review", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      // Check if offer is in draft status
      if (offer.status !== 'draft') {
        return res.status(400).json({
          error: "Invalid status",
          message: "Only draft offers can be submitted for review"
        });
      }

      // CRITICAL: Validate 6-12 video requirement
      const videos = await storage.getOfferVideos(offerId);
      if (videos.length < 6) {
        return res.status(400).json({
          error: "Insufficient videos",
          message: `Offers must have at least 6 example videos. Currently: ${videos.length}/6`
        });
      }

      if (videos.length > 12) {
        return res.status(400).json({
          error: "Too many videos",
          message: `Offers can have maximum 12 example videos. Currently: ${videos.length}/12`
        });
      }

      // Update offer status to pending_review
      const updatedOffer = await storage.updateOffer(offerId, {
        status: 'pending_review'
      });

      // Notify admins about new offer pending review
      const adminUsers = await storage.getUsersByRole('admin');
      for (const admin of adminUsers) {
        await notificationService.sendNotification(
          admin.id,
          'new_application',
          'New Offer Pending Review',
          `${companyProfile.legalName || companyProfile.tradeName} has submitted offer "${offer.title}" for review.`,
          {
            userName: admin.firstName || admin.username,
            companyName: companyProfile.legalName || companyProfile.tradeName || '',
            offerTitle: offer.title,
            offerId: offer.id,
          }
        );
      }
      console.log(`[Submit for Review] Notified admins about offer ${offer.id} (${videos.length} videos)`);

      res.json({
        success: true,
        message: "Offer submitted for review successfully",
        offer: updatedOffer,
        videoCount: videos.length
      });
    } catch (error: any) {
      console.error('[POST /api/offers/:id/submit-for-review] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Priority Listing Purchase endpoint
  app.post("/api/offers/:id/purchase-priority", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      // Check if offer is approved
      if (offer.status !== 'approved') {
        return res.status(400).json({
          error: "Invalid status",
          message: "Only approved offers can be made priority listings"
        });
      }

      // Check if already has active priority listing
      if (offer.featuredOnHomepage && offer.priorityExpiresAt) {
        const now = new Date();
        if (new Date(offer.priorityExpiresAt) > now) {
          return res.status(400).json({
            error: "Already featured",
            message: "This offer already has an active priority listing"
          });
        }
      }

      // Get priority listing settings from platform_settings
      const feeSettings = await storage.getPlatformSetting('priority_listing_fee');
      const durationSettings = await storage.getPlatformSetting('priority_listing_duration_days');

      const priorityFee = feeSettings ? parseFloat(feeSettings.value) : 199;
      const priorityDuration = durationSettings ? parseInt(durationSettings.value) : 30;

      // In a real implementation, you would:
      // 1. Create Stripe Payment Intent
      // 2. Process payment via Stripe
      // 3. Only update offer if payment succeeds

      // For now, simulate successful payment processing
      const now = new Date();
      const expiresAt = new Date(now.getTime() + priorityDuration * 24 * 60 * 60 * 1000);

      // Update offer with priority listing
      const updatedOffer = await storage.updateOffer(offerId, {
        featuredOnHomepage: true,
        priorityExpiresAt: expiresAt,
        priorityPurchasedAt: now,
      });

      // Send confirmation notification
      await notificationService.sendNotification(
        userId,
        'system_announcement',
        'Priority Listing Activated!',
        `Your offer "${offer.title}" is now a priority listing until ${expiresAt.toLocaleDateString()}.`,
        {
          linkUrl: `/company/offers/${offer.id}`,
          offerId: offer.id,
          offerTitle: offer.title,
        }
      );

      res.json({
        success: true,
        message: "Priority listing purchased successfully",
        offer: updatedOffer,
        expiresAt: expiresAt,
        fee: priorityFee,
      });
    } catch (error: any) {
      console.error('[POST /api/offers/:id/purchase-priority] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Priority Listing Renewal endpoint
  app.post("/api/offers/:id/renew-priority", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.id;

      // Verify ownership
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized: You don't own this offer");
      }

      // Check if offer is approved
      if (offer.status !== 'approved') {
        return res.status(400).json({
          error: "Invalid status",
          message: "Only approved offers can have priority listings"
        });
      }

      // Get priority listing settings
      const feeSettings = await storage.getPlatformSetting('priority_listing_fee');
      const durationSettings = await storage.getPlatformSetting('priority_listing_duration_days');

      const priorityFee = feeSettings ? parseFloat(feeSettings.value) : 199;
      const priorityDuration = durationSettings ? parseInt(durationSettings.value) : 30;

      // Calculate new expiration date
      const now = new Date();
      let newExpiresAt: Date;

      if (offer.priorityExpiresAt && new Date(offer.priorityExpiresAt) > now) {
        // Extend from current expiration date
        newExpiresAt = new Date(new Date(offer.priorityExpiresAt).getTime() + priorityDuration * 24 * 60 * 60 * 1000);
      } else {
        // Start from now
        newExpiresAt = new Date(now.getTime() + priorityDuration * 24 * 60 * 60 * 1000);
      }

      // Update offer with renewed priority listing
      const updatedOffer = await storage.updateOffer(offerId, {
        featuredOnHomepage: true,
        priorityExpiresAt: newExpiresAt,
        priorityPurchasedAt: now,
      });

      // Send confirmation notification
      await notificationService.sendNotification(
        userId,
        'system_announcement',
        'Priority Listing Renewed!',
        `Your priority listing for "${offer.title}" has been extended until ${newExpiresAt.toLocaleDateString()}.`,
        {
          linkUrl: `/company/offers/${offer.id}`,
          offerId: offer.id,
          offerTitle: offer.title,
        }
      );

      res.json({
        success: true,
        message: "Priority listing renewed successfully",
        offer: updatedOffer,
        expiresAt: newExpiresAt,
        fee: priorityFee,
      });
    } catch (error: any) {
      console.error('[POST /api/offers/:id/renew-priority] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Applications routes
  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getApplicationsByCreator(userId);

      // Fetch offer details for each application
      const applicationsWithOffers = await Promise.all(
        applications.map(async (app) => {
          const offer = await storage.getOffer(app.offerId);
          const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;
          return { ...app, offer: offer ? { ...offer, company } : null };
        })
      );

      res.json(applicationsWithOffers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // ✅ NEW: Get single application by ID
  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applicationId = req.params.id;

      // Get the application
      const application = await storage.getApplication(applicationId);
      
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the user owns this application
      if (application.creatorId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // Fetch offer and company details
      const offer = await storage.getOffer(application.offerId);
      const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;

      res.json({
        ...application,
        offer: offer ? { ...offer, company } : null
      });
    } catch (error: any) {
      console.error('[GET /api/applications/:id] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // QR Code generation endpoint for tracking links
  app.get("/api/applications/:id/qrcode", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applicationId = req.params.id;

      // Get the application
      const application = await storage.getApplication(applicationId);

      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the user owns this application
      if (application.creatorId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // Check if application is approved and has a tracking link
      if (application.status !== 'approved' && application.status !== 'active') {
        return res.status(400).json({
          error: "Application not approved",
          message: "QR codes are only available for approved applications"
        });
      }

      if (!application.trackingLink) {
        return res.status(400).json({
          error: "No tracking link",
          message: "This application doesn't have a tracking link yet"
        });
      }

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(application.trackingLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.json({
        success: true,
        qrCodeDataUrl: qrCodeDataUrl,
        trackingLink: application.trackingLink
      });
    } catch (error: any) {
      console.error('[GET /api/applications/:id/qrcode] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/applications", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;

      // ACCOUNT TYPE RESTRICTION: Check if creator has at least one video platform
      const creatorProfile = await storage.getCreatorProfile(userId);
      const hasVideoPlatform = creatorProfile && (
        creatorProfile.youtubeUrl ||
        creatorProfile.tiktokUrl ||
        creatorProfile.instagramUrl
      );

      if (!hasVideoPlatform) {
        return res.status(400).json({
          error: "Video platform required",
          message: "You must add at least one video platform (YouTube, TikTok, or Instagram) to your profile before applying to offers. Please complete your profile setup first."
        });
      }

      const validated = insertApplicationSchema.parse({
        ...req.body,
        creatorId: userId,
        status: 'pending',
      });

      // 🆕 CHECK IF CREATOR HAS ALREADY APPLIED TO THIS OFFER
      const existingApplication = await storage.getExistingApplication(userId, validated.offerId);
      if (existingApplication) {
        return res.status(400).json({
          error: "You have already applied to this offer. Only one application per offer is allowed."
        });
      }

      const application = await storage.createApplication(validated);

      // 🆕 GET OFFER, CREATOR, AND COMPANY INFO FOR NOTIFICATION
      const offer = await storage.getOffer(application.offerId);
      const creator = await storage.getUserById(application.creatorId);
      
      if (offer && creator) {
        const company = await storage.getCompanyProfileById(offer.companyId);
        
        if (company) {
          // 🆕 SEND NOTIFICATION TO COMPANY
          await notificationService.sendNotification(
            company.userId,
            'new_application',
            'New Application Received! 📩',
            `${creator.firstName || creator.username} has applied to your offer "${offer.title}". Review their application now.`,
            {
              userName: company.contactName || 'there',
              offerTitle: offer.title,
              applicationId: application.id,
            }
          );
          console.log(`[Notification] Sent new application notification to company ${company.legalName}`);
        }
      }

      // TODO: Schedule auto-approval job for 7 minutes later

      res.json(application);
    } catch (error: any) {
      console.error('[POST /api/applications] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/applications/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Generate tracking link and code (must be unique per application)
      const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${application.id.substring(0, 8)}`;
      const port = process.env.PORT || 3000;
      const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
      const trackingLink = `${baseURL}/go/${trackingCode}`;

      const approved = await storage.approveApplication(
        application.id,
        trackingLink,
        trackingCode
      );

      // 🆕 GET OFFER AND CREATOR INFO FOR NOTIFICATION
      const offer = await storage.getOffer(application.offerId);
      const creator = await storage.getUserById(application.creatorId);

      // 🆕 SEND NOTIFICATION TO CREATOR
      if (offer && creator) {
        await notificationService.sendNotification(
          application.creatorId,
          'application_status_change',
          'Your application has been approved! 🎉',
          `Congratulations! Your application for "${offer.title}" has been approved. You can now start promoting this offer.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            trackingLink: trackingLink,
            trackingCode: trackingCode,
            applicationId: application.id,
            applicationStatus: 'approved',
          }
        );
        console.log(`[Notification] Sent approval notification to creator ${creator.username}`);
      }

      res.json(approved);
    } catch (error: any) {
      console.error('[Approve Application] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/applications/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the application belongs to one of the company's offers
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Verify ownership
      if (offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      const rejected = await storage.updateApplication(application.id, {
        status: 'rejected',
      });

      // 🆕 GET CREATOR INFO FOR NOTIFICATION
      const creator = await storage.getUserById(application.creatorId);

      // 🆕 SEND NOTIFICATION TO CREATOR
      if (creator) {
        await notificationService.sendNotification(
          application.creatorId,
          'application_status_change',
          'Application Update',
          `Your application for "${offer.title}" was not approved at this time. Don't worry - there are many other great offers available!`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            linkUrl: `/browse`,
            applicationStatus: 'rejected',
          }
        );
        console.log(`[Notification] Sent rejection notification to creator ${creator.username}`);
      }

      res.json(rejected);
    } catch (error: any) {
      console.error('[Reject Application] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/applications/:id/complete", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send("Application not found");
      }

      // Verify the application belongs to one of the company's offers
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Compare offer.companyId against companyProfile.id (not userId)
      if (offer.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Verify application is approved before marking complete
      if (application.status !== 'approved' && application.status !== 'active') {
        return res.status(400).send("Only approved applications can be marked as complete");
      }

      const completed = await storage.completeApplication(application.id);

      // Automatically create payment when work is completed
      // Calculate payment amounts based on offer commission
      let grossAmount = 0;
      // Calculate gross amount based on configured commission type
      // The canonical commission types are defined as: 'per_sale', 'per_lead', 'per_click', 'monthly_retainer', 'hybrid'
      // If it's a per_sale type and a commissionPercentage is present, use percentage logic
      if (offer.commissionType === 'per_sale' && offer.commissionPercentage) {
        // For percentage-based, use a base amount (this should come from actual sale data)
        // For now, we'll use a placeholder - in production, this would come from tracked conversions
        const baseAmount = parseFloat(req.body.saleAmount || '100');
        grossAmount = baseAmount * (parseFloat(offer.commissionPercentage.toString()) / 100);
      } else if (offer.commissionType !== 'per_sale' && offer.commissionAmount) {
        // For non per_sale commission types we expect a fixed amount (per_click, per_lead, monthly_retainer, etc.)
        grossAmount = parseFloat(offer.commissionAmount.toString());
      }

      // Calculate fees with per-company override support (Section 4.3.H)
      const fees = await calculateFees(grossAmount, companyProfile.id);

      // Create payment record
      const payment = await storage.createPayment({
        applicationId: application.id,
        creatorId: application.creatorId,
        companyId: companyProfile.id,
        offerId: offer.id,
        grossAmount: fees.grossAmount.toFixed(2),
        platformFeeAmount: fees.platformFeeAmount.toFixed(2),
        stripeFeeAmount: fees.stripeFeeAmount.toFixed(2),
        netAmount: fees.netAmount.toFixed(2),
        status: 'pending',
        description: `Payment for ${offer.title}`,
      });

      const feeLabel = fees.isCustomFee ? `Custom ${formatFeePercentage(fees.platformFeePercentage)}` : formatFeePercentage(DEFAULT_PLATFORM_FEE_PERCENTAGE);
      console.log(`[Payment] Created payment ${payment.id} for application ${application.id} - Platform Fee: ${feeLabel}`);

      // Send notification to creator
      const creator = await storage.getUserById(application.creatorId);
      if (creator) {
        // ✅ FIXED: Added paymentId to notification
        await notificationService.sendNotification(
          application.creatorId,
          'payment_pending',
          'Work Completed - Payment Pending 💰',
          `Your work for "${offer.title}" has been marked as complete! Payment of $${fees.netAmount.toFixed(2)} is pending company approval.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: offer.title,
            amount: `$${fees.netAmount.toFixed(2)}`,
            paymentId: payment.id, // ✅ ADDED
          }
        );
      }

      // Send notification to admins about new payment to process
      const adminUsers = await storage.getUsersByRole('admin');
      for (const admin of adminUsers) {
        await notificationService.sendNotification(
          admin.id,
          'payment_pending',
          'New Affiliate Payment Ready for Processing',
          `A payment of $${fees.netAmount.toFixed(2)} for creator ${creator?.username || 'Unknown'} on "${offer.title}" is ready for processing.`,
          {
            userName: admin.firstName || admin.username,
            offerTitle: offer.title,
            amount: `$${fees.netAmount.toFixed(2)}`,
            paymentId: payment.id,
            linkUrl: `/payments/${payment.id}`, // Link to specific payment detail page
          }
        );
      }
      console.log(`[Notification] Notified admins about new affiliate payment ${payment.id}`);

      // Check if this is the first completed campaign between this company and creator
      // to show review prompt
      const allApplications = await storage.getApplicationsByCreator(application.creatorId);
      const completedApplicationsWithThisCompany = allApplications.filter(app => {
        // Get all completed applications with offers from this company
        return app.status === 'completed' && app.completedAt;
      });

      // Get the offers for these applications to check if they're from the same company
      let completedWithThisCompanyCount = 0;
      for (const app of completedApplicationsWithThisCompany) {
        const appOffer = await storage.getOffer(app.offerId);
        if (appOffer && appOffer.companyId === offer.companyId) {
          completedWithThisCompanyCount++;
        }
      }

      // Check if creator has already reviewed this company
      const existingReviews = await storage.getReviewsByCreatorAndCompany(
        application.creatorId,
        offer.companyId
      );

      const shouldPromptReview = completedWithThisCompanyCount === 1 && existingReviews.length === 0;

      res.json({
        application: completed,
        payment,
        promptReview: shouldPromptReview,
        companyId: offer.companyId,
        companyName: companyProfile.legalName || companyProfile.tradeName,
      });
    } catch (error: any) {
      console.error('[Complete Application] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/company/applications", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      console.log('[/api/company/applications] userId:', userId);
      const companyProfile = await storage.getCompanyProfile(userId);
      console.log('[/api/company/applications] companyProfile:', companyProfile);
      if (!companyProfile) {
        console.log('[/api/company/applications] No company profile found for user:', userId);
        return res.status(404).send("Company profile not found");
      }
      
      // Pass company profile ID, not user ID
      const applications = await storage.getApplicationsByCompany(companyProfile.id);
      console.log('[/api/company/applications] Found', applications.length, 'applications');
      res.json(applications);
    } catch (error: any) {
      console.error('[/api/company/applications] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/company/applications/:id/status", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { status } = req.body as { status?: string };
      const allowedStatuses = ['pending', 'approved', 'active', 'paused', 'completed', 'rejected'];

      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided' });
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send('Company profile not found');
      }

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).send('Application not found');
      }

      const offer = await storage.getOffer(application.offerId);
      if (!offer || offer.companyId !== companyProfile.id) {
        return res.status(403).send('Forbidden');
      }

      const updated = await storage.updateApplication(application.id, { status: status as any });
      res.json(updated);
    } catch (error: any) {
      console.error('[Update Application Status] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Favorites routes
  app.get("/api/favorites", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const favorites = await storage.getFavoritesByCreator(userId);

      // Fetch offer details for each favorite
      const favoritesWithOffers = await Promise.all(
        favorites.map(async (fav) => {
          const offer = await storage.getOffer(fav.offerId);
          const company = offer ? await storage.getCompanyProfileById(offer.companyId) : null;
          return { ...fav, offer: offer ? { ...offer, company } : null };
        })
      );

      res.json(favoritesWithOffers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/favorites/:offerId", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const isFav = await storage.isFavorite(userId, req.params.offerId);
      res.json(isFav);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/favorites", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertFavoriteSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const favorite = await storage.createFavorite(validated);
      res.json(favorite);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/favorites/:offerId", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.deleteFavorite(userId, req.params.offerId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Tracking & Redirect System
  app.get("/go/:code", async (req, res) => {
    try {
      const trackingCode = req.params.code;
      console.log(`[Tracking] Received tracking code: ${trackingCode}`);

      // Look up application by tracking code
      const application = await storage.getApplicationByTrackingCode(trackingCode);
      if (!application) {
        console.error(`[Tracking] Application not found for tracking code: ${trackingCode}`);
        return res.status(404).send("Tracking link not found");
      }

      console.log(`[Tracking] Found application: ${application.id}, status: ${application.status}`);

      // Get offer details for product URL
      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).send("Offer not found");
      }

      // Extract client IP (normalize for proxies/load balancers)
      let clientIp = 'unknown';
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // X-Forwarded-For can be comma-separated, take first (client) IP
        const forwardedIpValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        const ips = String(forwardedIpValue).split(',').map(ip => ip.trim());
        clientIp = ips[0];
      } else if (req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      } else if (req.ip) {
        clientIp = req.ip;
      }

      // Clean IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 → 192.168.1.1)
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }

      const userAgent = req.headers['user-agent'] || 'unknown';
      const refererRaw = req.headers['referer'] || req.headers['referrer'];
      const referer = Array.isArray(refererRaw) ? refererRaw[0] : (refererRaw || 'direct');

      // Parse UTM parameters from query string
      const utmSource = req.query.utm_source as string | undefined;
      const utmMedium = req.query.utm_medium as string | undefined;
      const utmCampaign = req.query.utm_campaign as string | undefined;
      const utmTerm = req.query.utm_term as string | undefined;
      const utmContent = req.query.utm_content as string | undefined;

      // Perform fraud detection check
      const fraudCheck = await checkClickFraud(clientIp, userAgent, referer, application.id);

      // Log fraud detection result
      if (!fraudCheck.isValid) {
        logFraudDetection(trackingCode, clientIp, fraudCheck);
      }

      // Log the click asynchronously (don't block redirect)
      // Note: We still log even if fraud is detected, but mark it with fraud score
      console.log(`[Tracking] Logging click for application ${application.id}, IP: ${clientIp}, fraud score: ${fraudCheck.fraudScore}`);
      storage.logTrackingClick(application.id, {
        ip: clientIp,
        userAgent,
        referer,
        timestamp: new Date(),
        fraudScore: fraudCheck.fraudScore,
        fraudFlags: fraudCheck.flags.join(','),
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
      }).then(() => {
        console.log(`[Tracking] Successfully logged click for application ${application.id}`);
      }).catch(err => {
        console.error('[Tracking] Error logging click:', err);
        console.error('[Tracking] Error stack:', err.stack);
      });

      // Always redirect to maintain good UX
      // Even fraudulent clicks get redirected (but won't count toward analytics if fraud score > 50)
      res.redirect(302, offer.productUrl);
    } catch (error: any) {
      console.error('[Tracking] Error:', error);
      res.status(500).send("Internal server error");
    }
  });

  // Record conversion (companies can report sales/conversions)
  app.post("/api/conversions/:applicationId", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { saleAmount } = req.body;

      // Verify the application belongs to an offer owned by this company
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const offer = await storage.getOffer(application.offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Forbidden: You don't own this offer" });
      }

      // Record the conversion and calculate earnings
      await storage.recordConversion(applicationId, saleAmount ? parseFloat(saleAmount) : undefined);

      res.json({
        success: true,
        message: "Conversion recorded successfully"
      });
    } catch (error: any) {
      console.error('[Record Conversion] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Analytics routes
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;
      const userRole = user.role;
      const dateRange = (req.query.range as string) || '30d';
      const applicationId = req.query.applicationId as string | undefined;

      // If applicationId is provided, return analytics for that specific application
      if (applicationId) {
        const application = await storage.getApplication(applicationId);
        if (!application) {
          return res.status(404).send("Application not found");
        }

        // Verify the user has access to this application
        if (userRole === 'creator' && application.creatorId !== userId) {
          return res.status(403).send("Access denied");
        }
        if (userRole === 'company') {
          const offer = await storage.getOffer(application.offerId);
          const companyProfile = await storage.getCompanyProfile(userId);
          if (!offer || !companyProfile || offer.companyId !== companyProfile.id) {
            return res.status(403).send("Access denied");
          }
        }

        // Get analytics for this specific application
        const appAnalytics = await storage.getAnalyticsByApplication(applicationId);
        const offer = await storage.getOffer(application.offerId);
        const companyProfile = offer ? await storage.getCompanyProfile(offer.companyId) : null;

        // Calculate totals
        const totals = appAnalytics && appAnalytics.length > 0
          ? appAnalytics.reduce((acc: any, curr: any) => ({
              clicks: acc.clicks + (Number(curr.clicks) || 0),
              conversions: acc.conversions + (Number(curr.conversions) || 0),
              earnings: acc.earnings + (Number(curr.earnings) || 0),
            }), { clicks: 0, conversions: 0, earnings: 0 })
          : { clicks: 0, conversions: 0, earnings: 0 };

        // Get time series data
        const chartData = await storage.getAnalyticsTimeSeriesByApplication(applicationId, dateRange);

        const stats = {
          totalEarnings: totals.earnings,
          totalClicks: totals.clicks,
          uniqueClicks: totals.clicks, // TODO: Track unique clicks separately
          conversions: totals.conversions,
          conversionRate: totals.clicks > 0
            ? ((totals.conversions / totals.clicks) * 100).toFixed(1)
            : 0,
          activeOffers: 1,
          chartData: chartData,
          offerTitle: offer?.title,
          companyName: companyProfile?.legalName || companyProfile?.tradeName,
          offerBreakdown: [], // Empty for single application view
        };

        return res.json(stats);
      }

      if (userRole === 'company') {
        // Company analytics
        const [
          analyticsData,
          chartData,
          applicationsTimeline,
          conversionFunnel,
          acquisitionSources,
          geography,
        ] = await Promise.all([
          storage.getAnalyticsByCompany(userId),
          storage.getAnalyticsTimeSeriesByCompany(userId, dateRange),
          storage.getApplicationsTimeSeriesByCompany(userId, dateRange),
          storage.getConversionFunnelByCompany(userId),
          storage.getCreatorAcquisitionSourcesByCompany(userId),
          storage.getCreatorGeographyByCompany(userId),
        ]);

        // Get offer breakdown for company
        const companyProfile = await storage.getCompanyProfile(userId);
        const offerBreakdown: any[] = [];

        if (companyProfile) {
          const companyOffers = await storage.getOffersByCompany(companyProfile.id);

          for (const offer of companyOffers) {
            const offerApplications = await storage.getApplicationsByOffer(offer.id);

            let offerClicks = 0;
            let offerConversions = 0;
            let offerSpent = 0;

            for (const app of offerApplications) {
              const appAnalytics = await storage.getAnalyticsByApplication(app.id);
              if (appAnalytics && appAnalytics.length > 0) {
                const totals = appAnalytics.reduce((acc: any, curr: any) => ({
                  clicks: acc.clicks + (Number(curr.clicks) || 0),
                  conversions: acc.conversions + (Number(curr.conversions) || 0),
                  earnings: acc.earnings + (Number(curr.earnings) || 0),
                }), { clicks: 0, conversions: 0, earnings: 0 });

                offerClicks += totals.clicks;
                offerConversions += totals.conversions;
                offerSpent += totals.earnings;
              }
            }

            if (offerClicks > 0 || offerConversions > 0 || offerSpent > 0) {
              offerBreakdown.push({
                offerId: offer.id,
                offerTitle: offer.title,
                companyName: companyProfile.legalName || companyProfile.tradeName || 'Unknown Company',
                clicks: offerClicks,
                conversions: offerConversions,
                earnings: offerSpent,
              });
            }
          }
        }

        const stats = {
          totalEarnings: analyticsData?.totalSpent || 0,
          totalSpent: analyticsData?.totalSpent || 0,
          affiliateSpent: analyticsData?.affiliateSpent || 0,
          retainerSpent: analyticsData?.retainerSpent || 0,
          activeOffers: analyticsData?.activeOffers || 0,
          activeCreators: analyticsData?.activeCreators || 0,
          totalClicks: analyticsData?.totalClicks || 0,
          uniqueClicks: analyticsData?.uniqueClicks || 0,
          conversions: analyticsData?.conversions || 0,
          conversionRate: analyticsData?.totalClicks > 0
            ? ((analyticsData?.conversions || 0) / analyticsData.totalClicks * 100).toFixed(1)
            : 0,
          chartData: chartData,
          offerBreakdown: offerBreakdown,
          applicationsTimeline,
          conversionFunnel,
          acquisitionSources,
          geography,
        };

        res.json(stats);
      } else {
        // Creator analytics
        const analyticsData = await storage.getAnalyticsByCreator(userId);
        const applications = await storage.getApplicationsByCreator(userId);
        const chartData = await storage.getAnalyticsTimeSeriesByCreator(userId, dateRange);

        // Get offer breakdown for creator
        const offerBreakdown: any[] = [];

        for (const app of applications) {
          if (app.status === 'active' || app.status === 'approved') {
            const offer = await storage.getOffer(app.offerId);
            const companyProfile = offer ? await storage.getCompanyProfile(offer.companyId) : null;
            const appAnalytics = await storage.getAnalyticsByApplication(app.id);

            if (appAnalytics && appAnalytics.length > 0) {
              const totals = appAnalytics.reduce((acc: any, curr: any) => ({
                clicks: acc.clicks + (curr.clicks || 0),
                conversions: acc.conversions + (curr.conversions || 0),
                earnings: acc.earnings + (curr.earnings || 0),
              }), { clicks: 0, conversions: 0, earnings: 0 });

              if (totals.clicks > 0 || totals.conversions > 0 || totals.earnings > 0) {
                offerBreakdown.push({
                  offerId: offer?.id,
                  offerTitle: offer?.title || 'Unknown Offer',
                  companyName: companyProfile?.legalName || companyProfile?.tradeName || 'Unknown Company',
                  clicks: totals.clicks,
                  conversions: totals.conversions,
                  earnings: totals.earnings,
                });
              }
            }
          }
        }

        const stats = {
          totalEarnings: analyticsData?.totalEarnings || 0,
          affiliateEarnings: analyticsData?.affiliateEarnings || 0,
          retainerEarnings: analyticsData?.retainerEarnings || 0,
          activeOffers: applications.filter(a => a.status === 'active' || a.status === 'approved').length,
          totalClicks: analyticsData?.totalClicks || 0,
          uniqueClicks: analyticsData?.uniqueClicks || 0,
          conversions: analyticsData?.conversions || 0,
          conversionRate: analyticsData?.totalClicks > 0
            ? ((analyticsData?.conversions || 0) / analyticsData.totalClicks * 100).toFixed(1)
            : 0,
          chartData: chartData,
          offerBreakdown: offerBreakdown,
        };

        res.json(stats);
      }
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/analytics/export/zapier", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body as { webhookUrl?: string; payload?: any };
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      if (!webhookUrl || typeof webhookUrl !== 'string' || !/^https?:\/\//i.test(webhookUrl)) {
        return res.status(400).json({ error: 'A valid webhookUrl is required' });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          companyId: companyProfile.id,
          generatedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({
          error: 'Webhook responded with an error',
          status: response.status,
          body: text,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Zapier Export] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Messages routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user.id;
      const userRole = user.role;
      
      // Get company profile ID if user is a company
      let companyProfileId = null;
      if (userRole === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        companyProfileId = companyProfile?.id;
      }
      
      const conversations = await storage.getConversationsByUser(userId, userRole, companyProfileId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/messages/:conversationId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const allMessages = await storage.getMessages(req.params.conversationId);
      // Filter out messages deleted for the current user
      const filteredMessages = allMessages.filter(msg => {
        const deletedFor = msg.deletedFor || [];
        return !deletedFor.includes(userId);
      });
      res.json(filteredMessages);
    } catch (error: any) {
      console.error('[GET /api/messages/:conversationId] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });

      const message = await storage.createMessage(validated);

      // Auto-moderate message for banned content
      try {
        await moderateMessage(message.id, storage);
      } catch (moderationError) {
        console.error('[Moderation] Error auto-moderating message:', moderationError);
        // Don't fail the message creation if moderation fails
      }

      res.json(message);
    } catch (error: any) {
      console.error('[POST /api/messages] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Delete message for current user only ("delete for me")
  app.delete("/api/messages/:messageId/for-me", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const messageId = req.params.messageId;

      // Verify the message exists and user is part of the conversation
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Get conversation to verify user is part of it
      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check if user is part of the conversation
      const isCreator = conversation.creatorId === userId;
      const companyProfile = await storage.getCompanyProfile(userId);
      const isCompany = companyProfile?.id === conversation.companyId;

      if (!isCreator && !isCompany) {
        return res.status(403).json({ error: "You don't have permission to delete this message" });
      }

      const success = await storage.deleteMessageForUser(messageId, userId);
      if (success) {
        res.json({ success: true, message: "Message deleted for you" });
      } else {
        res.status(500).json({ error: "Failed to delete message" });
      }
    } catch (error: any) {
      console.error('[DELETE /api/messages/:messageId/for-me] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Delete message for both users ("delete for everyone")
  app.delete("/api/messages/:messageId/for-both", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const messageId = req.params.messageId;

      // Verify the message exists
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only the sender can delete for both
      if (message.senderId !== userId) {
        return res.status(403).json({ error: "Only the sender can delete a message for everyone" });
      }

      const success = await storage.deleteMessageForBoth(messageId, userId);
      if (success) {
        res.json({ success: true, message: "Message deleted for everyone" });
      } else {
        res.status(500).json({ error: "Failed to delete message" });
      }
    } catch (error: any) {
      console.error('[DELETE /api/messages/:messageId/for-both] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Get company average response time
  app.get("/api/companies/:companyId/response-time", async (req, res) => {
    try {
      const companyId = req.params.companyId;

      // Get company profile to find userId
      const companyProfile = await storage.getCompanyProfileById(companyId);
      if (!companyProfile) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get all conversations for this company
      const companyConversations = await db.query.conversations.findMany({
        where: eq(conversations.companyId, companyId),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
          },
        },
      });

      if (companyConversations.length === 0) {
        return res.json({
          averageResponseTime: null,
          responseTimeHours: null,
          conversationCount: 0,
        });
      }

      // Calculate response times for each conversation
      const responseTimes: number[] = [];

      for (const conversation of companyConversations) {
        const msgs = conversation.messages;
        if (msgs.length < 2) continue;

        // Find first creator message and first company response
        let firstCreatorMessageTime: Date | null = null;
        let firstCompanyResponseTime: Date | null = null;

        for (const msg of msgs) {
          if (msg.senderId === conversation.creatorId && !firstCreatorMessageTime && msg.createdAt) {
            firstCreatorMessageTime = new Date(msg.createdAt);
          } else if (msg.senderId === companyProfile.userId && firstCreatorMessageTime && !firstCompanyResponseTime && msg.createdAt) {
            firstCompanyResponseTime = new Date(msg.createdAt);
            break;
          }
        }

        // If we found both, calculate the response time
        if (firstCreatorMessageTime && firstCompanyResponseTime) {
          const responseTimeMs = firstCompanyResponseTime.getTime() - firstCreatorMessageTime.getTime();
          responseTimes.push(responseTimeMs);
        }
      }

      if (responseTimes.length === 0) {
        return res.json({
          averageResponseTime: null,
          responseTimeHours: null,
          conversationCount: companyConversations.length,
        });
      }

      // Calculate average
      const averageMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const averageHours = averageMs / (1000 * 60 * 60);

      res.json({
        averageResponseTime: Math.round(averageMs / 1000), // in seconds
        responseTimeHours: Math.round(averageHours * 10) / 10, // rounded to 1 decimal
        conversationCount: companyConversations.length,
        responseCount: responseTimes.length,
      });
    } catch (error: any) {
      console.error('[GET /api/companies/:companyId/response-time] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Get or create conversation for an application
  app.post("/api/conversations/start", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { applicationId } = req.body;

      if (!applicationId) {
        return res.status(400).json({ error: "applicationId is required" });
      }

      // Get the application
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Get user role and company profile
      const user = req.user as any;
      let companyId: string | null = null;
      let companyProfileId: string | null = null;

      if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        companyId = companyProfile?.id || null;
        companyProfileId = companyProfile?.id || null;
      } else {
        // If creator, get company from offer
        const offer = await storage.getOffer(application.offerId);
        companyId = offer?.companyId || null;
      }

      if (!companyId) {
        return res.status(400).json({ error: "Could not determine company" });
      }

      // Find existing conversation for this application
      const existingConversations = await storage.getConversationsByUser(userId, user.role, companyProfileId);
      const existingConversation = existingConversations.find(
        (c: any) => c.applicationId === applicationId
      );

      if (existingConversation) {
        return res.json({ conversationId: existingConversation.id });
      }

      // Create new conversation
      const conversation = await storage.createConversation({
        applicationId,
        creatorId: application.creatorId,
        companyId,
        offerId: application.offerId,
        lastMessageAt: new Date(),
      });

      res.json({ conversationId: conversation.id });
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      res.status(500).send(error.message);
    }
  });

  // Reviews routes
  app.post("/api/reviews", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertReviewSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      const review = await storage.createReview(validated);

      // Auto-moderate review for banned content and low ratings
      try {
        await moderateReview(review.id, storage);
      } catch (moderationError) {
        console.error('[Moderation] Error auto-moderating review:', moderationError);
        // Don't fail the review creation if moderation fails
      }

      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get reviews by creator (creator only)
  app.get("/api/user/reviews", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const reviews = await storage.getReviewsByCreator(userId);
      res.json(reviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching creator reviews:', error);
      res.status(500).send(error.message);
    }
  });

  // Get reviews for a company (company only)
  app.get("/api/company/reviews", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const reviews = await storage.getReviewsByCompany(companyProfile.id);
      res.json(reviews);
    } catch (error: any) {
      console.error('[Reviews] Error fetching company reviews:', error);
      res.status(500).send(error.message);
    }
  });

  // Add company response to a review (company only)
  app.patch("/api/reviews/:id/respond", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const reviewId = req.params.id;
      const { response } = req.body;

      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        return res.status(400).send("Response text is required");
      }

      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Verify the review belongs to this company
      const review = await storage.getReview(reviewId);
      if (!review) {
        return res.status(404).send("Review not found");
      }

      if (review.companyId !== companyProfile.id) {
        return res.status(403).send("You can only respond to reviews for your company");
      }

      // Update the review with company response
      const updatedReview = await storage.updateReview(reviewId, {
        companyResponse: response.trim(),
        companyRespondedAt: new Date(),
      });

      res.json(updatedReview);
    } catch (error: any) {
      console.error('[Reviews] Error adding company response:', error);
      res.status(500).send(error.message);
    }
  });

  // Payment Settings routes
  app.get("/api/payment-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const settings = await storage.getPaymentSettings(userId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/payment-settings", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertPaymentSettingSchema.parse({
        ...req.body,
        userId,
      });

      const setting = await storage.createPaymentSetting(validated);
      res.json(setting);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/payment-settings/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const paymentMethodId = req.params.id;

      // Get all payment settings for the user
      const allSettings = await storage.getPaymentSettings(userId);

      // Find the payment method to delete
      const settingToDelete = allSettings.find(s => s.id === paymentMethodId);

      if (!settingToDelete) {
        return res.status(404).send("Payment method not found");
      }

      // Verify the payment method belongs to the user
      if (settingToDelete.userId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // If deleting the primary payment method and there are other methods, set a new primary
      if (settingToDelete.isDefault && allSettings.length > 1) {
        // Find another payment method to set as primary (first one that's not being deleted)
        const newPrimary = allSettings.find(s => s.id !== paymentMethodId);
        if (newPrimary) {
          await storage.setPrimaryPaymentMethod(userId, newPrimary.id);
        }
      }

      // Delete the payment method
      await storage.deletePaymentSetting(paymentMethodId);

      res.json({ success: true, message: "Payment method deleted successfully" });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/payment-settings/:id/set-primary", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const paymentMethodId = req.params.id;

      // Get all payment settings for the user
      const allSettings = await storage.getPaymentSettings(userId);

      // Find the payment method to set as primary
      const settingToSetPrimary = allSettings.find(s => s.id === paymentMethodId);

      if (!settingToSetPrimary) {
        return res.status(404).send("Payment method not found");
      }

      // Verify the payment method belongs to the user
      if (settingToSetPrimary.userId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // Set as primary
      await storage.setPrimaryPaymentMethod(userId, paymentMethodId);

      res.json({ success: true, message: "Primary payment method updated successfully" });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Update payment setting (e.g., add stripeAccountId to existing e-transfer)
  app.put("/api/payment-settings/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const paymentMethodId = req.params.id;
      const { stripeAccountId } = req.body;

      // Get all payment settings for the user
      const allSettings = await storage.getPaymentSettings(userId);

      // Find the payment method to update
      const settingToUpdate = allSettings.find(s => s.id === paymentMethodId);

      if (!settingToUpdate) {
        return res.status(404).send("Payment method not found");
      }

      // Verify the payment method belongs to the user
      if (settingToUpdate.userId !== userId) {
        return res.status(403).send("Unauthorized");
      }

      // Update the payment setting with stripeAccountId
      await storage.updatePaymentSetting(paymentMethodId, { stripeAccountId });

      res.json({ success: true, message: "Payment method updated successfully" });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Stripe Connect routes for e-transfer setup
  app.post("/api/stripe-connect/create-account", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      const { stripeConnectService } = await import('./stripeConnectService');

      // Create Stripe Connect account
      const result = await stripeConnectService.createConnectedAccount(
        userId,
        user.email,
        'CA' // Default to Canada for e-transfers
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        accountId: result.accountId
      });
    } catch (error: any) {
      console.error('[Stripe Connect] Create account error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/stripe-connect/onboarding-link", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { accountId, returnUrl, refreshUrl } = req.body;

      if (!accountId) {
        return res.status(400).send("accountId is required");
      }

      // Verify the account belongs to this user
      const paymentSettings = await storage.getPaymentSettings(userId);
      const userOwnsAccount = paymentSettings.some(ps => ps.stripeAccountId === accountId);

      if (!userOwnsAccount) {
        return res.status(403).send("Unauthorized - account does not belong to this user");
      }

      const { stripeConnectService } = await import('./stripeConnectService');

      const result = await stripeConnectService.createAccountLink(
        accountId,
        returnUrl || `${process.env.BASE_URL || 'http://localhost:5000'}/settings/payment?stripe_onboarding=success`,
        refreshUrl || `${process.env.BASE_URL || 'http://localhost:5000'}/settings/payment?stripe_onboarding=refresh`
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        url: result.url
      });
    } catch (error: any) {
      console.error('[Stripe Connect] Onboarding link error:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/stripe-connect/account-status/:accountId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { accountId } = req.params;

      // Verify the account belongs to this user
      const paymentSettings = await storage.getPaymentSettings(userId);
      const userOwnsAccount = paymentSettings.some(ps => ps.stripeAccountId === accountId);

      if (!userOwnsAccount) {
        return res.status(403).send("Unauthorized - account does not belong to this user");
      }

      const { stripeConnectService } = await import('./stripeConnectService');

      const result = await stripeConnectService.checkAccountStatus(accountId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error: any) {
      console.error('[Stripe Connect] Account status error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/stripe-connect/dashboard-link", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).send("accountId is required");
      }

      // Verify the account belongs to this user
      const paymentSettings = await storage.getPaymentSettings(userId);
      const userOwnsAccount = paymentSettings.some(ps => ps.stripeAccountId === accountId);

      if (!userOwnsAccount) {
        return res.status(403).send("Unauthorized - account does not belong to this user");
      }

      const { stripeConnectService } = await import('./stripeConnectService');

      const result = await stripeConnectService.createLoginLink(accountId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        url: result.url
      });
    } catch (error: any) {
      console.error('[Stripe Connect] Dashboard link error:', error);
      res.status(500).send(error.message);
    }
  });

  // Payment routes for creators
  app.get("/api/payments/creator", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const payments = await storage.getPaymentsByCreator(userId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Payment routes for companies
  app.get("/api/payments/company", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const payments = await storage.getPaymentsByCompany(companyProfile.id);
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Payment routes for admins
  app.get("/api/payments/all", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // ✅ Get single payment by ID (for all roles - creator, company, admin)
  // IMPORTANT: This MUST come AFTER specific routes like /creator, /company, /all
  app.get("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;
      const paymentId = req.params.id;

      // Get the payment (works for both affiliate and retainer payments)
      const payment = await storage.getPaymentOrRetainerPayment(paymentId);

      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Verify the user has permission to view this payment
      // Creators can view their own payments
      // Companies can view payments they issued
      // Admins can view all payments
      if (user.role === 'creator') {
        if (payment.creatorId !== userId) {
          return res.status(403).send("Unauthorized: You don't have permission to view this payment");
        }
      } else if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (!companyProfile || payment.companyId !== companyProfile.id) {
          return res.status(403).send("Unauthorized: You don't have permission to view this payment");
        }
      } else if (user.role !== 'admin') {
        return res.status(403).send("Unauthorized");
      }

      // Fetch additional details based on payment type
      let offer = null;
      let contract = null;
      let company = null;

      try {
        if (payment.paymentType === 'affiliate' && payment.offerId) {
          offer = await storage.getOffer(payment.offerId);
          if (offer) {
            company = await storage.getCompanyProfileById(offer.companyId);
          }
        } else if (payment.paymentType === 'retainer' && payment.contractId) {
          contract = await storage.getRetainerContract(payment.contractId);
          if (contract) {
            company = await storage.getCompanyProfileById(contract.companyId);
          }
        }
      } catch (error) {
        console.log('[Payment Detail] Could not fetch offer/contract/company details:', error);
        // Continue without these details - they're optional
      }

      // Return payment with additional context
      res.json({
        ...payment,
        offer: offer,
        contract: contract,
        company: company,
      });
    } catch (error: any) {
      console.error('[GET /api/payments/:id] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Update payment status (admin only)
  app.patch("/api/payments/:id/status", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).send("Status is required");
      }

      const payment = await storage.getPaymentOrRetainerPayment(id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // 💰 PROCESS ACTUAL PAYMENT WHEN MARKING AS COMPLETED
      if (status === 'completed') {
        console.log(`[Payment] Processing ${payment.paymentType || 'affiliate'} payment ${id} to send $${payment.netAmount} to creator`);

        // Import payment processor
        const { paymentProcessor } = await import('./paymentProcessor');

        // Validate creator has payment settings configured
        console.log(`[Payment] Validating payment settings for creator ${payment.creatorId}...`);
        const validation = await paymentProcessor.validateCreatorPaymentSettings(payment.creatorId);
        if (!validation.valid) {
          console.error(`[Payment] ERROR: Payment validation failed: ${validation.error}`);
          return res.status(400).send(validation.error);
        }
        console.log(`[Payment] Validation passed, proceeding with payment...`);

        // Actually send the money via PayPal/bank/crypto/etc.
        // Use the appropriate processor based on payment type
        const paymentResult = payment.paymentType === 'retainer'
          ? await paymentProcessor.processRetainerPayment(id)
          : await paymentProcessor.processPayment(id);

        if (!paymentResult.success) {
          // Payment failed - update status to failed
          await storage.updatePaymentOrRetainerPaymentStatus(id, 'failed', {
            description: `Payment failed: ${paymentResult.error}`,
          });

          // Check if the error is due to insufficient funds
          const isInsufficientFunds = paymentResult.error?.toLowerCase().includes('insufficient funds');

          // Automatically send notification to company if insufficient funds
          if (isInsufficientFunds && payment.companyId) {
            console.log(`[Payment] Detected insufficient funds error, sending notification to company profile ${payment.companyId}`);

            // Get company profile first (payment.companyId is a company profile ID, not user ID)
            const companyProfile = await storage.getCompanyProfileById(payment.companyId);

            if (companyProfile) {
              // Get the user associated with this company profile
              const companyUser = await storage.getUserById(companyProfile.userId);

              if (companyUser) {
                // Get the payment method name from the creator's settings
                let paymentMethodName = 'payment account';
                try {
                  const creatorPaymentSettings = await storage.getPaymentSettings(payment.creatorId);
                  if (creatorPaymentSettings && creatorPaymentSettings.length > 0) {
                    const defaultMethod = creatorPaymentSettings.find(ps => ps.isDefault) || creatorPaymentSettings[0];
                    const methodNames: Record<string, string> = {
                      'paypal': 'PayPal account',
                      'etransfer': 'Stripe account',
                      'wire': 'bank account',
                      'crypto': 'crypto wallet'
                    };
                    paymentMethodName = methodNames[defaultMethod.payoutMethod] || 'payment account';
                  }
                } catch (error) {
                  // If we can't determine the method, use generic message
                  console.warn('[Payment] Could not determine payment method name:', error);
                }

                await notificationService.sendNotification(
                  companyUser.id,
                  'payment_failed_insufficient_funds',
                  'Payment Processing Failed - Insufficient Funds',
                  `The payment request for $${payment.netAmount} could not be processed due to insufficient funds in your ${paymentMethodName}.`,
                  {
                    userName: companyUser.firstName || companyUser.username,
                    amount: `$${payment.netAmount}`,
                    grossAmount: `$${payment.grossAmount}`,
                    platformFee: `$${payment.platformFeeAmount}`,
                    processingFee: `$${payment.stripeFeeAmount}`,
                    paymentId: payment.id,
                    companyName: companyProfile.legalName || companyProfile.tradeName || companyUser.username,
                    linkUrl: `/payments/${payment.id}`,
                  }
                );

                console.log(`[Payment] Notification sent to company user ${companyUser.username} about insufficient funds`);
              }
            }
          }

          return res.status(400).json({
            error: paymentResult.error,
            message: "Failed to process payment. Status updated to 'failed'."
          });
        }

        // Payment succeeded - update with transaction details
        const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(id, 'completed', {
          providerTransactionId: paymentResult.transactionId,
          providerResponse: paymentResult.providerResponse,
          completedAt: new Date(),
        });

        console.log(`[Payment] SUCCESS - Sent $${payment.netAmount} to creator. TX ID: ${paymentResult.transactionId}`);

        // Send notification to creator
        const creator = await storage.getUserById(payment.creatorId);

        // Get title based on payment type
        let paymentTitle = 'Payment';
        if (payment.paymentType === 'affiliate' && payment.offerId) {
          const offer = await storage.getOffer(payment.offerId);
          paymentTitle = offer?.title || 'Affiliate Offer';
        } else if (payment.paymentType === 'retainer' && payment.contractId) {
          const contract = await storage.getRetainerContract(payment.contractId);
          paymentTitle = contract?.title || 'Retainer Contract';
        }

        if (creator) {
          // Calculate fee percentages from payment data
          const grossAmt = parseFloat(payment.grossAmount);
          const platformFeeAmt = parseFloat(payment.platformFeeAmount);
          const processingFeeAmt = parseFloat(payment.stripeFeeAmount);
          const platformFeePercent = grossAmt > 0 ? formatFeePercentage(platformFeeAmt / grossAmt) : '4%';
          const processingFeePercent = grossAmt > 0 ? formatFeePercentage(processingFeeAmt / grossAmt) : '3%';

          await notificationService.sendNotification(
            payment.creatorId,
            'payment_received',
            'Payment Received! 💰',
            `You've received a payment of $${payment.netAmount} for your work on "${paymentTitle}". Transaction ID: ${paymentResult.transactionId}`,
            {
              userName: creator.firstName || creator.username,
              offerTitle: paymentTitle,
              amount: `$${payment.netAmount}`,
              grossAmount: `$${payment.grossAmount}`,
              platformFee: `$${payment.platformFeeAmount}`,
              processingFee: `$${payment.stripeFeeAmount}`,
              platformFeePercentage: platformFeePercent,
              processingFeePercentage: processingFeePercent,
              transactionId: paymentResult.transactionId,
              paymentId: payment.id,
              linkUrl: `/payments/${payment.id}`,
            }
          );
          console.log(`[Notification] Sent payment notification to creator ${creator.username}`);
        }

        // Send notification to company
        if (payment.companyId) {
          const companyProfile = await storage.getCompanyProfileById(payment.companyId);
          if (companyProfile) {
            const companyUser = await storage.getUserById(companyProfile.userId);
            if (companyUser) {
              // Reuse calculated fee percentages from above
              const grossAmtCompany = parseFloat(payment.grossAmount);
              const platformFeeAmtCompany = parseFloat(payment.platformFeeAmount);
              const processingFeeAmtCompany = parseFloat(payment.stripeFeeAmount);
              const platformFeePercentCompany = grossAmtCompany > 0 ? formatFeePercentage(platformFeeAmtCompany / grossAmtCompany) : '4%';
              const processingFeePercentCompany = grossAmtCompany > 0 ? formatFeePercentage(processingFeeAmtCompany / grossAmtCompany) : '3%';

              await notificationService.sendNotification(
                companyUser.id,
                'payment_approved',
                'Payment Sent Successfully ✓',
                `Payment of $${payment.netAmount} has been successfully sent to the creator for "${paymentTitle}". Transaction ID: ${paymentResult.transactionId}`,
                {
                  userName: companyUser.firstName || companyUser.username,
                  companyName: companyProfile.legalName || companyProfile.tradeName || companyUser.username,
                  offerTitle: paymentTitle,
                  amount: `$${payment.netAmount}`,
                  grossAmount: `$${payment.grossAmount}`,
                  platformFee: `$${payment.platformFeeAmount}`,
                  processingFee: `$${payment.stripeFeeAmount}`,
                  platformFeePercentage: platformFeePercentCompany,
                  processingFeePercentage: processingFeePercentCompany,
                  transactionId: paymentResult.transactionId,
                  paymentId: payment.id,
                  linkUrl: `/payments/${payment.id}`,
                }
              );
              console.log(`[Notification] Sent payment success notification to company user ${companyUser.username}`);
            }
          }
        }

        res.json(updatedPayment);
      } else {
        // For other status changes (not completed), just update status
        const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(id, status);
        res.json(updatedPayment);
      }

    } catch (error: any) {
      console.error('[Update Payment Status] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Send insufficient funds notification to company
  app.post("/api/payments/:id/notify-insufficient-funds", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;

      const payment = await storage.getPaymentOrRetainerPayment(id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      if (!payment.companyId) {
        return res.status(400).send("Payment has no associated company");
      }

      // Send notification to company about insufficient funds
      const { NotificationService } = await import('./notifications/notificationService');
      const notificationService = new NotificationService(storage);

      // Get company profile first (payment.companyId is a company profile ID, not user ID)
      const companyProfile = await storage.getCompanyProfileById(payment.companyId);

      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      // Get the user associated with this company profile
      const companyUser = await storage.getUserById(companyProfile.userId);

      if (!companyUser) {
        return res.status(404).send("Company user not found");
      }

      // Get the payment method name from the creator's settings
      let paymentMethodName = 'payment account';
      try {
        const creatorPaymentSettings = await storage.getPaymentSettings(payment.creatorId);
        if (creatorPaymentSettings && creatorPaymentSettings.length > 0) {
          const defaultMethod = creatorPaymentSettings.find(ps => ps.isDefault) || creatorPaymentSettings[0];
          const methodNames: Record<string, string> = {
            'paypal': 'PayPal account',
            'etransfer': 'Stripe account',
            'wire': 'bank account',
            'crypto': 'crypto wallet'
          };
          paymentMethodName = methodNames[defaultMethod.payoutMethod] || 'payment account';
        }
      } catch (error) {
        // If we can't determine the method, use generic message
        console.warn('[Payment] Could not determine payment method name:', error);
      }

      await notificationService.sendNotification(
        companyUser.id,
        'payment_failed_insufficient_funds',
        'Payment Processing Failed - Insufficient Funds',
        `The payment request for $${payment.netAmount} could not be processed due to insufficient funds in your ${paymentMethodName}.`,
        {
          userName: companyUser.firstName || companyUser.username,
          amount: `$${payment.netAmount}`,
          grossAmount: `$${payment.grossAmount}`,
          platformFee: `$${payment.platformFeeAmount}`,
          processingFee: `$${payment.stripeFeeAmount}`,
          paymentId: payment.id,
          companyName: companyProfile.legalName || companyProfile.tradeName || companyUser.username,
          linkUrl: `/payments/${payment.id}`,
        }
      );

      console.log(`[Payment] Notification sent to company user ${companyUser.username} about insufficient funds for payment ${id}`);

      res.json({ success: true, message: 'Notification sent to company' });
    } catch (error: any) {
      console.error('[Send Insufficient Funds Notification] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company payment approval
  app.post("/api/company/payments/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const payment = await storage.getPaymentOrRetainerPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Verify the payment belongs to this company
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      if (payment.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Update payment status to processing
      const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(payment.id, 'processing');

      // Send notification to creator
      const creator = await storage.getUserById(payment.creatorId);

      // Get title based on payment type
      let paymentTitle = 'Payment';
      if (payment.paymentType === 'affiliate' && payment.offerId) {
        const offer = await storage.getOffer(payment.offerId);
        paymentTitle = offer?.title || 'Affiliate Offer';
      } else if (payment.paymentType === 'retainer' && payment.contractId) {
        const contract = await storage.getRetainerContract(payment.contractId);
        paymentTitle = contract?.title || 'Retainer Contract';
      }

      if (creator) {
        // Calculate fee percentages from payment data
        const grossAmtApproved = parseFloat(payment.grossAmount);
        const platformFeeAmtApproved = parseFloat(payment.platformFeeAmount);
        const processingFeeAmtApproved = parseFloat(payment.stripeFeeAmount);
        const platformFeePercentApproved = grossAmtApproved > 0 ? formatFeePercentage(platformFeeAmtApproved / grossAmtApproved) : '4%';
        const processingFeePercentApproved = grossAmtApproved > 0 ? formatFeePercentage(processingFeeAmtApproved / grossAmtApproved) : '3%';

        await notificationService.sendNotification(
          payment.creatorId,
          'payment_approved',
          'Payment Approved! 🎉',
          `Great news! Your payment of $${payment.netAmount} for "${paymentTitle}" has been approved and is being processed.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: paymentTitle,
            amount: `$${payment.netAmount}`,
            grossAmount: `$${payment.grossAmount}`,
            platformFee: `$${payment.platformFeeAmount}`,
            processingFee: `$${payment.stripeFeeAmount}`,
            platformFeePercentage: platformFeePercentApproved,
            processingFeePercentage: processingFeePercentApproved,
            paymentId: payment.id,
            linkUrl: `/payments/${payment.id}`,
          }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Approve Payment] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company payment dispute
  app.post("/api/company/payments/:id/dispute", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const { reason } = req.body;
      const payment = await storage.getPaymentOrRetainerPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Verify the payment belongs to this company
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      if (payment.companyId !== companyProfile.id) {
        return res.status(403).send("Unauthorized");
      }

      // Update payment status to failed with reason
      const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(payment.id, 'failed', {
        description: `Disputed: ${reason || 'No reason provided'}`,
      });

      // Send notification to creator
      const creator = await storage.getUserById(payment.creatorId);

      // Get title based on payment type
      let paymentTitle = 'Payment';
      if (payment.paymentType === 'affiliate' && payment.offerId) {
        const offer = await storage.getOffer(payment.offerId);
        paymentTitle = offer?.title || 'Affiliate Offer';
      } else if (payment.paymentType === 'retainer' && payment.contractId) {
        const contract = await storage.getRetainerContract(payment.contractId);
        paymentTitle = contract?.title || 'Retainer Contract';
      }

      if (creator) {
        await notificationService.sendNotification(
          payment.creatorId,
          'payment_disputed',
          'Payment Disputed',
          `Your payment for "${paymentTitle}" has been disputed. Reason: ${reason || 'Not specified'}. Please contact the company for more information.`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: paymentTitle,
            amount: `$${payment.netAmount}`,
            paymentId: payment.id,
            linkUrl: `/messages`,
          }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Dispute Payment] Error:', error);
      res.status(500).send(error.message);
    }
  });


  // Retainer payment routes
  // Get retainer payments for creator
  app.get("/api/retainer-payments/creator", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const payments = await storage.getRetainerPaymentsByCreator(userId);
      res.json(payments);
    } catch (error: any) {
      console.error('[Retainer Payments] Error fetching creator payments:', error);
      res.status(500).send(error.message);
    }
  });

  // Get retainer payments for a specific contract (admin/company)
  app.get("/api/retainer-payments/contract/:contractId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = (req.user as any).role;
      const { contractId } = req.params;

      // Get contract to verify permissions
      const contract = await storage.getRetainerContract(contractId);
      if (!contract) {
        return res.status(404).send("Contract not found");
      }

      // Check permissions
      if (userRole === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (!companyProfile || contract.companyId !== companyProfile.id) {
          return res.status(403).send("Unauthorized");
        }
      } else if (userRole === 'creator') {
        if (contract.assignedCreatorId !== userId) {
          return res.status(403).send("Unauthorized");
        }
      } else if (userRole !== 'admin') {
        return res.status(403).send("Unauthorized");
      }

      const payments = await storage.getRetainerPaymentsByContract(contractId);
      res.json(payments);
    } catch (error: any) {
      console.error('[Retainer Payments] Error fetching contract payments:', error);
      res.status(500).send(error.message);
    }
  });

  // Admin: Process monthly retainer payments for all active contracts
  app.post("/api/admin/retainer-payments/process-monthly", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { RetainerPaymentScheduler } = await import('./retainerPaymentScheduler');
      const scheduler = new RetainerPaymentScheduler(notificationService);

      console.log('[Admin] Manually triggering monthly retainer payment processing...');
      const results = await scheduler.processMonthlyRetainerPayments();

      res.json({
        success: true,
        message: 'Monthly retainer payment processing completed',
        results,
      });
    } catch (error: any) {
      console.error('[Admin] Error processing monthly retainer payments:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Admin: Process monthly payment for a specific contract
  app.post("/api/admin/retainer-payments/process-contract/:contractId", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { contractId } = req.params;
      const { RetainerPaymentScheduler } = await import('./retainerPaymentScheduler');
      const scheduler = new RetainerPaymentScheduler(notificationService);

      console.log(`[Admin] Manually processing payment for contract ${contractId}...`);
      const result = await scheduler.processContractMonthlyPayment(contractId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Monthly payment processed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error(`[Admin] Error processing contract payment:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Admin: Update retainer payment status (e.g., mark as completed, failed)
  app.patch("/api/admin/retainer-payments/:id/status", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).send("Status is required");
      }

      // If marking as completed, process the payment
      if (status === 'completed') {
        const { paymentProcessor } = await import('./paymentProcessor');

        const payment = await storage.getRetainerPayment(id);
        if (!payment) {
          return res.status(404).send("Payment not found");
        }

        // Validate creator has payment settings
        const validation = await paymentProcessor.validateCreatorPaymentSettings(payment.creatorId);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        // Process the payment
        const paymentResult = await paymentProcessor.processRetainerPayment(id);

        if (!paymentResult.success) {
          await storage.updateRetainerPaymentStatus(id, 'failed', {
            description: `Payment failed: ${paymentResult.error}`,
            failedAt: new Date(),
          });
          return res.status(400).json({ error: paymentResult.error });
        }

        // Update as completed with transaction details
        const updatedPayment = await storage.updateRetainerPaymentStatus(id, 'completed', {
          providerTransactionId: paymentResult.transactionId,
          providerResponse: paymentResult.providerResponse,
          completedAt: new Date(),
        });

        res.json(updatedPayment);
      } else {
        // Just update the status
        const updatedPayment = await storage.updateRetainerPaymentStatus(id, status);
        res.json(updatedPayment);
      }
    } catch (error: any) {
      console.error('[Admin] Error updating retainer payment status:', error);
      res.status(500).send(error.message);
    }
  });

  // Company routes
  app.get("/api/company/offers", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      
      if (!companyProfile) {
        return res.status(404).send("Company profile not found");
      }

      const offers = await storage.getOffersByCompany(companyProfile.id);
      res.json(offers);
    } catch (error: any) {
      console.error('[company/offers] Error getting company offers:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/company/stats", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);

      if (!companyProfile) {
        return res.json({
          activeCreators: 0,
          pendingApplications: 0,
          liveOffers: 0,
          draftOffers: 0,
          totalApplications: 0,
          totalClicks: 0,
          conversions: 0,
          companyProfile: null,
        });
      }

      const offers = await storage.getOffersByCompany(companyProfile.id);

      // Collect all applications and calculate stats
      const allApplications = [];
      for (const offer of offers) {
        const apps = await storage.getApplicationsByOffer(offer.id);
        allApplications.push(...apps);
      }

      // Count unique active creators
      const activeCreatorIds = new Set(
        allApplications
          .filter(app => app.status === 'approved' || app.status === 'active')
          .map(app => app.creatorId)
      );

      // Get analytics data including total clicks and conversions
      const analyticsData = await storage.getAnalyticsByCompany(companyProfile.id);

      const stats = {
        activeCreators: activeCreatorIds.size,
        pendingApplications: allApplications.filter(app => app.status === 'pending').length,
        liveOffers: offers.filter(o => o.status === 'approved').length,
        draftOffers: offers.filter(o => o.status === 'draft').length,
        totalApplications: allApplications.length,
        totalClicks: analyticsData.totalClicks || 0,
        conversions: analyticsData.conversions || 0,
        companyProfile,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/company/payment-method-status", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const paymentSettings = await storage.getPaymentSettings(userId);

      res.json({
        hasPaymentMethod: paymentSettings && paymentSettings.length > 0,
        paymentMethodCount: paymentSettings ? paymentSettings.length : 0,
        configured: paymentSettings && paymentSettings.length > 0,
      });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/unread", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const notifications = await storage.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/unread/count", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get single notification by id
  app.get("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const notification = await storage.getNotification(req.params.id);
      if (!notification) return res.status(404).send("Not found");
      if ((notification as any).userId !== userId) return res.status(403).send("Forbidden");
      res.json(notification);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.clearAllNotifications(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Notification preferences routes
  app.get("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      let preferences = await storage.getUserNotificationPreferences(userId);
      
      if (!preferences) {
        preferences = await storage.createUserNotificationPreferences({ userId });
      }
      
      res.json(preferences);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const preferences = await storage.updateUserNotificationPreferences(userId, req.body);
      res.json(preferences);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/notifications/subscribe-push", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { subscription } = req.body;
      
      await storage.updateUserNotificationPreferences(userId, {
        pushSubscription: subscription,
        pushNotifications: true,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/notifications/vapid-public-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  // Admin routes
  app.get("/api/admin/stats", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const pendingCompanies = await storage.getPendingCompanies();
      const pendingOffers = await storage.getPendingOffers();
      const allUsers = await storage.getAllUsers();
      const activeOffers = await storage.getOffers({ status: 'approved' });

      // Split users by role
      const creators = allUsers.filter(user => user.role === 'creator');
      const companies = allUsers.filter(user => user.role === 'company');

      // Calculate new users created in the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newCreatorsThisWeek = creators.filter(user =>
        user.createdAt && new Date(user.createdAt) >= oneWeekAgo
      ).length;
      const newCompaniesThisWeek = companies.filter(user =>
        user.createdAt && new Date(user.createdAt) >= oneWeekAgo
      ).length;

      const stats = {
        totalCreators: creators.length,
        totalCompanies: companies.length,
        newCreatorsThisWeek: newCreatorsThisWeek,
        newCompaniesThisWeek: newCompaniesThisWeek,
        pendingCompanies: pendingCompanies.length,
        pendingOffers: pendingOffers.length,
        activeOffers: activeOffers.length,
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get comprehensive admin analytics (admin only)
  app.get("/api/admin/analytics", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const range = (req.query.range as string) || '30d';

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date(0);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all users
      const allUsers = await storage.getAllUsers();
      const creators = allUsers.filter(user => user.role === 'creator');
      const companies = allUsers.filter(user => user.role === 'company');
      const admins = allUsers.filter(user => user.role === 'admin');

      // Calculate new users this week
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newCreatorsThisWeek = creators.filter(user =>
        user.createdAt && new Date(user.createdAt) >= oneWeekAgo
      ).length;
      const newCompaniesThisWeek = companies.filter(user =>
        user.createdAt && new Date(user.createdAt) >= oneWeekAgo
      ).length;

      // Get all payments for financial data
      const allPayments = await db
        .select()
        .from(payments);

      const filteredPayments = allPayments.filter(p =>
        !p.initiatedAt || new Date(p.initiatedAt) >= startDate
      );

      // Calculate financial metrics
      let totalPayouts = 0;
      let pendingPayouts = 0;
      let completedPayouts = 0;
      let disputedPaymentsAmt = 0;
      let platformFees = 0;
      let processingFees = 0;

      for (const payment of filteredPayments) {
        const platform = Number(payment.platformFeeAmount || 0);
        const processing = Number(payment.stripeFeeAmount || 0);
        const net = Number(payment.netAmount || 0);

        totalPayouts += net;
        platformFees += platform;
        processingFees += processing;

        if (payment.status === 'pending' || payment.status === 'processing') {
          pendingPayouts += net;
        } else if (payment.status === 'completed') {
          completedPayouts += net;
        } else if (payment.status === 'failed') {
          disputedPaymentsAmt += net;
        }
      }

      // Get offers for listing fees
      const allOffers = await storage.getOffers({});
      const filteredOffers = allOffers.filter((o: any) =>
        !o.createdAt || new Date(o.createdAt) >= startDate
      );
      const listingFees = filteredOffers.reduce((sum: number, o: any) => sum + Number(o.listingFee || 0), 0);

      const totalRevenue = listingFees + platformFees + processingFees;

      // Calculate growth (compare to previous period)
      const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
      const previousPayments = allPayments.filter(p =>
        p.initiatedAt && new Date(p.initiatedAt) >= previousStartDate && new Date(p.initiatedAt) < startDate
      );
      const previousRevenue = previousPayments.reduce((sum, p) =>
        sum + Number(p.platformFeeAmount || 0) + Number(p.stripeFeeAmount || 0), 0);
      const revenueGrowth = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

      // Get applications data directly from db
      const allApplications = await db.select().from(applications);
      const filteredApplications = allApplications.filter(a =>
        !a.createdAt || new Date(a.createdAt) >= startDate
      );

      // Get analytics data for clicks and conversions
      const allAnalytics = await db.select().from(analytics);
      const filteredAnalytics = allAnalytics.filter(a =>
        !a.createdAt || new Date(a.createdAt) >= startDate
      );
      const totalClicks = filteredAnalytics.reduce((sum, a) => sum + (a.clicks || 0), 0);
      const totalConversions = filteredAnalytics.reduce((sum, a) => sum + (a.conversions || 0), 0);
      const averageConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

      // Group applications by status
      const applicationsByStatus = ['pending', 'approved', 'active', 'paused', 'completed', 'rejected'].map(status => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count: filteredApplications.filter(a => a.status === status).length,
      })).filter(s => s.count > 0);

      // Get niches data (use primaryNiche)
      const nicheMap = new Map<string, number>();
      for (const offer of filteredOffers) {
        const primaryNiche = (offer as any).primaryNiche;
        if (primaryNiche) {
          nicheMap.set(primaryNiche, (nicheMap.get(primaryNiche) || 0) + 1);
        }
      }
      const offersByNiche = Array.from(nicheMap.entries())
        .map(([niche, count]) => ({ niche, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate revenue by period (group by week/day)
      const revenueByPeriod: Array<{ period: string; listingFees: number; platformFees: number; processingFees: number; total: number }> = [];
      const periodMap = new Map<string, { listingFees: number; platformFees: number; processingFees: number }>();

      for (const payment of filteredPayments) {
        const date = payment.initiatedAt ? new Date(payment.initiatedAt) : new Date();
        const periodKey = date.toISOString().split('T')[0];
        const existing = periodMap.get(periodKey) || { listingFees: 0, platformFees: 0, processingFees: 0 };
        existing.platformFees += Number(payment.platformFeeAmount || 0);
        existing.processingFees += Number(payment.stripeFeeAmount || 0);
        periodMap.set(periodKey, existing);
      }

      for (const offer of filteredOffers) {
        const date = offer.createdAt ? new Date(offer.createdAt) : new Date();
        const periodKey = date.toISOString().split('T')[0];
        const existing = periodMap.get(periodKey) || { listingFees: 0, platformFees: 0, processingFees: 0 };
        existing.listingFees += Number(offer.listingFee || 0);
        periodMap.set(periodKey, existing);
      }

      const sortedPeriods = Array.from(periodMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [period, data] of sortedPeriods.slice(-14)) {
        revenueByPeriod.push({
          period: new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          listingFees: data.listingFees,
          platformFees: data.platformFees,
          processingFees: data.processingFees,
          total: data.listingFees + data.platformFees + data.processingFees,
        });
      }

      // User growth by period
      const userGrowthMap = new Map<string, { creators: number; companies: number; total: number }>();
      for (const user of allUsers) {
        if (!user.createdAt || new Date(user.createdAt) < startDate) continue;
        const date = new Date(user.createdAt);
        const periodKey = date.toISOString().split('T')[0];
        const existing = userGrowthMap.get(periodKey) || { creators: 0, companies: 0, total: 0 };
        if (user.role === 'creator') existing.creators++;
        else if (user.role === 'company') existing.companies++;
        existing.total++;
        userGrowthMap.set(periodKey, existing);
      }

      const userGrowth = Array.from(userGrowthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([period, data]) => ({
          period: new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...data,
        }));

      // Get top creators by earnings
      const creatorEarnings = new Map<string, { earnings: number; clicks: number; conversions: number }>();
      for (const analytic of filteredAnalytics) {
        if (!analytic.creatorId) continue;
        const existing = creatorEarnings.get(analytic.creatorId) || { earnings: 0, clicks: 0, conversions: 0 };
        existing.earnings += Number(analytic.earnings || 0);
        existing.clicks += analytic.clicks || 0;
        existing.conversions += analytic.conversions || 0;
        creatorEarnings.set(analytic.creatorId, existing);
      }

      const topCreators = await Promise.all(
        Array.from(creatorEarnings.entries())
          .sort((a, b) => b[1].earnings - a[1].earnings)
          .slice(0, 10)
          .map(async ([creatorId, data]) => {
            const user = await storage.getUserById(creatorId);
            return {
              id: creatorId,
              name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
              email: user?.email || '',
              earnings: data.earnings,
              clicks: data.clicks,
              conversions: data.conversions,
            };
          })
      );

      // Get top companies by spend
      const companySpend = new Map<string, { spend: number; offers: number; creators: number }>();
      for (const offer of filteredOffers) {
        if (!offer.companyId) continue;
        const existing = companySpend.get(offer.companyId) || { spend: 0, offers: 0, creators: 0 };
        existing.offers++;
        companySpend.set(offer.companyId, existing);
      }

      for (const payment of filteredPayments) {
        if (!payment.companyId) continue;
        const existing = companySpend.get(payment.companyId) || { spend: 0, offers: 0, creators: 0 };
        existing.spend += Number(payment.grossAmount || 0);
        companySpend.set(payment.companyId, existing);
      }

      // Count unique creators per company
      for (const app of filteredApplications) {
        const offer = allOffers.find(o => o.id === app.offerId);
        if (!offer?.companyId) continue;
        const existing = companySpend.get(offer.companyId) || { spend: 0, offers: 0, creators: 0 };
        existing.creators++;
        companySpend.set(offer.companyId, existing);
      }

      const topCompanies = await Promise.all(
        Array.from(companySpend.entries())
          .sort((a, b) => b[1].spend - a[1].spend)
          .slice(0, 10)
          .map(async ([companyId, data]) => {
            const profile = await storage.getCompanyProfileById(companyId);
            return {
              id: companyId,
              name: profile?.legalName || profile?.tradeName || 'Unknown',
              offers: data.offers,
              spend: data.spend,
              creators: data.creators,
            };
          })
      );

      // Count active users
      const activeApplications = allApplications.filter(a => a.status === 'active' || a.status === 'approved');
      const activeCreatorIds = new Set(activeApplications.map(a => a.creatorId).filter(Boolean));
      const activeCompanyIds = new Set(filteredOffers.filter((o: any) => o.status === 'approved').map((o: any) => o.companyId).filter(Boolean));

      // Get pending companies count
      const pendingCompanyProfiles = await db.select().from(companyProfiles);
      const pendingCompaniesCount = pendingCompanyProfiles.filter((c: any) => c.verificationStatus === 'pending').length;

      // Get suspended users (those without active status)
      const suspendedUsersCount = allUsers.filter((u: any) => u.isSuspended).length;

      const response = {
        financial: {
          totalRevenue,
          listingFees,
          platformFees,
          processingFees,
          totalPayouts,
          pendingPayouts,
          completedPayouts,
          disputedPayments: disputedPaymentsAmt,
          revenueGrowth,
          payoutGrowth: 0,
          revenueByPeriod,
          payoutsByPeriod: [],
          revenueBySource: [
            { source: 'Listing Fees', amount: listingFees },
            { source: 'Platform Fees (4%)', amount: platformFees },
            { source: 'Processing Fees (3%)', amount: processingFees },
          ].filter(s => s.amount > 0),
        },
        users: {
          totalUsers: allUsers.length,
          totalCreators: creators.length,
          totalCompanies: companies.length,
          totalAdmins: admins.length,
          newUsersThisWeek: newCreatorsThisWeek + newCompaniesThisWeek,
          newCreatorsThisWeek,
          newCompaniesThisWeek,
          activeCreators: activeCreatorIds.size,
          activeCompanies: activeCompanyIds.size,
          pendingCompanies: pendingCompaniesCount,
          suspendedUsers: suspendedUsersCount,
          userGrowth,
          topCreators,
          topCompanies,
        },
        platform: {
          totalOffers: allOffers.length,
          activeOffers: allOffers.filter((o: any) => o.status === 'approved').length,
          pendingOffers: allOffers.filter((o: any) => o.status === 'pending_review').length,
          totalApplications: filteredApplications.length,
          totalConversions,
          totalClicks,
          averageConversionRate,
          offersByNiche,
          applicationsByStatus,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('[Admin Analytics Error]:', error);
      res.status(500).send(error.message);
    }
  });

  // Notify admins about existing pending offers and payments (admin only)
  app.post("/api/admin/notify-pending-items", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      console.log('[Admin] Sending notifications for pending items...');

      let notificationCount = 0;
      const adminUsers = await storage.getUsersByRole('admin');

      // Notify about pending offers
      const pendingOffers = await storage.getPendingOffers();
      for (const offer of pendingOffers) {
        const companyProfile = await storage.getCompanyProfileById(offer.companyId);

        for (const admin of adminUsers) {
          await notificationService.sendNotification(
            admin.id,
            'new_application',
            'Offer Pending Review',
            `${companyProfile?.legalName || companyProfile?.tradeName || 'A company'} has an offer "${offer.title}" pending review.`,
            {
              userName: admin.firstName || admin.username,
              companyName: companyProfile?.legalName || companyProfile?.tradeName || '',
              offerTitle: offer.title,
              offerId: offer.id,
            }
          );
          notificationCount++;
        }
      }

      // Notify about pending payments
      const pendingPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.status, 'pending'));

      for (const payment of pendingPayments) {
        const creator = await storage.getUserById(payment.creatorId);
        const application = payment.applicationId
          ? await storage.getApplication(payment.applicationId)
          : null;
        const offer = application?.offerId
          ? await storage.getOffer(application.offerId)
          : null;

        for (const admin of adminUsers) {
          await notificationService.sendNotification(
            admin.id,
            'payment_pending',
            'Payment Ready for Processing',
            `A payment of $${(Number(payment.netAmount) / 100).toFixed(2)} for creator ${creator?.username || 'Unknown'} is ready for processing.`,
            {
              userName: admin.firstName || admin.username,
              offerTitle: offer?.title || 'Unknown Offer',
              amount: `$${(Number(payment.netAmount) / 100).toFixed(2)}`,
              paymentId: payment.id,
            }
          );
          notificationCount++;
        }
      }

      console.log(`[Admin] Sent ${notificationCount} notifications for ${pendingOffers.length} pending offers and ${pendingPayments.length} pending payments`);
      res.json({
        success: true,
        notificationsSent: notificationCount,
        pendingOffers: pendingOffers.length,
        pendingPayments: pendingPayments.length
      });
    } catch (error: any) {
      console.error('[Admin] Error sending pending item notifications:', error);
      res.status(500).send(error.message);
    }
  });

  // Fix tracking codes for existing approved applications (admin only)
  app.post("/api/admin/fix-tracking-codes", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      console.log('[Admin] Starting tracking code fix...');

      // Get all approved applications
      const allApprovedApplications = await db
        .select()
        .from(applications)
        .where(eq(applications.status, 'approved'));

      let fixed = 0;
      let skipped = 0;

      for (const application of allApprovedApplications) {
        // Check if tracking code is missing or invalid
        if (!application.trackingCode || !application.trackingLink) {
          console.log(`[Admin] Fixing tracking code for application ${application.id}`);

          // Generate new tracking code
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

          fixed++;
        } else {
          skipped++;
        }
      }

      console.log(`[Admin] Tracking code fix complete. Fixed: ${fixed}, Skipped: ${skipped}`);
      res.json({
        success: true,
        fixed,
        skipped,
        total: allApprovedApplications.length,
      });
    } catch (error: any) {
      console.error('[Admin] Error fixing tracking codes:', error);
      res.status(500).send(error.message);
    }
  });

  // Get pending companies (legacy endpoint for backward compatibility)
  app.get("/api/admin/companies", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companies = await storage.getPendingCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // DEBUG: Check if company ID exists in database
  app.get("/api/admin/companies/debug/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      console.log(`[DEBUG] Checking if company ${companyId} exists in database`);

      // Raw query to check company_profiles table
      const { db } = await import('./db');
      const { companyProfiles } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const rawResult = await db.select().from(companyProfiles).where(eq(companyProfiles.id, companyId));
      console.log(`[DEBUG] Raw query result:`, rawResult);

      // Also check if any company exists with similar ID
      const allCompanies = await db.select().from(companyProfiles);
      console.log(`[DEBUG] Total companies in DB: ${allCompanies.length}`);
      console.log(`[DEBUG] All company IDs: ${allCompanies.map(c => c.id).join(', ')}`);

      res.json({
        requestedId: companyId,
        found: rawResult.length > 0,
        result: rawResult[0] || null,
        totalCompanies: allCompanies.length,
        allIds: allCompanies.map(c => c.id)
      });
    } catch (error: any) {
      console.error(`[DEBUG] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all companies with filters (new comprehensive endpoint)
  app.get("/api/admin/companies/all", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { status, industry, startDate, endDate } = req.query;
      const filters: any = {};

      if (status) filters.status = status;
      if (industry) filters.industry = industry;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const companies = await storage.getAllCompanies(filters);
      console.log(`[Admin] Found ${companies.length} companies. IDs: ${companies.map(c => c.id).join(', ')}`);
      res.json(companies);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get all companies with their risk assessments (for dashboard and company management)
  // NOTE: This route must be defined BEFORE /api/admin/companies/:id to avoid route conflict
  app.get("/api/admin/companies/risk-assessments", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      // Get all approved companies
      const approvedCompanies = await storage.getAllCompanies({ status: 'approved' });

      // Calculate risk assessment for each company
      const companiesWithRisk = await Promise.all(
        approvedCompanies.map(async (company: any) => {
          const companyPayments = await storage.getPaymentsByCompany(company.id);

          // Calculate risk indicators (simplified version of the detailed endpoint)
          const disputedPayments = companyPayments.filter(p =>
            p.description?.toLowerCase().includes('disputed')
          );
          const disputeRate = companyPayments.length > 0
            ? (disputedPayments.length / companyPayments.length) * 100
            : 0;

          const failedPayments = companyPayments.filter(p =>
            p.status === 'failed' && !p.description?.toLowerCase().includes('disputed')
          );
          const failureRate = companyPayments.length > 0
            ? (failedPayments.length / companyPayments.length) * 100
            : 0;

          const refundedPayments = companyPayments.filter(p => p.status === 'refunded');
          const refundRate = companyPayments.length > 0
            ? (refundedPayments.length / companyPayments.length) * 100
            : 0;

          const completedPayments = companyPayments.filter(p => p.status === 'completed');

          // Calculate risk score
          let riskScore = 50; // Start neutral
          const riskIndicators: string[] = [];

          // High dispute rate
          if (disputeRate >= 10) {
            riskScore += 15;
            riskIndicators.push(`High dispute rate (${disputeRate.toFixed(1)}%)`);
          }

          // High failure rate
          if (failedPayments.length >= 3 || failureRate >= 15) {
            riskScore += 15;
            riskIndicators.push(`High payment failure rate (${failedPayments.length} failed)`);
          }

          // High refund rate
          if (refundRate >= 20) {
            riskScore += 15;
            riskIndicators.push(`High refund rate (${refundRate.toFixed(1)}%)`);
          }

          // Website not verified
          if (!company.websiteVerified) {
            riskScore += 15;
            riskIndicators.push('Website not verified');
          }

          // Positive indicators
          if (completedPayments.length >= 50 && disputeRate < 2 && failureRate < 5) {
            riskScore -= 10;
          }

          riskScore = Math.max(0, Math.min(100, riskScore));

          const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

          return {
            id: company.id,
            legalName: company.legalName,
            tradeName: company.tradeName,
            industry: company.industry,
            websiteUrl: company.websiteUrl,
            websiteVerified: company.websiteVerified,
            customPlatformFeePercentage: company.customPlatformFeePercentage,
            status: company.status,
            createdAt: company.createdAt,
            riskScore,
            riskLevel,
            riskIndicators,
            stats: {
              totalPayments: companyPayments.length,
              completedPayments: completedPayments.length,
              failedPayments: failedPayments.length,
              disputedPayments: disputedPayments.length,
              refundedPayments: refundedPayments.length,
            },
          };
        })
      );

      // Sort by risk score (highest first)
      companiesWithRisk.sort((a: any, b: any) => b.riskScore - a.riskScore);

      res.json({
        companies: companiesWithRisk,
        summary: {
          total: companiesWithRisk.length,
          highRisk: companiesWithRisk.filter((c: any) => c.riskLevel === 'high').length,
          mediumRisk: companiesWithRisk.filter((c: any) => c.riskLevel === 'medium').length,
          lowRisk: companiesWithRisk.filter((c: any) => c.riskLevel === 'low').length,
        },
      });
    } catch (error: any) {
      console.error('[get-companies-risk-assessments] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get individual company details
  app.get("/api/admin/companies/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      console.log(`[Admin] Fetching company with ID: ${companyId}`);
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        console.log(`[Admin] Company not found with ID: ${companyId}`);
        return res.status(404).send("Company not found");
      }
      console.log(`[Admin] Company found: ${company.legalName} (ID: ${company.id})`);
      res.json(company);
    } catch (error: any) {
      console.error(`[Admin] Error fetching company ${req.params.id}:`, error);
      res.status(500).send(error.message);
    }
  });

  // Get company offers
  app.get("/api/admin/companies/:id/offers", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offers = await storage.getCompanyOffers(req.params.id);
      res.json(offers);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get company payments
  app.get("/api/admin/companies/:id/payments", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const payments = await storage.getCompanyPayments(req.params.id);
      res.json(payments);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get company creator relationships
  app.get("/api/admin/companies/:id/creators", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const relationships = await storage.getCompanyCreatorRelationships(req.params.id);
      res.json(relationships);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Approve company
  app.post("/api/admin/companies/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const company = await storage.approveCompany(req.params.id);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Reject company
  app.post("/api/admin/companies/:id/reject", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { reason } = req.body;
      const company = await storage.rejectCompany(req.params.id, reason);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Suspend company
  app.post("/api/admin/companies/:id/suspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const company = await storage.suspendCompany(req.params.id);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Unsuspend company
  app.post("/api/admin/companies/:id/unsuspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const company = await storage.unsuspendCompany(req.params.id);
      res.json(company);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Website Verification - Generate verification token
  app.post("/api/admin/companies/:id/generate-verification-token", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const company = await storage.generateWebsiteVerificationToken(companyId);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json({
        success: true,
        verificationToken: company.websiteVerificationToken,
        instructions: {
          meta_tag: `Add this meta tag to the <head> section of your website's homepage:\n<meta name="affiliatexchange-site-verification" content="${company.websiteVerificationToken}">`,
          dns_txt: `Add this TXT record to your domain's DNS settings:\n${company.websiteVerificationToken}`,
        },
      });
    } catch (error: any) {
      console.error('[generate-verification-token] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Website Verification - Verify website ownership
  app.post("/api/admin/companies/:id/verify-website", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const { method } = req.body;

      if (!method || !['meta_tag', 'dns_txt'].includes(method)) {
        return res.status(400).json({ error: "Invalid verification method. Use 'meta_tag' or 'dns_txt'." });
      }

      const result = await storage.verifyWebsiteOwnership(companyId, method);

      if (result.success) {
        res.json({
          success: true,
          message: `Website verified successfully via ${method === 'meta_tag' ? 'Meta Tag' : 'DNS TXT Record'}`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error('[verify-website] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Website Verification - Reset verification status (admin)
  app.post("/api/admin/companies/:id/reset-website-verification", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const company = await storage.updateWebsiteVerificationStatus(companyId, false);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json({
        success: true,
        message: "Website verification status has been reset",
      });
    } catch (error: any) {
      console.error('[reset-website-verification] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Per-Company Platform Fee Override Endpoints (Section 4.3.H)
  // ============================================================

  // Get company's custom platform fee percentage
  app.get("/api/admin/companies/:id/fee", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const company = await storage.getCompanyById(companyId);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const customFee = company.customPlatformFeePercentage;
      const hasCustomFee = customFee !== null && customFee !== undefined;

      res.json({
        companyId: company.id,
        companyName: company.legalName,
        customPlatformFeePercentage: hasCustomFee ? parseFloat(customFee.toString()) : null,
        customPlatformFeeDisplay: hasCustomFee ? `${(parseFloat(customFee.toString()) * 100).toFixed(2)}%` : null,
        defaultPlatformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        defaultPlatformFeeDisplay: `${(DEFAULT_PLATFORM_FEE_PERCENTAGE * 100)}%`,
        processingFeePercentage: STRIPE_PROCESSING_FEE_PERCENTAGE,
        processingFeeDisplay: `${(STRIPE_PROCESSING_FEE_PERCENTAGE * 100)}%`,
        effectivePlatformFee: hasCustomFee ? parseFloat(customFee.toString()) : DEFAULT_PLATFORM_FEE_PERCENTAGE,
        effectiveTotalFee: (hasCustomFee ? parseFloat(customFee.toString()) : DEFAULT_PLATFORM_FEE_PERCENTAGE) + STRIPE_PROCESSING_FEE_PERCENTAGE,
        isUsingCustomFee: hasCustomFee,
      });
    } catch (error: any) {
      console.error('[get-company-fee] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update company's custom platform fee percentage
  app.put("/api/admin/companies/:id/fee", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const { platformFeePercentage } = req.body;

      // Validate input
      if (platformFeePercentage === undefined || platformFeePercentage === null) {
        return res.status(400).json({ error: "platformFeePercentage is required" });
      }

      const feeValue = parseFloat(platformFeePercentage);

      // Validate fee percentage is between 0% and 50%
      if (isNaN(feeValue) || feeValue < 0 || feeValue > 0.5) {
        return res.status(400).json({
          error: "Platform fee percentage must be between 0 and 0.5 (0% to 50%)",
          received: platformFeePercentage,
        });
      }

      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Update company profile with custom fee
      const updatedCompany = await storage.updateCompanyProfileById(companyId, {
        customPlatformFeePercentage: feeValue.toFixed(4),
      });

      // Log audit event
      const adminUser = req.user as any;
      await storage.createAuditLog({
        userId: adminUser.id,
        action: 'update_company_fee',
        entityType: 'company',
        entityId: companyId,
        reason: `Updated platform fee for ${company.legalName} to ${(feeValue * 100).toFixed(2)}%`,
        changes: {
          previousFee: company.customPlatformFeePercentage,
          newFee: feeValue,
          companyName: company.legalName,
        },
      });

      console.log(`[Admin] Updated platform fee for company ${companyId} (${company.legalName}) to ${(feeValue * 100).toFixed(2)}%`);

      res.json({
        success: true,
        message: `Platform fee updated to ${(feeValue * 100).toFixed(2)}% for ${company.legalName}`,
        companyId: companyId,
        customPlatformFeePercentage: feeValue,
        customPlatformFeeDisplay: `${(feeValue * 100).toFixed(2)}%`,
        effectiveTotalFee: feeValue + STRIPE_PROCESSING_FEE_PERCENTAGE,
      });
    } catch (error: any) {
      console.error('[update-company-fee] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove company's custom platform fee (revert to default)
  app.delete("/api/admin/companies/:id/fee", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;

      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const previousFee = company.customPlatformFeePercentage;

      // Update company profile to remove custom fee
      await storage.updateCompanyProfileById(companyId, {
        customPlatformFeePercentage: null,
      });

      // Log audit event
      const adminUser = req.user as any;
      await storage.createAuditLog({
        userId: adminUser.id,
        action: 'remove_company_fee',
        entityType: 'company',
        entityId: companyId,
        reason: `Removed custom platform fee for ${company.legalName}, reverting to default ${(DEFAULT_PLATFORM_FEE_PERCENTAGE * 100)}%`,
        changes: {
          previousFee: previousFee,
          companyName: company.legalName,
        },
      });

      console.log(`[Admin] Removed custom platform fee for company ${companyId} (${company.legalName}), reverted to default`);

      res.json({
        success: true,
        message: `Custom platform fee removed for ${company.legalName}. Now using default ${(DEFAULT_PLATFORM_FEE_PERCENTAGE * 100)}%`,
        companyId: companyId,
        defaultPlatformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        defaultPlatformFeeDisplay: `${(DEFAULT_PLATFORM_FEE_PERCENTAGE * 100)}%`,
        effectiveTotalFee: DEFAULT_PLATFORM_FEE_PERCENTAGE + STRIPE_PROCESSING_FEE_PERCENTAGE,
      });
    } catch (error: any) {
      console.error('[remove-company-fee] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all companies with custom fees (for admin dashboard)
  app.get("/api/admin/companies-with-custom-fees", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companies = await storage.getCompaniesWithCustomFees();

      res.json({
        count: companies.length,
        defaultPlatformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        defaultPlatformFeeDisplay: `${(DEFAULT_PLATFORM_FEE_PERCENTAGE * 100)}%`,
        companies: companies.map(company => ({
          id: company.id,
          legalName: company.legalName,
          tradeName: company.tradeName,
          customPlatformFeePercentage: company.customPlatformFeePercentage ? parseFloat(company.customPlatformFeePercentage.toString()) : null,
          customPlatformFeeDisplay: company.customPlatformFeePercentage ? `${(parseFloat(company.customPlatformFeePercentage.toString()) * 100).toFixed(2)}%` : null,
          effectiveTotalFee: company.customPlatformFeePercentage
            ? parseFloat(company.customPlatformFeePercentage.toString()) + STRIPE_PROCESSING_FEE_PERCENTAGE
            : DEFAULT_PLATFORM_FEE_PERCENTAGE + STRIPE_PROCESSING_FEE_PERCENTAGE,
        })),
      });
    } catch (error: any) {
      console.error('[get-companies-with-custom-fees] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get company risk indicators for fee adjustment decisions
  app.get("/api/admin/companies/:id/risk-indicators", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const companyId = req.params.id;
      const company = await storage.getCompanyById(companyId);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get company payments to analyze
      const companyPayments = await storage.getPaymentsByCompany(companyId);

      // Calculate risk indicators
      const indicators: Array<{
        type: 'warning' | 'info' | 'success';
        category: string;
        title: string;
        description: string;
        recommendation: 'increase' | 'decrease' | 'neutral';
      }> = [];

      // 1. Check dispute rate
      const disputedPayments = companyPayments.filter(p =>
        p.description?.toLowerCase().includes('disputed')
      );
      const disputeRate = companyPayments.length > 0
        ? (disputedPayments.length / companyPayments.length) * 100
        : 0;

      if (disputedPayments.length > 0) {
        if (disputeRate >= 10) {
          indicators.push({
            type: 'warning',
            category: 'Disputes',
            title: 'High Dispute Rate',
            description: `${disputedPayments.length} disputed payments (${disputeRate.toFixed(1)}% of total). High dispute rates increase platform risk.`,
            recommendation: 'increase',
          });
        } else if (disputeRate >= 5) {
          indicators.push({
            type: 'info',
            category: 'Disputes',
            title: 'Moderate Dispute Rate',
            description: `${disputedPayments.length} disputed payments (${disputeRate.toFixed(1)}% of total). Monitor for potential issues.`,
            recommendation: 'neutral',
          });
        }
      }

      // 2. Check failed payments
      const failedPayments = companyPayments.filter(p =>
        p.status === 'failed' && !p.description?.toLowerCase().includes('disputed')
      );
      const failureRate = companyPayments.length > 0
        ? (failedPayments.length / companyPayments.length) * 100
        : 0;

      if (failedPayments.length >= 3 || failureRate >= 15) {
        indicators.push({
          type: 'warning',
          category: 'Payment Issues',
          title: 'High Payment Failure Rate',
          description: `${failedPayments.length} failed payments (${failureRate.toFixed(1)}% failure rate). May indicate payment reliability issues.`,
          recommendation: 'increase',
        });
      }

      // 3. Check refund rate
      const refundedPayments = companyPayments.filter(p => p.status === 'refunded');
      const refundRate = companyPayments.length > 0
        ? (refundedPayments.length / companyPayments.length) * 100
        : 0;

      if (refundRate >= 20) {
        indicators.push({
          type: 'warning',
          category: 'Refunds',
          title: 'High Refund Rate',
          description: `${refundedPayments.length} refunded payments (${refundRate.toFixed(1)}% of total). High refund rates may indicate issues.`,
          recommendation: 'increase',
        });
      }

      // 4. Check website verification status
      if (!company.websiteVerified) {
        indicators.push({
          type: 'warning',
          category: 'Verification',
          title: 'Website Not Verified',
          description: 'Company website has not been verified. Unverified companies pose higher risk.',
          recommendation: 'increase',
        });
      } else {
        indicators.push({
          type: 'success',
          category: 'Verification',
          title: 'Website Verified',
          description: `Website verified on ${company.websiteVerifiedAt ? new Date(company.websiteVerifiedAt).toLocaleDateString() : 'N/A'}`,
          recommendation: 'neutral',
        });
      }

      // 5. Check account age (new accounts are higher risk)
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (accountAgeDays < 30) {
        indicators.push({
          type: 'info',
          category: 'Account Age',
          title: 'New Account',
          description: `Account created ${accountAgeDays} days ago. New accounts may require closer monitoring.`,
          recommendation: 'neutral',
        });
      } else if (accountAgeDays >= 180) {
        indicators.push({
          type: 'success',
          category: 'Account Age',
          title: 'Established Account',
          description: `Account is ${Math.floor(accountAgeDays / 30)} months old with established history.`,
          recommendation: 'neutral',
        });
      }

      // 6. Check payment volume (high volume trusted partners may warrant lower fees)
      const completedPayments = companyPayments.filter(p => p.status === 'completed');
      const totalVolume = completedPayments.reduce((sum, p) => sum + parseFloat(p.grossAmount?.toString() || '0'), 0);

      if (completedPayments.length >= 50 && disputeRate < 2 && failureRate < 5) {
        indicators.push({
          type: 'success',
          category: 'Payment History',
          title: 'High-Volume Trusted Partner',
          description: `${completedPayments.length} successful payments totaling $${totalVolume.toFixed(2)} with low dispute/failure rates. Consider reduced fees.`,
          recommendation: 'decrease',
        });
      } else if (completedPayments.length >= 20 && disputeRate < 5) {
        indicators.push({
          type: 'success',
          category: 'Payment History',
          title: 'Good Payment History',
          description: `${completedPayments.length} successful payments with acceptable dispute rate.`,
          recommendation: 'neutral',
        });
      } else if (companyPayments.length === 0) {
        indicators.push({
          type: 'info',
          category: 'Payment History',
          title: 'No Payment History',
          description: 'Company has no payment history yet. Default fee recommended until track record is established.',
          recommendation: 'neutral',
        });
      }

      // Calculate overall risk score (0-100)
      let riskScore = 50; // Start neutral
      indicators.forEach(ind => {
        if (ind.recommendation === 'increase') riskScore += 15;
        if (ind.recommendation === 'decrease') riskScore -= 10;
      });
      riskScore = Math.max(0, Math.min(100, riskScore));

      // Generate overall recommendation
      const increaseIndicators = indicators.filter(i => i.recommendation === 'increase').length;
      const decreaseIndicators = indicators.filter(i => i.recommendation === 'decrease').length;

      let overallRecommendation: 'increase' | 'decrease' | 'maintain' = 'maintain';
      let recommendationText = 'Current fee appears appropriate based on company profile.';

      if (increaseIndicators >= 2) {
        overallRecommendation = 'increase';
        recommendationText = 'Multiple risk indicators suggest considering a fee increase.';
      } else if (decreaseIndicators > 0 && increaseIndicators === 0) {
        overallRecommendation = 'decrease';
        recommendationText = 'Strong payment history suggests this company may qualify for reduced fees.';
      }

      res.json({
        companyId: company.id,
        companyName: company.legalName,
        riskScore,
        riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
        overallRecommendation,
        recommendationText,
        indicators,
        stats: {
          totalPayments: companyPayments.length,
          completedPayments: completedPayments.length,
          failedPayments: failedPayments.length,
          refundedPayments: refundedPayments.length,
          disputedPayments: disputedPayments.length,
          totalVolume: totalVolume.toFixed(2),
          accountAgeDays,
        },
      });
    } catch (error: any) {
      console.error('[get-company-risk-indicators] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check and notify admins about high-risk companies
  app.post("/api/admin/check-high-risk-companies", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      // Get all approved companies
      const approvedCompanies = await storage.getAllCompanies({ status: 'approved' });

      // Get all admin users
      const allUsers = await storage.getAllUsers();
      const adminUsers = allUsers.filter(u => u.role === 'admin');

      if (adminUsers.length === 0) {
        return res.json({ message: 'No admin users found', notificationsSent: 0 });
      }

      let notificationsSent = 0;
      const highRiskCompanies: Array<{ id: string; legalName: string; riskScore: number; riskIndicators: string[] }> = [];

      // Calculate risk for each company
      for (const company of approvedCompanies as any[]) {
        const companyPayments = await storage.getPaymentsByCompany(company.id);

        // Calculate risk indicators
        const disputedPayments = companyPayments.filter(p =>
          p.description?.toLowerCase().includes('disputed')
        );
        const disputeRate = companyPayments.length > 0
          ? (disputedPayments.length / companyPayments.length) * 100
          : 0;

        const failedPayments = companyPayments.filter(p =>
          p.status === 'failed' && !p.description?.toLowerCase().includes('disputed')
        );
        const failureRate = companyPayments.length > 0
          ? (failedPayments.length / companyPayments.length) * 100
          : 0;

        const refundedPayments = companyPayments.filter(p => p.status === 'refunded');
        const refundRate = companyPayments.length > 0
          ? (refundedPayments.length / companyPayments.length) * 100
          : 0;

        const completedPayments = companyPayments.filter(p => p.status === 'completed');

        // Calculate risk score
        let riskScore = 50;
        const riskIndicators: string[] = [];

        if (disputeRate >= 10) {
          riskScore += 15;
          riskIndicators.push(`High dispute rate (${disputeRate.toFixed(1)}%)`);
        }

        if (failedPayments.length >= 3 || failureRate >= 15) {
          riskScore += 15;
          riskIndicators.push(`High payment failure rate (${failedPayments.length} failed)`);
        }

        if (refundRate >= 20) {
          riskScore += 15;
          riskIndicators.push(`High refund rate (${refundRate.toFixed(1)}%)`);
        }

        if (!company.websiteVerified) {
          riskScore += 15;
          riskIndicators.push('Website not verified');
        }

        if (completedPayments.length >= 50 && disputeRate < 2 && failureRate < 5) {
          riskScore -= 10;
        }

        riskScore = Math.max(0, Math.min(100, riskScore));

        // Check if company is high risk (score >= 70)
        if (riskScore >= 70) {
          highRiskCompanies.push({
            id: company.id,
            legalName: company.legalName,
            riskScore,
            riskIndicators,
          });
        }
      }

      // Send notifications to all admins for each high-risk company
      for (const company of highRiskCompanies) {
        for (const admin of adminUsers) {
          // Check if a notification was already sent recently (within 24 hours)
          const recentNotifications = await storage.getNotifications(admin.id, 100);
          const alreadyNotified = recentNotifications.some((n: any) =>
            n.type === 'high_risk_company' &&
            (n.metadata as any)?.companyId === company.id &&
            new Date(n.createdAt!).getTime() > Date.now() - 24 * 60 * 60 * 1000
          );

          if (!alreadyNotified) {
            await notificationService.sendNotification(
              admin.id,
              'high_risk_company',
              `High Risk Company: ${company.legalName}`,
              `${company.legalName} has been flagged as high risk (score: ${company.riskScore}/100). Consider reviewing their platform fee.`,
              {
                companyId: company.id,
                companyName: company.legalName,
                riskScore: company.riskScore,
                riskLevel: 'high',
                riskIndicators: company.riskIndicators,
                linkUrl: `/admin/companies/${company.id}`,
              }
            );
            notificationsSent++;
          }
        }
      }

      res.json({
        message: `Found ${highRiskCompanies.length} high-risk companies`,
        highRiskCount: highRiskCompanies.length,
        notificationsSent,
        companies: highRiskCompanies.map(c => ({
          id: c.id,
          name: c.legalName,
          riskScore: c.riskScore,
          indicators: c.riskIndicators,
        })),
      });
    } catch (error: any) {
      console.error('[check-high-risk-companies] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Company self-service - Get verification token (for company users)
  app.get("/api/company/website-verification", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const company = await storage.getCompanyProfile(userId);

      if (!company) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      res.json({
        websiteUrl: company.websiteUrl,
        websiteVerified: company.websiteVerified,
        websiteVerificationToken: company.websiteVerificationToken,
        websiteVerificationMethod: company.websiteVerificationMethod,
        websiteVerifiedAt: company.websiteVerifiedAt,
        instructions: company.websiteVerificationToken ? {
          meta_tag: `Add this meta tag to the <head> section of your website's homepage:\n<meta name="affiliatexchange-site-verification" content="${company.websiteVerificationToken}">`,
          dns_txt: `Add this TXT record to your domain's DNS settings:\n${company.websiteVerificationToken}`,
        } : null,
      });
    } catch (error: any) {
      console.error('[get-website-verification] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Company self-service - Generate verification token
  app.post("/api/company/generate-verification-token", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      let company = await storage.getCompanyProfile(userId);

      if (!company) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      if (!company.websiteUrl) {
        return res.status(400).json({ error: "Please add a website URL to your company profile first" });
      }

      company = await storage.generateWebsiteVerificationToken(company.id);

      res.json({
        success: true,
        verificationToken: company?.websiteVerificationToken,
        instructions: {
          meta_tag: `Add this meta tag to the <head> section of your website's homepage:\n<meta name="affiliatexchange-site-verification" content="${company?.websiteVerificationToken}">`,
          dns_txt: `Add this TXT record to your domain's DNS settings:\n${company?.websiteVerificationToken}`,
        },
      });
    } catch (error: any) {
      console.error('[company-generate-verification-token] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Company self-service - Request verification check
  app.post("/api/company/verify-website", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { method } = req.body;

      if (!method || !['meta_tag', 'dns_txt'].includes(method)) {
        return res.status(400).json({ error: "Invalid verification method. Use 'meta_tag' or 'dns_txt'." });
      }

      const company = await storage.getCompanyProfile(userId);

      if (!company) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const result = await storage.verifyWebsiteOwnership(company.id, method);

      if (result.success) {
        res.json({
          success: true,
          message: `Website verified successfully via ${method === 'meta_tag' ? 'Meta Tag' : 'DNS TXT Record'}`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error('[company-verify-website] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Offer Management
  app.get("/api/admin/offers", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { status, niche, commissionType } = req.query;
      const filters: any = {};

      // Only add filters if they're not "all" or empty
      if (status && status !== 'all') filters.status = status;
      if (niche && niche !== 'all') filters.niche = niche;
      if (commissionType && commissionType !== 'all') filters.commissionType = commissionType;

      const offers = await storage.getAllOffersForAdmin(filters);
      res.json(offers);
    } catch (error: any) {
      console.error('Error fetching admin offers:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/offers/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offerData = await storage.getOfferWithStats(req.params.id);
      if (!offerData.offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      res.json(offerData);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/offers/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.id);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Check if company has payment method configured
      const company = await storage.getCompanyProfileById(offer.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const paymentSettings = await storage.getPaymentSettings(company.userId);
      if (!paymentSettings || paymentSettings.length === 0) {
        return res.status(400).json({
          error: `Company "${company.legalName || company.tradeName}" does not have a payment method configured. Please ask them to add payment settings before approving this offer.`
        });
      }

      // Approve the offer
      const approvedOffer = await storage.approveOffer(req.params.id);
      if (!approvedOffer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Send notification to company
      await storage.createNotification({
        userId: company.userId,
        type: 'offer_approved',
        title: 'Offer Approved',
        message: `Your offer "${approvedOffer.title}" has been approved and is now live!`,
        metadata: { offerId: approvedOffer.id },
      });

      res.json(approvedOffer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/offers/:id/reject", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const offer = await storage.rejectOffer(req.params.id, reason);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Send notification to company
      const company = await storage.getCompanyProfileById(offer.companyId);
      if (company) {
        await storage.createNotification({
          userId: company.userId,
          type: 'offer_rejected',
          title: 'Offer Rejected',
          message: `Your offer "${offer.title}" has been rejected. Reason: ${reason}`,
          metadata: { offerId: offer.id, reason },
        });
      }

      res.json(offer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/offers/:id/request-edits", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ error: "Edit notes are required" });
      }

      const userId = (req.user as any)?.id || '';
      const offer = await storage.requestOfferEdits(req.params.id, notes, userId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Send notification to company
      const company = await storage.getCompanyProfileById(offer.companyId);
      if (company) {
        await storage.createNotification({
          userId: company.userId,
          type: 'offer_edit_requested',
          title: 'Edits Requested for Offer',
          message: `An admin has requested edits to your offer "${offer.title}". Please review the notes and make the necessary changes.`,
          metadata: { offerId: offer.id, notes },
        });
      }

      res.json(offer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/offers/:id/feature", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { featured } = req.body;
      if (typeof featured !== 'boolean') {
        return res.status(400).json({ error: "Featured status (boolean) is required" });
      }

      const offer = await storage.featureOfferOnHomepage(req.params.id, featured);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      res.json(offer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/offers/:id/remove", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const offer = await storage.removeOfferFromPlatform(req.params.id);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      // Send notification to company
      const company = await storage.getCompanyProfileById(offer.companyId);
      if (company) {
        await storage.createNotification({
          userId: company.userId,
          type: 'offer_removed',
          title: 'Offer Removed',
          message: `Your offer "${offer.title}" has been removed from the platform.`,
          metadata: { offerId: offer.id },
        });
      }

      res.json({ success: true, offer });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/offers/:id/listing-fee", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { fee } = req.body;
      if (fee === undefined || fee === null) {
        return res.status(400).json({ error: "Listing fee is required" });
      }

      const offer = await storage.adjustOfferListingFee(req.params.id, fee.toString());
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      res.json(offer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/creators", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creators = await storage.getCreatorsForAdmin();
      res.json(creators);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/suspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.suspendCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/unsuspend", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.unsuspendCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/creators/:id/ban", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const creator = await storage.banCreator(req.params.id);
      res.json({ success: true, creator });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Admin review routes
  app.get("/api/admin/reviews", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/reviews/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const validated = adminReviewUpdateSchema.parse(req.body);
      const review = await storage.updateReview(req.params.id, validated);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/hide", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const review = await storage.hideReview(req.params.id);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/unhide", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const review = await storage.unhideReview(req.params.id);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/reviews/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/note", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = adminNoteSchema.parse(req.body);
      const review = await storage.updateAdminNote(req.params.id, validated.note, userId);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/reviews/:id/approve", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const review = await storage.approveReview(req.params.id, userId);
      res.json(review);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/reviews/:id/respond", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const reviewId = req.params.id;
      const validated = adminResponseSchema.parse(req.body);

      // Verify the review exists
      const review = await storage.getReview(reviewId);
      if (!review) {
        return res.status(404).send("Review not found");
      }

      const updatedReview = await storage.respondToReview(reviewId, validated.response, userId);
      res.json(updatedReview);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).send(error.errors[0]?.message || "Invalid request");
      }
      res.status(500).send(error.message);
    }
  });

  // Content Moderation routes

  // Banned Keywords Management
  app.post("/api/admin/moderation/keywords", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertBannedKeywordSchema.parse(req.body);

      const [keyword] = await db.insert(bannedKeywords).values({
        ...validated,
        createdBy: userId,
      }).returning();

      res.json(keyword);
    } catch (error: any) {
      console.error('[Moderation] Error creating banned keyword:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/moderation/keywords", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const isActive = req.query.isActive as string | undefined;

      let query = db.select().from(bannedKeywords).$dynamic();

      if (category) {
        query = query.where(eq(bannedKeywords.category, category as any));
      }

      if (isActive !== undefined) {
        query = query.where(eq(bannedKeywords.isActive, isActive === 'true'));
      }

      const keywords = await query;
      res.json(keywords);
    } catch (error: any) {
      console.error('[Moderation] Error fetching banned keywords:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/moderation/keywords/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const validated = insertBannedKeywordSchema.parse(req.body);

      const [keyword] = await db
        .update(bannedKeywords)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(bannedKeywords.id, req.params.id))
        .returning();

      if (!keyword) {
        return res.status(404).send("Keyword not found");
      }

      res.json(keyword);
    } catch (error: any) {
      console.error('[Moderation] Error updating banned keyword:', error);
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/moderation/keywords/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await db.delete(bannedKeywords).where(eq(bannedKeywords.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Moderation] Error deleting banned keyword:', error);
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/moderation/keywords/:id/toggle", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const keyword = await db.query.bannedKeywords.findFirst({
        where: eq(bannedKeywords.id, req.params.id),
      });

      if (!keyword) {
        return res.status(404).send("Keyword not found");
      }

      const [updated] = await db
        .update(bannedKeywords)
        .set({
          isActive: !keyword.isActive,
          updatedAt: new Date(),
        })
        .where(eq(bannedKeywords.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error('[Moderation] Error toggling banned keyword:', error);
      res.status(500).send(error.message);
    }
  });

  // Content Flags Management
  app.get("/api/admin/moderation/flags", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const contentType = req.query.contentType as string | undefined;

      let query = db.query.contentFlags.findMany({
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: (contentFlags, { desc }) => [desc(contentFlags.createdAt)],
      });

      let flags = await query;

      // Filter in memory since drizzle-orm query builder is limited
      if (status) {
        flags = flags.filter(f => f.status === status);
      }
      if (contentType) {
        flags = flags.filter(f => f.contentType === contentType);
      }

      res.json(flags);
    } catch (error: any) {
      console.error('[Moderation] Error fetching content flags:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/moderation/flags/pending", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const flags = await getPendingFlags();
      res.json(flags);
    } catch (error: any) {
      console.error('[Moderation] Error fetching pending flags:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/moderation/flags/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const flag = await db.query.contentFlags.findFirst({
        where: eq(contentFlags.id, req.params.id),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!flag) {
        return res.status(404).send("Content flag not found");
      }

      res.json(flag);
    } catch (error: any) {
      console.error('[Moderation] Error fetching content flag:', error);
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/moderation/flags/:id/review", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { status, adminNotes, actionTaken } = req.body;

      if (!status || !['reviewed', 'dismissed', 'action_taken'].includes(status)) {
        return res.status(400).send("Invalid status. Must be: reviewed, dismissed, or action_taken");
      }

      await reviewFlaggedContent(req.params.id, userId, status, adminNotes, actionTaken, storage);

      const flag = await db.query.contentFlags.findFirst({
        where: eq(contentFlags.id, req.params.id),
      });

      res.json(flag);
    } catch (error: any) {
      console.error('[Moderation] Error reviewing content flag:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/moderation/statistics", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const stats = await getFlagStatistics();
      res.json(stats);
    } catch (error: any) {
      console.error('[Moderation] Error fetching moderation statistics:', error);
      res.status(500).send(error.message);
    }
  });

  // Audit Log routes
  app.get("/api/admin/audit-logs", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;

      const logs = await storage.getAuditLogs({
        userId,
        action,
        entityType,
        entityId,
        limit,
        offset,
      });

      res.json(logs);
    } catch (error: any) {
      console.error('[Audit Logs] Error fetching logs:', error);
      res.status(500).send(error.message);
    }
  });

  // Platform Settings routes
  app.get("/api/admin/settings", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const settings = category
        ? await storage.getPlatformSettingsByCategory(category)
        : await storage.getAllPlatformSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('[Platform Settings] Error fetching settings:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/settings/:key", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const setting = await storage.getPlatformSetting(req.params.key);
      if (!setting) {
        return res.status(404).send("Setting not found");
      }
      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error fetching setting:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/settings/:key", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).send("Value is required");
      }

      const setting = await storage.updatePlatformSetting(req.params.key, value.toString(), userId);

      // Log the settings change
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.UPDATE_PLATFORM_SETTINGS,
        entityType: EntityTypes.PLATFORM_SETTINGS,
        entityId: req.params.key,
        changes: { value },
        reason: req.body.reason,
      }, req);

      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error updating setting:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/settings", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { key, value, description, category } = req.body;

      if (!key || value === undefined || value === null) {
        return res.status(400).send("Key and value are required");
      }

      const setting = await storage.createPlatformSetting({
        key,
        value: value.toString(),
        description: description || null,
        category: category || null,
        updatedBy: userId,
      });

      res.json(setting);
    } catch (error: any) {
      console.error('[Platform Settings] Error creating setting:', error);
      res.status(500).send(error.message);
    }
  });

  // Admin messaging monitoring routes
  app.get("/api/admin/conversations", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const conversations = await storage.getAllConversationsForAdmin({ search, limit, offset });
      res.json(conversations);
    } catch (error: any) {
      console.error('[Admin Conversations] Error fetching conversations:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/messages/:conversationId", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error: any) {
      console.error('[Admin Messages] Error fetching messages:', error);
      res.status(500).send(error.message);
    }
  });

  // Admin payment disputes routes
  app.get("/api/admin/payments/disputed", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const payments = await storage.getDisputedPayments({ limit, offset });
      res.json(payments);
    } catch (error: any) {
      console.error('[Admin Disputed Payments] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/payments/:id/resolve-dispute", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { resolution, notes } = req.body;

      if (!resolution || !['refund', 'complete', 'cancel'].includes(resolution)) {
        return res.status(400).send("Valid resolution required: refund, complete, or cancel");
      }

      const payment = await storage.getPaymentOrRetainerPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      let newStatus: 'refunded' | 'completed' | 'failed';
      let description = payment.description || '';

      switch (resolution) {
        case 'refund':
          newStatus = 'refunded';
          description += ` | Admin resolved: Refunded to company. ${notes || ''}`;
          break;
        case 'complete':
          newStatus = 'completed';
          description += ` | Admin resolved: Payment approved. ${notes || ''}`;
          break;
        case 'cancel':
          newStatus = 'failed';
          description += ` | Admin resolved: Dispute cancelled. ${notes || ''}`;
          break;
        default:
          return res.status(400).send("Invalid resolution type");
      }

      const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(req.params.id, newStatus, {
        description: description.trim(),
      });

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.RESOLVE_PAYMENT_DISPUTE,
        entityType: EntityTypes.PAYMENT,
        entityId: req.params.id,
        changes: { resolution, notes, newStatus },
        reason: `Resolved dispute: ${resolution}`,
      }, req);

      // Send notifications
      const creator = await storage.getUserById(payment.creatorId);
      const company = await storage.getCompanyProfileById(payment.companyId);

      if (creator) {
        await notificationService.sendNotification(
          payment.creatorId,
          'payment_dispute_resolved',
          'Payment Dispute Resolved',
          `The dispute on your payment has been resolved. Resolution: ${resolution}. ${notes || ''}`,
          { paymentId: payment.id }
        );
      }

      if (company && company.userId) {
        await notificationService.sendNotification(
          company.userId,
          'payment_dispute_resolved',
          'Payment Dispute Resolved',
          `The payment dispute has been resolved. Resolution: ${resolution}. ${notes || ''}`,
          { paymentId: payment.id }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Admin Resolve Dispute] Error:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/payments/:id/refund", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { reason } = req.body;

      const payment = await storage.getPaymentOrRetainerPayment(req.params.id);
      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      if (payment.status !== 'completed') {
        return res.status(400).send("Can only refund completed payments");
      }

      const updatedPayment = await storage.updatePaymentOrRetainerPaymentStatus(req.params.id, 'refunded', {
        description: `${payment.description || ''} | Admin refunded: ${reason || 'No reason provided'}`,
        refundedAt: new Date(),
      });

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.REFUND_PAYMENT,
        entityType: EntityTypes.PAYMENT,
        entityId: req.params.id,
        changes: { status: 'refunded', reason },
        reason: `Admin refund: ${reason || 'No reason provided'}`,
      }, req);

      // Send notifications
      const creator = await storage.getUserById(payment.creatorId);
      const company = await storage.getCompanyProfileById(payment.companyId);

      if (creator) {
        await notificationService.sendNotification(
          payment.creatorId,
          'payment_refunded',
          'Payment Refunded',
          `Your payment has been refunded. Reason: ${reason || 'Not specified'}`,
          { paymentId: payment.id }
        );
      }

      if (company && company.userId) {
        await notificationService.sendNotification(
          company.userId,
          'payment_refunded',
          'Payment Refunded',
          `A payment has been refunded. Reason: ${reason || 'Not specified'}`,
          { paymentId: payment.id }
        );
      }

      res.json(updatedPayment);
    } catch (error: any) {
      console.error('[Admin Refund Payment] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Admin niche categories management
  app.get("/api/admin/niches", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const niches = await storage.getNiches();
      res.json(niches);
    } catch (error: any) {
      console.error('[Admin Niches] Error fetching niches:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/niches", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { name, description, isActive } = req.body;

      if (!name) {
        return res.status(400).send("Niche name is required");
      }

      const niche = await storage.addNiche(name, description, isActive !== false, userId);

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.CREATE_NICHE,
        entityType: EntityTypes.NICHE,
        entityId: niche.id,
        changes: { name, description, isActive },
        reason: 'Added new niche category',
      }, req);

      res.json(niche);
    } catch (error: any) {
      console.error('[Admin Niches] Error adding niche:', error);
      res.status(500).send(error.message);
    }
  });

  app.put("/api/admin/niches/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const nicheId = req.params.id;
      const { name, description, isActive } = req.body;

      const niche = await storage.updateNiche(nicheId, { name, description, isActive }, userId);

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.UPDATE_NICHE,
        entityType: EntityTypes.NICHE,
        entityId: nicheId,
        changes: { name, description, isActive },
        reason: 'Updated niche category',
      }, req);

      res.json(niche);
    } catch (error: any) {
      console.error('[Admin Niches] Error updating niche:', error);
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/niches/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const nicheId = req.params.id;

      await storage.deleteNiche(nicheId, userId);

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.DELETE_NICHE,
        entityType: EntityTypes.NICHE,
        entityId: nicheId,
        reason: 'Deleted niche category',
      }, req);

      res.json({ success: true, message: 'Niche deleted successfully' });
    } catch (error: any) {
      console.error('[Admin Niches] Error deleting niche:', error);
      res.status(500).send(error.message);
    }
  });

  // Public endpoint to get active niches
  app.get("/api/niches", async (req, res) => {
    try {
      const niches = await storage.getActiveNiches();
      res.json(niches);
    } catch (error: any) {
      console.error('[Niches] Error fetching niches:', error);
      res.status(500).send(error.message);
    }
  });

  // =====================================================
  // Email Templates Management Routes
  // =====================================================

  // Get all email templates (admin only)
  app.get("/api/admin/email-templates", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('[Email Templates] Error fetching templates:', error);
      res.status(500).send(error.message);
    }
  });

  // IMPORTANT: Specific path routes MUST come before the generic :id route
  // Otherwise Express will match "available-types", "slug", "category", etc. as :id values

  // Get email template by slug (for internal use)
  app.get("/api/admin/email-templates/slug/:slug", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const template = await storage.getEmailTemplateBySlug(req.params.slug);
      if (!template) {
        return res.status(404).send("Email template not found");
      }
      res.json(template);
    } catch (error: any) {
      console.error('[Email Templates] Error fetching template by slug:', error);
      res.status(500).send(error.message);
    }
  });

  // Get templates by category
  app.get("/api/admin/email-templates/category/:category", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const templates = await storage.getEmailTemplatesByCategory(req.params.category);
      res.json(templates);
    } catch (error: any) {
      console.error('[Email Templates] Error fetching templates by category:', error);
      res.status(500).send(error.message);
    }
  });

  // Get available variables for a specific template slug
  app.get("/api/admin/email-templates/variables/:slug", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { getAvailableVariablesForTemplate } = await import('./notifications/templateEngine');
      const variables = getAvailableVariablesForTemplate(req.params.slug);
      res.json(variables);
    } catch (error: any) {
      console.error('[Email Templates] Error getting template variables:', error);
      res.status(500).send(error.message);
    }
  });

  // Get all available template types/slugs with their variables
  app.get("/api/admin/email-templates/available-types", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const { getAvailableVariablesForTemplate, getTemplateSlugForNotificationType } = await import('./notifications/templateEngine');

      // All notification types and their slugs
      const templateTypes = [
        { type: 'application_status_change', category: 'application', name: 'Application Status Change', description: 'Sent when application status changes (approved/rejected/pending)' },
        { type: 'new_application', category: 'application', name: 'New Application', description: 'Sent when a new application or offer is submitted for review' },
        { type: 'payment_received', category: 'payment', name: 'Payment Received', description: 'Sent to creator when payment is successfully received' },
        { type: 'payment_pending', category: 'payment', name: 'Payment Pending', description: 'Sent when payment is pending approval or processing' },
        { type: 'payment_approved', category: 'payment', name: 'Payment Approved', description: 'Sent when payment has been approved and is being processed' },
        { type: 'payment_failed_insufficient_funds', category: 'payment', name: 'Payment Failed (Insufficient Funds)', description: 'Sent when payment fails due to insufficient funds' },
        { type: 'payment_disputed', category: 'payment', name: 'Payment Disputed', description: 'Sent when a payment is disputed' },
        { type: 'payment_dispute_resolved', category: 'payment', name: 'Payment Dispute Resolved', description: 'Sent when a payment dispute is resolved' },
        { type: 'payment_refunded', category: 'payment', name: 'Payment Refunded', description: 'Sent when a payment is refunded' },
        { type: 'offer_approved', category: 'offer', name: 'Offer Approved', description: 'Sent when company offer is approved by admin' },
        { type: 'offer_rejected', category: 'offer', name: 'Offer Rejected', description: 'Sent when company offer is rejected by admin' },
        { type: 'registration_approved', category: 'company', name: 'Registration Approved', description: 'Sent when company registration is approved' },
        { type: 'registration_rejected', category: 'company', name: 'Registration Rejected', description: 'Sent when company registration is rejected' },
        { type: 'system_announcement', category: 'system', name: 'System Announcement', description: 'General system announcements and updates' },
        { type: 'new_message', category: 'system', name: 'New Message', description: 'Sent when user receives a new message' },
        { type: 'review_received', category: 'system', name: 'Review Received', description: 'Sent when company receives a new review' },
        { type: 'work_completion_approval', category: 'system', name: 'Work Completion Approval', description: 'Sent when work is approved' },
        { type: 'priority_listing_expiring', category: 'system', name: 'Priority Listing Expiring', description: 'Sent when priority listing is about to expire' },
        { type: 'deliverable_rejected', category: 'system', name: 'Deliverable Rejected', description: 'Sent when retainer deliverable is rejected' },
        { type: 'revision_requested', category: 'system', name: 'Revision Requested', description: 'Sent when revision is requested for deliverable' },
        { type: 'content_flagged', category: 'moderation', name: 'Content Flagged', description: 'Sent when content is flagged for moderation' },
        { type: 'email_verification', category: 'authentication', name: 'Email Verification', description: 'Sent for email address verification' },
        { type: 'password_reset', category: 'authentication', name: 'Password Reset', description: 'Sent for password reset requests' },
        { type: 'account_deletion_otp', category: 'authentication', name: 'Account Deletion OTP', description: 'Sent for account deletion verification' },
        { type: 'password_change_otp', category: 'authentication', name: 'Password Change OTP', description: 'Sent for password change verification' },
      ];

      // Add slug and variables to each type
      const result = templateTypes.map(t => {
        const slug = getTemplateSlugForNotificationType(t.type);
        return {
          ...t,
          slug,
          variables: slug ? getAvailableVariablesForTemplate(slug) : [],
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error('[Email Templates] Error getting available template types:', error);
      res.status(500).send(error.message);
    }
  });

  // Get email template by ID (must come after specific path routes)
  app.get("/api/admin/email-templates/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const template = await storage.getEmailTemplateById(req.params.id);
      if (!template) {
        return res.status(404).send("Email template not found");
      }
      res.json(template);
    } catch (error: any) {
      console.error('[Email Templates] Error fetching template:', error);
      res.status(500).send(error.message);
    }
  });

  // Create new email template
  app.post("/api/admin/email-templates", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { name, slug, category, subject, htmlContent, visualData, description, availableVariables, isActive, isSystem } = req.body;

      // Validate required fields
      if (!name || !slug || !category || !subject || !htmlContent) {
        return res.status(400).send("Missing required fields: name, slug, category, subject, htmlContent");
      }

      // Check if slug already exists
      const existingTemplate = await storage.getEmailTemplateBySlug(slug);
      if (existingTemplate) {
        return res.status(400).send("A template with this slug already exists");
      }

      const template = await storage.createEmailTemplate({
        name,
        slug,
        category,
        subject,
        htmlContent,
        visualData: visualData || null,
        description: description || null,
        availableVariables: availableVariables || [],
        isActive: isActive !== false,
        isSystem: isSystem || false,
        createdBy: userId,
        updatedBy: userId,
      });

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.CREATE_EMAIL_TEMPLATE || 'create_email_template',
        entityType: EntityTypes.EMAIL_TEMPLATE || 'email_template',
        entityId: template.id,
        changes: { name, slug, category },
        reason: 'Created new email template',
      }, req);

      res.json(template);
    } catch (error: any) {
      console.error('[Email Templates] Error creating template:', error);
      res.status(500).send(error.message);
    }
  });

  // Update email template
  app.put("/api/admin/email-templates/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const templateId = req.params.id;
      const { name, slug, category, subject, htmlContent, visualData, description, availableVariables, isActive } = req.body;

      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateById(templateId);
      if (!existingTemplate) {
        return res.status(404).send("Email template not found");
      }

      // If slug is being changed, check for uniqueness
      if (slug && slug !== existingTemplate.slug) {
        const slugExists = await storage.getEmailTemplateBySlug(slug);
        if (slugExists) {
          return res.status(400).send("A template with this slug already exists");
        }
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (slug !== undefined) updates.slug = slug;
      if (category !== undefined) updates.category = category;
      if (subject !== undefined) updates.subject = subject;
      if (htmlContent !== undefined) updates.htmlContent = htmlContent;
      if (visualData !== undefined) updates.visualData = visualData;
      if (description !== undefined) updates.description = description;
      if (availableVariables !== undefined) updates.availableVariables = availableVariables;
      if (isActive !== undefined) updates.isActive = isActive;

      const template = await storage.updateEmailTemplate(templateId, updates, userId);

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.UPDATE_EMAIL_TEMPLATE || 'update_email_template',
        entityType: EntityTypes.EMAIL_TEMPLATE || 'email_template',
        entityId: templateId,
        changes: updates,
        reason: 'Updated email template',
      }, req);

      res.json(template);
    } catch (error: any) {
      console.error('[Email Templates] Error updating template:', error);
      res.status(500).send(error.message);
    }
  });

  // Delete email template
  app.delete("/api/admin/email-templates/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const templateId = req.params.id;

      // Check if template exists
      const existingTemplate = await storage.getEmailTemplateById(templateId);
      if (!existingTemplate) {
        return res.status(404).send("Email template not found");
      }

      if (existingTemplate.isSystem) {
        return res.status(403).send("Cannot delete system templates");
      }

      await storage.deleteEmailTemplate(templateId);

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.DELETE_EMAIL_TEMPLATE || 'delete_email_template',
        entityType: EntityTypes.EMAIL_TEMPLATE || 'email_template',
        entityId: templateId,
        reason: 'Deleted email template',
      }, req);

      res.json({ success: true, message: 'Email template deleted successfully' });
    } catch (error: any) {
      console.error('[Email Templates] Error deleting template:', error);
      res.status(500).send(error.message);
    }
  });

  // Preview email template with sample data
  app.post("/api/admin/email-templates/:id/preview", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const template = await storage.getEmailTemplateById(req.params.id);
      if (!template) {
        return res.status(404).send("Email template not found");
      }

      const sampleData = req.body.sampleData || {};

      // Process template variables
      let processedSubject = template.subject;
      let processedHtml = template.htmlContent;

      // Replace all {{variable}} patterns with sample data or placeholder
      const variableRegex = /\{\{(\w+)\}\}/g;

      processedSubject = processedSubject.replace(variableRegex, (match, variable) => {
        return sampleData[variable] || `[${variable}]`;
      });

      processedHtml = processedHtml.replace(variableRegex, (match, variable) => {
        return sampleData[variable] || `<span style="background-color: #FEF3C7; padding: 2px 4px; border-radius: 2px;">[${variable}]</span>`;
      });

      res.json({
        subject: processedSubject,
        html: processedHtml,
        originalTemplate: template,
      });
    } catch (error: any) {
      console.error('[Email Templates] Error previewing template:', error);
      res.status(500).send(error.message);
    }
  });

  // Duplicate an email template
  app.post("/api/admin/email-templates/:id/duplicate", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const sourceTemplate = await storage.getEmailTemplateById(req.params.id);

      if (!sourceTemplate) {
        return res.status(404).send("Email template not found");
      }

      // Generate a unique slug
      let newSlug = `${sourceTemplate.slug}-copy`;
      let counter = 1;
      while (await storage.getEmailTemplateBySlug(newSlug)) {
        newSlug = `${sourceTemplate.slug}-copy-${counter}`;
        counter++;
      }

      const newTemplate = await storage.createEmailTemplate({
        name: `${sourceTemplate.name} (Copy)`,
        slug: newSlug,
        category: sourceTemplate.category,
        subject: sourceTemplate.subject,
        htmlContent: sourceTemplate.htmlContent,
        visualData: sourceTemplate.visualData as Record<string, unknown> | undefined,
        description: sourceTemplate.description,
        availableVariables: sourceTemplate.availableVariables || [],
        isActive: false, // Start as inactive
        isSystem: false, // Copies are never system templates
        createdBy: userId,
        updatedBy: userId,
      });

      // Log the action
      const { logAuditAction, AuditActions, EntityTypes } = await import('./auditLog');
      await logAuditAction(userId, {
        action: AuditActions.DUPLICATE_EMAIL_TEMPLATE || 'duplicate_email_template',
        entityType: EntityTypes.EMAIL_TEMPLATE || 'email_template',
        entityId: newTemplate.id,
        changes: { sourceTemplateId: sourceTemplate.id },
        reason: 'Duplicated email template',
      }, req);

      res.json(newTemplate);
    } catch (error: any) {
      console.error('[Email Templates] Error duplicating template:', error);
      res.status(500).send(error.message);
    }
  });

  // Initialize default email templates for all notification types
  app.post("/api/admin/email-templates/initialize-defaults", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { getTemplateSlugForNotificationType, getAvailableVariablesForTemplate } = await import('./notifications/templateEngine');

      // Default visual template data for each notification type
      const defaultTemplates: Record<string, {
        name: string;
        category: string;
        subject: string;
        headerTitle: string;
        headerColor: string;
        blocks: Array<{ id: string; type: string; content: string; properties: Record<string, string> }>;
      }> = {
        'application_status_change': {
          name: 'Application Status Change',
          category: 'application',
          subject: 'Your application status has been updated',
          headerTitle: 'Application Update',
          headerColor: '#10B981',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'success-box', content: 'Your application for {{offerTitle}} has been updated!', properties: {} },
            { id: '3', type: 'text', content: 'Please log in to view the details and next steps.', properties: {} },
            { id: '4', type: 'button', content: 'View Application', properties: { url: '{{linkUrl}}', color: 'success' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'new_application': {
          name: 'New Application',
          category: 'application',
          subject: 'New application for {{offerTitle}}',
          headerTitle: 'New Application Received',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'info-box', content: 'You have received a new application for your offer: {{offerTitle}}', properties: {} },
            { id: '3', type: 'text', content: 'Please review the application and respond to the creator.', properties: {} },
            { id: '4', type: 'button', content: 'Review Application', properties: { url: '{{linkUrl}}', color: 'primary' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'payment_received': {
          name: 'Payment Received',
          category: 'payment',
          subject: 'Payment received: {{amount}}',
          headerTitle: 'Payment Received!',
          headerColor: '#10B981',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'success-box', content: 'Great news! You have received a payment.', properties: {} },
            { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Amount Received', style: 'success' } },
            { id: '4', type: 'details-table', content: 'Gross Amount:{{grossAmount}}\nPlatform Fee:{{platformFee}}\nProcessing Fee:{{processingFee}}\nTransaction ID:{{transactionId}}', properties: {} },
            { id: '5', type: 'button', content: 'View Payment Details', properties: { url: '{{linkUrl}}', color: 'success' } },
            { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'payment_pending': {
          name: 'Payment Pending',
          category: 'payment',
          subject: 'New payment ready for processing',
          headerTitle: 'Payment Pending Review',
          headerColor: '#F59E0B',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'warning-box', content: 'A new affiliate payment is ready for processing and requires your review.', properties: {} },
            { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Payment Amount', style: 'warning' } },
            { id: '4', type: 'text', content: 'Please review and process this payment at your earliest convenience.', properties: {} },
            { id: '5', type: 'button', content: 'Review Payment', properties: { url: '{{linkUrl}}', color: 'warning' } },
            { id: '6', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'payment_approved': {
          name: 'Payment Approved',
          category: 'payment',
          subject: 'Payment sent: {{amount}}',
          headerTitle: 'Payment Sent Successfully',
          headerColor: '#10B981',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'success-box', content: 'Your payment has been successfully sent!', properties: {} },
            { id: '3', type: 'amount-display', content: '{{amount}}', properties: { label: 'Amount Sent', style: 'success' } },
            { id: '4', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'success' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'offer_approved': {
          name: 'Offer Approved',
          category: 'offer',
          subject: 'Your offer "{{offerTitle}}" has been approved!',
          headerTitle: 'Offer Approved!',
          headerColor: '#10B981',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'success-box', content: 'Congratulations! Your offer "{{offerTitle}}" has been approved and is now live.', properties: {} },
            { id: '3', type: 'text', content: 'Creators can now discover and apply to your offer.', properties: {} },
            { id: '4', type: 'button', content: 'View Your Offer', properties: { url: '{{linkUrl}}', color: 'success' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'offer_rejected': {
          name: 'Offer Rejected',
          category: 'offer',
          subject: 'Update on your offer submission',
          headerTitle: 'Offer Review Update',
          headerColor: '#6B7280',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'info-box', content: 'Your offer "{{offerTitle}}" requires adjustments before it can be published.', properties: {} },
            { id: '3', type: 'text', content: 'Please review the feedback and make the necessary changes.', properties: {} },
            { id: '4', type: 'button', content: 'View Offer', properties: { url: '{{linkUrl}}', color: 'gray' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'registration_approved': {
          name: 'Registration Approved',
          category: 'company',
          subject: 'Your account has been approved!',
          headerTitle: 'Welcome to AffiliateXchange!',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'success-box', content: 'Great news! Your company account has been approved.', properties: {} },
            { id: '3', type: 'text', content: 'You can now start creating offers and connecting with creators.', properties: {} },
            { id: '4', type: 'button', content: 'Get Started', properties: { url: '{{linkUrl}}', color: 'primary' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'registration_rejected': {
          name: 'Registration Rejected',
          category: 'company',
          subject: 'Update on your registration',
          headerTitle: 'Account Registration Update',
          headerColor: '#6B7280',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'text', content: 'Unfortunately, we are unable to approve your company account at this time.', properties: {} },
            { id: '3', type: 'info-box', content: 'If you believe this is an error, please contact our support team.', properties: {} },
            { id: '4', type: 'button', content: 'Contact Support', properties: { url: '{{linkUrl}}', color: 'gray' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.', properties: {} },
          ],
        },
        'new_message': {
          name: 'New Message',
          category: 'system',
          subject: 'New message from {{companyName}}',
          headerTitle: 'New Message',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'text', content: 'You have a new message from {{companyName}} regarding {{offerTitle}}.', properties: {} },
            { id: '3', type: 'info-box', content: '"{{messagePreview}}"', properties: {} },
            { id: '4', type: 'button', content: 'View Message', properties: { url: '{{linkUrl}}', color: 'primary' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'review_received': {
          name: 'Review Received',
          category: 'system',
          subject: 'New review received ({{reviewRating}} stars)',
          headerTitle: 'New Review Received',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'text', content: 'You have received a new review for your company!', properties: {} },
            { id: '3', type: 'info-box', content: '{{reviewRating}} out of 5 stars\n\n"{{reviewText}}"', properties: {} },
            { id: '4', type: 'button', content: 'View Review', properties: { url: '{{linkUrl}}', color: 'primary' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'email_verification': {
          name: 'Email Verification',
          category: 'authentication',
          subject: 'Verify your email address',
          headerTitle: 'Verify Your Email',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'text', content: 'Please verify your email address to complete your registration.', properties: {} },
            { id: '3', type: 'button', content: 'Verify Email Address', properties: { url: '{{verificationUrl}}', color: 'primary' } },
            { id: '4', type: 'warning-box', content: 'This verification link will expire in 24 hours.', properties: {} },
            { id: '5', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
          ],
        },
        'password_reset': {
          name: 'Password Reset',
          category: 'authentication',
          subject: 'Reset your password',
          headerTitle: 'Password Reset Request',
          headerColor: '#F59E0B',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'text', content: 'Click the button below to reset your password.', properties: {} },
            { id: '3', type: 'button', content: 'Reset Password', properties: { url: '{{resetUrl}}', color: 'warning' } },
            { id: '4', type: 'warning-box', content: 'This link will expire in 1 hour.', properties: {} },
            { id: '5', type: 'footer', content: 'This is an automated email from AffiliateXchange.', properties: {} },
          ],
        },
        'system_announcement': {
          name: 'System Announcement',
          category: 'system',
          subject: '{{announcementTitle}}',
          headerTitle: 'System Announcement',
          headerColor: '#4F46E5',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'heading', content: '{{announcementTitle}}', properties: { size: 'medium' } },
            { id: '3', type: 'text', content: '{{announcementMessage}}', properties: {} },
            { id: '4', type: 'button', content: 'Learn More', properties: { url: '{{linkUrl}}', color: 'primary' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
        'content_flagged': {
          name: 'Content Flagged',
          category: 'moderation',
          subject: 'Your content is under review',
          headerTitle: 'Content Under Review',
          headerColor: '#F59E0B',
          blocks: [
            { id: '1', type: 'greeting', content: 'Hi {{userName}},', properties: {} },
            { id: '2', type: 'warning-box', content: 'Your content has been flagged for review by our moderation system.', properties: {} },
            { id: '3', type: 'text', content: 'Our team will review and you will be notified of the outcome.', properties: {} },
            { id: '4', type: 'button', content: 'View Details', properties: { url: '{{linkUrl}}', color: 'warning' } },
            { id: '5', type: 'footer', content: 'This is an automated notification from AffiliateXchange.\nUpdate your notification preferences anytime.', properties: {} },
          ],
        },
      };

      // Helper function to generate HTML from visual blocks
      const generateHtmlFromBlocks = (data: { headerTitle: string; headerColor: string; blocks: any[] }): string => {
        const baseStyles = `
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: ${data.headerColor}; color: #ffffff; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #E5E7EB; }
        `;

        const renderBlock = (block: any): string => {
          switch (block.type) {
            case 'greeting':
              return `<p>${block.content}</p>`;
            case 'text':
              return `<p>${block.content.replace(/\n/g, '<br>')}</p>`;
            case 'heading':
              return `<h3 style="font-size: 20px; font-weight: 600; color: #111827;">${block.content}</h3>`;
            case 'success-box':
              return `<div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; color: #065F46;">${block.content}</p></div>`;
            case 'warning-box':
              return `<div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; color: #92400E;">${block.content}</p></div>`;
            case 'error-box':
              return `<div style="background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; color: #991B1B;">${block.content}</p></div>`;
            case 'info-box':
              return `<div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; color: #1E40AF;">${block.content.replace(/\n/g, '<br>')}</p></div>`;
            case 'button':
              const colors: Record<string, string> = { primary: '#4F46E5', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', gray: '#6B7280' };
              const btnColor = colors[block.properties?.color || 'primary'];
              return `<div style="text-align: center; margin: 30px 0;"><a href="${block.properties?.url || '{{linkUrl}}'}" style="display: inline-block; padding: 12px 30px; background-color: ${btnColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">${block.content}</a></div>`;
            case 'amount-display':
              const styles: Record<string, { bg: string; label: string; amount: string }> = {
                default: { bg: '#F3F4F6', label: '#6B7280', amount: '#111827' },
                success: { bg: '#ECFDF5', label: '#065F46', amount: '#047857' },
                warning: { bg: '#FEF3C7', label: '#92400E', amount: '#D97706' },
              };
              const style = styles[block.properties?.style || 'default'];
              return `<div style="background-color: ${style.bg}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;"><p style="margin: 0 0 5px 0; font-size: 14px; color: ${style.label};">${block.properties?.label || 'Amount'}</p><p style="margin: 0; font-size: 32px; font-weight: bold; color: ${style.amount};">${block.content}</p></div>`;
            case 'details-table':
              const rows = block.content.split('\n').filter((line: string) => line.includes(':'));
              const tableRows = rows.map((row: string) => {
                const [label, ...valueParts] = row.split(':');
                const value = valueParts.join(':').trim();
                return `<tr style="border-bottom: 1px solid #D1D5DB;"><td style="padding: 12px 0; color: #6B7280;">${label.trim()}</td><td style="padding: 12px 0; font-weight: 600; color: #111827; text-align: right;">${value}</td></tr>`;
              }).join('');
              return `<div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;"><table style="width: 100%; border-collapse: collapse;">${tableRows}</table></div>`;
            case 'footer':
              return `<div class="footer">${block.content.split('\n').map((l: string) => `<p>${l}</p>`).join('')}</div>`;
            case 'numbered-list':
              const items = block.content.split('\n').filter(Boolean).map((item: string) => `<li style="margin-bottom: 8px;">${item}</li>`).join('');
              return `<ol style="margin: 15px 0; padding-left: 20px; color: #374151;">${items}</ol>`;
            default:
              return '';
          }
        };

        const contentBlocks = data.blocks.filter(b => b.type !== 'footer');
        const footerBlocks = data.blocks.filter(b => b.type === 'footer');

        const bodyContent = contentBlocks.map(renderBlock).join('\n');
        const footerContent = footerBlocks.length > 0
          ? footerBlocks.map(renderBlock).join('\n')
          : `<div class="footer"><p>This is an automated notification from AffiliateXchange.</p></div>`;

        return `<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body><div class="container"><div class="header"><h1 style="margin: 0;">${data.headerTitle}</h1></div><div class="content">${bodyContent}</div>${footerContent}</div></body></html>`;
      };

      let created = 0;

      for (const [notificationType, templateData] of Object.entries(defaultTemplates)) {
        const slug = getTemplateSlugForNotificationType(notificationType);
        if (!slug) continue;

        // Check if template already exists
        const existing = await storage.getEmailTemplateBySlug(slug);
        if (existing) continue;

        // Get variables for this template
        const variables = getAvailableVariablesForTemplate(slug);
        const variableNames = variables.map(v => v.name);

        // Create visual data structure
        const visualData = {
          blocks: templateData.blocks,
          headerTitle: templateData.headerTitle,
          headerColor: templateData.headerColor,
        };

        // Generate HTML
        const htmlContent = generateHtmlFromBlocks(visualData);

        // Create the template
        await storage.createEmailTemplate({
          name: templateData.name,
          slug,
          category: templateData.category as any,
          subject: templateData.subject,
          htmlContent,
          visualData,
          description: `Default template for ${templateData.name} notifications`,
          availableVariables: variableNames,
          isActive: true,
          isSystem: true,
          createdBy: userId,
          updatedBy: userId,
        });

        created++;
      }

      res.json({ success: true, created, message: `Created ${created} default email templates` });
    } catch (error: any) {
      console.error('[Email Templates] Error initializing default templates:', error);
      res.status(500).send(error.message);
    }
  });

  // Platform Funding Accounts routes
  app.get("/api/admin/funding-accounts", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const accounts = await storage.getAllPlatformFundingAccounts();
      res.json(accounts);
    } catch (error: any) {
      console.error('[Funding Accounts] Error fetching accounts:', error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const account = await storage.getPlatformFundingAccount(req.params.id);
      if (!account) {
        return res.status(404).send("Funding account not found");
      }
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error fetching account:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/funding-accounts", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const account = await storage.createPlatformFundingAccount({
        ...req.body,
        createdBy: userId,
      });
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error creating account:', error);
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const account = await storage.updatePlatformFundingAccount(req.params.id, req.body);
      if (!account) {
        return res.status(404).send("Funding account not found");
      }
      res.json(account);
    } catch (error: any) {
      console.error('[Funding Accounts] Error updating account:', error);
      res.status(500).send(error.message);
    }
  });

  app.delete("/api/admin/funding-accounts/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.deletePlatformFundingAccount(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Funding Accounts] Error deleting account:', error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/admin/funding-accounts/:id/set-primary", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await storage.setPrimaryFundingAccount(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Funding Accounts] Error setting primary account:', error);
      res.status(500).send(error.message);
    }
  });

  // Object Storage routes
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(filePath, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Simple image proxy for allowed external hosts (e.g., GCS, Cloudinary)
  // This makes images same-origin and helps avoid browser tracking-prevention blocking
  app.get("/proxy/image", async (req, res) => {
    try {
      const url = (req.query.url as string) || req.query.u as string;
      if (!url) return res.status(400).send("url query param is required");

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch (e) {
        return res.status(400).send("invalid url");
      }

      // Only allow known safe hosts to avoid open proxy / SSRF
      const allowedHosts = ["res.cloudinary.com", "cloudinary.com", "storage.googleapis.com", "googleapis.com"];
      const hostname = parsed.hostname || "";
      const allowed = allowedHosts.some((h) => hostname.endsWith(h));
      if (!allowed) return res.status(403).send("forbidden host");

      if (parsed.protocol !== "https:") return res.status(400).send("only https urls are allowed");

      // For GCS URLs, generate a signed URL first (files are not public)
      let fetchUrl = url;
      if (hostname.endsWith("storage.googleapis.com") || hostname.endsWith("googleapis.com")) {
        try {
          // Extract the file path from GCS URL: https://storage.googleapis.com/bucket-name/path/to/file
          const pathParts = parsed.pathname.split('/').filter(p => p);
          if (pathParts.length >= 2) {
            // Remove bucket name, keep the rest as file path
            const filePath = pathParts.slice(1).join('/');

            // Generate signed URL using ObjectStorageService
            const { Storage } = await import('@google-cloud/storage');
            const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
            const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

            let gcsStorage: any;
            // Option 1: Use credentials from JSON string (best for production/Render)
            const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
            if (credentialsJson) {
              const credentials = JSON.parse(credentialsJson);
              gcsStorage = new Storage({
                projectId: projectId || credentials.project_id,
                credentials,
              });
            }
            // Option 2: Use key file path (for local development)
            else if (process.env.GOOGLE_CLOUD_KEYFILE) {
              gcsStorage = new Storage({
                projectId,
                keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
              });
            }
            // Option 3: Fallback to default credentials (useful for GCP environments)
            else {
              gcsStorage = new Storage({ projectId });
            }

            const [signedUrl] = await gcsStorage
              .bucket(bucketName)
              .file(filePath)
              .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
              });

            fetchUrl = signedUrl;
            console.log('[Proxy Image] Generated signed URL for GCS file:', filePath);
          }
        } catch (signedUrlError) {
          console.error('[Proxy Image] Failed to generate signed URL:', signedUrlError);
          // Continue with original URL as fallback
        }
      }

      const fetchRes = await fetch(fetchUrl, { method: "GET" });
      if (!fetchRes.ok) return res.status(fetchRes.status).send("failed to fetch image");

      const contentType = fetchRes.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const cacheControl = fetchRes.headers.get("cache-control");
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);

      // Allow browsers to fetch this proxied resource from same-origin
      res.setHeader("Access-Control-Allow-Origin", "*");

      const arrayBuffer = await fetchRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      console.error('[Proxy] Error fetching image:', error);
      res.status(500).send(error?.message || 'proxy error');
    }
  });

  // Video proxy with range request support for proper video streaming
  app.get("/proxy/video", async (req, res) => {
    try {
      const url = (req.query.url as string) || req.query.u as string;
      if (!url) return res.status(400).send("url query param is required");

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch (e) {
        return res.status(400).send("invalid url");
      }

      // Only allow known safe hosts to avoid open proxy / SSRF
      const allowedHosts = ["res.cloudinary.com", "cloudinary.com", "storage.googleapis.com", "googleapis.com"];
      const hostname = parsed.hostname || "";
      const allowed = allowedHosts.some((h) => hostname.endsWith(h));
      if (!allowed) return res.status(403).send("forbidden host");

      if (parsed.protocol !== "https:") return res.status(400).send("only https urls are allowed");

      // For GCS URLs, generate a signed URL first (files are not public)
      let fetchUrl = url;
      if (hostname.endsWith("storage.googleapis.com") || hostname.endsWith("googleapis.com")) {
        try {
          // Extract the file path from GCS URL: https://storage.googleapis.com/bucket-name/path/to/file
          const pathParts = parsed.pathname.split('/').filter(p => p);
          if (pathParts.length >= 2) {
            // Remove bucket name, keep the rest as file path
            const filePath = pathParts.slice(1).join('/');

            // Generate signed URL using ObjectStorageService
            const { Storage } = await import('@google-cloud/storage');
            const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
            const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

            let gcsStorage: any;
            // Option 1: Use credentials from JSON string (best for production/Render)
            const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
            if (credentialsJson) {
              const credentials = JSON.parse(credentialsJson);
              gcsStorage = new Storage({
                projectId: projectId || credentials.project_id,
                credentials,
              });
            }
            // Option 2: Use key file path (for local development)
            else if (process.env.GOOGLE_CLOUD_KEYFILE) {
              gcsStorage = new Storage({
                projectId,
                keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
              });
            }
            // Option 3: Fallback to default credentials (useful for GCP environments)
            else {
              gcsStorage = new Storage({ projectId });
            }

            const [signedUrl] = await gcsStorage
              .bucket(bucketName)
              .file(filePath)
              .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
              });

            fetchUrl = signedUrl;
            console.log('[Proxy Video] Generated signed URL for GCS file:', filePath);
          }
        } catch (signedUrlError) {
          console.error('[Proxy Video] Failed to generate signed URL:', signedUrlError);
          // Continue with original URL as fallback
        }
      }

      // Get the range header from the request (for video seeking)
      const range = req.headers.range;

      // Prepare headers for the upstream request
      const headers: Record<string, string> = {};
      if (range) {
        headers['Range'] = range;
      }

      const fetchRes = await fetch(fetchUrl, {
        method: "GET",
        headers
      });

      if (!fetchRes.ok && fetchRes.status !== 206) {
        return res.status(fetchRes.status).send("failed to fetch video");
      }

      // Forward the status code (200 for full content, 206 for partial content)
      res.status(fetchRes.status);

      // Forward important headers
      const contentType = fetchRes.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);

      const contentLength = fetchRes.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const contentRange = fetchRes.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);

      const acceptRanges = fetchRes.headers.get("accept-ranges");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      else res.setHeader("Accept-Ranges", "bytes"); // Enable range requests

      const cacheControl = fetchRes.headers.get("cache-control");
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);

      // Allow browsers to fetch this proxied resource
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Stream the video content (don't load into memory)
      if (fetchRes.body) {
        const reader = fetchRes.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
            res.end();
          } catch (error) {
            console.error('[Video Proxy] Error streaming video:', error);
            res.end();
          }
        };
        await pump();
      } else {
        // Fallback for when body is not available
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      }
    } catch (error: any) {
      console.error('[Video Proxy] Error fetching video:', error);
      res.status(500).send(error?.message || 'video proxy error');
    }
  });

  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    console.log("🔍 Requested object path:", req.path);
    const userId = (req.user as any)?.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      const publicId = req.path.replace("/objects/", "");
      objectStorageService.downloadObject(publicId, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        // FALLBACK: Try to serve from Cloudinary directly
        // This handles legacy normalized URLs that haven't been migrated yet
        const publicId = req.path.replace("/objects/", "");
        const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dilp6tuin";

        console.log(`[Objects Fallback] Trying Cloudinary URLs for ${publicId}`);

        // FIRST: Check if this is a video in the database - we can get the company/offer context
        try {
          const videoRecord = await db
            .select({
              video: offerVideos,
              offer: offers
            })
            .from(offerVideos)
            .leftJoin(offers, eq(offerVideos.offerId, offers.id))
            .where(sql`${offerVideos.videoUrl} LIKE ${`%${publicId}%`}`)
            .limit(1);

          if (videoRecord && videoRecord.length > 0 && videoRecord[0].offer) {
            const { offer } = videoRecord[0];
            console.log(`[Objects Fallback] Found video in DB: company=${offer.companyId}, offer=${offer.id}`);

            // Try the nested folder structure where videos are actually stored
            const specificFolders = [
              `creatorlink/videos/${offer.companyId}/${offer.id}`,
              `creatorlink/videos/${offer.companyId}`,
            ];

            for (const folder of specificFolders) {
              const path = `${folder}/${publicId}`;

              for (const ext of ['mp4', 'mov', 'webm', 'avi']) {
                const videoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${path}.${ext}`;
                try {
                  const headRes = await fetch(videoUrl, { method: 'HEAD' });
                  if (headRes.ok) {
                    console.log(`[Objects Fallback] ✓ Found video at: ${videoUrl}`);

                    const range = req.headers.range;
                    const headers: Record<string, string> = {};
                    if (range) headers['Range'] = range;

                    const videoRes = await fetch(videoUrl, { method: "GET", headers });
                    if (!videoRes.ok && videoRes.status !== 206) continue;

                    res.status(videoRes.status);

                    const contentType = videoRes.headers.get("content-type");
                    if (contentType) res.setHeader("Content-Type", contentType);

                    const contentLength = videoRes.headers.get("content-length");
                    if (contentLength) res.setHeader("Content-Length", contentLength);

                    const contentRange = videoRes.headers.get("content-range");
                    if (contentRange) res.setHeader("Content-Range", contentRange);

                    const acceptRanges = videoRes.headers.get("accept-ranges");
                    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
                    else res.setHeader("Accept-Ranges", "bytes");

                    res.setHeader("Cache-Control", "public, max-age=31536000");
                    res.setHeader("Access-Control-Allow-Origin", "*");

                    if (videoRes.body) {
                      const reader = videoRes.body.getReader();
                      try {
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          res.write(Buffer.from(value));
                        }
                        return res.end();
                      } catch (streamError) {
                        console.error('[Objects Fallback] Error streaming:', streamError);
                        return res.end();
                      }
                    } else {
                      const buffer = await videoRes.arrayBuffer();
                      return res.send(Buffer.from(buffer));
                    }
                  }
                } catch (e) {
                  // Try next extension
                }
              }
            }
          }
        } catch (dbError) {
          console.error('[Objects Fallback] Database lookup error:', dbError);
        }

        // FALLBACK: Try common folder patterns if database lookup didn't find it
        const folderPatterns = [
          'creatorlink/videos/thumbnails',
          'creatorlink/videos',
          'creatorlink/retainer',
          'company-logos',
          'profile-images',
          'verification-documents',
          '' // Root folder (no prefix)
        ];

        // Try to fetch as image with different folder patterns
        // We'll try the most common extension (jpg) first
        for (const folder of folderPatterns) {
          const path = folder ? `${folder}/${publicId}` : publicId;

          // Try common image extensions
          for (const ext of ['jpg', 'png', 'jpeg']) {
            const imageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${path}.${ext}`;
            try {
              const imageRes = await fetch(imageUrl);
              if (imageRes.ok) {
                console.log(`[Objects Fallback] ✓ Found as image: ${imageUrl}`);
                const contentType = imageRes.headers.get("content-type");
                if (contentType) res.setHeader("Content-Type", contentType);
                res.setHeader("Cache-Control", "public, max-age=31536000");
                res.setHeader("Access-Control-Allow-Origin", "*");
                const buffer = await imageRes.arrayBuffer();
                return res.send(Buffer.from(buffer));
              }
            } catch (e) {
              // Try next extension
            }
          }
        }

        // Try to fetch as video with different folder patterns (with range request support)
        for (const folder of folderPatterns) {
          const path = folder ? `${folder}/${publicId}` : publicId;

          // Try common video extensions
          for (const ext of ['mp4', 'mov', 'webm', 'avi']) {
            const videoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${path}.${ext}`;
            try {
              // Check if the video exists first with a HEAD request
              const headRes = await fetch(videoUrl, { method: 'HEAD' });
              if (headRes.ok) {
                console.log(`[Objects Fallback] ✓ Found as video: ${videoUrl}`);

                // Get the range header from the request (for video seeking)
                const range = req.headers.range;
                const headers: Record<string, string> = {};
                if (range) {
                  headers['Range'] = range;
                }

                // Fetch the video with range support
                const videoRes = await fetch(videoUrl, {
                  method: "GET",
                  headers
                });

                if (!videoRes.ok && videoRes.status !== 206) {
                  continue; // Try next extension
                }

                // Forward the status code (200 for full content, 206 for partial content)
                res.status(videoRes.status);

                // Forward important headers
                const contentType = videoRes.headers.get("content-type");
                if (contentType) res.setHeader("Content-Type", contentType);

                const contentLength = videoRes.headers.get("content-length");
                if (contentLength) res.setHeader("Content-Length", contentLength);

                const contentRange = videoRes.headers.get("content-range");
                if (contentRange) res.setHeader("Content-Range", contentRange);

                const acceptRanges = videoRes.headers.get("accept-ranges");
                if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
                else res.setHeader("Accept-Ranges", "bytes");

                res.setHeader("Cache-Control", "public, max-age=31536000");
                res.setHeader("Access-Control-Allow-Origin", "*");

                // Stream the video content instead of loading into memory
                if (videoRes.body) {
                  const reader = videoRes.body.getReader();
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      res.write(Buffer.from(value));
                    }
                    return res.end();
                  } catch (streamError) {
                    console.error('[Objects Fallback] Error streaming video:', streamError);
                    return res.end();
                  }
                } else {
                  // Fallback if streaming not available
                  const buffer = await videoRes.arrayBuffer();
                  return res.send(Buffer.from(buffer));
                }
              }
            } catch (e) {
              // Try next extension
            }
          }
        }

        console.log(`[Objects Fallback] ✗ Not found in any Cloudinary folder`);
        return res.sendStatus(404);
      }
      // Log unexpected errors only
      console.error("Error checking object access:", error);
      return res.sendStatus(500);
    }
  });

  // Debug endpoint to check video URLs in database
  app.get("/api/debug/videos", requireAuth, async (req, res) => {
    try {
      const videos = await db.select().from(offerVideos);

      const videoStats = {
        total: videos.length,
        withCloudinaryUrls: videos.filter(v => v.videoUrl?.includes('cloudinary.com')).length,
        withObjectsUrls: videos.filter(v => v.videoUrl?.startsWith('/objects/')).length,
        withOtherUrls: videos.filter(v => v.videoUrl && !v.videoUrl.includes('cloudinary.com') && !v.videoUrl.startsWith('/objects/')).length,
        videos: videos.map(v => ({
          id: v.id,
          offerId: v.offerId,
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          urlType: v.videoUrl?.includes('cloudinary.com') ? 'cloudinary' :
                   v.videoUrl?.startsWith('/objects/') ? 'objects' : 'other'
        }))
      };

      res.json(videoStats);
    } catch (error: any) {
      console.error('[Debug Videos] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const folder = req.body.folder || undefined; // Optional folder parameter
    const resourceType = req.body.resourceType || 'auto'; // Optional resource type (image, video, auto)
    const contentType = req.body.contentType || undefined; // Optional content type from client
    const fileName = req.body.fileName || undefined; // Optional original filename
    console.log('[Upload API] Requested folder:', req.body.folder);
    console.log('[Upload API] Requested resourceType:', req.body.resourceType);
    console.log('[Upload API] Requested contentType:', contentType);
    console.log('[Upload API] Requested fileName:', fileName);
    console.log('[Upload API] Folder parameter passed to service:', folder);
    const uploadParams = await objectStorageService.getObjectEntityUploadURL(folder, resourceType, contentType, fileName);
    console.log('[Upload API] Upload params returned:', uploadParams);
    res.json(uploadParams);
  });

  // Configure multer for file uploads (store in memory as buffer)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Endpoint to generate signed URL for reading an existing file
  // Query params: download=true (forces download with Content-Disposition), name=filename (custom download name)
  app.get("/api/get-signed-url/:filename(*)", requireAuth, async (req, res) => {
    try {
      const filename = req.params.filename;
      const isDownload = req.query.download === 'true';
      const customName = req.query.name as string | undefined;
      const objectStorageService = new ObjectStorageService();

      // Import Storage from @google-cloud/storage
      const { Storage } = await import('@google-cloud/storage');

      // Initialize Google Cloud Storage with service account key
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'tool-development-478707';
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';

      let gcsStorage: any;
      // Option 1: Use credentials from JSON string (best for production/Render)
      const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        gcsStorage = new Storage({
          projectId: projectId || credentials.project_id,
          credentials,
        });
      }
      // Option 2: Use key file path (for local development)
      else if (process.env.GOOGLE_CLOUD_KEYFILE) {
        gcsStorage = new Storage({
          projectId,
          keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
        });
      }
      // Option 3: Fallback to default credentials (useful for GCP environments)
      else {
        gcsStorage = new Storage({ projectId });
      }

      // Determine content type based on file extension
      const ext = filename.split('.').pop()?.toLowerCase();
      const contentTypeMap: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
      };
      const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

      // Build options with Content-Type and optional Content-Disposition
      const options: any = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + 60 * 60 * 1000, // 1 hour from now
        responseContentType: contentType,
      };

      // Set Content-Disposition based on mode
      if (isDownload) {
        const downloadName = customName || filename.split('/').pop() || 'download';
        options.responseContentDisposition = `attachment; filename="${downloadName}"`;
      } else {
        // For viewing, set inline to display in browser
        options.responseContentDisposition = 'inline';
      }

      const [url] = await gcsStorage
        .bucket(bucketName)
        .file(filename)
        .getSignedUrl(options);

      console.log('[Signed URL API] Generated signed URL for:', filename, isDownload ? '(download)' : '(view)', 'contentType:', contentType);
      res.json({ url });
    } catch (error: any) {
      console.error('Error generating signed URL:', error);
      res.status(500).json({ error: 'Failed to generate URL', details: error.message });
    }
  });

  // Endpoint to upload a file directly and get its signed URL
  app.post("/api/upload-file", requireAuth, upload.single('file'), async (req: ExpressRequest, res) => {
    try {
      // Type assertion for multer's file property
      const multerReq = req as ExpressRequest & { file?: MulterFile };

      if (!multerReq.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = multerReq.file;
      const folder = req.body.folder || 'affiliatexchange/uploads';
      const resourceType = req.body.resourceType || 'auto';

      // Import Storage from @google-cloud/storage
      const { Storage } = await import('@google-cloud/storage');

      // Initialize Google Cloud Storage
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'tool-development-478707';
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';

      let gcsStorage: any;
      // Option 1: Use credentials from JSON string (best for production/Render)
      const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        gcsStorage = new Storage({
          projectId: projectId || credentials.project_id,
          credentials,
        });
      }
      // Option 2: Use key file path (for local development)
      else if (process.env.GOOGLE_CLOUD_KEYFILE) {
        gcsStorage = new Storage({
          projectId,
          keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
        });
      }
      // Option 3: Fallback to default credentials (useful for GCP environments)
      else {
        gcsStorage = new Storage({ projectId });
      }

      // Generate unique filename with original extension
      const { randomUUID } = await import('crypto');
      const ext = file.originalname.split('.').pop();
      const filename = `${randomUUID()}.${ext}`;
      const destination = `${folder}/${filename}`;

      const blob = gcsStorage.bucket(bucketName).file(destination);

      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype
        }
      });

      blobStream.on('error', (err: any) => {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: err.message });
      });

      blobStream.on('finish', async () => {
        try {
          // Generate signed URL for the uploaded file
          const [url] = await blob.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000,
          });

          console.log('[Direct Upload API] File uploaded successfully:', destination);
          res.json({
            message: 'File uploaded successfully',
            filename: destination,
            originalName: file.originalname,
            url: url,
            publicUrl: `https://storage.googleapis.com/${bucketName}/${destination}`
          });
        } catch (error: any) {
          console.error('Error generating signed URL after upload:', error);
          res.status(500).json({ error: 'File uploaded but failed to generate signed URL' });
        }
      });

      blobStream.end(file.buffer);
    } catch (error: any) {
      console.error('Error in direct upload:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/company-logos", requireAuth, requireRole('company'), async (req, res) => {
    if (!req.body.logoUrl) {
      return res.status(400).json({ error: "logoUrl is required" });
    }
    const userId = (req.user as any).id;
    try {
      // Don't normalize logo URLs - keep the full Cloudinary URL for proper display
      const logoUrl = req.body.logoUrl;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (companyProfile) {
        await storage.updateCompanyProfile(userId, { logoUrl });
      }
      res.status(200).json({ objectPath: logoUrl });
    } catch (error) {
      console.error("Error setting company logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Offer Videos endpoints
  app.get("/api/offers/:offerId/videos", requireAuth, async (req, res) => {
    try {
      const videos = await storage.getOfferVideos(req.params.offerId);
      res.json(videos);
    } catch (error: any) {
      console.error("Error fetching offer videos:", error);
      res.status(500).send(error.message);
    }
  });

  app.post("/api/offers/:offerId/videos", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const offerId = req.params.offerId;
      
      // Verify the offer belongs to this company
      const offer = await storage.getOffer(offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Check video count (max 12)
      const existingVideos = await storage.getOfferVideos(offerId);
      if (existingVideos.length >= 12) {
        return res.status(400).json({ error: "Maximum 12 videos allowed per offer" });
      }

      const { videoUrl, title, description, creatorCredit, originalPlatform, thumbnailUrl } = req.body;
      if (!videoUrl || !title) {
        return res.status(400).json({ error: "videoUrl and title are required" });
      }

      // Don't normalize video or thumbnail URLs - keep the full Cloudinary URLs for proper display
      // This is especially important for videos in nested folders (e.g., creatorlink/videos/{companyId}/{offerId}/)

      // Create video record in database
      const video = await storage.createOfferVideo({
        offerId,
        videoUrl: videoUrl, // Keep full Cloudinary URL instead of normalized path
        title,
        description: description || null,
        creatorCredit: creatorCredit || null,
        originalPlatform: originalPlatform || null,
        thumbnailUrl: thumbnailUrl || null, // Keep full Cloudinary URL
        orderIndex: existingVideos.length, // Auto-increment order
      });

      res.json(video);
    } catch (error: any) {
      console.error("Error creating offer video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/offer-videos/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const videoId = req.params.id;
      
      // Get the video to verify ownership
      const videos = await db.select().from(offerVideos).where(eq(offerVideos.id, videoId)).limit(1);
      const video = videos[0];
      
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Verify the offer belongs to this company
      const offer = await storage.getOffer(video.offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile || offer.companyId !== companyProfile.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Delete the video
      await storage.deleteOfferVideo(videoId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting offer video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =====================================================
  // RETAINER CONTRACTS ROUTES
  // =====================================================

  // Get all retainer contracts for creator (open contracts + contracts assigned to them)
  app.get("/api/retainer-contracts", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;

      // Get open contracts (for browsing/applying)
      const openContracts = await storage.getOpenRetainerContracts();

      // Get contracts assigned to this creator (their approved contracts)
      const myContracts = await storage.getRetainerContractsByCreator(userId);

      // Combine and deduplicate (in case a contract is both open and assigned)
      const contractMap = new Map();

      // Add my contracts first (higher priority)
      myContracts.forEach(contract => {
        contractMap.set(contract.id, contract);
      });

      // Add open contracts (only if not already in map)
      openContracts.forEach(contract => {
        if (!contractMap.has(contract.id)) {
          contractMap.set(contract.id, contract);
        }
      });

      // Convert map back to array
      const allContracts = Array.from(contractMap.values());

      res.json(allContracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get specific retainer contract
  app.get("/api/retainer-contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract) return res.status(404).send("Not found");
      res.json(contract);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Get their retainer contracts
  app.get("/api/company/retainer-contracts", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contracts = await storage.getRetainerContractsByCompany(companyProfile.id);
      res.json(contracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Create retainer contract
  app.post("/api/company/retainer-contracts", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const validated = createRetainerContractSchema.parse(req.body);
      const contract = await storage.createRetainerContract({ ...validated, companyId: companyProfile.id });
      res.json(contract);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Update retainer contract
  app.patch("/api/company/retainer-contracts/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const validated = createRetainerContractSchema.partial().parse(req.body);
      const updated = await storage.updateRetainerContract(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Delete retainer contract
  app.delete("/api/company/retainer-contracts/:id", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      await storage.deleteRetainerContract(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get assigned contracts
  app.get("/api/creator/retainer-contracts", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const contracts = await storage.getRetainerContractsByCreator(userId);
      res.json(contracts);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get applications for a contract
  app.get("/api/retainer-contracts/:id/applications", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const applications = await storage.getRetainerApplicationsByContract(req.params.id);
      res.json(applications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get their applications
  app.get("/api/creator/retainer-applications", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const applications = await storage.getRetainerApplicationsByCreator(userId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Apply to contract
  app.post("/api/creator/retainer-contracts/:id/apply", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;

      // ACCOUNT TYPE RESTRICTION: Check if creator has at least one video platform
      const creatorProfile = await storage.getCreatorProfile(userId);
      const hasVideoPlatform = creatorProfile && (
        creatorProfile.youtubeUrl ||
        creatorProfile.tiktokUrl ||
        creatorProfile.instagramUrl
      );

      if (!hasVideoPlatform) {
        return res.status(400).json({
          error: "Video platform required",
          message: "You must add at least one video platform (YouTube, TikTok, or Instagram) to your profile before applying to retainer contracts. Please complete your profile setup first."
        });
      }

      const body = {
        ...req.body,
        proposedStartDate: req.body.proposedStartDate ? new Date(req.body.proposedStartDate) : undefined,
      };
      const validated = insertRetainerApplicationSchema.omit({ creatorId: true, contractId: true }).parse(body);
      const application = await storage.createRetainerApplication({ ...validated, contractId: req.params.id, creatorId: userId });
      res.json(application);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Approve application
  app.patch("/api/company/retainer-applications/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const application = await storage.getRetainerApplication(req.params.id);
      if (!application) return res.status(404).send("Application not found");
      const contract = await storage.getRetainerContract(application.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const approved = await storage.approveRetainerApplication(req.params.id, application.contractId, application.creatorId);
      res.json(approved);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Company: Reject application
  app.patch("/api/company/retainer-applications/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const application = await storage.getRetainerApplication(req.params.id);
      if (!application) return res.status(404).send("Application not found");
      const contract = await storage.getRetainerContract(application.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      const rejected = await storage.rejectRetainerApplication(req.params.id);
      res.json(rejected);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Get deliverables for contract
  app.get("/api/retainer-contracts/:id/deliverables", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = req.user as any;
      const contract = await storage.getRetainerContract(req.params.id);
      if (!contract) return res.status(404).send("Contract not found");
      if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (!companyProfile || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      } else if (user.role === 'creator') {
        if (contract.assignedCreatorId !== userId) return res.status(403).send("Forbidden");
      }
      const deliverables = await storage.getRetainerDeliverablesByContract(req.params.id);
      res.json(deliverables);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Get their deliverables
  app.get("/api/creator/retainer-deliverables", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deliverables = await storage.getRetainerDeliverablesByCreator(userId);
      res.json(deliverables);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Submit deliverable
  app.post("/api/creator/retainer-deliverables", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validated = insertRetainerDeliverableSchema.omit({ creatorId: true }).parse(req.body);
      const contract = await storage.getRetainerContract(validated.contractId);
      if (!contract || contract.assignedCreatorId !== userId) return res.status(403).send("Forbidden");
      const deliverable = await storage.createRetainerDeliverable({ ...validated, creatorId: userId });
      res.json(deliverable);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  // Creator: Resubmit deliverable (for revisions)
  app.patch("/api/creator/retainer-deliverables/:id/resubmit", requireAuth, requireRole('creator'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deliverable = await storage.getRetainerDeliverable(req.params.id);

      if (!deliverable) return res.status(404).send("Deliverable not found");
      if (deliverable.creatorId !== userId) return res.status(403).send("Forbidden");
      if (deliverable.status !== 'revision_requested') {
        return res.status(400).send("Can only resubmit deliverables with revision_requested status");
      }

      // Delete old video from Cloudinary
      const oldVideoUrl = deliverable.videoUrl;
      if (oldVideoUrl) {
        try {
          const objectStorageService = new ObjectStorageService();
          const publicId = objectStorageService.extractPublicIdFromUrl(oldVideoUrl);
          if (publicId) {
            console.log(`[Resubmit] Deleting old video from Cloudinary: ${publicId}`);
            await objectStorageService.deleteVideo(publicId);
            console.log(`[Resubmit] Successfully deleted old video`);
          }
        } catch (error) {
          console.error(`[Resubmit] Error deleting old video:`, error);
          // Continue even if deletion fails - we don't want to block the resubmission
        }
      }

      // Update deliverable with new video and reset status to pending_review
      const updated = await storage.updateRetainerDeliverable(req.params.id, {
        videoUrl: req.body.videoUrl,
        platformUrl: req.body.platformUrl,
        title: req.body.title,
        description: req.body.description,
        status: 'pending_review',
        submittedAt: new Date(),
        reviewedAt: null,
        reviewNotes: null,
      } as any);

      res.json(updated);
    } catch (error: any) {
      console.error('[Resubmit Deliverable] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company: Approve deliverable
  app.patch("/api/company/retainer-deliverables/:id/approve", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
// Approve the deliverable
const approved = await storage.approveRetainerDeliverable(req.params.id, req.body.reviewNotes);

// Calculate payment amount per video (monthly amount / videos per month)
const monthlyAmount = parseFloat(contract.monthlyAmount);
const videosPerMonth = contract.videosPerMonth || 1;
const paymentPerVideo = monthlyAmount / videosPerMonth;

// Calculate fees with per-company override support (Section 4.3.H)
const retainerFees = await calculateFees(paymentPerVideo, contract.companyId);

// Create payment for the approved deliverable with 'pending' status
// This puts it in the admin queue for processing
const payment = await storage.createRetainerPayment({
  contractId: contract.id,
  deliverableId: deliverable.id,
  creatorId: deliverable.creatorId,
  companyId: contract.companyId,
  amount: paymentPerVideo.toFixed(2),
  grossAmount: retainerFees.grossAmount.toFixed(2),
  platformFeeAmount: retainerFees.platformFeeAmount.toFixed(2),
  processingFeeAmount: retainerFees.stripeFeeAmount.toFixed(2),
  netAmount: retainerFees.netAmount.toFixed(2),
  status: 'pending', // ✅ FIXED: Changed from 'completed' to 'pending' for admin review
  description: `Retainer payment for ${contract.title} - Month ${deliverable.monthNumber}, Video ${deliverable.videoNumber}`,
  initiatedAt: new Date(),
});

const retainerFeeLabel = retainerFees.isCustomFee ? `Custom ${formatFeePercentage(retainerFees.platformFeePercentage)}` : formatFeePercentage(DEFAULT_PLATFORM_FEE_PERCENTAGE);
console.log(`[Retainer Payment] Created pending payment of $${retainerFees.netAmount.toFixed(2)} (net) for creator ${deliverable.creatorId} - Platform Fee: ${retainerFeeLabel}`);

// 🆕 SEND NOTIFICATION TO CREATOR ABOUT PENDING PAYMENT
const creatorUser = await storage.getUserById(deliverable.creatorId);
if (creatorUser) {
  await notificationService.sendNotification(
    deliverable.creatorId,
    'payment_pending',
    'Deliverable Approved - Payment Pending 💰',
    `Your deliverable for "${contract.title}" has been approved! Payment of $${retainerFees.netAmount.toFixed(2)} is pending admin processing.`,
    {
      userName: creatorUser.firstName || creatorUser.username,
      offerTitle: contract.title,
      amount: `$${retainerFees.netAmount.toFixed(2)}`,
      paymentId: payment.id,
    }
  );
  console.log(`[Notification] Sent payment pending notification to creator ${creatorUser.username}`);
}

// 🆕 SEND NOTIFICATION TO ADMIN ABOUT NEW PAYMENT TO PROCESS
// Get admin users to notify them
const adminUsers = await storage.getUsersByRole('admin');
for (const admin of adminUsers) {
  await notificationService.sendNotification(
    admin.id,
    'payment_pending',
    'New Retainer Payment Ready for Processing',
    `A retainer payment of $${retainerFees.netAmount.toFixed(2)} for creator ${creatorUser?.username || 'Unknown'} on "${contract.title}" is ready for processing.`,
    {
      offerTitle: contract.title,
      amount: `$${retainerFees.netAmount.toFixed(2)}`,
      paymentId: payment.id,
    }
  );
}
console.log(`[Notification] Notified admins about new payment ${payment.id}`);

res.json(approved);
    } catch (error: any) {
      console.error('[Approve Deliverable] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company: Reject deliverable
  app.patch("/api/company/retainer-deliverables/:id/reject", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      if (!req.body.reviewNotes) return res.status(400).send("Review notes required");

      const rejected = await storage.rejectRetainerDeliverable(req.params.id, req.body.reviewNotes);

      // 🆕 SEND NOTIFICATION TO CREATOR ABOUT REJECTION
      const creator = await storage.getUserById(deliverable.creatorId);
      if (creator) {
        await notificationService.sendNotification(
          deliverable.creatorId,
          'deliverable_rejected',
          'Deliverable Rejected',
          `Your deliverable for "${contract.title}" (Month ${deliverable.monthNumber}, Video #${deliverable.videoNumber}) has been rejected. Please review the feedback.`,
          {
            userName: creator.firstName || creator.username,
            contractTitle: contract.title,
            reason: req.body.reviewNotes,
            linkUrl: `/retainers/${contract.id}`,
          }
        );
        console.log(`[Notification] Sent deliverable rejection notification to creator ${creator.username}`);
      }

      res.json(rejected);
    } catch (error: any) {
      console.error('[Reject Deliverable] Error:', error);
      res.status(500).send(error.message);
    }
  });

  // Company: Request revision
  app.patch("/api/company/retainer-deliverables/:id/request-revision", requireAuth, requireRole('company'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const companyProfile = await storage.getCompanyProfile(userId);
      if (!companyProfile) return res.status(404).send("Company profile not found");
      const deliverable = await storage.getRetainerDeliverable(req.params.id);
      if (!deliverable) return res.status(404).send("Deliverable not found");
      const contract = await storage.getRetainerContract(deliverable.contractId);
      if (!contract || contract.companyId !== companyProfile.id) return res.status(403).send("Forbidden");
      if (!req.body.reviewNotes) return res.status(400).send("Review notes required");

      const revised = await storage.requestRevision(req.params.id, req.body.reviewNotes);

      // 🆕 SEND NOTIFICATION TO CREATOR ABOUT REVISION REQUEST
      const creator = await storage.getUserById(deliverable.creatorId);
      if (creator) {
        await notificationService.sendNotification(
          deliverable.creatorId,
          'revision_requested',
          'Revision Requested',
          `A revision has been requested for your deliverable on "${contract.title}" (Month ${deliverable.monthNumber}, Video #${deliverable.videoNumber}). Please review the feedback and resubmit.`,
          {
            userName: creator.firstName || creator.username,
            contractTitle: contract.title,
            revisionInstructions: req.body.reviewNotes,
            linkUrl: `/retainers/${contract.id}`,
          }
        );
        console.log(`[Notification] Sent revision request notification to creator ${creator.username}`);
      }

      res.json(revised);
    } catch (error: any) {
      console.error('[Request Revision] Error:', error);
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({
    noServer: true // We'll handle the upgrade manually for authentication
  });

  // Store connected clients
  const clients = new Map<string, WebSocket>();

  // Handle WebSocket upgrade with authentication
  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parseUrl(req.url || '', true);

    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // Get session from cookie
    const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
    const sessionId = cookies['connect.sid'];

    if (!sessionId) {
      console.log('[WebSocket] No session cookie found');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Create a mock request/response to use express-session
    const mockReq: any = Object.create(req);
    mockReq.session = null;
    mockReq.sessionStore = null;
    mockReq.user = null;
    mockReq.isAuthenticated = function() {
      return !!this.user;
    };

    const mockRes: any = {
      getHeader: () => {},
      setHeader: () => {},
      end: () => {}
    };

    // Use the session middleware from the app
    const sessionMiddleware = (app as any)._router.stack
      .find((layer: any) => layer.name === 'session')?.handle;

    if (!sessionMiddleware) {
      console.error('[WebSocket] Session middleware not found');
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
      return;
    }

    sessionMiddleware(mockReq, mockRes, () => {
      passport.initialize()(mockReq, mockRes, () => {
        passport.session()(mockReq, mockRes, () => {
          if (!mockReq.user || !mockReq.isAuthenticated()) {
            console.log('[WebSocket] User not authenticated');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // User is authenticated, complete the WebSocket handshake
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, mockReq);
          });
        });
      });
    });
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    const userId = req.user?.id;

    if (!userId) {
      console.log('[WebSocket] No user ID found after authentication');
      ws.close();
      return;
    }

    console.log(`[WebSocket] User ${userId} connected`);
    clients.set(userId, ws);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat_message') {
          // Save message to database
          const savedMessage = await storage.createMessage({
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            attachments: message.attachments || [],
          });

          // Auto-moderate message for banned content
          try {
            await moderateMessage(savedMessage.id, storage);
          } catch (moderationError) {
            console.error('[WebSocket] Error auto-moderating message:', moderationError);
            // Don't fail the message if moderation fails
          }

          // Find all participants in the conversation
          const conversation = await storage.getConversation(message.conversationId);
          const companyProfile = conversation?.companyId
            ? await storage.getCompanyProfileById(conversation.companyId)
            : null;

          // Send to all participants (company profile -> user account)
          const recipientIds = [conversation.creatorId, companyProfile?.userId || conversation.companyId];
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'new_message',
                message: savedMessage,
              }));
            }
          }
        } else if (message.type === 'typing_start') {
          // Broadcast typing indicator to other participants
          const conversation = await storage.getConversation(message.conversationId);
          const companyProfile = conversation?.companyId
            ? await storage.getCompanyProfileById(conversation.companyId)
            : null;
          const recipientIds = [conversation.creatorId, companyProfile?.userId || conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'user_typing',
                conversationId: message.conversationId,
                userId: userId,
              }));
            }
          }
        } else if (message.type === 'typing_stop') {
          // Broadcast stop typing indicator
          const conversation = await storage.getConversation(message.conversationId);
          const companyProfile = conversation?.companyId
            ? await storage.getCompanyProfileById(conversation.companyId)
            : null;
          const recipientIds = [conversation.creatorId, companyProfile?.userId || conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'user_stop_typing',
                conversationId: message.conversationId,
                userId: userId,
              }));
            }
          }
        } else if (message.type === 'mark_read') {
          // Mark messages as read
          await storage.markMessagesAsRead(message.conversationId, userId);
          
          // Notify the sender that messages have been read
          const conversation = await storage.getConversation(message.conversationId);
          const companyProfile = conversation?.companyId
            ? await storage.getCompanyProfileById(conversation.companyId)
            : null;
          const recipientIds = [conversation.creatorId, companyProfile?.userId || conversation.companyId].filter(id => id !== userId);
          
          for (const recipientId of recipientIds) {
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify({
                type: 'messages_read',
                conversationId: message.conversationId,
                readBy: userId,
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        console.log(`[WebSocket] User ${userId} disconnected`);
        clients.delete(userId);
      }
    });
  });

  // Auto-approval scheduler - runs every minute to check for applications that need auto-approval
  const runAutoApprovalScheduler = async () => {
    try {
      const pendingApplications = await storage.getAllPendingApplications();
      const now = new Date();
      let processedCount = 0;
      
      for (const application of pendingApplications) {
        // Only process pending applications with scheduled auto-approval time
        if (application.status === 'pending' && application.autoApprovalScheduledAt) {
          const scheduledTime = new Date(application.autoApprovalScheduledAt);
          
          // Check if the application is past its 7-minute auto-approval window
          if (now >= scheduledTime) {
            try {
              const trackingCode = `CR-${application.creatorId.substring(0, 8)}-${application.offerId.substring(0, 8)}-${Date.now()}`;
              const port = process.env.PORT || 3000;
              const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
              const trackingLink = `${baseURL}/go/${trackingCode}`;
              
              await storage.approveApplication(
                application.id,
                trackingLink,
                trackingCode
              );

              // 🆕 SEND NOTIFICATION FOR AUTO-APPROVED APPLICATION
              const offer = await storage.getOffer(application.offerId);
              const creator = await storage.getUserById(application.creatorId);

              if (offer && creator) {
                await notificationService.sendNotification(
                  application.creatorId,
                  'application_status_change',
                  'Your application has been approved! 🎉',
                  `Congratulations! Your application for "${offer.title}" has been auto-approved. You can now start promoting this offer.`,
                  {
                    userName: creator.firstName || creator.username,
                    offerTitle: offer.title,
                    trackingLink: trackingLink,
                    trackingCode: trackingCode,
                    applicationId: application.id,
                    applicationStatus: 'approved',
                  }
                );
                console.log(`[Auto-Approval] Sent notification to creator ${creator.username}`);
              }
              
              processedCount++;
              console.log(`[Auto-Approval] ✓ Approved application ${application.id} (${processedCount} total)`);
            } catch (error) {
              console.error(`[Auto-Approval] ✗ Failed to approve application ${application.id}:`, error);
            }
          }
        }
      }
      
      if (processedCount > 0) {
        console.log(`[Auto-Approval] Processed ${processedCount} applications successfully`);
      }
    } catch (error) {
      console.error('[Auto-Approval] Scheduler error:', error);
    }
  };

  // Run scheduler every minute
  console.log('[Auto-Approval] Scheduler started - checking every 60 seconds');
  setInterval(runAutoApprovalScheduler, 60000);

  // Run once immediately on startup
  runAutoApprovalScheduler();

  // ============ Platform Health Monitoring Endpoints (Section 4.3.G) ============

  // Get comprehensive platform health report
  app.get("/api/admin/platform-health", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const report = await getPlatformHealthReport();
      res.json(report);
    } catch (error: any) {
      console.error('[Platform Health] Error getting health report:', error);
      res.status(500).json({ error: "Failed to get platform health report", details: error.message });
    }
  });

  // Get latest health snapshot
  app.get("/api/admin/platform-health/snapshot", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const snapshot = await getLatestHealthSnapshot();
      res.json(snapshot || { message: "No health snapshots available" });
    } catch (error: any) {
      console.error('[Platform Health] Error getting snapshot:', error);
      res.status(500).json({ error: "Failed to get health snapshot", details: error.message });
    }
  });

  // Get API metrics summary
  app.get("/api/admin/platform-health/api-metrics", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await getRecentApiMetrics(hours);
      res.json(metrics);
    } catch (error: any) {
      console.error('[Platform Health] Error getting API metrics:', error);
      res.status(500).json({ error: "Failed to get API metrics", details: error.message });
    }
  });

  // Get API metrics time series for charts
  app.get("/api/admin/platform-health/api-metrics/timeseries", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const timeSeries = await getApiMetricsTimeSeries(days);
      res.json(timeSeries);
    } catch (error: any) {
      console.error('[Platform Health] Error getting API metrics time series:', error);
      res.status(500).json({ error: "Failed to get API metrics time series", details: error.message });
    }
  });

  // Get storage metrics
  app.get("/api/admin/platform-health/storage", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const storage = await calculateStorageUsage();
      res.json(storage);
    } catch (error: any) {
      console.error('[Platform Health] Error getting storage metrics:', error);
      res.status(500).json({ error: "Failed to get storage metrics", details: error.message });
    }
  });

  // Get storage metrics time series
  app.get("/api/admin/platform-health/storage/timeseries", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const timeSeries = await getStorageMetricsTimeSeries(days);
      res.json(timeSeries);
    } catch (error: any) {
      console.error('[Platform Health] Error getting storage time series:', error);
      res.status(500).json({ error: "Failed to get storage time series", details: error.message });
    }
  });

  // Get video hosting costs
  app.get("/api/admin/platform-health/video-costs", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const costs = await calculateVideoHostingCosts();
      res.json(costs);
    } catch (error: any) {
      console.error('[Platform Health] Error getting video costs:', error);
      res.status(500).json({ error: "Failed to get video costs", details: error.message });
    }
  });

  // Get video costs time series
  app.get("/api/admin/platform-health/video-costs/timeseries", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const timeSeries = await getVideoCostsTimeSeries(days);
      res.json(timeSeries);
    } catch (error: any) {
      console.error('[Platform Health] Error getting video costs time series:', error);
      res.status(500).json({ error: "Failed to get video costs time series", details: error.message });
    }
  });

  // Get recent error logs
  app.get("/api/admin/platform-health/errors", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const errors = await getRecentErrorLogs(limit);
      res.json(errors);
    } catch (error: any) {
      console.error('[Platform Health] Error getting error logs:', error);
      res.status(500).json({ error: "Failed to get error logs", details: error.message });
    }
  });

  // Manually trigger health snapshot (for testing/admin)
  app.post("/api/admin/platform-health/snapshot", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await createHealthSnapshot();
      const snapshot = await getLatestHealthSnapshot();
      res.json({ message: "Health snapshot created", snapshot });
    } catch (error: any) {
      console.error('[Platform Health] Error creating snapshot:', error);
      res.status(500).json({ error: "Failed to create health snapshot", details: error.message });
    }
  });

  // Manually trigger metrics flush (for testing/admin)
  app.post("/api/admin/platform-health/flush-metrics", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await flushMetrics();
      res.json({ message: "Metrics flushed successfully" });
    } catch (error: any) {
      console.error('[Platform Health] Error flushing metrics:', error);
      res.status(500).json({ error: "Failed to flush metrics", details: error.message });
    }
  });

  // Manually record daily metrics (for testing/admin)
  app.post("/api/admin/platform-health/record-daily", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      await Promise.all([
        recordDailyStorageMetrics(),
        recordDailyVideoCosts(),
      ]);
      res.json({ message: "Daily metrics recorded successfully" });
    } catch (error: any) {
      console.error('[Platform Health] Error recording daily metrics:', error);
      res.status(500).json({ error: "Failed to record daily metrics", details: error.message });
    }
  });

  // ============ End Platform Health Monitoring Endpoints ============

  // Debug endpoint to check database URLs
  app.get("/api/admin/debug-urls", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      // Get sample URLs from database
      const sampleOffers = await db.select().from(offers).limit(3);
      const sampleVideos = await db.select().from(offerVideos).limit(5);

      res.json({
        offers: sampleOffers.map(o => ({
          id: o.id,
          title: o.title,
          featuredImageUrl: o.featuredImageUrl
        })),
        videos: sampleVideos.map(v => ({
          id: v.id,
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl
        }))
      });
    } catch (error: any) {
      console.error('[Debug] Error:', error);
      res.status(500).json({ error: "Debug failed", details: error.message });
    }
  });

  // Migration endpoint to fix normalized Cloudinary URLs
  app.post("/api/admin/migrate-cloudinary-urls", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);

      // Only allow admins to run migrations
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      console.log('[Migration] Starting Cloudinary URL fix...');

      const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dilp6tuin";
      let totalFixed = 0;

      // Function to denormalize paths
      const denormalizeCloudinaryPath = (normalizedPath: string, resourceType: 'image' | 'video' = 'image'): string => {
        if (!normalizedPath || !normalizedPath.startsWith('/objects/')) {
          return normalizedPath;
        }
        const publicId = normalizedPath.replace('/objects/', '');
        const extension = resourceType === 'video' ? 'mp4' : 'jpg';
        return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${publicId}.${extension}`;
      };

      // Fix offer featured images
      const offersResult = await db.select().from(offers).where(sql`featured_image_url LIKE '/objects/%'`);
      console.log(`[Migration] Found ${offersResult.length} offers with normalized featured images`);

      for (const offer of offersResult) {
        if (offer.featuredImageUrl) {
          const newUrl = denormalizeCloudinaryPath(offer.featuredImageUrl, 'image');
          await db.update(offers)
            .set({ featuredImageUrl: newUrl })
            .where(eq(offers.id, offer.id));
          totalFixed++;
          console.log(`  ✓ Fixed offer ${offer.id}: ${offer.featuredImageUrl} -> ${newUrl}`);
        }
      }

      // Fix video thumbnails
      const videosWithThumbsResult = await db.select().from(offerVideos).where(sql`thumbnail_url LIKE '/objects/%'`);
      console.log(`[Migration] Found ${videosWithThumbsResult.length} videos with normalized thumbnails`);

      for (const video of videosWithThumbsResult) {
        if (video.thumbnailUrl) {
          const newUrl = denormalizeCloudinaryPath(video.thumbnailUrl, 'image');
          await db.update(offerVideos)
            .set({ thumbnailUrl: newUrl })
            .where(eq(offerVideos.id, video.id));
          totalFixed++;
          console.log(`  ✓ Fixed video thumbnail ${video.id}: ${video.thumbnailUrl} -> ${newUrl}`);
        }
      }

      // Fix video URLs
      const videosWithUrlsResult = await db.select().from(offerVideos).where(sql`video_url LIKE '/objects/%'`);
      console.log(`[Migration] Found ${videosWithUrlsResult.length} videos with normalized video URLs`);

      for (const video of videosWithUrlsResult) {
        if (video.videoUrl) {
          const newUrl = denormalizeCloudinaryPath(video.videoUrl, 'video');
          await db.update(offerVideos)
            .set({ videoUrl: newUrl })
            .where(eq(offerVideos.id, video.id));
          totalFixed++;
          console.log(`  ✓ Fixed video URL ${video.id}: ${video.videoUrl} -> ${newUrl}`);
        }
      }

      // Fix company logos
      const companiesResult = await db.select().from(companyProfiles).where(sql`logo_url LIKE '/objects/%'`);
      console.log(`[Migration] Found ${companiesResult.length} companies with normalized logos`);

      for (const company of companiesResult) {
        if (company.logoUrl) {
          const newUrl = denormalizeCloudinaryPath(company.logoUrl, 'image');
          await db.update(companyProfiles)
            .set({ logoUrl: newUrl })
            .where(eq(companyProfiles.id, company.id));
          totalFixed++;
          console.log(`  ✓ Fixed company logo ${company.id}: ${company.logoUrl} -> ${newUrl}`);
        }
      }

      console.log(`[Migration] ✓ Complete! Fixed ${totalFixed} URLs`);

      res.json({
        success: true,
        message: `Migration completed successfully`,
        stats: {
          offersFixed: offersResult.length,
          videoThumbnailsFixed: videosWithThumbsResult.length,
          videoUrlsFixed: videosWithUrlsResult.length,
          companyLogosFixed: companiesResult.length,
          totalFixed
        }
      });
    } catch (error: any) {
      console.error('[Migration] Error:', error);
      res.status(500).json({ error: "Migration failed", details: error.message });
    }
  });

  return httpServer;
}