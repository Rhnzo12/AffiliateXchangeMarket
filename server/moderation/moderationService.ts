import { Filter } from 'bad-words';
import { db } from '../db';
import { bannedKeywords, contentFlags, reviews, messages, notifications, users } from '../../shared/schema';
import { eq, and, count } from 'drizzle-orm';
import { NotificationService } from '../notifications/notificationService';
import type { DatabaseStorage } from '../storage';

const profanityFilter = new Filter();

// Default keywords to seed if table is empty
const defaultKeywords = [
  { keyword: 'scam', category: 'spam' as const, severity: 4, description: 'Potential scam-related content' },
  { keyword: 'fraud', category: 'legal' as const, severity: 5, description: 'Fraud-related term' },
  { keyword: 'guaranteed money', category: 'spam' as const, severity: 3, description: 'Misleading financial claims' },
  { keyword: 'get rich quick', category: 'spam' as const, severity: 3, description: 'Misleading financial claims' },
  { keyword: 'free money', category: 'spam' as const, severity: 3, description: 'Spam-like promotional content' },
  { keyword: 'testbadword', category: 'custom' as const, severity: 2, description: 'Test keyword for moderation testing' },
];

/**
 * Initialize moderation system with default keywords if none exist
 */
export async function initializeModerationKeywords(): Promise<void> {
  try {
    const result = await db.select({ count: count() }).from(bannedKeywords);
    const keywordCount = result[0]?.count || 0;

    if (keywordCount === 0) {
      console.log('[Moderation] No banned keywords found, seeding defaults...');

      for (const kw of defaultKeywords) {
        await db.insert(bannedKeywords).values({
          keyword: kw.keyword,
          category: kw.category,
          severity: kw.severity,
          description: kw.description,
          isActive: true,
        });
      }

      console.log(`[Moderation] Seeded ${defaultKeywords.length} default banned keywords`);
    } else {
      console.log(`[Moderation] Found ${keywordCount} existing banned keywords`);
    }
  } catch (error) {
    console.error('[Moderation] Error initializing keywords:', error);
    // Don't throw - let the app continue even if seeding fails
  }
}

interface CheckContentResult {
  isFlagged: boolean;
  reasons: string[];
  matchedKeywords: string[];
  severity: number;
}

/**
 * Check if content contains banned keywords or profanity
 */
export async function checkContent(
  content: string,
  contentType: 'message' | 'review'
): Promise<CheckContentResult> {
  const result: CheckContentResult = {
    isFlagged: false,
    reasons: [],
    matchedKeywords: [],
    severity: 0,
  };

  if (!content || typeof content !== 'string') {
    return result;
  }

  const contentLower = content.toLowerCase();

  // Check for profanity using bad-words library
  if (profanityFilter.isProfane(content)) {
    result.isFlagged = true;
    result.reasons.push('Contains profanity');
    result.severity = Math.max(result.severity, 3);
  }

  // Get all active banned keywords from database
  const keywords = await db
    .select()
    .from(bannedKeywords)
    .where(eq(bannedKeywords.isActive, true));

  // Check each keyword
  for (const keyword of keywords) {
    const keywordLower = keyword.keyword.toLowerCase();

    // Check if content contains the keyword (word boundary match)
    const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
    if (regex.test(content)) {
      result.isFlagged = true;
      result.matchedKeywords.push(keyword.keyword);
      result.reasons.push(`Contains banned keyword: ${keyword.category}`);
      result.severity = Math.max(result.severity, keyword.severity);
    }
  }

  return result;
}

/**
 * Flag content and create notification for admins and notify the user
 */
export async function flagContent(
  contentType: 'message' | 'review',
  contentId: string,
  userId: string,
  reason: string,
  matchedKeywords: string[] = [],
  storage?: DatabaseStorage
): Promise<void> {
  // Create content flag
  const [flag] = await db.insert(contentFlags).values({
    contentType,
    contentId,
    userId,
    flagReason: reason,
    matchedKeywords,
    status: 'pending',
  }).returning();

  // Get all admin users to notify
  const admins = await db.query.users.findMany({
    where: (users, { eq }) => eq(users.role, 'admin'),
  });

  // Create notifications for all admins - link to notification detail page
  for (const admin of admins) {
    await db.insert(notifications).values({
      userId: admin.id,
      type: 'content_flagged',
      title: 'Content Flagged for Review',
      message: `A ${contentType} has been flagged for moderation: ${reason}`,
      linkUrl: `/notifications`,
      metadata: {
        contentType,
        contentId,
        flagId: flag.id,
        flaggedUserId: userId,
        matchedKeywords,
        moderationUrl: `/admin/moderation`,
      },
      isRead: false,
    });
  }

  // Notify the user whose content was flagged
  if (storage) {
    const notificationService = new NotificationService(storage);
    const keywordsList = matchedKeywords.length > 0
      ? matchedKeywords.join(', ')
      : 'inappropriate content';

    await notificationService.sendNotification(
      userId,
      'content_flagged',
      'Content Under Review',
      `Your ${contentType} has been flagged for review due to: ${keywordsList}. Our moderation team will review it shortly.`,
      {
        contentType,
        contentId,
        matchedKeywords,
        reason,
      }
    );
  }
}

