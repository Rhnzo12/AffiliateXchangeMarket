// path: src/server/storage.ts
import { randomUUID } from "crypto";
import { eq, and, or, desc, asc, sql, count, inArray, gte, lte } from "drizzle-orm";
import { db, pool } from "./db";
import geoip from "geoip-lite";
import {
  users,
  creatorProfiles,
  companyProfiles,
  offers,
  offerVideos,
  applications,
  conversations,
  messages,
  reviews,
  favorites,
  analytics,
  clickEvents,
  paymentSettings,
  payments,
  retainerPayments,
  retainerContracts,
  retainerApplications,
  retainerDeliverables,
  notifications,
  userNotificationPreferences,
  auditLogs,
  platformSettings,
  niches,
  platformFundingAccounts,
  type User,
  type UpsertUser,
  type InsertUser,
  type CreatorProfile,
  type InsertCreatorProfile,
  type CompanyProfile,
  type InsertCompanyProfile,
  type Offer,
  type InsertOffer,
  type OfferVideo,
  type InsertOfferVideo,
  type Application,
  type InsertApplication,
  type Message,
  type InsertMessage,
  type Review,
  type InsertReview,
  type Favorite,
  type InsertFavorite,
  type Analytics,
  type PaymentSetting,
  type InsertPaymentSetting,
  type Payment,
  type InsertPayment,
  type RetainerPayment,
  type InsertRetainerPayment,
  type RetainerContract,
  type InsertRetainerContract,
  type RetainerApplication,
  type InsertRetainerApplication,
  type RetainerDeliverable,
  type InsertRetainerDeliverable,
  type Notification,
  type InsertNotification,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type AuditLog,
  type InsertAuditLog,
  type PlatformSetting,
  type InsertPlatformSetting,
  type Niche,
  type InsertNiche,
  type PlatformFundingAccount,
  type InsertPlatformFundingAccount,
} from "../shared/schema";

/**
 * Postgres error codes related to missing schema objects:
 *  - 42P01: undefined_table
 *  - 42704: undefined_object / undefined_object type
 */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42704"]);
const MISSING_COLUMN_CODES = new Set(["42703"]);

const NOTIFICATION_OPTIONAL_COLUMNS = [
  "type",
  "title",
  "user_id",
  "metadata",
  "message",
  "link_url",
  "is_read",
  "read_at",
  "created_at",
];

const REVIEW_OPTIONAL_COLUMNS = [
  "category_ratings",
  "status",
  "edited_by_admin",
  "admin_notes",
  "overall_rating",
  "payment_speed_rating",
  "communication_rating",
  "offer_quality_rating",
  "support_rating",
  "company_response",
  "company_responded_at",
  "is_edited",
  "admin_note",
  "is_approved",
  "approved_by",
  "approved_at",
  "is_hidden",
];

function isMissingRelationError(error: unknown, relation: string): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as { code?: string; message?: unknown };

  // If error code hints at missing objects, prefer message inspection when present.
  if (typeof code === "string" && MISSING_SCHEMA_CODES.has(code)) {
    if (typeof message !== "string") return true; // No message to verify, still safe to treat as missing.

    const normalized = message.toLowerCase();
    const target = relation.toLowerCase();

    if (normalized.includes(target)) return true;
  }

  if (typeof message === "string") {
    // Fast exact check with original casing for common path.
    if (message.includes(`relation "${relation}" does not exist`)) return true;

    // Robust checks with normalized forms.
    const normalized = message.toLowerCase();
    const target = relation.toLowerCase();

    if (normalized.includes(`relation "${target}" does not exist`)) return true;
    if (normalized.includes(`table "${target}" does not exist`)) return true;
    if (normalized.includes(`type "${target}" does not exist`)) return true;

    // Regex catch-all; supports relation|table|type and schema-qualified names
    const match = normalized.match(/(?:relation|table|type) "([^"\\]+)" does not exist/);
    if (match) {
      const relationName = match[1];
      if (relationName === target || relationName.endsWith(`.${target}`)) return true;
    }
  }

  return false;
}

function isMissingColumnError(error: unknown, relation: string, columns: string[] = []): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as { code?: string; message?: unknown };
  const normalizedRelation = relation.toLowerCase();

  const matchesColumns = (text: string) => {
    if (!columns.length) return true;
    const normalizedText = text.toLowerCase();
    return columns.some((column) => normalizedText.includes(column.toLowerCase()));
  };

  const inspect = (value: unknown) => {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase();
    if (!normalized.includes("column")) return false;

    // Messages commonly look like:
    //   column "overall_rating" does not exist
    //   column "overall_rating" of relation "reviews" does not exist
    //   column "public.notifications.metadata" does not exist
    const mentionsRelation = normalized.includes(normalizedRelation);
    const mentionsMissingColumn =
      normalized.includes("does not exist") && matchesColumns(normalized);

    if (mentionsRelation && matchesColumns(normalized)) return true;
    if (mentionsMissingColumn) return true;

    return false;
  };

  if (typeof code === "string" && MISSING_COLUMN_CODES.has(code)) {
    if (inspect(message)) return true;
    if (typeof message !== "string") return true;
  }

  if (inspect(message)) return true;

  return false;
}

function coerceCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function buildEphemeralNotification(notification: InsertNotification): Notification {
  const now = new Date();
  const partial = notification as Partial<Notification>;

  const isRead = partial.isRead ?? false;
  const readAt = isRead ? partial.readAt ?? now : null;

  return {
    id: randomUUID(),
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: notification.linkUrl ?? null,
    metadata: notification.metadata ?? null,
    isRead,
    readAt,
    createdAt: now,
  };
}

function buildEphemeralReview(review: InsertReview): Review {
  const now = new Date();
  const partial = review as Partial<Review>;

  return {
    id: randomUUID(),
    applicationId: review.applicationId,
    creatorId: review.creatorId,
    companyId: review.companyId,
    reviewText: partial.reviewText ?? null,
    overallRating: review.overallRating,
    paymentSpeedRating: partial.paymentSpeedRating ?? null,
    communicationRating: partial.communicationRating ?? null,
    offerQualityRating: partial.offerQualityRating ?? null,
    supportRating: partial.supportRating ?? null,
    companyResponse: partial.companyResponse ?? null,
    companyRespondedAt: partial.companyRespondedAt ?? null,
    isEdited: partial.isEdited ?? false,
    adminNote: partial.adminNote ?? null,
    isApproved: partial.isApproved ?? true,
    approvedBy: partial.approvedBy ?? null,
    approvedAt: partial.approvedAt ?? null,
    isHidden: partial.isHidden ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

function buildDefaultNotificationPreferences(userId: string): UserNotificationPreferences {
  const now = new Date();

  return {
    id: randomUUID(),
    userId,
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    emailApplicationStatus: true,
    emailNewMessage: true,
    emailPayment: true,
    emailOffer: true,
    emailReview: true,
    emailSystem: true,
    pushApplicationStatus: true,
    pushNewMessage: true,
    pushPayment: true,
    pushSubscription: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isMissingNotificationSchema(error: unknown): boolean {
  // Some Postgres setups emit missing enum/type for notification_type as well.
  return (
    isMissingRelationError(error, "notifications") ||
    isMissingRelationError(error, "notification_type")
  );
}

function isLegacyNotificationColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "notifications", NOTIFICATION_OPTIONAL_COLUMNS);
}

function isLegacyReviewColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "reviews", REVIEW_OPTIONAL_COLUMNS);
}

function safeParseJson<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function coerceDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value);
    if (!Number.isNaN(result.getTime())) {
      return result;
    }
  }
  return new Date();
}

function coerceBoolean(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "t", "1", "yes"].includes(normalized)) return true;
    if (["false", "f", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceNumberValue(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

function coerceOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function getExistingColumns(table: string): Promise<Set<string>> {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    return new Set(result.rows.map((row: any) => row.column_name as string));
  } catch (error) {
    console.warn(`[Storage] Unable to inspect columns for ${table}:`, error);
    return new Set();
  }
}

function mapLegacyNotificationRow(
  row: any,
  columns: Set<string>,
  fallbackUserId: string,
): Notification {
  const metadataValue = columns.has("metadata") ? row.metadata ?? null : null;
  const messageCandidate =
    (columns.has("message") ? row.message : undefined) ??
    row.content ??
    row.body ??
    row.description ??
    "";
  const normalizedMessage =
    typeof messageCandidate === "string"
      ? messageCandidate
      : messageCandidate
        ? JSON.stringify(messageCandidate)
        : "";

  const titleCandidate =
    (columns.has("title") ? row.title : undefined) ??
    row.subject ??
    (normalizedMessage ? normalizedMessage.slice(0, 120) : null);

  return {
    id: row.id ?? randomUUID(),
    userId: row.user_id ?? fallbackUserId,
    type: row.type ?? "system_announcement",
    title: titleCandidate || "Notification",
    message: normalizedMessage || titleCandidate || "Notification update",
    linkUrl: columns.has("link_url") ? row.link_url ?? null : null,
    metadata: safeParseJson(metadataValue),
    isRead: columns.has("is_read") ? coerceBoolean(row.is_read, false) : false,
    readAt: columns.has("read_at") && row.read_at ? coerceDate(row.read_at) : null,
    createdAt: columns.has("created_at") && row.created_at ? coerceDate(row.created_at) : new Date(),
  };
}

async function legacyFetchNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; columns?: Set<string> } = {},
): Promise<Notification[]> {
  const columns = options.columns ?? (await getExistingColumns("notifications"));
  if (!columns.size) return [];

  const where: string[] = ["user_id = $1"];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options.unreadOnly && columns.has("is_read")) {
    where.push("(is_read = false OR is_read IS NULL)");
  }

  const orderColumn = columns.has("created_at") ? "created_at" : "id";
  let limitClause = "";
  if (typeof options.limit === "number") {
    limitClause = ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const query = `SELECT * FROM notifications WHERE ${where.join(" AND ")} ORDER BY ${orderColumn} DESC${limitClause}`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map((row: any) => mapLegacyNotificationRow(row, columns, userId));
  } catch (error) {
    console.warn("[Storage] Legacy notifications query failed:", error);
    return [];
  }
}

async function legacyFetchUnreadNotifications(userId: string): Promise<Notification[]> {
  const columns = await getExistingColumns("notifications");
  if (!columns.size) return [];

  if (!columns.has("is_read")) {
    // Without an is_read column, treat all notifications as unread.
    return legacyFetchNotifications(userId, { columns });
  }

  return legacyFetchNotifications(userId, { columns, unreadOnly: true });
}

async function legacyCountUnreadNotifications(userId: string): Promise<number> {
  const columns = await getExistingColumns("notifications");
  if (!columns.size) return 0;

  const baseQuery = columns.has("is_read")
    ? `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND (is_read = false OR is_read IS NULL)`
    : `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1`;

  try {
    const result = await pool.query(baseQuery, [userId]);
    return coerceCount(result.rows[0]?.count ?? 0);
  } catch (error) {
    console.warn("[Storage] Legacy unread notification count failed:", error);
    return 0;
  }
}

function mapLegacyReviewRow(row: any, columns: Set<string>): Review {
  const createdAt = columns.has("created_at") && row.created_at ? coerceDate(row.created_at) : new Date();
  const updatedAt = columns.has("updated_at") && row.updated_at ? coerceDate(row.updated_at) : createdAt;

  const categoryRatings = columns.has("category_ratings")
    ? safeParseJson<Record<string, unknown>>(row.category_ratings) ?? {}
    : {};

  const readCategoryRating = (...keys: string[]): number | null => {
    for (const key of keys) {
      if (categoryRatings && typeof categoryRatings === "object" && key in categoryRatings) {
        const value = (categoryRatings as Record<string, unknown>)[key];
        const coerced = coerceOptionalNumber(value);
        if (coerced !== null) return coerced;
      }
    }
    return null;
  };

  const statusValue = columns.has("status") && typeof row.status === "string" ? row.status.toLowerCase() : null;
  const isPending = statusValue ? ["pending", "under_review", "flagged"].includes(statusValue) : false;
  const isHiddenByStatus = statusValue ? ["hidden", "flagged", "removed"].includes(statusValue) : false;

  return {
    id: row.id ?? randomUUID(),
    applicationId: row.application_id ?? row.applicationId ?? "",
    creatorId: row.creator_id ?? row.creatorId ?? "",
    companyId: row.company_id ?? row.companyId ?? "",
    reviewText: row.review_text ?? row.review ?? row.text ?? null,
    overallRating:
      coerceNumberValue(
        row.overall_rating ??
          row.rating ??
          readCategoryRating("overall", "overallRating", "rating") ??
          0,
      ) || 0,
    paymentSpeedRating:
      coerceOptionalNumber(row.payment_speed_rating ?? row.payment_speed) ??
      readCategoryRating("payment_speed", "paymentSpeed"),
    communicationRating:
      coerceOptionalNumber(row.communication_rating ?? row.communication) ??
      readCategoryRating("communication", "communication_rating"),
    offerQualityRating:
      coerceOptionalNumber(row.offer_quality_rating ?? row.offer_quality) ??
      readCategoryRating("offer_quality", "offerQuality"),
    supportRating:
      coerceOptionalNumber(row.support_rating) ?? readCategoryRating("support", "support_rating"),
    companyResponse: columns.has("company_response") ? row.company_response ?? null : null,
    companyRespondedAt:
      columns.has("company_responded_at") && row.company_responded_at
        ? coerceDate(row.company_responded_at)
        : null,
    isEdited:
      columns.has("is_edited")
        ? coerceBoolean(row.is_edited, false)
        : columns.has("edited_by_admin")
          ? coerceBoolean(row.edited_by_admin, false)
          : false,
    adminNote:
      columns.has("admin_note")
        ? row.admin_note ?? null
        : columns.has("admin_notes")
          ? row.admin_notes ?? null
          : null,
    isApproved:
      columns.has("is_approved")
        ? coerceBoolean(row.is_approved, true)
        : statusValue
          ? !isPending && statusValue !== "rejected"
          : true,
    approvedBy: columns.has("approved_by") ? row.approved_by ?? null : null,
    approvedAt: columns.has("approved_at") && row.approved_at ? coerceDate(row.approved_at) : null,
    isHidden:
      columns.has("is_hidden")
        ? coerceBoolean(row.is_hidden, false)
        : isHiddenByStatus,
    createdAt,
    updatedAt,
  };
}

async function legacyFetchReviews(): Promise<Review[]> {
  const columns = await getExistingColumns("reviews");
  if (!columns.size) return [];

  const orderColumn = columns.has("created_at") ? "created_at" : "id";

  try {
    const result = await pool.query(`SELECT * FROM reviews ORDER BY ${orderColumn} DESC`);
    return result.rows.map((row: any) => mapLegacyReviewRow(row, columns));
  } catch (error) {
    console.warn("[Storage] Legacy reviews query failed:", error);
    return [];
  }
}

