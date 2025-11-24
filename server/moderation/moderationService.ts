import { Filter } from 'bad-words';
import { db } from '../db';
import { bannedKeywords, contentFlags, reviews, messages, notifications } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const profanityFilter = new Filter();

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
 * Flag content and create notification for admins
 */
export async function flagContent(
  contentType: 'message' | 'review',
  contentId: string,
  userId: string,
  reason: string,
  matchedKeywords: string[] = []
): Promise<void> {
  // Create content flag
  await db.insert(contentFlags).values({
    contentType,
    contentId,
    userId,
    flagReason: reason,
    matchedKeywords,
    status: 'pending',
  });

  // Get all admin users to notify
  const admins = await db.query.users.findMany({
    where: (users, { eq }) => eq(users.role, 'admin'),
  });

  // Create notifications for all admins
  for (const admin of admins) {
    await db.insert(notifications).values({
      userId: admin.id,
      type: 'content_flagged',
      title: 'Content Flagged for Review',
      message: `A ${contentType} has been flagged for moderation: ${reason}`,
      linkUrl: `/admin/moderation/${contentType}/${contentId}`,
      metadata: {
        contentType,
        contentId,
        flaggedUserId: userId,
        matchedKeywords,
      },
      isRead: false,
    });
  }
}

/**
 * Check and flag a review if it meets flagging criteria
 */
export async function moderateReview(reviewId: string): Promise<void> {
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) {
    return;
  }

  const reasons: string[] = [];
  let shouldFlag = false;

  // Check for low rating (1-2 stars)
  if (review.overallRating <= 2) {
    shouldFlag = true;
    reasons.push('Low rating (1-2 stars)');
  }

  // Check review text for banned content
  if (review.reviewText) {
    const contentCheck = await checkContent(review.reviewText, 'review');
    if (contentCheck.isFlagged) {
      shouldFlag = true;
      reasons.push(...contentCheck.reasons);

      if (contentCheck.matchedKeywords.length > 0) {
        await flagContent(
          'review',
          reviewId,
          review.creatorId,
          reasons.join(', '),
          contentCheck.matchedKeywords
        );
      }
    }
  }

  // If flagged but no keywords, still create flag
  if (shouldFlag && reasons.length > 0 && !review.reviewText) {
    await flagContent(
      'review',
      reviewId,
      review.creatorId,
      reasons.join(', ')
    );
  }
}

/**
 * Check and flag a message if it contains banned content
 */
export async function moderateMessage(messageId: string): Promise<void> {
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });

  if (!message || !message.content) {
    return;
  }

  const contentCheck = await checkContent(message.content, 'message');

  if (contentCheck.isFlagged) {
    await flagContent(
      'message',
      messageId,
      message.senderId,
      contentCheck.reasons.join(', '),
      contentCheck.matchedKeywords
    );
  }
}

/**
 * Review a flagged content item
 */
export async function reviewFlaggedContent(
  flagId: string,
  adminId: string,
  status: 'reviewed' | 'dismissed' | 'action_taken',
  adminNotes?: string,
  actionTaken?: string
): Promise<void> {
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
