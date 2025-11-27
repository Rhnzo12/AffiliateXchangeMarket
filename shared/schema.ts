import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['creator', 'company', 'admin']);
export const userAccountStatusEnum = pgEnum('user_account_status', ['active', 'suspended', 'banned']);
export const companyStatusEnum = pgEnum('company_status', ['pending', 'approved', 'rejected', 'suspended']);
export const offerStatusEnum = pgEnum('offer_status', ['draft', 'pending_review', 'approved', 'paused', 'archived']);
export const commissionTypeEnum = pgEnum('commission_type', ['per_sale', 'per_lead', 'per_click', 'monthly_retainer', 'hybrid']);
export const applicationStatusEnum = pgEnum('application_status', [
  'pending',
  'approved',
  'active',
  'paused',
  'completed',
  'rejected',
]);
export const payoutMethodEnum = pgEnum('payout_method', ['etransfer', 'wire', 'paypal', 'crypto']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'processing', 'completed', 'failed', 'refunded']);
export const retainerStatusEnum = pgEnum('retainer_status', ['open', 'in_progress', 'completed', 'cancelled', 'paused']);
export const retainerApplicationStatusEnum = pgEnum('retainer_application_status', ['pending', 'approved', 'rejected']);
export const deliverableStatusEnum = pgEnum('deliverable_status', ['pending_review', 'approved', 'revision_requested', 'rejected']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'application_status_change',
  'new_message',
  'payment_received',
  'payment_pending',
  'payment_approved',
  'payment_disputed',
  'payment_dispute_resolved',
  'payment_refunded',
  'payment_failed_insufficient_funds',
  'offer_approved',
  'offer_rejected',
  'offer_edit_requested',
  'offer_removed',
  'new_application',
  'review_received',
  'system_announcement',
  'registration_approved',
  'registration_rejected',
  'work_completion_approval',
  'priority_listing_expiring',
  'deliverable_rejected',
  'revision_requested',
  'email_verification',
  'password_reset',
  'content_flagged',
  'high_risk_company',
  'account_deletion_otp',
  'password_change_otp'
]);
export const keywordCategoryEnum = pgEnum('keyword_category', ['profanity', 'spam', 'legal', 'harassment', 'custom']);
export const contentTypeEnum = pgEnum('content_type', ['message', 'review']);
export const flagStatusEnum = pgEnum('flag_status', ['pending', 'reviewed', 'dismissed', 'action_taken']);
export const emailTemplateCategoryEnum = pgEnum('email_template_category', [
  'application',
  'payment',
  'offer',
  'company',
  'system',
  'moderation',
  'authentication'
]);

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique().notNull(),
  password: varchar("password"),
  googleId: varchar("google_id").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default('creator'),
  accountStatus: userAccountStatusEnum("account_status").notNull().default('active'),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationTokenExpiry: timestamp("email_verification_token_expiry"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry"),
  accountDeletionOtp: varchar("account_deletion_otp"),
  accountDeletionOtpExpiry: timestamp("account_deletion_otp_expiry"),
  passwordChangeOtp: varchar("password_change_otp"),
  passwordChangeOtpExpiry: timestamp("password_change_otp_expiry"),
  // Two-Factor Authentication fields
  twoFactorSecret: varchar("two_factor_secret", { length: 64 }),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorBackupCodes: text("two_factor_backup_codes"), // JSON array of hashed backup codes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  creatorProfile: one(creatorProfiles, {
    fields: [users.id],
    references: [creatorProfiles.userId],
  }),
  companyProfile: one(companyProfiles, {
    fields: [users.id],
    references: [companyProfiles.userId],
  }),
  applications: many(applications),
  messages: many(messages),
  reviews: many(reviews),
  favorites: many(favorites),
}));

// Creator profiles
export const creatorProfiles = pgTable("creator_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  bio: text("bio"),
  youtubeUrl: varchar("youtube_url"),
  tiktokUrl: varchar("tiktok_url"),
  instagramUrl: varchar("instagram_url"),
  youtubeFollowers: integer("youtube_followers"),
  tiktokFollowers: integer("tiktok_followers"),
  instagramFollowers: integer("instagram_followers"),
  niches: text("niches").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creatorProfilesRelations = relations(creatorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [creatorProfiles.userId],
    references: [users.id],
  }),
}));

// Website verification method enum
export const websiteVerificationMethodEnum = pgEnum('website_verification_method', ['meta_tag', 'dns_txt']);