export interface AdminCreatorSummary {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  accountStatus: User["accountStatus"];
  createdAt: Date | null;
  isDeleted: boolean;
  profile:
    | {
        bio: string | null;
        youtubeFollowers: number | null;
        tiktokFollowers: number | null;
        instagramFollowers: number | null;
      }
    | null;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // Creator Profiles
  getCreatorProfile(userId: string): Promise<CreatorProfile | undefined>;
  createCreatorProfile(profile: InsertCreatorProfile): Promise<CreatorProfile>;
  updateCreatorProfile(userId: string, updates: Partial<InsertCreatorProfile>): Promise<CreatorProfile | undefined>;

  // Company Profiles
  getCompanyProfile(userId: string): Promise<CompanyProfile | undefined>;
  getCompanyProfileById(id: string): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(userId: string, updates: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  getPendingCompanies(): Promise<CompanyProfile[]>;
  approveCompany(companyId: string): Promise<CompanyProfile | undefined>;
  rejectCompany(companyId: string, reason: string): Promise<CompanyProfile | undefined>;
  suspendCompany(companyId: string): Promise<CompanyProfile | undefined>;
  unsuspendCompany(companyId: string): Promise<CompanyProfile | undefined>;
  getAllCompanies(filters?: {
    status?: string;
    industry?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]>;

  // Offers
  getOffer(id: string): Promise<Offer | undefined>;
  getOffers(filters?: any): Promise<Offer[]>;
  getOffersByCompany(companyId: string): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(id: string, updates: Partial<InsertOffer>): Promise<Offer | undefined>;
  incrementOfferViewCount(id: string): Promise<void>;
  deleteOffer(id: string): Promise<void>;
  getPendingOffers(): Promise<Offer[]>;
  approveOffer(offerId: string): Promise<Offer | undefined>;

  // Offer Videos
  getOfferVideos(offerId: string): Promise<OfferVideo[]>;
  createOfferVideo(video: InsertOfferVideo): Promise<OfferVideo>;
  deleteOfferVideo(id: string): Promise<void>;

  // Applications
  getApplication(id: string): Promise<Application | undefined>;
  getApplicationByTrackingCode(trackingCode: string): Promise<Application | undefined>;
  getApplicationsByCreator(creatorId: string): Promise<Application[]>;
  getApplicationsByOffer(offerId: string): Promise<Application[]>;
  getExistingApplication(creatorId: string, offerId: string): Promise<Application | undefined>;
  getActiveCreatorsCountForOffer(offerId: string): Promise<number>;
  getOfferClickStats(offerId: string): Promise<{ totalClicks: number; uniqueClicks: number }>;
  getAllPendingApplications(): Promise<Application[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application | undefined>;
  approveApplication(id: string, trackingLink: string, trackingCode: string): Promise<Application | undefined>;
  completeApplication(id: string): Promise<Application | undefined>;
  getApplicationsByCompany(companyId: string): Promise<any[]>;

  // Messages & Conversations
  getConversation(id: string): Promise<any>;
  getConversationsByUser(
    userId: string,
    userRole: string,
    companyProfileId?: string | null,
  ): Promise<any[]>;
  createConversation(data: any): Promise<any>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: string): Promise<Message[]>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;

  // Reviews
  getReview(id: string): Promise<Review | undefined>;
  getReviewsByCompany(companyId: string): Promise<Review[]>;
  getReviewsByCreatorAndCompany(creatorId: string, companyId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined>;

  // Favorites
  getFavoritesByCreator(creatorId: string): Promise<Favorite[]>;
  isFavorite(creatorId: string, offerId: string): Promise<boolean>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  deleteFavorite(creatorId: string, offerId: string): Promise<void>;

  // Analytics
  getAnalyticsByCreator(creatorId: string): Promise<any>;
  getAnalyticsTimeSeriesByCreator(creatorId: string, dateRange: string): Promise<any[]>;
  getAnalyticsByCompany(companyId: string): Promise<any>;
  getAnalyticsTimeSeriesByCompany(companyId: string, dateRange: string): Promise<any[]>;
  getAnalyticsByApplication(applicationId: string): Promise<any[]>;
  getAnalyticsTimeSeriesByApplication(applicationId: string, dateRange: string): Promise<any[]>;
  logTrackingClick(
    applicationId: string,
    clickData: {
      ip: string;
      userAgent: string;
      referer: string;
      timestamp: Date;
      fraudScore?: number;
      fraudFlags?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
    },
  ): Promise<void>;
  recordConversion(applicationId: string, saleAmount?: number): Promise<void>;

  // Payment Settings
  getPaymentSettings(userId: string): Promise<PaymentSetting[]>;
  createPaymentSetting(setting: InsertPaymentSetting): Promise<PaymentSetting>;
  deletePaymentSetting(id: string): Promise<void>;

  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByCreator(creatorId: string): Promise<Payment[]>;
  getPaymentsByCompany(companyId: string): Promise<Payment[]>;
  getAllPayments(): Promise<any[]>;
  updatePaymentStatus(id: string, status: string, updates?: Partial<Payment>): Promise<Payment | undefined>;

  // Retainer Contracts
  getRetainerContract(id: string): Promise<any>;
  getRetainerContracts(filters?: any): Promise<any[]>;
  getRetainerContractsByCompany(companyId: string): Promise<any[]>;
  getRetainerContractsByCreator(creatorId: string): Promise<any[]>;
  getOpenRetainerContracts(): Promise<any[]>;
  getActiveRetainerCreatorsCount(contractId: string): Promise<number>;
  createRetainerContract(contract: any): Promise<any>;
  updateRetainerContract(id: string, updates: any): Promise<any>;
  deleteRetainerContract(id: string): Promise<void>;

  // Retainer Applications
  getRetainerApplication(id: string): Promise<any>;
  getRetainerApplicationsByContract(contractId: string): Promise<any[]>;
  getRetainerApplicationsByCreator(creatorId: string): Promise<any[]>;
  createRetainerApplication(application: any): Promise<any>;
  updateRetainerApplication(id: string, updates: any): Promise<any>;
  approveRetainerApplication(id: string, contractId: string, creatorId: string): Promise<any>;
  rejectRetainerApplication(id: string): Promise<any>;

  // Retainer Deliverables
  getRetainerDeliverable(id: string): Promise<any>;
  getRetainerDeliverablesByContract(contractId: string): Promise<any[]>;
  getRetainerDeliverablesByCreator(creatorId: string): Promise<any[]>;
  getRetainerDeliverablesForMonth(contractId: string, monthNumber: number): Promise<any[]>;
  createRetainerDeliverable(deliverable: any): Promise<any>;
  updateRetainerDeliverable(id: string, updates: any): Promise<any>;
  approveRetainerDeliverable(id: string, reviewNotes?: string): Promise<any>;
  rejectRetainerDeliverable(id: string, reviewNotes: string): Promise<any>;
  requestRevision(id: string, reviewNotes: string): Promise<any>;
  deleteRetainerDeliverable(id: string): Promise<void>;

  // Retainer Payments
  createRetainerPayment(payment: InsertRetainerPayment): Promise<RetainerPayment>;
  getRetainerPayment(id: string): Promise<RetainerPayment | null>;
  getRetainerPaymentsByContract(contractId: string): Promise<RetainerPayment[]>;
  getRetainerPaymentsByCreator(creatorId: string): Promise<RetainerPayment[]>;
  updateRetainerPaymentStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded', updates?: {
    providerTransactionId?: string;
    providerResponse?: any;
    paymentMethod?: string;
    initiatedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    description?: string;
  }): Promise<RetainerPayment | null>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  getUnreadMessageCountForCreator(creatorId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  clearAllNotifications(userId: string): Promise<void>;

  // User Notification Preferences
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null>;
  createUserNotificationPreferences(
    preferences: InsertUserNotificationPreferences,
  ): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(
    userId: string,
    updates: Partial<InsertUserNotificationPreferences>,
  ): Promise<UserNotificationPreferences | undefined>;

  // Admin
  getCreatorsForAdmin(): Promise<AdminCreatorSummary[]>;
  suspendCreator(userId: string): Promise<User | undefined>;
  unsuspendCreator(userId: string): Promise<User | undefined>;
  banCreator(userId: string): Promise<User | undefined>;

  // Helper methods
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;

  // Platform Settings
  getPlatformSetting(key: string): Promise<PlatformSetting | null>;
  getAllPlatformSettings(): Promise<PlatformSetting[]>;
  getPlatformSettingsByCategory(category: string): Promise<PlatformSetting[]>;
  updatePlatformSetting(key: string, value: string, updatedBy: string | null): Promise<PlatformSetting>;
  createPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting>;

  // Platform Funding Accounts
  getPlatformFundingAccount(id: string): Promise<PlatformFundingAccount | null>;
  getAllPlatformFundingAccounts(): Promise<PlatformFundingAccount[]>;
  createPlatformFundingAccount(account: InsertPlatformFundingAccount): Promise<PlatformFundingAccount>;
  updatePlatformFundingAccount(id: string, updates: Partial<InsertPlatformFundingAccount>): Promise<PlatformFundingAccount | null>;
  deletePlatformFundingAccount(id: string): Promise<void>;
  setPrimaryFundingAccount(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return result[0];
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
    return result[0];
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        ...user,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Fetch potential role-specific records first
      const [companyProfile] = await tx
        .select({ id: companyProfiles.id })
        .from(companyProfiles)
        .where(eq(companyProfiles.userId, id))
        .limit(1);

      if (companyProfile) {
        const companyId = companyProfile.id;

        // Clean up offers and related entities
        const offerRows = await tx
          .select({ id: offers.id })
          .from(offers)
          .where(eq(offers.companyId, companyId));
        const offerIds = offerRows.map((offer) => offer.id);

        if (offerIds.length > 0) {
          const applicationRows = await tx
            .select({ id: applications.id })
            .from(applications)
            .where(inArray(applications.offerId, offerIds));
          const applicationIds = applicationRows.map((app) => app.id);

          if (applicationIds.length > 0) {
            const conversationRows = await tx
              .select({ id: conversations.id })
              .from(conversations)
              .where(inArray(conversations.applicationId, applicationIds));
            const conversationIds = conversationRows.map((conv) => conv.id);

            if (conversationIds.length > 0) {
              await tx.delete(messages).where(inArray(messages.conversationId, conversationIds));
              await tx.delete(conversations).where(inArray(conversations.id, conversationIds));
            }

            await tx.delete(analytics).where(inArray(analytics.applicationId, applicationIds));
            await tx.delete(reviews).where(inArray(reviews.applicationId, applicationIds));
            await tx.delete(applications).where(inArray(applications.id, applicationIds));
          }

          await tx.delete(analytics).where(inArray(analytics.offerId, offerIds));
          await tx.delete(favorites).where(inArray(favorites.offerId, offerIds));
          await tx.delete(clickEvents).where(inArray(clickEvents.offerId, offerIds));
          await tx.delete(offerVideos).where(inArray(offerVideos.offerId, offerIds));
          await tx.delete(offers).where(inArray(offers.id, offerIds));
        }

        // Clean up company retainer data
        const contractRows = await tx
          .select({ id: retainerContracts.id })
          .from(retainerContracts)
          .where(eq(retainerContracts.companyId, companyId));
        const contractIds = contractRows.map((contract) => contract.id);

        if (contractIds.length > 0) {
          await tx.delete(retainerDeliverables).where(inArray(retainerDeliverables.contractId, contractIds));
          await tx.delete(retainerApplications).where(inArray(retainerApplications.contractId, contractIds));
          await tx.delete(retainerPayments).where(inArray(retainerPayments.contractId, contractIds));
          await tx.delete(retainerContracts).where(inArray(retainerContracts.id, contractIds));
        }

        // Remove stray retainer payments tied to this company
        await tx.delete(retainerPayments).where(eq(retainerPayments.companyId, companyId));

        // Remove the company profile itself
        await tx.delete(companyProfiles).where(eq(companyProfiles.id, companyId));
      }

      const [creatorProfile] = await tx
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.userId, id))
        .limit(1);

      if (creatorProfile) {
        // Clean up creator applications and related data
        const creatorApplications = await tx
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.creatorId, id));
        const applicationIds = creatorApplications.map((app) => app.id);

        if (applicationIds.length > 0) {
          const conversationRows = await tx
            .select({ id: conversations.id })
            .from(conversations)
            .where(inArray(conversations.applicationId, applicationIds));
          const conversationIds = conversationRows.map((conv) => conv.id);

          if (conversationIds.length > 0) {
            await tx.delete(messages).where(inArray(messages.conversationId, conversationIds));
            await tx.delete(conversations).where(inArray(conversations.id, conversationIds));
          }

          await tx.delete(analytics).where(inArray(analytics.applicationId, applicationIds));
          await tx.delete(reviews).where(inArray(reviews.applicationId, applicationIds));
          await tx.delete(clickEvents).where(inArray(clickEvents.applicationId, applicationIds));
          await tx.delete(applications).where(inArray(applications.id, applicationIds));
        }