/**
 * Check and flag a review if it meets flagging criteria
 */
export async function moderateReview(reviewId: string, storage?: DatabaseStorage): Promise<void> {
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) {
    return;
  }

  const reasons: string[] = [];
  let matchedKeywords: string[] = [];

  // Check for low rating (1-2 stars)
  if (review.overallRating <= 2) {
    reasons.push('Low rating (1-2 stars)');
  }

  // Check review text for banned content
  if (review.reviewText) {
    const contentCheck = await checkContent(review.reviewText, 'review');
    if (contentCheck.isFlagged) {
      reasons.push(...contentCheck.reasons);
      matchedKeywords = contentCheck.matchedKeywords;
    }
  }

  // Flag if any reasons found
  if (reasons.length > 0) {
    await flagContent(
      'review',
      reviewId,
      review.creatorId,
      reasons.join(', '),
      matchedKeywords,
      storage
    );
  }
}

/**
 * Check and flag a message if it contains banned content
 */
export async function moderateMessage(messageId: string, storage?: DatabaseStorage): Promise<void> {
  console.log(`[Moderation] Checking message: ${messageId}`);

  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });

  if (!message) {
    console.log(`[Moderation] Message not found: ${messageId}`);
    return;
  }

  if (!message.content) {
    console.log(`[Moderation] Message has no content: ${messageId}`);
    return;
  }

  console.log(`[Moderation] Checking content: "${message.content.substring(0, 50)}..."`);
  const contentCheck = await checkContent(message.content, 'message');
  console.log(`[Moderation] Content check result:`, JSON.stringify(contentCheck));

  if (contentCheck.isFlagged) {
    console.log(`[Moderation] Flagging message ${messageId} - Reasons: ${contentCheck.reasons.join(', ')}`);
    try {
      await flagContent(
        'message',
        messageId,
        message.senderId,
        contentCheck.reasons.join(', '),
        contentCheck.matchedKeywords,
        storage
      );
      console.log(`[Moderation] Successfully flagged message ${messageId}`);
    } catch (flagError) {
      console.error(`[Moderation] Failed to flag message ${messageId}:`, flagError);
      throw flagError;
    }
  } else {
    console.log(`[Moderation] Message ${messageId} passed moderation check`);
  }
}

/**
 * Review a flagged content item and notify the user
 */
export async function reviewFlaggedContent(
  flagId: string,
  adminId: string,
  status: 'reviewed' | 'dismissed' | 'action_taken',
  adminNotes?: string,
  actionTaken?: string,
  storage?: DatabaseStorage
): Promise<void> {
  // First get the flag to know which user to notify
  const flag = await db.query.contentFlags.findFirst({
    where: eq(contentFlags.id, flagId),
  });

  await db
    .update(contentFlags)
    .set({
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminNotes,
      actionTaken,
    })
    .where(eq(contentFlags.id, flagId));

  // Notify the user about the review outcome
  if (flag && storage) {
    const notificationService = new NotificationService(storage);

    let title: string;
    let message: string;

    switch (status) {
      case 'reviewed':
        title = 'Content Review Complete';
        message = `Your ${flag.contentType} has been reviewed by our moderation team. No action was taken.`;
        break;
      case 'dismissed':
        title = 'Content Review Complete';
        message = `Your ${flag.contentType} has been reviewed and the flag has been dismissed. No issues were found.`;
        break;
      case 'action_taken':
        title = 'Content Moderation Notice';
        message = `Your ${flag.contentType} has been reviewed and action has been taken${actionTaken ? `: ${actionTaken}` : '.'}`;
        break;
      default:
        title = 'Content Review Update';
        message = `Your ${flag.contentType} review status has been updated.`;
    }

    await notificationService.sendNotification(
      flag.userId,
      'content_flagged',
      title,
      message,
      {
        contentType: flag.contentType,
        contentId: flag.contentId,
        reviewStatus: status,
        actionTaken,
      }
    );
  }
}

/**
 * Get all pending flagged content
 */
export async function getPendingFlags() {
  return await db.query.contentFlags.findMany({
    where: eq(contentFlags.status, 'pending'),
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
}

/**
 * Get flagged content statistics
 */
export async function getFlagStatistics() {
  const [pending, reviewed, dismissed, actionTaken] = await Promise.all([
    db.query.contentFlags.findMany({
      where: eq(contentFlags.status, 'pending'),
    }),
    db.query.contentFlags.findMany({
      where: eq(contentFlags.status, 'reviewed'),
    }),
    db.query.contentFlags.findMany({
      where: eq(contentFlags.status, 'dismissed'),
    }),
    db.query.contentFlags.findMany({
      where: eq(contentFlags.status, 'action_taken'),
    }),
  ]);

  return {
    pending: pending.length,
    reviewed: reviewed.length,
    dismissed: dismissed.length,
    actionTaken: actionTaken.length,
    total: pending.length + reviewed.length + dismissed.length + actionTaken.length,
  };
}