// Company profiles
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  legalName: varchar("legal_name").notNull(),
  tradeName: varchar("trade_name"),
  industry: varchar("industry"),
  websiteUrl: varchar("website_url"),
  companySize: varchar("company_size"),
  yearFounded: integer("year_founded"),
  logoUrl: varchar("logo_url"),
  description: text("description"),
  contactName: varchar("contact_name"),
  contactJobTitle: varchar("contact_job_title"),
  phoneNumber: varchar("phone_number"),
  businessAddress: text("business_address"),
  verificationDocumentUrl: varchar("verification_document_url"),
  linkedinUrl: varchar("linkedin_url"),
  twitterUrl: varchar("twitter_url"),
  facebookUrl: varchar("facebook_url"),
  instagramUrl: varchar("instagram_url"),
  // Website verification fields
  websiteVerificationToken: varchar("website_verification_token"),
  websiteVerified: boolean("website_verified").notNull().default(false),
  websiteVerificationMethod: websiteVerificationMethodEnum("website_verification_method"),
  websiteVerifiedAt: timestamp("website_verified_at"),
  // Per-company fee override (null means use default platform fee)
  customPlatformFeePercentage: decimal("custom_platform_fee_percentage", { precision: 5, scale: 4 }),
  status: companyStatusEnum("status").notNull().default('pending'),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyProfilesRelations = relations(companyProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [companyProfiles.userId],
    references: [users.id],
  }),
  offers: many(offers),
  verificationDocuments: many(companyVerificationDocuments),
}));

// Company Verification Documents (for multiple document uploads)
export const companyVerificationDocuments = pgTable("company_verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  documentUrl: varchar("document_url").notNull(),
  documentName: varchar("document_name").notNull(),
  documentType: varchar("document_type").notNull(), // 'pdf', 'image'
  fileSize: integer("file_size"), // in bytes
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyVerificationDocumentsRelations = relations(companyVerificationDocuments, ({ one }) => ({
  company: one(companyProfiles, {
    fields: [companyVerificationDocuments.companyId],
    references: [companyProfiles.id],
  }),
}));

// Offers
export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 100 }).notNull(),
  productName: varchar("product_name").notNull(),
  shortDescription: varchar("short_description", { length: 200 }).notNull(),
  fullDescription: text("full_description").notNull(),
  primaryNiche: varchar("primary_niche").notNull(),
  additionalNiches: text("additional_niches").array().default(sql`ARRAY[]::text[]`),
  productUrl: varchar("product_url").notNull(),
  featuredImageUrl: varchar("featured_image_url"),
  commissionType: commissionTypeEnum("commission_type").notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }),
  cookieDuration: integer("cookie_duration"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  minimumPayout: decimal("minimum_payout", { precision: 10, scale: 2 }),
  retainerAmount: decimal("retainer_amount", { precision: 10, scale: 2 }),
  retainerDeliverables: jsonb("retainer_deliverables"),
  paymentSchedule: varchar("payment_schedule"),
  minimumFollowers: integer("minimum_followers"),
  allowedPlatforms: text("allowed_platforms").array().default(sql`ARRAY[]::text[]`),
  geographicRestrictions: text("geographic_restrictions").array().default(sql`ARRAY[]::text[]`),
  ageRestriction: varchar("age_restriction"),
  contentStyleRequirements: text("content_style_requirements"),
  brandSafetyRequirements: text("brand_safety_requirements"),
  customTerms: text("custom_terms"),
  creatorRequirements: text("creator_requirements"),
  status: offerStatusEnum("status").notNull().default('pending_review'),
  viewCount: integer("view_count").default(0),
  applicationCount: integer("application_count").default(0),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  featuredOnHomepage: boolean("featured_on_homepage").default(false),
  listingFee: decimal("listing_fee", { precision: 10, scale: 2 }).default('0'),
  editRequests: jsonb("edit_requests").default(sql`'[]'::jsonb`),
  priorityExpiresAt: timestamp("priority_expires_at"),
  priorityPurchasedAt: timestamp("priority_purchased_at"),
  exclusivityRequired: boolean("exclusivity_required").default(false),
  contentApprovalRequired: boolean("content_approval_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const offersRelations = relations(offers, ({ one, many }) => ({
  company: one(companyProfiles, {
    fields: [offers.companyId],
    references: [companyProfiles.id],
  }),
  applications: many(applications),
  videos: many(offerVideos),
  favorites: many(favorites),
}));