        await tx.delete(analytics).where(eq(analytics.creatorId, id));
        await tx.delete(favorites).where(eq(favorites.creatorId, id));
        await tx.delete(retainerApplications).where(eq(retainerApplications.creatorId, id));
        await tx.delete(retainerDeliverables).where(eq(retainerDeliverables.creatorId, id));
        await tx.delete(retainerPayments).where(eq(retainerPayments.creatorId, id));
        await tx.delete(creatorProfiles).where(eq(creatorProfiles.id, creatorProfile.id));
      }

      // Remove notifications and preferences
      await tx.delete(notifications).where(eq(notifications.userId, id));
      await tx.delete(userNotificationPreferences).where(eq(userNotificationPreferences.userId, id));

      // Remove payment settings and payments initiated by this user
      await tx.delete(paymentSettings).where(eq(paymentSettings.userId, id));
      await tx.delete(payments).where(eq(payments.creatorId, id));

      // Finally remove the user record
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  // Creator Profiles
  async getCreatorProfile(userId: string): Promise<CreatorProfile | undefined> {
    const result = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async createCreatorProfile(profile: InsertCreatorProfile): Promise<CreatorProfile> {
    const result = await db
      .insert(creatorProfiles)
      .values({
        ...profile,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateCreatorProfile(
    userId: string,
    updates: Partial<InsertCreatorProfile>,
  ): Promise<CreatorProfile | undefined> {
    const result = await db
      .update(creatorProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creatorProfiles.userId, userId))
      .returning();
    return result[0];
  }

  // Company Profiles
  async getCompanyProfile(userId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async getCompanyProfileById(id: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.id, id))
      .limit(1);
    return result[0];
  }

  async createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
    const newId = randomUUID();
    console.log(`[Storage] Creating company profile with ID: ${newId} for user ${profile.userId}`);
    const result = await db
      .insert(companyProfiles)
      .values({
        ...profile,
        id: newId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    console.log(`[Storage] Company profile created: ${result[0].legalName} with ID: ${result[0].id}`);
    return result[0];
  }

  async updateCompanyProfile(
    userId: string,
    updates: Partial<InsertCompanyProfile>,
  ): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getPendingCompanies(): Promise<CompanyProfile[]> {
    return await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.status, "pending"))
      .orderBy(desc(companyProfiles.createdAt));
  }

  async approveCompany(companyId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  async rejectCompany(companyId: string, reason: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  async suspendCompany(companyId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  async unsuspendCompany(companyId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  async getAllCompanies(filters?: {
    status?: string;
    industry?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    let query = db
      .select({
        company: companyProfiles,
        user: users,
      })
      .from(companyProfiles)
      .leftJoin(users, eq(companyProfiles.userId, users.id));

    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(companyProfiles.status, filters.status as any));
    }

    if (filters?.industry) {
      conditions.push(eq(companyProfiles.industry, filters.industry));
    }

    if (filters?.startDate) {
      conditions.push(gte(companyProfiles.createdAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(companyProfiles.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(companyProfiles.createdAt)) as any;

    const results = await query;

    return results.map((row: any) => ({
      ...row.company,
      user: row.user,
      isDeletedUser:
        !!row.user?.email &&
        (row.user.email.startsWith("deleted-") || row.user.email.includes("@deleted.user")),
    }));
  }

  async getCompanyById(companyId: string): Promise<any | undefined> {
    console.log(`[Storage] getCompanyById called with ID: ${companyId}`);
    const result = await db
      .select({
        company: companyProfiles,
        user: users,
      })
      .from(companyProfiles)
      .leftJoin(users, eq(companyProfiles.userId, users.id))
      .where(eq(companyProfiles.id, companyId))
      .limit(1);

    console.log(`[Storage] Query result length: ${result.length}`);
    if (result.length === 0) return undefined;

    const company = {
      ...result[0].company,
      user: result[0].user,
      isDeletedUser:
        !!result[0].user?.email &&
        (result[0].user.email.startsWith("deleted-") ||
          result[0].user.email.includes("@deleted.user")),
    };
    console.log(`[Storage] Found company: ${company.legalName} with ID: ${company.id}`);
    return company;
  }

  async getCompanyOffers(companyId: string): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyId))
      .orderBy(desc(offers.createdAt));
  }

  async getCompanyPayments(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        payment: payments,
        application: applications,
        offer: offers,
        creator: users,
      })
      .from(payments)
      .leftJoin(applications, eq(payments.applicationId, applications.id))
      .leftJoin(offers, eq(applications.offerId, offers.id))
      .leftJoin(users, eq(applications.creatorId, users.id))
      .where(eq(offers.companyId, companyId))
      .orderBy(desc(payments.createdAt));

    return result.map((row: any) => ({
      ...row.payment,
      application: row.application,
      offer: row.offer,
      creator: row.creator,
    }));
  }

  async getCompanyCreatorRelationships(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        application: applications,
        offer: offers,
        creator: users,
        creatorProfile: creatorProfiles,
      })
      .from(applications)
      .leftJoin(offers, eq(applications.offerId, offers.id))
      .leftJoin(users, eq(applications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .where(eq(offers.companyId, companyId))
      .orderBy(desc(applications.createdAt));

    return result.map((row: any) => ({
      ...row.application,
      offer: row.offer,
      creator: row.creator,
      creatorProfile: row.creatorProfile,
    }));
  }

  // Offers
  async getOffer(id: string): Promise<Offer | undefined> {
    const result = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    return result[0];
  }

  async getOffers(_filters?: any): Promise<Offer[]> {
    // Support optional filters from the caller (status, companyId, limit, search, niches, commissionType, sortBy)
    // If a limit is provided, respect it. If not provided, return all matching offers.
    const filters = _filters || {};

    let query: any = db
      .select({
        offer: offers,
        company: companyProfiles,
      })
      .from(offers)
      .leftJoin(companyProfiles, eq(offers.companyId, companyProfiles.id));

    // Build where conditions
    const conditions: any[] = [];

    if (filters.status) {
      conditions.push(eq(offers.status, filters.status));
    } else {
      conditions.push(eq(offers.status, "approved"));
    }

    if (filters.companyId) {
      conditions.push(eq(offers.companyId, filters.companyId));
    }

    // Search filter - search in title, shortDescription, and fullDescription
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${offers.title}) LIKE ${searchTerm}`,
          sql`LOWER(${offers.shortDescription}) LIKE ${searchTerm}`,
          sql`LOWER(${offers.fullDescription}) LIKE ${searchTerm}`
        )
      );
    }

    // Niche filter - filter by primaryNiche
    if (filters.niches) {
      const nichesList = typeof filters.niches === 'string'
        ? filters.niches.split(',').map((n: string) => n.trim()).filter(Boolean)
        : filters.niches;

      if (nichesList.length > 0) {
        conditions.push(inArray(offers.primaryNiche, nichesList));
      }
    }

    // Commission type filter
    if (filters.commissionType) {
      conditions.push(eq(offers.commissionType, filters.commissionType));
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = (query.where(and(...conditions)) as unknown) as typeof query;
    }

    const sortByBestRated = filters.sortBy === 'best_rated';

    // Sort by
    if (filters.sortBy === 'highest_commission') {
      // Sort by commission amount/percentage/rate (descending)
      query = (query.orderBy(
        desc(sql`COALESCE(${offers.commissionAmount}, ${offers.commissionPercentage}, 0)`)
      ) as unknown) as typeof query;
    } else if (filters.sortBy === 'lowest_commission') {
      // Sort by commission amount/percentage/rate (ascending)
      query = (query.orderBy(
        asc(sql`COALESCE(${offers.commissionAmount}, ${offers.commissionPercentage}, 0)`)
      ) as unknown) as typeof query;
    } else if (filters.sortBy === 'trending') {
      // Sort by view count and application count
      query = (query.orderBy(
        desc(sql`COALESCE(${offers.viewCount}, 0) + COALESCE(${offers.applicationCount}, 0) * 2`)
      ) as unknown) as typeof query;
    } else if (filters.sortBy === 'most_popular') {
      // Sort by application count
      query = (query.orderBy(desc(offers.applicationCount)) as unknown) as typeof query;
    } else {
      // Default: newest first
      query = (query.orderBy(desc(offers.createdAt)) as unknown) as typeof query;
    }

    if (filters.limit) {
      const limit = parseInt(String(filters.limit), 10);
      if (!Number.isNaN(limit) && limit > 0) {
        query = (query.limit(limit) as unknown) as typeof query;
      }
    }

    const results = await query;

    const companyIds = Array.from(
      new Set(
        results
          .map((row: any) => row.offer?.companyId)
          .filter((companyId: string | undefined) => Boolean(companyId)),
      ),
    ) as string[];

    let ratingsByCompany: Record<string, { averageRating: number | null; reviewCount: number }> = {};

    if (companyIds.length > 0) {
      const ratingRows = await db
        .select({
          companyId: reviews.companyId,
          averageRating: sql<number | null>`AVG(${reviews.overallRating})`,
          reviewCount: sql<number>`COUNT(*)::int`,
        })
        .from(reviews)
        .where(
          and(
            inArray(reviews.companyId, companyIds),
            eq(reviews.isHidden, false),
            eq(reviews.isApproved, true),
          ),
        )
        .groupBy(reviews.companyId);

      ratingsByCompany = ratingRows.reduce(
        (acc, row) => {
          acc[row.companyId] = {
            averageRating: row.averageRating,
            reviewCount: row.reviewCount,
          };
          return acc;
        },
        {} as Record<string, { averageRating: number | null; reviewCount: number }>,
      );
    }

    // ✅ ADD: Map to include company data and stats
    let offersWithStats = await Promise.all(
      results.map(async (row: any) => {
        const activeCreatorsCount = await this.getActiveCreatorsCountForOffer(row.offer.id);
        const clickStats = await this.getOfferClickStats(row.offer.id);
        const ratingStats = ratingsByCompany[row.offer.companyId];

        const companyData = row.company
          ? {
              ...(row.company as any),
              averageRating:
                ratingStats && ratingStats.averageRating !== null
                  ? Number(ratingStats.averageRating)
                  : null,
              reviewCount: ratingStats?.reviewCount ?? 0,
            }
          : row.company;

        return {
          ...row.offer,
          company: companyData,
          activeCreatorsCount,
          totalClicks: clickStats.totalClicks,
          uniqueClicks: clickStats.uniqueClicks,
        };
      })
    );

    if (sortByBestRated) {
      offersWithStats = offersWithStats.sort((a: any, b: any) => {
        const aRating = typeof a.company?.averageRating === 'number' ? a.company.averageRating : 0;
        const bRating = typeof b.company?.averageRating === 'number' ? b.company.averageRating : 0;

        if (bRating !== aRating) {
          return bRating - aRating;
        }

        const aReviews = typeof a.company?.reviewCount === 'number' ? a.company.reviewCount : 0;
        const bReviews = typeof b.company?.reviewCount === 'number' ? b.company.reviewCount : 0;

        return bReviews - aReviews;
      });
    }

    return offersWithStats;
  }

  async getTrendingOffers(limit: number = 20): Promise<Offer[]> {
    // Get offers with most applications in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingResults = await db
      .select({
        offerId: applications.offerId,
        applicationCount: sql<number>`COUNT(*)::int`,
      })
      .from(applications)
      .where(gte(applications.createdAt, sevenDaysAgo))
      .groupBy(applications.offerId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    // Get full offer details for trending offers
    if (trendingResults.length === 0) {
      // Fallback to newest approved offers if no trending data
      return this.getOffers({ status: 'approved', limit });
    }

    const offerIds = trendingResults.map(r => r.offerId);

    const offerData = await db
      .select({
        offer: offers,
        company: companyProfiles,
      })
      .from(offers)
      .leftJoin(companyProfiles, eq(offers.companyId, companyProfiles.id))
      .where(and(
        inArray(offers.id, offerIds),
        eq(offers.status, 'approved')
      ));

    // Map to include stats and application counts
    const offersWithStats = await Promise.all(
      offerData.map(async (row: any) => {
        const activeCreatorsCount = await this.getActiveCreatorsCountForOffer(row.offer.id);
        const clickStats = await this.getOfferClickStats(row.offer.id);
        const trendingData = trendingResults.find(t => t.offerId === row.offer.id);

        return {
          ...row.offer,
          company: row.company,
          activeCreatorsCount,
          totalClicks: clickStats.totalClicks,
          uniqueClicks: clickStats.uniqueClicks,
          applicationCountLast7Days: trendingData?.applicationCount || 0,
        };
      })
    );

    // Sort by application count
    return offersWithStats.sort((a, b) => b.applicationCountLast7Days - a.applicationCountLast7Days);
  }

  async getOffersByCompany(companyId: string): Promise<Offer[]> {
    const results = await db
      .select({
        offer: offers,
        company: companyProfiles,
      })
      .from(offers)
      .leftJoin(companyProfiles, eq(offers.companyId, companyProfiles.id))
      .where(eq(offers.companyId, companyId))
      .orderBy(desc(offers.createdAt));

    // Map to include company data and fetch videos and stats for each offer
    const offersWithData = await Promise.all(
      results.map(async (row: any) => {
        const videos = await this.getOfferVideos(row.offer.id);
        const activeCreatorsCount = await this.getActiveCreatorsCountForOffer(row.offer.id);
        const clickStats = await this.getOfferClickStats(row.offer.id);

        const applicationsResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(applications)
          .where(eq(applications.offerId, row.offer.id));
        
        const applicationCount = Number(applicationsResult[0]?.count || 0);

        return {
          ...row.offer,
          company: row.company,
          videos,
          activeCreatorsCount,
          totalClicks: clickStats.totalClicks,
          uniqueClicks: clickStats.uniqueClicks,
          applicationCount, 
        };
      })
    );

    return offersWithData;
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    const offerId = randomUUID();

    // DEBUG: Log creator requirements being saved
    console.log('[STORAGE] createOffer received creator requirements:', {
      minimumFollowers: offer.minimumFollowers,
      allowedPlatforms: offer.allowedPlatforms,
      geographicRestrictions: offer.geographicRestrictions,
      ageRestriction: offer.ageRestriction,
      contentStyleRequirements: offer.contentStyleRequirements?.substring(0, 50),
      brandSafetyRequirements: offer.brandSafetyRequirements?.substring(0, 50),
    });

    const slug = offer.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const commission_details: any = {
      type: offer.commissionType,
    };

    if (offer.commissionType === "per_sale" && offer.commissionPercentage) {
      commission_details.percentage = offer.commissionPercentage;
    }

    if (offer.commissionType !== "per_sale" && offer.commissionAmount) {
      commission_details.amount = offer.commissionAmount;
    }

    // ✅ FIX: Added featuredImageUrl and creator requirements fields to the INSERT
    // Format arrays properly for PostgreSQL
    const allowedPlatformsArray = offer.allowedPlatforms && offer.allowedPlatforms.length > 0
      ? `ARRAY[${offer.allowedPlatforms.map(p => `'${p.replace(/'/g, "''")}'`).join(',')}]::text[]`
      : 'ARRAY[]::text[]';

    const geographicRestrictionsArray = offer.geographicRestrictions && offer.geographicRestrictions.length > 0
      ? `ARRAY[${offer.geographicRestrictions.map(g => `'${g.replace(/'/g, "''")}'`).join(',')}]::text[]`
      : 'ARRAY[]::text[]';

    const result = await db.execute(sql`
      INSERT INTO offers (
        id, company_id, title, slug, short_description, full_description,
        product_name, primary_niche, product_url, commission_type,
        commission_details, commission_percentage, commission_amount,
        status, created_at, updated_at, niches, requirements, featured_image_url,
        is_priority, view_count, application_count, active_creator_count,
        minimum_followers, allowed_platforms, geographic_restrictions,
        age_restriction, content_style_requirements, brand_safety_requirements
      ) VALUES (
        ${offerId},
        ${offer.companyId}::uuid,
        ${offer.title},
        ${slug},
        ${offer.shortDescription},
        ${offer.fullDescription},
        ${offer.productName},
        ${offer.primaryNiche},
        ${offer.productUrl},
        ${offer.commissionType},
        ${JSON.stringify(commission_details)}::jsonb,
        ${offer.commissionPercentage || null},
        ${offer.commissionAmount || null},
        ${offer.status || "pending_review"},
        NOW(),
        NOW(),
        ARRAY[]::varchar[],
        '{}'::jsonb,
        ${offer.featuredImageUrl || null},
        false,
        0,
        0,
        0,
        ${offer.minimumFollowers || null},
        ${sql.raw(allowedPlatformsArray)},
        ${sql.raw(geographicRestrictionsArray)},
        ${offer.ageRestriction || null},
        ${offer.contentStyleRequirements || null},
        ${offer.brandSafetyRequirements || null}
      )
      RETURNING *
    `);

    return result.rows[0] as Offer;
  }

  async updateOffer(id: string, updates: Partial<InsertOffer>): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return result[0];
  }

  async incrementOfferViewCount(id: string): Promise<void> {
    await db
      .update(offers)
      .set({
        viewCount: sql`COALESCE(${offers.viewCount}, 0) + 1`,
        updatedAt: new Date()
      })
      .where(eq(offers.id, id));
  }

  async deleteOffer(id: string): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }

  async getPendingOffers(): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.status, "pending_review"))
      .orderBy(desc(offers.createdAt));
  }

  async approveOffer(offerId: string): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async getAllOffersForAdmin(filters?: {
    status?: string;
    niche?: string;
    commissionType?: string;
  }): Promise<Offer[]> {
    let query = db.select().from(offers);
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(offers.status, filters.status as any));
    }
    if (filters?.niche) {
      conditions.push(eq(offers.primaryNiche, filters.niche));
    }
    if (filters?.commissionType) {
      conditions.push(eq(offers.commissionType, filters.commissionType as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(offers.createdAt));

    // Ensure all fields have proper defaults and add stats for display
    const offersWithStats = await Promise.all(
      results.map(async (offer) => {
        const activeCreatorsCount = await this.getActiveCreatorsCountForOffer(offer.id);
        const clickStats = await this.getOfferClickStats(offer.id);

        return {
          ...offer,
          viewCount: offer.viewCount ?? 0,
          applicationCount: offer.applicationCount ?? 0,
          featuredOnHomepage: offer.featuredOnHomepage ?? false,
          listingFee: offer.listingFee ?? '0',
          activeCreatorsCount,
          totalClicks: clickStats.totalClicks,
          uniqueClicks: clickStats.uniqueClicks,
        };
      })
    );

    return offersWithStats.map(offer => ({
      ...offer,
      editRequests: offer.editRequests ?? [],
    }));
  }

  async rejectOffer(offerId: string, reason: string): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({
        status: "archived",
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async requestOfferEdits(offerId: string, notes: string, adminId: string): Promise<Offer | undefined> {
    const offer = await this.getOffer(offerId);
    if (!offer) return undefined;

    const editRequests = Array.isArray(offer.editRequests) ? offer.editRequests : [];
    const newEditRequest = {
      adminId,
      notes,
      requestedAt: new Date().toISOString(),
    };

    const result = await db
      .update(offers)
      .set({
        editRequests: [...editRequests, newEditRequest] as any,
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async featureOfferOnHomepage(offerId: string, featured: boolean): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({
        featuredOnHomepage: featured,
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async removeOfferFromPlatform(offerId: string): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({
        status: "archived",
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async adjustOfferListingFee(offerId: string, fee: string): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({
        listingFee: fee,
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  async getOfferWithStats(offerId: string): Promise<{
    offer: Offer | undefined;
    applicationStats: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
    activeCreators: number;
    performanceMetrics: {
      totalViews: number;
      totalApplications: number;
      approvalRate: number;
    };
  }> {
    const offer = await this.getOffer(offerId);
    if (!offer) {
      return {
        offer: undefined,
        applicationStats: { total: 0, pending: 0, approved: 0, rejected: 0 },
        activeCreators: 0,
        performanceMetrics: { totalViews: 0, totalApplications: 0, approvalRate: 0 },
      };
    }

    const allApplications = await db
      .select()
      .from(applications)
      .where(eq(applications.offerId, offerId));

    const applicationStats = {
      total: allApplications.length,
      pending: allApplications.filter(a => a.status === 'pending').length,
      approved: allApplications.filter(a => a.status === 'approved' || a.status === 'active').length,
      rejected: allApplications.filter(a => a.status === 'rejected').length,
    };

    const activeCreators = allApplications.filter(a => a.status === 'active').length;

    const approvalRate = applicationStats.total > 0
      ? (applicationStats.approved / applicationStats.total) * 100
      : 0;

    return {
      offer,
      applicationStats,
      activeCreators,
      performanceMetrics: {
        totalViews: offer.viewCount || 0,
        totalApplications: offer.applicationCount || 0,
        approvalRate: Math.round(approvalRate * 100) / 100,
      },
    };
  }

  // Offer Videos
  async getOfferVideos(offerId: string): Promise<OfferVideo[]> {
    return await db
      .select()
      .from(offerVideos)
      .where(eq(offerVideos.offerId, offerId))
      .orderBy(offerVideos.orderIndex);
  }

  async createOfferVideo(video: InsertOfferVideo): Promise<OfferVideo> {
    const result = await db
      .insert(offerVideos)
      .values({
        ...video,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deleteOfferVideo(id: string): Promise<void> {
    await db.delete(offerVideos).where(eq(offerVideos.id, id));
  }

  // Applications
  async getApplication(id: string): Promise<Application | undefined> {
    const result = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return result[0];
  }

  async getApplicationByTrackingCode(trackingCode: string): Promise<Application | undefined> {
    const result = await db
      .select()
      .from(applications)
      .where(eq(applications.trackingCode, trackingCode))
      .limit(1);
    return result[0];
  }

  async getApplicationsByCreator(creatorId: string): Promise<Application[]> {
    try {
      const result = await db
        .select()
        .from(applications)
        .where(eq(applications.creatorId, creatorId))
        .orderBy(desc(applications.createdAt));
      return result || [];
    } catch (error) {
      console.error("[getApplicationsByCreator] Error:", error);
      return [];
    }
  }

  async getApplicationsByOffer(offerId: string): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.offerId, offerId))
      .orderBy(desc(applications.createdAt));
  }

  async getExistingApplication(creatorId: string, offerId: string): Promise<Application | undefined> {
    const result = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.creatorId, creatorId),
          eq(applications.offerId, offerId)
        )
      )
      .limit(1);
    return result[0];
  }

  async getActiveCreatorsCountForOffer(offerId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(applications)
      .where(
        and(
          eq(applications.offerId, offerId),
          or(
            eq(applications.status, 'approved'),
            eq(applications.status, 'active')
          )
        )
      );
    return Number(result[0]?.count || 0);
  }

  async getOfferClickStats(offerId: string): Promise<{ totalClicks: number; uniqueClicks: number }> {
    const result = await db
      .select({
        totalClicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        uniqueClicks: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
      })
      .from(analytics)
      .where(eq(analytics.offerId, offerId));

    return {
      totalClicks: Number(result[0]?.totalClicks || 0),
      uniqueClicks: Number(result[0]?.uniqueClicks || 0),
    };
  }

  async getAllPendingApplications(): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.status, "pending"))
      .orderBy(applications.autoApprovalScheduledAt);
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const autoApprovalTime = new Date();
    autoApprovalTime.setMinutes(autoApprovalTime.getMinutes() + 7);

    const result = await db
      .insert(applications)
      .values({
        ...application,
        id: randomUUID(),
        autoApprovalScheduledAt: autoApprovalTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db
      .update(offers)
      .set({
        applicationCount: sql`COALESCE(${offers.applicationCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(offers.id, application.offerId));

    return result[0];
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async approveApplication(
    id: string,
    trackingLink: string,
    trackingCode: string,
  ): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({
        status: "approved",
        trackingLink,
        trackingCode,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async completeApplication(id: string): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async getApplicationsByCompany(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        id: applications.id,
        offerId: applications.offerId,
        offerTitle: offers.title,
        offerCommissionType: offers.commissionType,
        offerCommissionPercentage: offers.commissionPercentage,
        offerCommissionAmount: offers.commissionAmount,
        creatorId: applications.creatorId,
        creatorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
        creatorEmail: users.email,
        message: applications.message,
        status: applications.status,
        trackingLink: applications.trackingLink,
        trackingCode: applications.trackingCode,
        approvedAt: applications.approvedAt,
        completedAt: applications.completedAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorProfileImageUrl: users.profileImageUrl,
        creatorBio: creatorProfiles.bio,
        creatorYoutubeUrl: creatorProfiles.youtubeUrl,
        creatorTiktokUrl: creatorProfiles.tiktokUrl,
        creatorInstagramUrl: creatorProfiles.instagramUrl,
        creatorNiches: creatorProfiles.niches,
        clickCount: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        uniqueClickCount: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
        conversionCount: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        totalEarnings: sql<string>`COALESCE(SUM(${analytics.earnings}), 0)`,
      })
      .from(applications)
      .innerJoin(offers, eq(applications.offerId, offers.id))
      .innerJoin(users, eq(applications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .leftJoin(analytics, eq(applications.id, analytics.applicationId))
      .where(eq(offers.companyId, companyId))
      .groupBy(applications.id, offers.id, users.id, creatorProfiles.id)
      .orderBy(desc(applications.createdAt));

    return result.map((app) => ({
      id: app.id,
      offerId: app.offerId,
      offerTitle: app.offerTitle,
      creatorId: app.creatorId,
      creatorName: app.creatorName,
      creatorEmail: app.creatorEmail,
      message: app.message,
      status: app.status,
      trackingLink: app.trackingLink,
      trackingCode: app.trackingCode,
      approvedAt: app.approvedAt,
      completedAt: app.completedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      clickCount: app.clickCount,
      conversionCount: app.conversionCount,
      totalEarnings: app.totalEarnings,
      offer: {
        id: app.offerId,
        title: app.offerTitle,
        commissionType: app.offerCommissionType,
        commissionPercentage: app.offerCommissionPercentage,
        commissionAmount: app.offerCommissionAmount,
      },
      creator: {
        id: app.creatorId,
        firstName: app.creatorFirstName,
        lastName: app.creatorLastName,
        email: app.creatorEmail,
        profileImageUrl: app.creatorProfileImageUrl,
        bio: app.creatorBio,
        youtubeUrl: app.creatorYoutubeUrl,
        tiktokUrl: app.creatorTiktokUrl,
        instagramUrl: app.creatorInstagramUrl,
        niches: app.creatorNiches,
      },
    }));
  }

  // Messages & Conversations
  async getConversation(id: string): Promise<any> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationsByUser(
    userId: string,
    userRole: string,
    companyProfileId: string | null = null,
  ): Promise<any[]> {
    const whereClause =
      userRole === "company" && companyProfileId
        ? eq(conversations.companyId, companyProfileId)
        : eq(conversations.creatorId, userId);

    const result = await db
      .select({
        id: conversations.id,
        applicationId: conversations.applicationId,
        creatorId: conversations.creatorId,
        companyId: conversations.companyId,
        offerId: conversations.offerId,
        lastMessageAt: conversations.lastMessageAt,
        creatorUnreadCount: conversations.creatorUnreadCount,
        companyUnreadCount: conversations.companyUnreadCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        offerTitle: offers.title,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorEmail: users.email,
        creatorProfileImageUrl: users.profileImageUrl,
        companyLegalName: companyProfiles.legalName,
        companyTradeName: companyProfiles.tradeName,
        companyLogoUrl: companyProfiles.logoUrl,
        companyUserId: companyProfiles.userId,
      })
      .from(conversations)
      .innerJoin(offers, eq(conversations.offerId, offers.id))
      .innerJoin(users, eq(conversations.creatorId, users.id))
      .innerJoin(companyProfiles, eq(conversations.companyId, companyProfiles.id))
      .where(whereClause)
      .orderBy(desc(conversations.lastMessageAt));

    // Fetch last message for each conversation
    const conversationsWithMessages = await Promise.all(
      result.map(async (conv) => {
        const lastMessages = await db
          .select({
            content: messages.content,
            senderId: messages.senderId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          ...conv,
          lastMessage: lastMessages[0]?.content || null,
          lastMessageSenderId: lastMessages[0]?.senderId || null,
        };
      })
    );

    return conversationsWithMessages.map((conv) => ({
      id: conv.id,
      applicationId: conv.applicationId,
      creatorId: conv.creatorId,
      companyId: conv.companyId,
      offerId: conv.offerId,
      offerTitle: conv.offerTitle,
      lastMessageAt: conv.lastMessageAt,
      lastMessage: conv.lastMessage,
      lastMessageSenderId: conv.lastMessageSenderId,
      creatorUnreadCount: conv.creatorUnreadCount,
      companyUnreadCount: conv.companyUnreadCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      otherUser:
        userRole === "company"
          ? {
              id: conv.creatorId,
              name: `${conv.creatorFirstName || ""} ${conv.creatorLastName || ""}`.trim() ||
                conv.creatorEmail,
              firstName: conv.creatorFirstName,
              lastName: conv.creatorLastName,
              email: conv.creatorEmail,
              profileImageUrl: conv.creatorProfileImageUrl,
            }
          : {
              id: conv.companyUserId,
              name: conv.companyTradeName || conv.companyLegalName,
              legalName: conv.companyLegalName,
              tradeName: conv.companyTradeName,
              logoUrl: conv.companyLogoUrl,
            },
    }));
  }

  async getAllConversationsForAdmin(options: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { search, limit = 50, offset = 0 } = options;

    // Build the base query
    let query = db
      .select({
        id: conversations.id,
        applicationId: conversations.applicationId,
        creatorId: conversations.creatorId,
        companyId: conversations.companyId,
        offerId: conversations.offerId,
        lastMessageAt: conversations.lastMessageAt,
        creatorUnreadCount: conversations.creatorUnreadCount,
        companyUnreadCount: conversations.companyUnreadCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        offerTitle: offers.title,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorEmail: users.email,
        creatorProfileImageUrl: users.profileImageUrl,
        companyLegalName: companyProfiles.legalName,
        companyTradeName: companyProfiles.tradeName,
        companyLogoUrl: companyProfiles.logoUrl,
        companyUserId: companyProfiles.userId,
      })
      .from(conversations)
      .innerJoin(offers, eq(conversations.offerId, offers.id))
      .innerJoin(users, eq(conversations.creatorId, users.id))
      .innerJoin(companyProfiles, eq(conversations.companyId, companyProfiles.id))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    // Apply search filter if provided
    if (search) {
      query = query.where(
        or(
          sql`${users.firstName} ILIKE ${`%${search}%`}`,
          sql`${users.lastName} ILIKE ${`%${search}%`}`,
          sql`${users.email} ILIKE ${`%${search}%`}`,
          sql`${companyProfiles.legalName} ILIKE ${`%${search}%`}`,
          sql`${companyProfiles.tradeName} ILIKE ${`%${search}%`}`,
          sql`${offers.title} ILIKE ${`%${search}%`}`
        )
      ) as typeof query;
    }

    const result = await query;

    // Fetch last message for each conversation
    const conversationsWithMessages = await Promise.all(
      result.map(async (conv) => {
        const lastMessages = await db
          .select({
            content: messages.content,
            senderId: messages.senderId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          ...conv,
          lastMessage: lastMessages[0]?.content || null,
          lastMessageSenderId: lastMessages[0]?.senderId || null,
        };
      })
    );

    return conversationsWithMessages.map((conv) => ({
      id: conv.id,
      applicationId: conv.applicationId,
      creatorId: conv.creatorId,
      companyId: conv.companyId,
      offerId: conv.offerId,
      offerTitle: conv.offerTitle,
      lastMessageAt: conv.lastMessageAt,
      lastMessage: conv.lastMessage,
      lastMessageSenderId: conv.lastMessageSenderId,
      creatorUnreadCount: conv.creatorUnreadCount,
      companyUnreadCount: conv.companyUnreadCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      creator: {
        id: conv.creatorId,
        name: `${conv.creatorFirstName || ""} ${conv.creatorLastName || ""}`.trim() ||
          conv.creatorEmail,
        firstName: conv.creatorFirstName,
        lastName: conv.creatorLastName,
        email: conv.creatorEmail,
        profileImageUrl: conv.creatorProfileImageUrl,
      },
      company: {
        id: conv.companyUserId,
        name: conv.companyTradeName || conv.companyLegalName,
        legalName: conv.companyLegalName,
        tradeName: conv.companyTradeName,
        logoUrl: conv.companyLogoUrl,
      },
    }));
  }

  async createConversation(data: any): Promise<any> {
    const result = await db
      .insert(conversations)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    try {
      const result = await db.insert(messages).values(message).returning();

      // Get the conversation to determine who should receive the unread notification
      const conversation = await this.getConversation(message.conversationId);

      // Increment unread count for the recipient
      // If the sender is the creator, increment company unread count
      // If the sender is the company, increment creator unread count
      const isCreatorSender = message.senderId === conversation.creatorId;

      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
          ...(isCreatorSender
            ? { companyUnreadCount: sql`${conversations.companyUnreadCount} + 1` }
            : { creatorUnreadCount: sql`${conversations.creatorUnreadCount} + 1` }
          )
        })
        .where(eq(conversations.id, message.conversationId));

      return result[0];
    } catch (error) {
      console.error("[createMessage] Error:", error);
      throw error;
    }
  }

  async getUnreadMessageCountForCreator(creatorId: string): Promise<number> {
    const result = await db
      .select({
        unreadCount: sql<number>`COALESCE(SUM(${conversations.creatorUnreadCount}), 0)`,
      })
      .from(conversations)
      .where(eq(conversations.creatorId, creatorId));

    return result[0]?.unreadCount ?? 0;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);
      return result || [];
    } catch (error) {
      console.error("[getMessages] Error:", error);
      return [];
    }
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    // Mark messages as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.conversationId, conversationId), eq(messages.isRead, false)));

    // Get the conversation to determine who is reading the messages
    const conversation = await this.getConversation(conversationId);

    // Reset unread count for the reader
    // If the reader is the creator, reset creator unread count
    // If the reader is the company, reset company unread count
    const isCreatorReading = userId === conversation.creatorId;

    await db
      .update(conversations)
      .set(
        isCreatorReading
          ? { creatorUnreadCount: 0 }
          : { companyUnreadCount: 0 }
      )
      .where(eq(conversations.id, conversationId));
  }

  // Reviews
  async getReviewsByCompany(companyId: string): Promise<Review[]> {
    try {
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.companyId, companyId))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching company reviews - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.filter((review) => review.companyId === companyId);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching company reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getReviewsByCreator(creatorId: string): Promise<Review[]> {
    try {
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.creatorId, creatorId))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching creator reviews - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.filter((review) => review.creatorId === creatorId);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching creator reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getReviewsByCreatorAndCompany(creatorId: string, companyId: string): Promise<Review[]> {
    try {
      return await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.creatorId, creatorId), eq(reviews.companyId, companyId)))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching creator and company reviews - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.filter((review) => review.creatorId === creatorId && review.companyId === companyId);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching creator and company reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getReview(id: string): Promise<Review | undefined> {
    try {
      const result = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching review - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.find((review) => review.id === id);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching review - returning undefined.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async createReview(review: InsertReview): Promise<Review> {
    try {
      const result = await db
        .insert(reviews)
        .values({
          ...review,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while creating review - returning ephemeral review.",
        );
        return buildEphemeralReview(review);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while creating review - returning ephemeral review.",
        );
        return buildEphemeralReview(review);
      }
      throw error;
    }
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({ ...updates, isEdited: true, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while updating review - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while updating review - treating as no-op.");
        return undefined;
      }
      throw error;
    }
  }

  async getAllReviews(): Promise<Review[]> {
    try {
      return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching all reviews - attempting legacy fallback.",
        );
        return legacyFetchReviews();
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching all reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async hideReview(id: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({ isHidden: true, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn("[Storage] reviews column mismatch while hiding review - treating as no-op.");
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while hiding review - treating as no-op.");
        return undefined;
      }
      throw error;
    }
  }

  async deleteReview(id: string): Promise<void> {
    try {
      await db.delete(reviews).where(eq(reviews.id, id));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn("[Storage] reviews column mismatch while deleting review - skipping operation.");
        return;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while deleting review - skipping operation.");
        return;
      }
      throw error;
    }
  }

  async updateAdminNote(id: string, note: string, _adminId: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({
          adminNote: note,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while updating admin note - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while updating admin note - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async approveReview(id: string, adminId: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({
          isApproved: true,
          isHidden: false,
          approvedBy: adminId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while approving review - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while approving review - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  // Favorites
  async getFavoritesByCreator(creatorId: string): Promise<Favorite[]> {
    try {
      const result = await db.select().from(favorites).where(eq(favorites.creatorId, creatorId));
      return result || [];
    } catch (error) {
      console.error("[getFavoritesByCreator] Error:", error);
      return [];
    }
  }

  async isFavorite(creatorId: string, offerId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.creatorId, creatorId), eq(favorites.offerId, offerId)))
      .limit(1);
    return result.length > 0;
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const result = await db
      .insert(favorites)
      .values({
        ...favorite,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deleteFavorite(creatorId: string, offerId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(and(eq(favorites.creatorId, creatorId), eq(favorites.offerId, offerId)));
  }

  // Analytics
  async getAnalyticsByCreator(creatorId: string): Promise<any> {
    try {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      // Get affiliate earnings from analytics table
      const affiliateResult = await db
        .select({
          totalEarnings: sql<number>`COALESCE(SUM(CAST(${analytics.earnings} AS DECIMAL)), 0)`,
          totalClicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
          uniqueClicks: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
          conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        })
        .from(applications)
        .leftJoin(analytics, eq(analytics.applicationId, applications.id))
        .where(eq(applications.creatorId, creatorId));

      const affiliateMonthlyResult = await db
        .select({
          monthlyEarnings: sql<number>`COALESCE(SUM(CAST(${analytics.earnings} AS DECIMAL)), 0)`,
          monthlyClicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        })
        .from(applications)
        .leftJoin(analytics, eq(analytics.applicationId, applications.id))
        .where(
          and(
            eq(applications.creatorId, creatorId),
            gte(analytics.date, monthStart)
          )
        );

      // Get retainer earnings from retainer_payments table (only completed payments)
      const retainerResult = await db
        .select({
          totalRetainerEarnings: sql<number>`COALESCE(SUM(CAST(${retainerPayments.amount} AS DECIMAL)), 0)`,
        })
        .from(retainerPayments)
        .where(
          sql`${retainerPayments.creatorId} = ${creatorId} AND ${retainerPayments.status} = 'completed'`
        );

      const retainerMonthlyResult = await db
        .select({
          monthlyRetainerEarnings: sql<number>`COALESCE(SUM(CAST(${retainerPayments.amount} AS DECIMAL)), 0)`,
        })
        .from(retainerPayments)
        .where(
          and(
            eq(retainerPayments.creatorId, creatorId),
            eq(retainerPayments.status, "completed"),
            sql`COALESCE(${retainerPayments.completedAt}, ${retainerPayments.createdAt}) >= ${monthStart}`
          )
        );

      const affiliateEarnings = Number(affiliateResult[0]?.totalEarnings || 0);
      const retainerEarnings = Number(retainerResult[0]?.totalRetainerEarnings || 0);
      const totalEarnings = affiliateEarnings + retainerEarnings;

      const monthlyAffiliateEarnings = Number(affiliateMonthlyResult[0]?.monthlyEarnings || 0);
      const monthlyRetainerEarnings = Number(retainerMonthlyResult[0]?.monthlyRetainerEarnings || 0);
      const monthlyEarnings = monthlyAffiliateEarnings + monthlyRetainerEarnings;

      return {
        totalEarnings,
        affiliateEarnings,
        retainerEarnings,
        monthlyEarnings,
        monthlyAffiliateEarnings,
        monthlyRetainerEarnings,
        totalClicks: Number(affiliateResult[0]?.totalClicks || 0),
        monthlyClicks: Number(affiliateMonthlyResult[0]?.monthlyClicks || 0),
        uniqueClicks: Number(affiliateResult[0]?.uniqueClicks || 0),
        conversions: Number(affiliateResult[0]?.conversions || 0),
      };
    } catch (error) {
      console.error("[getAnalyticsByCreator] Error:", error);
      return {
        totalEarnings: 0,
        affiliateEarnings: 0,
        retainerEarnings: 0,
        monthlyEarnings: 0,
        monthlyAffiliateEarnings: 0,
        monthlyRetainerEarnings: 0,
        totalClicks: 0,
        monthlyClicks: 0,
        uniqueClicks: 0,
        conversions: 0,
      };
    }
  }

  async getAnalyticsTimeSeriesByCreator(creatorId: string, dateRange: string): Promise<any[]> {
    try {
      const whereClauses: any[] = [eq(applications.creatorId, creatorId)];

      if (dateRange !== "all") {
        let daysBack = 30;
        if (dateRange === "7d") daysBack = 7;
        else if (dateRange === "30d") daysBack = 30;
        else if (dateRange === "90d") daysBack = 90;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        whereClauses.push(sql`${analytics.date} >= ${startDate}`);
      }

      const result = await db
        .select({
          date: sql<string>`TO_CHAR(${analytics.date}, 'Mon DD')`,
          clicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        })
        .from(analytics)
        .innerJoin(applications, eq(analytics.applicationId, applications.id))
        .where(and(...whereClauses))
        .groupBy(analytics.date)
        .orderBy(analytics.date);

      return result || [];
    } catch (error) {
      console.error("[getAnalyticsTimeSeriesByCreator] Error:", error);
      return [];
    }
  }

  async getAnalyticsTimeSeriesByApplication(applicationId: string, dateRange: string): Promise<any[]> {
    try {
      const whereClauses: any[] = [eq(analytics.applicationId, applicationId)];

      if (dateRange !== "all") {
        let daysBack = 30;
        if (dateRange === "7d") daysBack = 7;
        else if (dateRange === "30d") daysBack = 30;
        else if (dateRange === "90d") daysBack = 90;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        whereClauses.push(sql`${analytics.date} >= ${startDate}`);
      }

      const result = await db
        .select({
          date: sql<string>`TO_CHAR(${analytics.date}, 'Mon DD')`,
          clicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
          conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
          earnings: sql<number>`COALESCE(SUM(${analytics.earnings}), 0)`,
        })
        .from(analytics)
        .where(and(...whereClauses))
        .groupBy(analytics.date)
        .orderBy(analytics.date);

      return result || [];
    } catch (error) {
      console.error("[getAnalyticsTimeSeriesByApplication] Error:", error);
      return [];
    }
  }

  async getAnalyticsByApplication(applicationId: string): Promise<any[]> {
    return await db
      .select()
      .from(analytics)
      .where(eq(analytics.applicationId, applicationId))
      .orderBy(desc(analytics.date));
  }

  async logTrackingClick(
    applicationId: string,
    clickData: {
      ip: string;
      userAgent: string;
      referer: string;
      timestamp: Date;
      fraudScore?: number;
      fraudFlags?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
    },
  ): Promise<void> {
    console.log(`[Storage] logTrackingClick called for application ${applicationId}`);
    const application = await this.getApplication(applicationId);
    if (!application) {
      console.error("[Storage/Tracking] Application not found:", applicationId);
      return;
    }
    console.log(`[Storage] Application found, logging click to database...`);

    const ua = clickData.userAgent || "";
    const uaLower = ua.toLowerCase();
    const deviceType = uaLower.includes("mobile")
      ? "mobile"
      : uaLower.includes("tablet")
      ? "tablet"
      : "desktop";
    const browser = ua.includes("Chrome")
      ? "Chrome"
      : ua.includes("Firefox")
      ? "Firefox"
      : ua.includes("Safari")
      ? "Safari"
      : "Other";

    const geo = geoip.lookup(clickData.ip);
    const country = geo?.country || "Unknown";
    const city = geo?.city || "Unknown";

    const clickEventId = randomUUID();
    console.log(`[Storage] Inserting click event ${clickEventId} into database...`);
    try {
      await db.insert(clickEvents).values({
        id: clickEventId,
        applicationId,
        offerId: application.offerId,
        creatorId: application.creatorId,
        ipAddress: clickData.ip,
        userAgent: ua,
        referer: clickData.referer,
        country,
        city,
        fraudScore: clickData.fraudScore || 0,
        fraudFlags: clickData.fraudFlags || null,
        utmSource: clickData.utmSource || null,
        utmMedium: clickData.utmMedium || null,
        utmCampaign: clickData.utmCampaign || null,
        utmTerm: clickData.utmTerm || null,
        utmContent: clickData.utmContent || null,
        timestamp: new Date(),
      });
      console.log(`[Storage] Successfully inserted click event ${clickEventId}`);
    } catch (error) {
      console.error(`[Storage] Error inserting click event:`, error);
      throw error;
    }

    // Only count clicks with fraud score < 50 toward analytics
    const fraudScore = clickData.fraudScore || 0;
    console.log(`[Storage] Processing analytics update. Fraud score: ${fraudScore}`);
    if (fraudScore < 50) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count unique IPs for today (excluding fraudulent clicks)
      const uniqueIpsToday = await db

        .selectDistinct({ ipAddress: clickEvents.ipAddress })
        .from(clickEvents)
        .where(
          and(
            eq(clickEvents.applicationId, applicationId),
            sql`${clickEvents.timestamp}::date = ${today}::date`,
            sql`${clickEvents.fraudScore} < 50`
          )
        );

      console.log(`[Storage] Unique IPs today: ${uniqueIpsToday.length}`);

      const existing = await db
        .select()
        .from(analytics)
        .where(and(eq(analytics.applicationId, applicationId), eq(analytics.date, today)))
        .limit(1);

      if (existing.length > 0) {
        console.log(`[Storage] Updating existing analytics record ${existing[0].id}`);
        await db
          .update(analytics)
          .set({
            clicks: sql`${analytics.clicks} + 1`,
            uniqueClicks: uniqueIpsToday.length,
          })
          .where(eq(analytics.id, existing[0].id));
        console.log(`[Storage] Analytics updated successfully`);
      } else {
        console.log(`[Storage] Creating new analytics record for today`);
        await db.insert(analytics).values({
          id: randomUUID(),
          applicationId,
          offerId: application.offerId,
          creatorId: application.creatorId,
          date: today,
          clicks: 1,
          uniqueClicks: uniqueIpsToday.length,
          conversions: 0,
          earnings: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      // Log fraud detection but don't count toward analytics
      console.log('[Fraud Detection] High fraud score click not counted:', {
        applicationId,
        ip: clickData.ip,
        fraudScore,
        fraudFlags: clickData.fraudFlags,
      });
    }

    console.log(
      `[Tracking] Logged click for application ${applicationId} from ${city}, ${country} - IP: ${clickData.ip}`,
    );
  }

  // Record Conversion and Calculate Earnings
  async recordConversion(applicationId: string, saleAmount?: number): Promise<void> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      console.error("[Conversion] Application not found:", applicationId);
      return;
    }

    const offer = await this.getOffer(application.offerId);
    if (!offer) {
      console.error("[Conversion] Offer not found:", application.offerId);
      return;
    }

    let earnings = 0;

    switch (offer.commissionType) {
      case "per_sale":
        if (!saleAmount || !offer.commissionPercentage) {
          console.error("[Conversion] Sale amount required for per_sale commission");
          return;
        }
        earnings = (saleAmount * parseFloat(offer.commissionPercentage.toString())) / 100;
        break;

      case "per_lead":
      case "per_click":
        if (!offer.commissionAmount) {
          console.error("[Conversion] Commission amount not set");
          return;
        }
        earnings = parseFloat(offer.commissionAmount.toString());
        break;

      case "monthly_retainer":
        console.log("[Conversion] Retainer payments handled via deliverable approval");
        return;

      case "hybrid":
        if (offer.commissionAmount) {
          earnings = parseFloat(offer.commissionAmount.toString());
        } else if (saleAmount && offer.commissionPercentage) {
          earnings = (saleAmount * parseFloat(offer.commissionPercentage.toString())) / 100;
        }
        break;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.applicationId, applicationId), eq(analytics.date, today)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(analytics)
        .set({
          conversions: sql`${analytics.conversions} + 1`,
          earnings: sql`${analytics.earnings} + ${earnings.toFixed(2)}`,
        })
        .where(eq(analytics.id, existing[0].id));
    } else {
      await db.insert(analytics).values({
        id: randomUUID(),
        applicationId,
        offerId: application.offerId,
        creatorId: application.creatorId,
        date: today,
        clicks: 0,
        uniqueClicks: 0,
        conversions: 1,
        earnings: earnings.toFixed(2),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Calculate fees according to spec: 7% total (4% platform + 3% Stripe)
    const platformFee = earnings * 0.04; // 4% platform fee
    const stripeFee = earnings * 0.03;   // 3% Stripe processing fee
    const netAmount = earnings - platformFee - stripeFee;

    await this.createPayment({
      applicationId: applicationId,
      creatorId: application.creatorId,
      companyId: offer.companyId,
      offerId: application.offerId,
      grossAmount: earnings.toFixed(2),
      platformFeeAmount: platformFee.toFixed(2),
      stripeFeeAmount: stripeFee.toFixed(2),
      netAmount: netAmount.toFixed(2),
      status: "pending",
      description: `Commission for ${offer.commissionType} conversion`,
    });

    console.log(
      `[Conversion] Recorded conversion for application ${applicationId} - Gross: $${earnings.toFixed(2)}, Platform Fee (4%): $${platformFee.toFixed(2)}, Stripe Fee (3%): $${stripeFee.toFixed(2)}, Net: $${netAmount.toFixed(2)}`,
    );
  }

  // Payment Settings
  async getPaymentSettings(userId: string): Promise<PaymentSetting[]> {
    return await db
      .select()
      .from(paymentSettings)
      .where(eq(paymentSettings.userId, userId))
      .orderBy(desc(paymentSettings.createdAt));
  }

  async createPaymentSetting(setting: InsertPaymentSetting): Promise<PaymentSetting> {
    const result = await db
      .insert(paymentSettings)
      .values({
        ...setting,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deletePaymentSetting(id: string): Promise<void> {
    await db.delete(paymentSettings).where(eq(paymentSettings.id, id));
  }

  async setPrimaryPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    // First, unset all primary flags for this user
    await db
      .update(paymentSettings)
      .set({ isDefault: false })
      .where(eq(paymentSettings.userId, userId));

    // Then set the specified one as primary
    await db
      .update(paymentSettings)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(paymentSettings.id, paymentMethodId));
  }

  async updatePaymentSetting(paymentMethodId: string, updates: Partial<PaymentSetting>): Promise<void> {
    await db
      .update(paymentSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentSettings.id, paymentMethodId));
  }

  // Payments
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db
      .insert(payments)
      .values({
        ...payment,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return result[0];
  }

  // Get payment from either payments or retainerPayments table
  async getPaymentOrRetainerPayment(id: string): Promise<any | undefined> {
    // First try regular payments table
    const regularPayment = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (regularPayment[0]) {
      return {
        ...regularPayment[0],
        paymentType: 'affiliate',
      };
    }

    // Then try retainer payments table
    const retainerPayment = await db.select().from(retainerPayments).where(eq(retainerPayments.id, id)).limit(1);
    if (retainerPayment[0]) {
      const p = retainerPayment[0];
      // Format retainer payment to match payment structure
      const netAmount = p.netAmount || p.amount || '0';
      const grossAmount = p.grossAmount || (parseFloat(netAmount.toString()) / 0.93).toFixed(2);
      const platformFeeAmount = p.platformFeeAmount || (parseFloat(grossAmount) * 0.04).toFixed(2);
      const stripeFeeAmount = p.processingFeeAmount || (parseFloat(grossAmount) * 0.03).toFixed(2);

      return {
        ...p,
        paymentType: 'retainer',
        grossAmount,
        platformFeeAmount,
        stripeFeeAmount,
        netAmount,
        creatorId: p.creatorId,
        companyId: p.companyId,
      };
    }

    return undefined;
  }

  // Update payment status for either affiliate or retainer payments
  async updatePaymentOrRetainerPaymentStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded',
    updates?: any
  ): Promise<any | undefined> {
    // First try regular payments table
    const regularPayment = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (regularPayment[0]) {
      return await this.updatePaymentStatus(id, status, updates);
    }

    // Then try retainer payments table
    const retainerPayment = await db.select().from(retainerPayments).where(eq(retainerPayments.id, id)).limit(1);
    if (retainerPayment[0]) {
      return await this.updateRetainerPaymentStatus(id, status, updates);
    }

    return undefined;
  }

  async getPaymentsByCreator(creatorId: string): Promise<any[]> {
    // Get affiliate commission payments
    const affiliatePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.creatorId, creatorId))
      .orderBy(desc(payments.createdAt));

    // Get retainer payments
    const retainerPaymentsList = await db
      .select()
      .from(retainerPayments)
      .where(eq(retainerPayments.creatorId, creatorId))
      .orderBy(desc(retainerPayments.createdAt));

    // Combine both with type indicators
    const combinedPayments = [
      ...affiliatePayments.map(p => ({
        ...p,
        paymentType: 'affiliate' as const,
        netAmount: p.netAmount,
        createdAt: p.createdAt || p.initiatedAt,
      })),
      ...retainerPaymentsList.map(p => {
        // Retainer amount is the net amount (what creator receives)
        // Calculate fee breakdown (platform 4% + processing 3% = 7% total)
        const netAmount = p.amount ? parseFloat(p.amount.toString()) : 0;
        const grossAmount = netAmount > 0 ? netAmount / 0.93 : 0; // Reverse calculate: net = gross * 0.93
        const platformFeeAmount = grossAmount * 0.04;
        const stripeFeeAmount = grossAmount * 0.03;

        return {
          ...p,
          paymentType: 'retainer' as const,
          // Add fee breakdown fields to match affiliate payment structure
          grossAmount: grossAmount.toFixed(2),
          platformFeeAmount: platformFeeAmount.toFixed(2),
          stripeFeeAmount: stripeFeeAmount.toFixed(2),
          netAmount: p.amount?.toString() || '0.00', // Original amount is the net
          initiatedAt: p.createdAt,
          createdAt: p.createdAt,
        };
      }),
    ];

    // Sort by date descending
    return combinedPayments.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.initiatedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.initiatedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  async getPaymentsByCompany(companyId: string): Promise<any[]> {
    // Get affiliate commission payments
    const affiliatePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.companyId, companyId))
      .orderBy(desc(payments.createdAt));

    // Get retainer payments
    const retainerPaymentsList = await db
      .select()
      .from(retainerPayments)
      .where(eq(retainerPayments.companyId, companyId))
      .orderBy(desc(retainerPayments.createdAt));

    // Combine both with type indicators
    const combinedPayments = [
      ...affiliatePayments.map(p => ({
        ...p,
        paymentType: 'affiliate' as const,
        netAmount: p.netAmount,
        createdAt: p.createdAt || p.initiatedAt,
      })),
      ...retainerPaymentsList.map(p => {
        // Retainer amount is the net amount (what creator receives)
        // Calculate fee breakdown (platform 4% + processing 3% = 7% total)
        const netAmount = p.amount ? parseFloat(p.amount.toString()) : 0;
        const grossAmount = netAmount > 0 ? netAmount / 0.93 : 0; // Reverse calculate: net = gross * 0.93
        const platformFeeAmount = grossAmount * 0.04;
        const stripeFeeAmount = grossAmount * 0.03;

        return {
          ...p,
          paymentType: 'retainer' as const,
          // Add fee breakdown fields to match affiliate payment structure
          grossAmount: grossAmount.toFixed(2),
          platformFeeAmount: platformFeeAmount.toFixed(2),
          stripeFeeAmount: stripeFeeAmount.toFixed(2),
          netAmount: p.amount?.toString() || '0.00', // Original amount is the net
          initiatedAt: p.createdAt,
          createdAt: p.createdAt,
        };
      }),
    ];

    // Sort by date descending
    return combinedPayments.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.initiatedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.initiatedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  async getAllPayments(): Promise<any[]> {
    // Get all affiliate commission payments
    const affiliatePayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));

    // Get all retainer payments
    const retainerPaymentsList = await db
      .select()
      .from(retainerPayments)
      .orderBy(desc(retainerPayments.createdAt));

    // Combine both with type indicators
    const combinedPayments = [
      ...affiliatePayments.map(p => ({
        ...p,
        paymentType: 'affiliate' as const,
        netAmount: p.netAmount,
        createdAt: p.createdAt || p.initiatedAt,
      })),
      ...retainerPaymentsList.map(p => {
        // Retainer amount is the net amount (what creator receives)
        // Calculate fee breakdown (platform 4% + processing 3% = 7% total)
        const netAmount = p.amount ? parseFloat(p.amount.toString()) : 0;
        const grossAmount = netAmount > 0 ? netAmount / 0.93 : 0; // Reverse calculate: net = gross * 0.93
        const platformFeeAmount = grossAmount * 0.04;
        const stripeFeeAmount = grossAmount * 0.03;

        return {
          ...p,
          paymentType: 'retainer' as const,
          // Add fee breakdown fields to match affiliate payment structure
          grossAmount: grossAmount.toFixed(2),
          platformFeeAmount: platformFeeAmount.toFixed(2),
          stripeFeeAmount: stripeFeeAmount.toFixed(2),
          netAmount: p.amount?.toString() || '0.00', // Original amount is the net
          initiatedAt: p.createdAt,
          createdAt: p.createdAt,
        };
      }),
    ];

    // Sort by date descending
    return combinedPayments.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.initiatedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.initiatedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  async getDisputedPayments(options: {
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { limit = 50, offset = 0 } = options;

    // Get disputed affiliate payments (status='failed' and description contains 'Disputed:')
    const affiliatePayments = await db
      .select({
        payment: payments,
        creator: users,
        company: companyProfiles,
        offer: offers,
      })
      .from(payments)
      .innerJoin(users, eq(payments.creatorId, users.id))
      .innerJoin(companyProfiles, eq(payments.companyId, companyProfiles.id))
      .leftJoin(offers, eq(payments.offerId, offers.id))
      .where(
        and(
          eq(payments.status, 'failed'),
          sql`${payments.description} ILIKE ${'%Disputed:%'}`
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // Get disputed retainer payments
    const retainerPaymentsList = await db
      .select({
        payment: retainerPayments,
        creator: users,
        company: companyProfiles,
        contract: retainerContracts,
      })
      .from(retainerPayments)
      .innerJoin(users, eq(retainerPayments.creatorId, users.id))
      .innerJoin(companyProfiles, eq(retainerPayments.companyId, companyProfiles.id))
      .leftJoin(retainerContracts, eq(retainerPayments.contractId, retainerContracts.id))
      .where(
        and(
          eq(retainerPayments.status, 'failed'),
          sql`${retainerPayments.description} ILIKE ${'%Disputed:%'}`
        )
      )
      .orderBy(desc(retainerPayments.createdAt))
      .limit(limit)
      .offset(offset);

    // Combine and format results
    const combinedPayments = [
      ...affiliatePayments.map(({ payment, creator, company, offer }) => ({
        ...payment,
        paymentType: 'affiliate' as const,
        creator: {
          id: creator.id,
          firstName: creator.firstName,
          lastName: creator.lastName,
          email: creator.email,
          profileImageUrl: creator.profileImageUrl,
        },
        company: {
          id: company.id,
          userId: company.userId,
          legalName: company.legalName,
          tradeName: company.tradeName,
          logoUrl: company.logoUrl,
        },
        title: offer?.title || 'Affiliate Offer',
      })),
      ...retainerPaymentsList.map(({ payment, creator, company, contract }) => ({
        ...payment,
        paymentType: 'retainer' as const,
        netAmount: payment.amount,
        creator: {
          id: creator.id,
          firstName: creator.firstName,
          lastName: creator.lastName,
          email: creator.email,
          profileImageUrl: creator.profileImageUrl,
        },
        company: {
          id: company.id,
          userId: company.userId,
          legalName: company.legalName,
          tradeName: company.tradeName,
          logoUrl: company.logoUrl,
        },
        title: contract?.title || 'Retainer Contract',
      })),
    ];

    // Sort by date descending
    return combinedPayments.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.initiatedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.initiatedAt || 0).getTime();
      return dateB - dateA;
    });
  }

  async updatePaymentStatus(
    id: string,
    status: string,
    updates?: Partial<Payment>,
  ): Promise<Payment | undefined> {
    const result = await db
      .update(payments)
      .set({
        status: status as any,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  // Retainer Contracts
  async getRetainerContract(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .leftJoin(users, eq(companyProfiles.userId, users.id))
      .where(eq(retainerContracts.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    const contract: any = {
      ...result[0].retainer_contracts,
      company: result[0].company_profiles,
      companyUser: result[0].users,
    };

    contract.activeCreators = await this.getActiveRetainerCreatorsCount(contract.id);

    // Fetch assigned creator if exists
    if (contract.assignedCreatorId) {
      const creator = await this.getUserById(contract.assignedCreatorId);
      contract.assignedCreator = creator;
    }

    return contract;
  }

  async getRetainerContracts(filters?: any): Promise<any[]> {
    let query = db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .leftJoin(users, eq(companyProfiles.userId, users.id));

    if (filters?.status) {
      query = (query.where(eq(retainerContracts.status, filters.status)) as unknown) as typeof query;
    }

    const results = await query.orderBy(desc(retainerContracts.createdAt));

    return Promise.all(
      results.map(async (r: any) => ({
        ...r.retainer_contracts,
        company: r.company_profiles,
        companyUser: r.users,
        activeCreators: await this.getActiveRetainerCreatorsCount(r.retainer_contracts.id),
      }))
    );
  }

  async getRetainerContractsByCompany(companyId: string): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(retainerContracts)
        .where(eq(retainerContracts.companyId, companyId))
        .orderBy(desc(retainerContracts.createdAt));

      // Fetch assigned creator for each contract
      const contractsWithCreators = await Promise.all(
        results.map(async (contract) => {
          const baseContract = {
            ...contract,
            activeCreators: await this.getActiveRetainerCreatorsCount(contract.id),
          };

          if (contract.assignedCreatorId) {
            const creator = await this.getUserById(contract.assignedCreatorId);
            return { ...baseContract, assignedCreator: creator };
          }

          return baseContract;
        })
      );

      return contractsWithCreators;
    } catch (error) {
      if (isMissingRelationError(error, "retainer_contracts")) {
        console.warn(
          "[Storage] retainer_contracts relation missing while fetching company retainer contracts - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getRetainerContractsByCreator(creatorId: string): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(retainerContracts)
        .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
        .where(eq(retainerContracts.assignedCreatorId, creatorId))
        .orderBy(desc(retainerContracts.createdAt));

      return Promise.all(
        results.map(async (r: any) => ({
          ...r.retainer_contracts,
          company: r.company_profiles,
          activeCreators: await this.getActiveRetainerCreatorsCount(r.retainer_contracts.id),
        }))
      );
    } catch (error) {
      if (isMissingRelationError(error, "retainer_contracts")) {
        console.warn(
          "[Storage] retainer_contracts relation missing while fetching creator retainer contracts - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getOpenRetainerContracts(): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(retainerContracts)
        .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
        .leftJoin(users, eq(companyProfiles.userId, users.id))
        .where(eq(retainerContracts.status, "open"))
        .orderBy(desc(retainerContracts.createdAt));

      return Promise.all(
        results.map(async (r: any) => ({
          ...r.retainer_contracts,
          company: r.company_profiles,
          companyUser: r.users,
          activeCreators: await this.getActiveRetainerCreatorsCount(r.retainer_contracts.id),
        }))
      );
    } catch (error) {
      if (isMissingRelationError(error, "retainer_contracts")) {
        console.warn(
          "[Storage] retainer_contracts relation missing while fetching open retainer contracts - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async createRetainerContract(contract: InsertRetainerContract): Promise<RetainerContract> {
    const result = await db
      .insert(retainerContracts)
      .values({
        ...contract,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerContract(
    id: string,
    updates: Partial<InsertRetainerContract>,
  ): Promise<RetainerContract | undefined> {
    const result = await db
      .update(retainerContracts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(retainerContracts.id, id))
      .returning();
    return result[0];
  }

  async deleteRetainerContract(id: string): Promise<void> {
    await db.delete(retainerContracts).where(eq(retainerContracts.id, id));
  }

  async getActiveRetainerCreatorsCount(contractId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${retainerApplications.creatorId})` })
      .from(retainerApplications)
      .where(
        and(eq(retainerApplications.contractId, contractId), eq(retainerApplications.status, "approved"))
      );

    return Number(result[0]?.count || 0);
  }

  // Retainer Applications
  async getRetainerApplication(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerApplications)
      .leftJoin(users, eq(retainerApplications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .leftJoin(retainerContracts, eq(retainerApplications.contractId, retainerContracts.id))
      .where(eq(retainerApplications.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return {
      ...result[0].retainer_applications,
      creator: result[0].users,
      creatorProfile: result[0].creator_profiles,
      contract: result[0].retainer_contracts,
    };
  }

  async getRetainerApplicationsByContract(contractId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerApplications)
      .leftJoin(users, eq(retainerApplications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .where(eq(retainerApplications.contractId, contractId))
      .orderBy(desc(retainerApplications.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_applications,
      creator: r.users,
      creatorProfile: r.creator_profiles,
    }));
  }

  async getRetainerApplicationsByCreator(creatorId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerApplications)
      .leftJoin(retainerContracts, eq(retainerApplications.contractId, retainerContracts.id))
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .where(eq(retainerApplications.creatorId, creatorId))
      .orderBy(desc(retainerApplications.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_applications,
      contract: r.retainer_contracts,
      company: r.company_profiles,
    }));
  }

  async createRetainerApplication(application: InsertRetainerApplication): Promise<RetainerApplication> {
    const result = await db
      .insert(retainerApplications)
      .values({
        ...application,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerApplication(
    id: string,
    updates: Partial<InsertRetainerApplication>,
  ): Promise<RetainerApplication | undefined> {
    const result = await db
      .update(retainerApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();
    return result[0];
  }

  async approveRetainerApplication(
    id: string,
    contractId: string,
    creatorId: string,
  ): Promise<RetainerApplication | undefined> {
    const appResult = await db
      .update(retainerApplications)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();

    await db
      .update(retainerContracts)
      .set({
        assignedCreatorId: creatorId,
        status: "in_progress",
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(retainerContracts.id, contractId));

    return appResult[0];
  }

  async rejectRetainerApplication(id: string): Promise<RetainerApplication | undefined> {
    const result = await db
      .update(retainerApplications)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();
    return result[0];
  }

  // Retainer Deliverables
  async getRetainerDeliverable(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerDeliverables)
      .where(eq(retainerDeliverables.id, id))
      .limit(1);
    return result[0];
  }

  async getRetainerDeliverablesByContract(contractId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .where(eq(retainerDeliverables.contractId, contractId))
      .orderBy(desc(retainerDeliverables.submittedAt));
    return results;
  }

  async getRetainerDeliverablesByCreator(creatorId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .leftJoin(retainerContracts, eq(retainerDeliverables.contractId, retainerContracts.id))
      .where(eq(retainerDeliverables.creatorId, creatorId))
      .orderBy(desc(retainerDeliverables.submittedAt));

    return results.map((r: any) => ({
      ...r.retainer_deliverables,
      contract: r.retainer_contracts,
    }));
  }

  async getRetainerDeliverablesForMonth(contractId: string, monthNumber: number): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .where(and(eq(retainerDeliverables.contractId, contractId), eq(retainerDeliverables.monthNumber, monthNumber)))
      .orderBy(retainerDeliverables.videoNumber);
    return results;
  }

  async createRetainerDeliverable(deliverable: InsertRetainerDeliverable): Promise<RetainerDeliverable> {
    const result = await db
      .insert(retainerDeliverables)
      .values({
        ...deliverable,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerDeliverable(
    id: string,
    updates: Partial<InsertRetainerDeliverable>,
  ): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set(updates)
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async approveRetainerDeliverable(id: string, reviewNotes?: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async rejectRetainerDeliverable(id: string, reviewNotes: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async requestRevision(id: string, reviewNotes: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "revision_requested",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async deleteRetainerDeliverable(id: string): Promise<void> {
  await db.delete(retainerDeliverables).where(eq(retainerDeliverables.id, id));
  console.log(`[Storage] Deleted retainer deliverable ${id}`);
}

  async createRetainerPayment(payment: InsertRetainerPayment): Promise<RetainerPayment> {
    try {
      const result = await db
        .insert(retainerPayments)
        .values({
          ...payment,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while creating retainer payment - treating as no-op.",
        );
        return {
          ...payment,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RetainerPayment;
      }
      throw error;
    }
  }

  async getRetainerPayment(id: string): Promise<RetainerPayment | null> {
    try {
      const result = await db
        .select()
        .from(retainerPayments)
        .where(eq(retainerPayments.id, id))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while fetching retainer payment - returning null.",
        );
        return null;
      }
      throw error;
    }
  }

  async getRetainerPaymentsByContract(contractId: string): Promise<RetainerPayment[]> {
    try {
      return await db
        .select()
        .from(retainerPayments)
        .where(eq(retainerPayments.contractId, contractId))
        .orderBy(desc(retainerPayments.createdAt));
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while fetching contract payments - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getRetainerPaymentsByCreator(creatorId: string): Promise<RetainerPayment[]> {
    try {
      return await db
        .select()
        .from(retainerPayments)
        .where(eq(retainerPayments.creatorId, creatorId))
        .orderBy(desc(retainerPayments.createdAt));
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while fetching creator retainer payments - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async updateRetainerPaymentStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded',
    updates?: {
      providerTransactionId?: string;
      providerResponse?: any;
      paymentMethod?: string;
      initiatedAt?: Date;
      completedAt?: Date;
      failedAt?: Date;
      description?: string;
    }
  ): Promise<RetainerPayment | null> {
    try {
      const result = await db
        .update(retainerPayments)
        .set({
          status: status as any, // Type assertion needed for Drizzle enum
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(retainerPayments.id, id))
        .returning();
      return result[0] || null;
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while updating retainer payment status - treating as no-op.",
        );
        return null;
      }
      throw error;
    }
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      console.log(`[Storage] Creating notification for user ${notification.userId}, type: ${notification.type}`);
      const result = await db
        .insert(notifications)
        .values({
          ...notification,
          id: randomUUID(),
          createdAt: new Date(),
        })
        .returning();
      console.log(`[Storage] Notification created successfully:`, result[0]);
      return result[0];
    } catch (error) {
      console.error(`[Storage] Error creating notification:`, error);
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while creating notification - returning ephemeral notification.",
        );
        console.warn("[Storage] WARNING: Ephemeral notifications are NOT persisted to database!");
        return buildEphemeralNotification(notification);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while creating notification - returning ephemeral notification.",
        );
        console.warn("[Storage] WARNING: Ephemeral notifications are NOT persisted to database!");
        return buildEphemeralNotification(notification);
      }
      throw error;
    }
  }

  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const results = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while fetching notifications - attempting legacy fallback.",
        );
        return legacyFetchNotifications(userId, { limit });
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while fetching notifications - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getNotification(id: string): Promise<Notification | null> {
    try {
      const result = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, id))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while fetching single notification - attempting legacy fallback.",
        );
        // Fallback: try to fetch all notifications and find the id (legacy slow path)
        try {
          const all = await legacyFetchNotifications((null as unknown) as string, { limit: 1000 });
          return all.find((n: any) => n.id === id) || null;
        } catch (e) {
          return null;
        }
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while fetching single notification - returning null.",
        );
        return null;
      }
      throw error;
    }
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    try {
      const results = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt));
      return results;
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while fetching unread notifications - attempting legacy fallback.",
        );
        return legacyFetchUnreadNotifications(userId);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while fetching unread notifications - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return coerceCount(result[0]?.count ?? 0);
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while counting unread notifications - attempting legacy fallback.",
        );
        return legacyCountUnreadNotifications(userId);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while counting unread notifications - returning 0.",
        );
        return 0;
      }
      throw error;
    }
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while marking notification as read - treating as already handled.",
        );
        return undefined;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while marking notification as read - treating as already handled.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while marking all notifications as read - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while marking all notifications as read - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  async deleteNotification(id: string): Promise<void> {
    try {
      await db.delete(notifications).where(eq(notifications.id, id));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while deleting notification - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while deleting notification - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  async clearAllNotifications(userId: string): Promise<void> {
    try {
      await db.delete(notifications).where(eq(notifications.userId, userId));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while clearing notifications - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while clearing notifications - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  // User Notification Preferences
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null> {
    try {
      const result = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, userId))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while fetching preferences - returning null.",
        );
        return null;
      }
      throw error;
    }
  }

  async createUserNotificationPreferences(
    preferences: InsertUserNotificationPreferences,
  ): Promise<UserNotificationPreferences> {
    try {
      const result = await db
        .insert(userNotificationPreferences)
        .values({
          ...preferences,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while creating preferences - returning defaults.",
        );
        return {
          ...buildDefaultNotificationPreferences(preferences.userId),
          ...preferences,
        };
      }
      throw error;
    }
  }

  async updateUserNotificationPreferences(
    userId: string,
    updates: Partial<InsertUserNotificationPreferences>,
  ): Promise<UserNotificationPreferences | undefined> {
    try {
      const result = await db
        .update(userNotificationPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userNotificationPreferences.userId, userId))
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while updating preferences - returning merged defaults.",
        );
        return {
          ...buildDefaultNotificationPreferences(userId),
          ...updates,
          userId,
          updatedAt: new Date(),
        } as UserNotificationPreferences;
      }
      throw error;
    }
  }

  // Admin
  private async updateCreatorAccountStatus(
    userId: string,
    status: User["accountStatus"],
  ): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set({ accountStatus: status, updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.role, "creator")))
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "users")) {
        console.warn(
          "[Storage] users relation missing while updating creator status - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async getCreatorsForAdmin(): Promise<AdminCreatorSummary[]> {
    try {
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          accountStatus: users.accountStatus,
          createdAt: users.createdAt,
          creatorProfile: creatorProfiles,
        })
        .from(users)
        .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
        .where(eq(users.role, "creator"))
        .orderBy(desc(users.createdAt));

      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        profileImageUrl: row.profileImageUrl ?? null,
        accountStatus: row.accountStatus,
        createdAt: row.createdAt ?? null,
        isDeleted: row.email.startsWith("deleted-") || row.email.includes("@deleted.user"),
        profile: row.creatorProfile
          ? {
              bio: row.creatorProfile.bio ?? null,
              youtubeFollowers: row.creatorProfile.youtubeFollowers ?? null,
              tiktokFollowers: row.creatorProfile.tiktokFollowers ?? null,
              instagramFollowers: row.creatorProfile.instagramFollowers ?? null,
            }
          : null,
      }));
    } catch (error) {
      if (isMissingRelationError(error, "users") || isMissingRelationError(error, "creator_profiles")) {
        console.warn("[Storage] creator listing relations missing - returning empty creator list.");
        return [];
      }
      throw error;
    }
  }

  async suspendCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "suspended");
  }

  async unsuspendCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "active");
  }

  async banCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "banned");
  }

  // Helper methods
  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getAllUsers(): Promise<User[]> {
    const results = await db.select().from(users);
    return results;
  }

  async getUsersByRole(role: 'creator' | 'company' | 'admin'): Promise<User[]> {
    const results = await db.select().from(users).where(eq(users.role, role));
    return results;
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);

    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditLogs.timestamp)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async getAuditLogsByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.getAuditLogs({ userId, limit });
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.getAuditLogs({ entityType, entityId });
  }

  // Platform Settings
  async getPlatformSetting(key: string): Promise<PlatformSetting | null> {
    const result = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return result[0] || null;
  }

  async getAllPlatformSettings(): Promise<PlatformSetting[]> {
    return await db.select().from(platformSettings).orderBy(platformSettings.category, platformSettings.key);
  }

  async getPlatformSettingsByCategory(category: string): Promise<PlatformSetting[]> {
    return await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.category, category))
      .orderBy(platformSettings.key);
  }

  async updatePlatformSetting(key: string, value: string, updatedBy: string | null): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(key);
    if (existing) {
      const result = await db
        .update(platformSettings)
        .set({ value, updatedBy, updatedAt: new Date() })
        .where(eq(platformSettings.key, key))
        .returning();
      return result[0];
    } else {
      // Create if doesn't exist
      return this.createPlatformSetting({
        key,
        value,
        description: null,
        category: null,
        updatedBy,
      });
    }
  }

  async createPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting> {
    const result = await db.insert(platformSettings).values(setting).returning();
    return result[0];
  }

  // Niche Categories Management
  async getNiches(): Promise<Niche[]> {
    return await db.select().from(niches).orderBy(niches.name);
  }

  async getActiveNiches(): Promise<Niche[]> {
    return await db
      .select()
      .from(niches)
      .where(eq(niches.isActive, true))
      .orderBy(niches.name);
  }

  async getNicheById(id: string): Promise<Niche | null> {
    const result = await db
      .select()
      .from(niches)
      .where(eq(niches.id, id))
      .limit(1);
    return result[0] || null;
  }

  async addNiche(name: string, description?: string, isActive: boolean = true, userId?: string): Promise<Niche> {
    const nicheData: InsertNiche = {
      name,
      description: description || null,
      isActive,
    };

    const result = await db.insert(niches).values(nicheData).returning();
    return result[0];
  }

  async updateNiche(id: string, updates: { name?: string; description?: string; isActive?: boolean }, userId?: string): Promise<Niche> {
    const result = await db
      .update(niches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(niches.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Niche not found');
    }

    return result[0];
  }

  async deleteNiche(id: string, userId?: string): Promise<void> {
    const result = await db
      .delete(niches)
      .where(eq(niches.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Niche not found');
    }
  }

  // Platform Funding Accounts
  async getPlatformFundingAccount(id: string): Promise<PlatformFundingAccount | null> {
    const result = await db
      .select()
      .from(platformFundingAccounts)
      .where(eq(platformFundingAccounts.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getAllPlatformFundingAccounts(): Promise<PlatformFundingAccount[]> {
    return await db
      .select()
      .from(platformFundingAccounts)
      .orderBy(desc(platformFundingAccounts.isPrimary), platformFundingAccounts.createdAt);
  }

  async createPlatformFundingAccount(account: InsertPlatformFundingAccount): Promise<PlatformFundingAccount> {
    const result = await db.insert(platformFundingAccounts).values(account).returning();
    return result[0];
  }

  async updatePlatformFundingAccount(
    id: string,
    updates: Partial<InsertPlatformFundingAccount>
  ): Promise<PlatformFundingAccount | null> {
    const result = await db
      .update(platformFundingAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(platformFundingAccounts.id, id))
      .returning();
    return result[0] || null;
  }

  async deletePlatformFundingAccount(id: string): Promise<void> {
    await db.delete(platformFundingAccounts).where(eq(platformFundingAccounts.id, id));
  }

  async setPrimaryFundingAccount(id: string): Promise<void> {
    // First, unset all primary flags
    await db.update(platformFundingAccounts).set({ isPrimary: false });
    // Then set the specified one as primary
    await db
      .update(platformFundingAccounts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(platformFundingAccounts.id, id));
  }

  async getAnalyticsByCompany(userId: string): Promise<any> {
  try {
    // FIXED: Get company profile first using userId
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      console.log('[getAnalyticsByCompany] No company profile found for userId:', userId);
      return {
        totalClicks: 0,
        uniqueClicks: 0,
        conversions: 0,
        totalSpent: 0,
        affiliateSpent: 0,
        retainerSpent: 0,
        activeCreators: 0,
        activeOffers: 0,
      };
    }

    console.log('[getAnalyticsByCompany] Found company profile:', companyProfile.id);

    // Get all offers for this company using company profile ID
    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    console.log('[getAnalyticsByCompany] Found', companyOffers.length, 'offers');

    if (companyOffers.length === 0) {
      return {
        totalClicks: 0,
        uniqueClicks: 0,
        conversions: 0,
        totalSpent: 0,
        affiliateSpent: 0,
        retainerSpent: 0,
        activeCreators: 0,
        activeOffers: 0,
      };
    }

    const offerIds = companyOffers.map(offer => offer.id);

    // Get analytics from all applications for these offers
    const analyticsResult = await db
      .select({
        totalClicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        uniqueClicks: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
        conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        totalSpent: sql<number>`COALESCE(SUM(CAST(${analytics.earnings} AS DECIMAL)), 0)`,
      })
      .from(analytics)
      .innerJoin(applications, eq(analytics.applicationId, applications.id))
      .where(inArray(applications.offerId, offerIds));

    // Get count of active creators (unique creators with approved/active applications)
    const activeCreatorsResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${applications.creatorId})`,
      })
      .from(applications)
      .where(
        and(
          inArray(applications.offerId, offerIds),
          or(
            eq(applications.status, 'approved'),
            eq(applications.status, 'active')
          )
        )
      );

    // Get retainer payments from company
    const retainerResult = await db
      .select({
        totalRetainerSpent: sql<number>`COALESCE(SUM(CAST(${retainerPayments.amount} AS DECIMAL)), 0)`,
      })
      .from(retainerPayments)
      .where(
        and(
          eq(retainerPayments.companyId, companyProfile.id),
          eq(retainerPayments.status, 'completed')
        )
      );

    const affiliateSpent = Number(analyticsResult[0]?.totalSpent || 0);
    const retainerSpent = Number(retainerResult[0]?.totalRetainerSpent || 0);
    const totalSpent = affiliateSpent + retainerSpent;

    const result = {
      totalClicks: Number(analyticsResult[0]?.totalClicks || 0),
      uniqueClicks: Number(analyticsResult[0]?.uniqueClicks || 0),
      conversions: Number(analyticsResult[0]?.conversions || 0),
      totalSpent: totalSpent,
      affiliateSpent: affiliateSpent,
      retainerSpent: retainerSpent,
      activeCreators: Number(activeCreatorsResult[0]?.count || 0),
      activeOffers: companyOffers.filter(o => o.status === 'approved').length,
    };

    console.log('[getAnalyticsByCompany] Returning analytics:', result);
    return result;
  } catch (error) {
    console.error("[getAnalyticsByCompany] Error:", error);
    return {
      totalClicks: 0,
      uniqueClicks: 0,
      conversions: 0,
      totalSpent: 0,
      affiliateSpent: 0,
      retainerSpent: 0,
      activeCreators: 0,
      activeOffers: 0,
    };
  }
}

async getAnalyticsTimeSeriesByCompany(userId: string, dateRange: string): Promise<any[]> {
  try {
    // FIXED: Get company profile first using userId
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      console.log('[getAnalyticsTimeSeriesByCompany] No company profile found for userId:', userId);
      return [];
    }

    console.log('[getAnalyticsTimeSeriesByCompany] Found company profile:', companyProfile.id);

    // Get all offers for this company using company profile ID
    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    console.log('[getAnalyticsTimeSeriesByCompany] Found', companyOffers.length, 'offers');

    if (companyOffers.length === 0) {
      return [];
    }

    const offerIds = companyOffers.map(offer => offer.id);
    const whereClauses: any[] = [
      inArray(applications.offerId, offerIds)
    ];

    if (dateRange !== "all") {
      let daysBack = 30;
      if (dateRange === "7d") daysBack = 7;
      else if (dateRange === "30d") daysBack = 30;
      else if (dateRange === "90d") daysBack = 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      whereClauses.push(gte(analytics.date, startDate));
    }

    const result = await db
      .select({
        date: sql<string>`TO_CHAR(${analytics.date}, 'Mon DD')`,
        isoDate: analytics.date,
        clicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        earnings: sql<number>`COALESCE(SUM(CAST(${analytics.earnings} AS DECIMAL)), 0)`,
      })
      .from(analytics)
      .innerJoin(applications, eq(analytics.applicationId, applications.id))
      .where(and(...whereClauses))
      .groupBy(analytics.date)
      .orderBy(analytics.date);

    console.log('[getAnalyticsTimeSeriesByCompany] Returning', result?.length || 0, 'data points');
    return result || [];
  } catch (error) {
    console.error("[getAnalyticsTimeSeriesByCompany] Error:", error);
    return [];
  }
}

async getApplicationsTimeSeriesByCompany(userId: string, dateRange: string): Promise<any[]> {
  try {
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      console.log('[getApplicationsTimeSeriesByCompany] No company profile found for userId:', userId);
      return [];
    }

    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    if (companyOffers.length === 0) {
      return [];
    }

    const offerIds = companyOffers.map(offer => offer.id);
    const whereClauses: any[] = [
      inArray(applications.offerId, offerIds)
    ];

    if (dateRange !== "all") {
      let daysBack = 30;
      if (dateRange === "7d") daysBack = 7;
      else if (dateRange === "30d") daysBack = 30;
      else if (dateRange === "90d") daysBack = 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      whereClauses.push(gte(applications.createdAt, startDate));
    }

    const result = await db
      .select({
        date: sql<string>`TO_CHAR(DATE(${applications.createdAt}), 'Mon DD')`,  // ✅ Use DATE() here too
        isoDate: sql<Date>`DATE(${applications.createdAt})`,
        total: sql<number>`COUNT(*)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'pending')::int`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'approved')::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'active')::int`,
        paused: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'paused')::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'completed')::int`,
      })
      .from(applications)
      .where(and(...whereClauses))
      .groupBy(sql`DATE(${applications.createdAt})`)  // ✅ This now matches the isoDate
      .orderBy(sql`DATE(${applications.createdAt})`);

    return result || [];
  } catch (error) {
    console.error("[getApplicationsTimeSeriesByCompany] Error:", error);
    return [];
  }
}

async getConversionFunnelByCompany(userId: string): Promise<any> {
  try {
    // FIXED: Get company profile first using userId
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      return null;
    }

    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    if (companyOffers.length === 0) {
      return null;
    }

    const offerIds = companyOffers.map(offer => offer.id);

    const result = await db
      .select({
        applied: sql<number>`COUNT(*)::int`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'approved')::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'active')::int`,
        paused: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'paused')::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${applications.status} = 'completed')::int`,
      })
      .from(applications)
      .where(inArray(applications.offerId, offerIds));

    // Get total conversions from analytics
    const conversionsResult = await db
      .select({
        conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
      })
      .from(analytics)
      .innerJoin(applications, eq(analytics.applicationId, applications.id))
      .where(inArray(applications.offerId, offerIds));

    return {
      applied: Number(result[0]?.applied || 0),
      approved: Number(result[0]?.approved || 0),
      active: Number(result[0]?.active || 0),
      paused: Number(result[0]?.paused || 0),
      completed: Number(result[0]?.completed || 0),
      conversions: Number(conversionsResult[0]?.conversions || 0),
    };
  } catch (error) {
    console.error("[getConversionFunnelByCompany] Error:", error);
    return null;
  }
}

async getCreatorAcquisitionSourcesByCompany(userId: string): Promise<any[]> {
  try {
    // FIXED: Get company profile first using userId
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      return [];
    }

    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    if (companyOffers.length === 0) {
      return [];
    }

    const offerIds = companyOffers.map(offer => offer.id);

    // Get UTM sources from click events
    const result = await db
      .select({
        source: sql<string>`COALESCE(${clickEvents.utmSource}, 'Direct')`,
        creators: sql<number>`COUNT(DISTINCT ${applications.creatorId})::int`,
      })
      .from(clickEvents)
      .innerJoin(applications, eq(clickEvents.applicationId, applications.id))
      .where(inArray(applications.offerId, offerIds))
      .groupBy(clickEvents.utmSource)
      .orderBy(sql`COUNT(DISTINCT ${applications.creatorId}) DESC`)
      .limit(10);

    return result || [];
  } catch (error) {
    console.error("[getCreatorAcquisitionSourcesByCompany] Error:", error);
    return [];
  }
}

async getCreatorGeographyByCompany(userId: string): Promise<any[]> {
  try {
    // FIXED: Get company profile first using userId
    const companyProfile = await this.getCompanyProfile(userId);
    if (!companyProfile) {
      return [];
    }

    const companyOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyProfile.id));

    if (companyOffers.length === 0) {
      return [];
    }

    const offerIds = companyOffers.map(offer => offer.id);

    const result = await db
      .select({
        country: clickEvents.country,
        count: sql<number>`COUNT(DISTINCT ${applications.creatorId})::int`,
      })
      .from(clickEvents)
      .innerJoin(applications, eq(clickEvents.applicationId, applications.id))
      .where(
        and(
          inArray(applications.offerId, offerIds),
          sql`${clickEvents.country} IS NOT NULL AND ${clickEvents.country} != 'Unknown'`
        )
      )
      .groupBy(clickEvents.country)
      .orderBy(sql`COUNT(DISTINCT ${applications.creatorId}) DESC`)
      .limit(15);

    return result || [];
  } catch (error) {
    console.error("[getCreatorGeographyByCompany] Error:", error);
    return [];
  }
}
}

export const storage = new DatabaseStorage();