// Offer Videos
export const offerVideos = pgTable("offer_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 100 }).notNull(),
  description: varchar("description", { length: 300 }),
  creatorCredit: varchar("creator_credit"),
  originalPlatform: varchar("original_platform"),
  videoUrl: varchar("video_url").notNull(),
  thumbnailUrl: varchar("thumbnail_url"),
  isPrimary: boolean("is_primary").default(false),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offerVideosRelations = relations(offerVideos, ({ one }) => ({
  offer: one(offers, {
    fields: [offerVideos.offerId],
    references: [offers.id],
  }),
}));

// Applications
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  message: text("message"),
  status: applicationStatusEnum("status").notNull().default('pending'),
  trackingLink: varchar("tracking_link"),
  trackingCode: varchar("tracking_code"),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  autoApprovalScheduledAt: timestamp("auto_approval_scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  creator: one(users, {
    fields: [applications.creatorId],
    references: [users.id],
  }),
  offer: one(offers, {
    fields: [applications.offerId],
    references: [offers.id],
  }),
  reviews: many(reviews),
  analytics: many(analytics),
}));

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  lastMessageAt: timestamp("last_message_at"),
  creatorUnreadCount: integer("creator_unread_count").default(0),
  companyUnreadCount: integer("company_unread_count").default(0),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  application: one(applications, {
    fields: [conversations.applicationId],
    references: [applications.id],
  }),
  creator: one(users, {
    fields: [conversations.creatorId],
    references: [users.id],
  }),
  company: one(companyProfiles, {
    fields: [conversations.companyId],
    references: [companyProfiles.id],
  }),
  messages: many(messages),
}));

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`),
  isRead: boolean("is_read").default(false),
  deletedFor: text("deleted_for").array().default(sql`ARRAY[]::text[]`), // Array of user IDs who deleted "for me"
  createdAt: timestamp("created_at").defaultNow(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

// Reviews
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  reviewText: text("review_text"),
  overallRating: integer("overall_rating").notNull(),
  paymentSpeedRating: integer("payment_speed_rating"),
  communicationRating: integer("communication_rating"),
  offerQualityRating: integer("offer_quality_rating"),
  supportRating: integer("support_rating"),
  companyResponse: text("company_response"),
  companyRespondedAt: timestamp("company_responded_at"),
  adminResponse: text("admin_response"),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by").references(() => users.id, { onDelete: 'set null' }),
  isEdited: boolean("is_edited").default(false),
  adminNote: text("admin_note"),
  isApproved: boolean("is_approved").default(true),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  application: one(applications, {
    fields: [reviews.applicationId],
    references: [applications.id],
  }),
  creator: one(users, {
    fields: [reviews.creatorId],
    references: [users.id],
  }),
  company: one(companyProfiles, {
    fields: [reviews.companyId],
    references: [companyProfiles.id],
  }),
}));

// Favorites
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favoritesRelations = relations(favorites, ({ one }) => ({
  creator: one(users, {
    fields: [favorites.creatorId],
    references: [users.id],
  }),
  offer: one(offers, {
    fields: [favorites.offerId],
    references: [offers.id],
  }),
}));

// Analytics
export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  clicks: integer("clicks").default(0),
  uniqueClicks: integer("unique_clicks").default(0),
  conversions: integer("conversions").default(0),
  earnings: decimal("earnings", { precision: 10, scale: 2 }).default('0'),
  earningsPaid: decimal("earnings_paid", { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const analyticsRelations = relations(analytics, ({ one }) => ({
  application: one(applications, {
    fields: [analytics.applicationId],
    references: [applications.id],
  }),
}));

// Click Events
export const clickEvents = pgTable("click_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent"),
  referer: text("referer"),
  country: varchar("country"),
  city: varchar("city"),
  fraudScore: integer("fraud_score").default(0),
  fraudFlags: text("fraud_flags"),
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  utmTerm: varchar("utm_term"),
  utmContent: varchar("utm_content"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const clickEventsRelations = relations(clickEvents, ({ one }) => ({
  application: one(applications, {
    fields: [clickEvents.applicationId],
    references: [applications.id],
  }),
}));

// Payment Settings
export const paymentSettings = pgTable("payment_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  payoutMethod: payoutMethodEnum("payout_method").notNull(),
  payoutEmail: varchar("payout_email"),
  bankRoutingNumber: varchar("bank_routing_number"),
  bankAccountNumber: varchar("bank_account_number"),
  paypalEmail: varchar("paypal_email"),
  cryptoWalletAddress: varchar("crypto_wallet_address"),
  cryptoNetwork: varchar("crypto_network"),
  stripeAccountId: varchar("stripe_account_id"), // Stripe Connect account ID for e-transfers
  taxInformation: jsonb("tax_information"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentSettingsRelations = relations(paymentSettings, ({ one }) => ({
  user: one(users, {
    fields: [paymentSettings.userId],
    references: [users.id],
  }),
}));

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  offerId: varchar("offer_id").notNull().references(() => offers.id, { onDelete: 'cascade' }),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  platformFeeAmount: decimal("platform_fee_amount", { precision: 10, scale: 2 }).notNull(),
  stripeFeeAmount: decimal("stripe_fee_amount", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeTransferId: varchar("stripe_transfer_id"),
  providerTransactionId: varchar("provider_transaction_id"), // Transaction ID from payment provider (PayPal, bank, crypto, etc.)
  providerResponse: jsonb("provider_response"), // Full response from payment provider
  status: paymentStatusEnum("status").notNull().default('pending'),
  paymentMethod: varchar("payment_method"),
  description: text("description"),
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  application: one(applications, {
    fields: [payments.applicationId],
    references: [applications.id],
  }),
  creator: one(users, {
    fields: [payments.creatorId],
    references: [users.id],
  }),
  company: one(companyProfiles, {
    fields: [payments.companyId],
    references: [companyProfiles.id],
  }),
  offer: one(offers, {
    fields: [payments.offerId],
    references: [offers.id],
  }),
}));

// Retainer Contracts
export const retainerContracts = pgTable("retainer_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  videosPerMonth: integer("videos_per_month").notNull(),
  durationMonths: integer("duration_months").notNull(),
  requiredPlatform: varchar("required_platform").notNull(),
  platformAccountDetails: text("platform_account_details"),
  contentGuidelines: text("content_guidelines"),
  brandSafetyRequirements: text("brand_safety_requirements"),
  contentApprovalRequired: boolean("content_approval_required").notNull().default(false),
  exclusivityRequired: boolean("exclusivity_required").notNull().default(false),
  minimumVideoLengthSeconds: integer("minimum_video_length_seconds"),
  postingSchedule: text("posting_schedule"),
  retainerTiers: jsonb("retainer_tiers").default(sql`'[]'::jsonb`),
  minimumFollowers: integer("minimum_followers"),
  niches: text("niches").array().default(sql`ARRAY[]::text[]`),
  status: retainerStatusEnum("status").notNull().default('open'),
  assignedCreatorId: varchar("assigned_creator_id").references(() => users.id, { onDelete: 'set null' }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const retainerContractsRelations = relations(retainerContracts, ({ one, many }) => ({
  company: one(companyProfiles, {
    fields: [retainerContracts.companyId],
    references: [companyProfiles.id],
  }),
  assignedCreator: one(users, {
    fields: [retainerContracts.assignedCreatorId],
    references: [users.id],
  }),
  applications: many(retainerApplications),
  deliverables: many(retainerDeliverables),
}));

// Retainer Applications
export const retainerApplications = pgTable("retainer_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => retainerContracts.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  portfolioLinks: text("portfolio_links").array().default(sql`ARRAY[]::text[]`),
  proposedStartDate: timestamp("proposed_start_date"),
  status: retainerApplicationStatusEnum("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const retainerApplicationsRelations = relations(retainerApplications, ({ one }) => ({
  contract: one(retainerContracts, {
    fields: [retainerApplications.contractId],
    references: [retainerContracts.id],
  }),
  creator: one(users, {
    fields: [retainerApplications.creatorId],
    references: [users.id],
  }),
}));

// Retainer Deliverables
export const retainerDeliverables = pgTable("retainer_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => retainerContracts.id, { onDelete: 'cascade' }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  monthNumber: integer("month_number").notNull(),
  videoNumber: integer("video_number").notNull(),
  videoUrl: varchar("video_url").notNull(),
  platformUrl: varchar("platform_url"),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  viewCount: integer("view_count"),
  engagement: jsonb("engagement"),
  status: deliverableStatusEnum("status").notNull().default('pending_review'),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const retainerDeliverablesRelations = relations(retainerDeliverables, ({ one }) => ({
  contract: one(retainerContracts, {
    fields: [retainerDeliverables.contractId],
    references: [retainerContracts.id],
  }),
  creator: one(users, {
    fields: [retainerDeliverables.creatorId],
    references: [users.id],
  }),
}));

export const retainerPayments = pgTable("retainer_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => retainerContracts.id, { onDelete: 'cascade' }),
  deliverableId: varchar("deliverable_id").references(() => retainerDeliverables.id, { onDelete: 'cascade' }), // Optional for monthly auto-payments
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  monthNumber: integer("month_number"), // Which month of the contract (1-12, etc.)
  paymentType: varchar("payment_type").notNull().default('deliverable'), // 'deliverable', 'monthly', 'bonus'
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(), // Full amount before fees
  platformFeeAmount: decimal("platform_fee_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  processingFeeAmount: decimal("processing_fee_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(), // Amount creator receives
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Legacy field, kept for backwards compatibility
  providerTransactionId: varchar("provider_transaction_id"), // PayPal batch ID, bank TX ID, crypto hash
  providerResponse: jsonb("provider_response"), // Full response from payment provider
  paymentMethod: varchar("payment_method"), // 'paypal', 'wire', 'crypto', 'etransfer'
  status: paymentStatusEnum("status").notNull().default('pending'),
  description: text("description"),
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const retainerPaymentsRelations = relations(retainerPayments, ({ one }) => ({
  contract: one(retainerContracts, {
    fields: [retainerPayments.contractId],
    references: [retainerContracts.id],
  }),
  deliverable: one(retainerDeliverables, {
    fields: [retainerPayments.deliverableId],
    references: [retainerDeliverables.id],
  }),
  creator: one(users, {
    fields: [retainerPayments.creatorId],
    references: [users.id],
  }),
  company: one(companyProfiles, {
    fields: [retainerPayments.companyId],
    references: [companyProfiles.id],
  }),
}));

// System Settings
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

// Banned Keywords
export const bannedKeywords = pgTable("banned_keywords", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  category: keywordCategoryEnum("category").notNull().default('custom'),
  isActive: boolean("is_active").notNull().default(true),
  severity: integer("severity").notNull().default(1), // 1-5, where 5 is most severe
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bannedKeywordsRelations = relations(bannedKeywords, ({ one }) => ({
  creator: one(users, {
    fields: [bannedKeywords.createdBy],
    references: [users.id],
  }),
}));

// Content Flags
export const contentFlags = pgTable("content_flags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: contentTypeEnum("content_type").notNull(),
  contentId: varchar("content_id").notNull(), // ID of message or review
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // User who created the flagged content
  flagReason: text("flag_reason").notNull(), // Why it was flagged
  matchedKeywords: text("matched_keywords").array().default(sql`ARRAY[]::text[]`), // Which keywords triggered the flag
  status: flagStatusEnum("status").notNull().default('pending'),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  adminNotes: text("admin_notes"),
  actionTaken: text("action_taken"), // What action was taken (e.g., content removed, user warned, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

export const contentFlagsRelations = relations(contentFlags, ({ one }) => ({
  user: one(users, {
    fields: [contentFlags.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [contentFlags.reviewedBy],
    references: [users.id],
  }),
}));

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  linkUrl: varchar("link_url"),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// User Notification Preferences
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  inAppNotifications: boolean("in_app_notifications").notNull().default(true),
  emailApplicationStatus: boolean("email_application_status").notNull().default(true),
  emailNewMessage: boolean("email_new_message").notNull().default(true),
  emailPayment: boolean("email_payment").notNull().default(true),
  emailOffer: boolean("email_offer").notNull().default(true),
  emailReview: boolean("email_review").notNull().default(true),
  emailSystem: boolean("email_system").notNull().default(true),
  pushApplicationStatus: boolean("push_application_status").notNull().default(true),
  pushNewMessage: boolean("push_new_message").notNull().default(true),
  pushPayment: boolean("push_payment").notNull().default(true),
  pushSubscription: jsonb("push_subscription"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

// Audit Logs (for admin action tracking)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id"),
  changes: jsonb("changes"),
  reason: text("reason"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Platform Settings (for admin configuration)
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  category: varchar("category"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const platformSettingsRelations = relations(platformSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [platformSettings.updatedBy],
    references: [users.id],
  }),
}));

// Niches (for categorizing offers and creator profiles)
export const niches = pgTable("niches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform Funding Accounts (for admin payment management)
export const platformFundingAccounts = pgTable("platform_funding_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // "bank", "wallet", "card"
  last4: varchar("last4").notNull(),
  status: varchar("status").notNull().default("pending"), // "active", "pending", "disabled"
  isPrimary: boolean("is_primary").default(false),
  bankName: varchar("bank_name"),
  accountHolderName: varchar("account_holder_name"),
  routingNumber: varchar("routing_number"),
  accountNumber: varchar("account_number"),
  swiftCode: varchar("swift_code"),
  walletAddress: text("wallet_address"),
  walletNetwork: varchar("wallet_network"),
  cardBrand: varchar("card_brand"),
  cardExpiry: varchar("card_expiry"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const platformFundingAccountsRelations = relations(platformFundingAccounts, ({ one }) => ({
  createdByUser: one(users, {
    fields: [platformFundingAccounts.createdBy],
    references: [users.id],
  }),
}));

// Email Templates (for admin-managed email templates)
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // Unique identifier for template lookup
  category: emailTemplateCategoryEnum("category").notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  htmlContent: text("html_content").notNull(),
  visualData: jsonb("visual_data"), // Visual email builder data (blocks, header, etc.)
  description: text("description"), // Admin-facing description of when this template is used
  availableVariables: text("available_variables").array().default(sql`ARRAY[]::text[]`), // List of variables like {{userName}}, {{offerTitle}}
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // System templates cannot be deleted
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [emailTemplates.updatedBy],
    references: [users.id],
  }),
}));

// Platform Health Monitoring Tables (Section 4.3.G)

// API Metrics - aggregated API performance data
export const apiMetrics = pgTable("api_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  date: timestamp("date").notNull(),
  hour: integer("hour").notNull().default(0),
  totalRequests: integer("total_requests").notNull().default(0),
  successfulRequests: integer("successful_requests").notNull().default(0),
  errorRequests: integer("error_requests").notNull().default(0),
  avgResponseTimeMs: decimal("avg_response_time_ms", { precision: 10, scale: 2 }).default('0'),
  minResponseTimeMs: integer("min_response_time_ms").default(0),
  maxResponseTimeMs: integer("max_response_time_ms").default(0),
  p50ResponseTimeMs: integer("p50_response_time_ms").default(0),
  p95ResponseTimeMs: integer("p95_response_time_ms").default(0),
  p99ResponseTimeMs: integer("p99_response_time_ms").default(0),
  error4xxCount: integer("error_4xx_count").default(0),
  error5xxCount: integer("error_5xx_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Error Logs - individual error occurrences
export const apiErrorLogs = pgTable("api_error_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code").notNull(),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  requestId: varchar("request_id", { length: 100 }),
  userId: varchar("user_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  requestBody: jsonb("request_body"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const apiErrorLogsRelations = relations(apiErrorLogs, ({ one }) => ({
  user: one(users, {
    fields: [apiErrorLogs.userId],
    references: [users.id],
  }),
}));

// Storage Metrics - daily storage usage tracking
export const storageMetrics = pgTable("storage_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull().unique(),
  totalFiles: integer("total_files").notNull().default(0),
  totalStorageBytes: decimal("total_storage_bytes", { precision: 20, scale: 0 }).notNull().default('0'),
  videoFiles: integer("video_files").notNull().default(0),
  videoStorageBytes: decimal("video_storage_bytes", { precision: 20, scale: 0 }).notNull().default('0'),
  imageFiles: integer("image_files").notNull().default(0),
  imageStorageBytes: decimal("image_storage_bytes", { precision: 20, scale: 0 }).notNull().default('0'),
  documentFiles: integer("document_files").notNull().default(0),
  documentStorageBytes: decimal("document_storage_bytes", { precision: 20, scale: 0 }).notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Video Hosting Costs - daily cost tracking
export const videoHostingCosts = pgTable("video_hosting_costs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull().unique(),
  totalVideos: integer("total_videos").notNull().default(0),
  totalVideoStorageGb: decimal("total_video_storage_gb", { precision: 12, scale: 4 }).notNull().default('0'),
  totalBandwidthGb: decimal("total_bandwidth_gb", { precision: 12, scale: 4 }).notNull().default('0'),
  storageCostUsd: decimal("storage_cost_usd", { precision: 10, scale: 4 }).notNull().default('0'),
  bandwidthCostUsd: decimal("bandwidth_cost_usd", { precision: 10, scale: 4 }).notNull().default('0'),
  transcodingCostUsd: decimal("transcoding_cost_usd", { precision: 10, scale: 4 }).notNull().default('0'),
  totalCostUsd: decimal("total_cost_usd", { precision: 10, scale: 4 }).notNull().default('0'),
  costPerVideoUsd: decimal("cost_per_video_usd", { precision: 10, scale: 4 }).notNull().default('0'),
  viewsCount: integer("views_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform Health Snapshots - periodic health status
export const platformHealthSnapshots = pgTable("platform_health_snapshots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  overallHealthScore: integer("overall_health_score").notNull().default(100),
  apiHealthScore: integer("api_health_score").notNull().default(100),
  storageHealthScore: integer("storage_health_score").notNull().default(100),
  databaseHealthScore: integer("database_health_score").notNull().default(100),
  avgResponseTimeMs: decimal("avg_response_time_ms", { precision: 10, scale: 2 }).default('0'),
  errorRatePercent: decimal("error_rate_percent", { precision: 5, scale: 2 }).default('0'),
  activeUsersCount: integer("active_users_count").default(0),
  requestsPerMinute: integer("requests_per_minute").default(0),
  memoryUsagePercent: decimal("memory_usage_percent", { precision: 5, scale: 2 }).default('0'),
  cpuUsagePercent: decimal("cpu_usage_percent", { precision: 5, scale: 2 }).default('0'),
  diskUsagePercent: decimal("disk_usage_percent", { precision: 5, scale: 2 }).default('0'),
  databaseConnections: integer("database_connections").default(0),
  uptimeSeconds: decimal("uptime_seconds", { precision: 20, scale: 0 }).default('0'),
  alerts: jsonb("alerts").default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreatorProfileSchema = createInsertSchema(creatorProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, applicationCount: true, approvedAt: true });
export const createOfferSchema = createInsertSchema(offers).omit({ id: true, companyId: true, createdAt: true, updatedAt: true, viewCount: true, applicationCount: true, approvedAt: true, status: true });
export const insertOfferVideoSchema = createInsertSchema(offerVideos).omit({ id: true, createdAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, trackingLink: true, trackingCode: true, autoApprovalScheduledAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, updatedAt: true, companyResponse: true, companyRespondedAt: true, adminResponse: true, respondedAt: true, respondedBy: true, isEdited: true, adminNote: true, isApproved: true, approvedBy: true, approvedAt: true, isHidden: true });
export const adminReviewUpdateSchema = createInsertSchema(reviews).pick({ reviewText: true, overallRating: true, paymentSpeedRating: true, communicationRating: true, offerQualityRating: true, supportRating: true }).partial();
export const adminNoteSchema = z.object({ note: z.string() });
export const adminResponseSchema = z.object({ response: z.string().min(1, "Response text is required") });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export const insertPaymentSettingSchema = createInsertSchema(paymentSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true, initiatedAt: true, completedAt: true, failedAt: true, refundedAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true, updatedAt: true });
const decimalInput = z.union([z.string(), z.number()]).transform((val, ctx) => {
  const parsed = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: "custom", message: "Invalid number" });
    return z.NEVER;
  }
  return parsed.toString();
});

const numericInput = z.union([z.string(), z.number()]).transform((val, ctx) => {
  const parsed = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({ code: "custom", message: "Invalid number" });
    return z.NEVER;
  }
  return parsed;
});

const integerInput = z.union([z.string(), z.number()]).transform((val, ctx) => {
  const parsed = typeof val === "number" ? val : parseInt(val, 10);
  if (!Number.isInteger(parsed)) {
    ctx.addIssue({ code: "custom", message: "Invalid whole number" });
    return z.NEVER;
  }
  return parsed;
});

const retainerTierInputSchema = z
  .object({
    name: z.string().min(1, "Tier name is required"),
    monthlyAmount: numericInput,
    videosPerMonth: integerInput,
    durationMonths: integerInput,
  })
  .strict();

export const insertRetainerContractSchema = createInsertSchema(retainerContracts)
  .omit({ id: true, createdAt: true, updatedAt: true, assignedCreatorId: true, startDate: true, endDate: true })
  .extend({
    monthlyAmount: decimalInput,
    videosPerMonth: integerInput,
    durationMonths: integerInput,
    minimumFollowers: integerInput.optional(),
    minimumVideoLengthSeconds: integerInput.optional(),
    retainerTiers: z.array(retainerTierInputSchema).max(5).default([]),
    niches: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((val) => {
        if (!val) return [] as string[];
        if (Array.isArray(val)) return val.filter(Boolean);
        return val
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
      }),
  });

export const createRetainerContractSchema = insertRetainerContractSchema.omit({ companyId: true, status: true });
export const insertRetainerApplicationSchema = createInsertSchema(retainerApplications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRetainerDeliverableSchema = createInsertSchema(retainerDeliverables).omit({ id: true, createdAt: true, submittedAt: true, reviewedAt: true });
export const insertRetainerPaymentSchema = createInsertSchema(retainerPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true, readAt: true });
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNicheSchema = createInsertSchema(niches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlatformFundingAccountSchema = createInsertSchema(platformFundingAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBannedKeywordSchema = createInsertSchema(bannedKeywords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContentFlagSchema = createInsertSchema(contentFlags).omit({ id: true, createdAt: true });
export const insertCompanyVerificationDocumentSchema = createInsertSchema(companyVerificationDocuments).omit({ id: true, createdAt: true, uploadedAt: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });

// Platform Health Monitoring insert schemas
export const insertApiMetricsSchema = createInsertSchema(apiMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApiErrorLogSchema = createInsertSchema(apiErrorLogs).omit({ id: true, timestamp: true });
export const insertStorageMetricsSchema = createInsertSchema(storageMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVideoHostingCostsSchema = createInsertSchema(videoHostingCosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlatformHealthSnapshotSchema = createInsertSchema(platformHealthSnapshots).omit({ id: true, createdAt: true });

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type InsertCreatorProfile = z.infer<typeof insertCreatorProfileSchema>;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type OfferVideo = typeof offerVideos.$inferSelect;
export type InsertOfferVideo = z.infer<typeof insertOfferVideoSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Analytics = typeof analytics.$inferSelect;
export type PaymentSetting = typeof paymentSettings.$inferSelect;
export type InsertPaymentSetting = z.infer<typeof insertPaymentSettingSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type RetainerContract = typeof retainerContracts.$inferSelect;
export type InsertRetainerContract = z.infer<typeof insertRetainerContractSchema>;
export type RetainerApplication = typeof retainerApplications.$inferSelect;
export type InsertRetainerApplication = z.infer<typeof insertRetainerApplicationSchema>;
export type RetainerDeliverable = typeof retainerDeliverables.$inferSelect;
export type InsertRetainerDeliverable = z.infer<typeof insertRetainerDeliverableSchema>;
export type RetainerPayment = typeof retainerPayments.$inferSelect;
export type InsertRetainerPayment = z.infer<typeof insertRetainerPaymentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type Niche = typeof niches.$inferSelect;
export type InsertNiche = z.infer<typeof insertNicheSchema>;
export type PlatformFundingAccount = typeof platformFundingAccounts.$inferSelect;
export type InsertPlatformFundingAccount = z.infer<typeof insertPlatformFundingAccountSchema>;
export type BannedKeyword = typeof bannedKeywords.$inferSelect;
export type InsertBannedKeyword = z.infer<typeof insertBannedKeywordSchema>;
export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;
export type CompanyVerificationDocument = typeof companyVerificationDocuments.$inferSelect;
export type InsertCompanyVerificationDocument = z.infer<typeof insertCompanyVerificationDocumentSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type ApiMetrics = typeof apiMetrics.$inferSelect;
export type InsertApiMetrics = z.infer<typeof insertApiMetricsSchema>;
export type ApiErrorLog = typeof apiErrorLogs.$inferSelect;
export type InsertApiErrorLog = z.infer<typeof insertApiErrorLogSchema>;
export type StorageMetrics = typeof storageMetrics.$inferSelect;
export type InsertStorageMetrics = z.infer<typeof insertStorageMetricsSchema>;
export type VideoHostingCosts = typeof videoHostingCosts.$inferSelect;
export type InsertVideoHostingCosts = z.infer<typeof insertVideoHostingCostsSchema>;
export type PlatformHealthSnapshot = typeof platformHealthSnapshots.$inferSelect;
export type InsertPlatformHealthSnapshot = z.infer<typeof insertPlatformHealthSnapshotSchema>;