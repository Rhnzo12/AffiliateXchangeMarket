import sgMail from '@sendgrid/mail';
import webpush from 'web-push';
import type { DatabaseStorage } from '../storage';
import type { InsertNotification, UserNotificationPreferences } from '../../shared/schema';
import * as emailTemplates from './emailTemplates';
import { getTemplateForType } from './templateEngine';

let sendGridConfigured = false;
let webPushConfigured = false;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sendGridConfigured = true;
  console.log('[Notifications] SendGrid configured successfully');
} else {
  console.warn('[Notifications] SendGrid API key not found - email notifications disabled');
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@affiliatemarketplace.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  webPushConfigured = true;
  console.log('[Notifications] Web Push configured successfully');
} else {
  console.warn('[Notifications] VAPID keys not found - push notifications disabled');
}

export type NotificationType =
  | 'application_status_change'
  | 'new_message'
  | 'payment_received'
  | 'payment_pending'
  | 'payment_approved'
  | 'payment_disputed'
  | 'payment_dispute_resolved'
  | 'payment_refunded'
  | 'payment_failed_insufficient_funds'
  | 'offer_approved'
  | 'offer_rejected'
  | 'new_application'
  | 'review_received'
  | 'system_announcement'
  | 'registration_approved'
  | 'registration_rejected'
  | 'work_completion_approval'
  | 'priority_listing_expiring'
  | 'deliverable_rejected'
  | 'revision_requested'
  | 'email_verification'
  | 'password_reset'
  | 'account_deletion_otp'
  | 'password_change_otp'
  | 'content_flagged'
  | 'high_risk_company';

interface NotificationData {
  userName?: string;
  userEmail?: string;
  companyName?: string;
  companyUserId?: string;
  offerTitle?: string;
  applicationId?: string;
  offerId?: string;
  conversationId?: string;
  messageId?: string;
  reviewId?: string;
  contractId?: string;
  deliverableId?: string;
  paymentId?: string; // ✅ ADDED: Payment ID for linking to payment details
  trackingLink?: string;
  trackingCode?: string;
  amount?: string;
  grossAmount?: string;
  platformFee?: string;
  processingFee?: string;
  platformFeePercentage?: string;
  processingFeePercentage?: string;
  transactionId?: string;
  reviewRating?: number;
  reviewText?: string;
  messagePreview?: string;
  daysUntilExpiration?: number;
  linkUrl?: string;
  applicationStatus?: string;
  announcementTitle?: string;
  announcementMessage?: string;
  contractTitle?: string;
  reason?: string;
  revisionInstructions?: string;
  verificationUrl?: string;
  resetUrl?: string;
  otpCode?: string;
  // Content moderation fields
  contentType?: string;
  contentId?: string;
  matchedKeywords?: string[];
  reviewStatus?: string;
  actionTaken?: string;
  // High-risk company fields
  companyId?: string;
  riskScore?: number;
  riskLevel?: string;
  riskIndicators?: string[];
}

export class NotificationService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Generate the correct linkUrl based on notification type and metadata
   * This ensures clicking a notification takes the user to the right page
   */
  private generateLinkUrl(type: NotificationType, data: NotificationData, userRole: 'creator' | 'company' | 'admin'): string {
    // If linkUrl is explicitly provided, use it
    if (data.linkUrl) {
      return data.linkUrl;
    }

    // Auto-generate linkUrl based on notification type and user role
    switch (type) {
      case 'application_status_change':
        // Creator: go to specific application detail page
        if (data.applicationId) {
          return `/applications/${data.applicationId}`;
        }
        return '/applications';

      case 'new_application':
        // Admin: go to offers page to review (new_application is used for admins reviewing new offers)
        // Company: go to applications page
        if (userRole === 'admin') {
          if (data.offerId) {
            return `/admin/offers?highlight=${data.offerId}`;
          }
          return '/admin/offers';
        }
        if (data.applicationId) {
          return `/company/applications?highlight=${data.applicationId}`;
        }
        return '/company/applications';

      case 'new_message':
        // Both: go to specific conversation
        if (data.conversationId) {
          if (userRole === 'company') {
            return `/company/messages/${data.conversationId}`;
          }
          return `/messages/${data.conversationId}`;
        }
        if (data.applicationId) {
          if (userRole === 'company') {
            return `/company/messages?application=${data.applicationId}`;
          }
          return `/messages?application=${data.applicationId}`;
        }
        return userRole === 'company' ? '/company/messages' : '/messages';

      case 'payment_received':
      case 'payment_pending':
      case 'payment_approved':
      case 'payment_disputed':
      case 'payment_dispute_resolved':
      case 'payment_refunded':
      case 'payment_failed_insufficient_funds':
      case 'work_completion_approval':
        // Admin: go to payment settings to process payments
        if (userRole === 'admin') {
          return '/payment-settings';
        }
        // Creator: link to specific payment detail page if paymentId is provided
        if (data.paymentId) {
          return `/payments/${data.paymentId}`;
        }
        // Fallback to payment settings page
        return '/payment-settings';

      case 'offer_approved':
      case 'offer_rejected':
        // Company: go to specific offer detail page
        if (data.offerId) {
          return `/company/offers/${data.offerId}`;
        }
        return '/company/offers';

      case 'review_received':
        // Company: go to reviews page, optionally highlight specific review
        if (data.reviewId) {
          return `/company/reviews?highlight=${data.reviewId}`;
        }
        return '/company/reviews';

      case 'registration_approved':
        // Company: go to dashboard after approval
        return userRole === 'company' ? '/company/dashboard' : '/creator/dashboard';

      case 'registration_rejected':
        // Go to home or contact page
        return '/';

      case 'priority_listing_expiring':
        // Company: go to specific offer to renew
        if (data.offerId) {
          return `/company/offers/${data.offerId}?tab=priority`;
        }
        return '/company/offers';

      case 'deliverable_rejected':
      case 'revision_requested':
        // Creator: go to specific deliverable
        if (data.contractId && data.deliverableId) {
          return `/retainer-contracts/${data.contractId}/deliverables/${data.deliverableId}`;
        }
        if (data.contractId) {
          return `/retainer-contracts/${data.contractId}`;
        }
        return '/retainer-contracts';

      case 'system_announcement':
        // Use provided linkUrl or go to home
        return data.linkUrl || '/';

      case 'content_flagged':
        // For users, link to notifications page to see details
        // The content itself might be removed/modified, so we don't link directly to it
        return '/notifications';

      case 'high_risk_company':
        // Admin notification - link to the company detail page for review
        if (data.companyId) {
          return `/admin/companies/${data.companyId}`;
        }
        return '/admin/companies';

      default:
        // Default fallback based on user role
        if (userRole === 'company') {
          return '/company/dashboard';
        } else if (userRole === 'creator') {
          return '/creator/dashboard';
        }
        return '/';
    }
  }

  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData = {}
  ): Promise<void> {
    try {
      console.log(`[Notifications] Starting notification send for user ${userId}, type: ${type}`);
      const preferences = await this.storage.getUserNotificationPreferences(userId);
      console.log(`[Notifications] User preferences:`, preferences);
      const user = await this.storage.getUserById(userId);

      if (!user) {
        console.error(`[Notifications] User ${userId} not found`);
        return;
      }

      data.userName = data.userName || user.firstName || user.username;
      data.userEmail = data.userEmail || user.email;

      // Generate the correct linkUrl automatically
      const linkUrl = this.generateLinkUrl(type, data, user.role);
      console.log(`[Notifications] Generated linkUrl: ${linkUrl}`);

      // FIRST: Check for custom email template before creating any notifications
      // If a custom template exists, use its subject as the notification title
      let customTemplate: { subject: string; html: string } | null = null;
      let effectiveTitle = title;
      let effectiveMessage = message;

      try {
        customTemplate = await getTemplateForType(type, { ...data, linkUrl });
        if (customTemplate) {
          console.log(`[Notifications] Found custom template for ${type}, using template subject as notification title`);
          effectiveTitle = customTemplate.subject;
          // Keep original message for in-app since HTML isn't suitable
        } else {
          console.log(`[Notifications] No custom template found for ${type}, using default title/message`);
        }
      } catch (error) {
        console.warn(`[Notifications] Error fetching custom template for ${type}:`, error);
      }

      console.log(`[Notifications] Checking in-app notifications: preferences?.inAppNotifications = ${preferences?.inAppNotifications}, will send = ${preferences?.inAppNotifications !== false}`);
      if (preferences?.inAppNotifications !== false) {
        await this.sendInAppNotification(userId, type, effectiveTitle, effectiveMessage, linkUrl, data);
      } else {
        console.log(`[Notifications] Skipping in-app notification (disabled by preferences)`);
      }

      if (preferences?.emailNotifications !== false && this.shouldSendEmail(type, preferences)) {
        // Pass linkUrl in data for email templates, and the pre-fetched custom template
        await this.sendEmailNotificationWithTemplate(user.email, type, { ...data, linkUrl }, customTemplate);
      }

      if (preferences?.pushNotifications !== false && this.shouldSendPush(type, preferences)) {
        await this.sendPushNotification(preferences, effectiveTitle, effectiveMessage, { ...data, linkUrl });
      }
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }

  private async sendInAppNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    linkUrl: string,
    data: NotificationData
  ): Promise<void> {
    try {
      console.log(`[Notifications] Creating in-app notification for user ${userId}`);
      const notification: InsertNotification = {
        userId,
        type,
        title,
        message,
        linkUrl,
        metadata: data,
        isRead: false,
      };

      console.log(`[Notifications] Notification object:`, JSON.stringify(notification, null, 2));
      const created = await this.storage.createNotification(notification);
      console.log(`[Notifications] In-app notification created for user ${userId}: ${type} -> ${linkUrl}`, created);
    } catch (error) {
      console.error('[Notifications] Error creating in-app notification:', error);
      console.error('[Notifications] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  }

  /**
   * Send email notification with an optional pre-fetched custom template
   * This avoids double-fetching when the template was already fetched for in-app notification
   */
  private async sendEmailNotificationWithTemplate(
    email: string,
    type: NotificationType,
    data: NotificationData,
    customTemplate: { subject: string; html: string } | null
  ): Promise<void> {
    if (!sendGridConfigured) {
      console.warn('[Notifications] SendGrid not configured, skipping email');
      return;
    }

    try {
      let emailContent: { subject: string; html: string } | null = customTemplate;

      // If custom template was provided (already fetched), use it
      if (emailContent) {
        console.log(`[Notifications] Using pre-fetched custom template for ${type}`);
      } else {
        // Fall back to hardcoded templates
        console.log(`[Notifications] No custom template available for ${type}, using hardcoded default`);
        emailContent = this.getHardcodedEmailTemplate(type, data);
        if (!emailContent) {
          console.warn(`[Notifications] Unknown email type: ${type}`);
          return;
        }
      }

      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'notifications@affiliatemarketplace.com',
        subject: emailContent.subject,
        html: emailContent.html,
      };

      await sgMail.send(msg);
      console.log(`[Notifications] Email sent to ${email}: ${type}`);
    } catch (error) {
      console.error('[Notifications] Error sending email:', error);
    }
  }

  /**
   * Get hardcoded email template for a notification type
   */
  private getHardcodedEmailTemplate(
    type: NotificationType,
    data: NotificationData
  ): { subject: string; html: string } | null {
    switch (type) {
      case 'application_status_change':
        return emailTemplates.applicationStatusChangeEmail(
          data.applicationStatus || 'updated',
          data
        );
      case 'new_message':
        return emailTemplates.newMessageEmail(data);
      case 'payment_received':
        return emailTemplates.paymentReceivedEmail(data);
      case 'payment_approved':
        return emailTemplates.paymentApprovedEmail(data);
      case 'payment_failed_insufficient_funds':
        return emailTemplates.paymentFailedInsufficientFundsEmail(data);
      case 'offer_approved':
        return emailTemplates.offerApprovedEmail(data);
      case 'offer_rejected':
        return emailTemplates.offerRejectedEmail(data);
      case 'new_application':
        return emailTemplates.newApplicationEmail(data);
      case 'review_received':
        return emailTemplates.reviewReceivedEmail(data);
      case 'system_announcement':
        return emailTemplates.systemAnnouncementEmail(
          data.announcementTitle || 'System Announcement',
          data.announcementMessage || '',
          data
        );
      case 'registration_approved':
        return emailTemplates.registrationApprovedEmail(data);
      case 'registration_rejected':
        return emailTemplates.registrationRejectedEmail(data);
      case 'work_completion_approval':
        return emailTemplates.workCompletionApprovalEmail(data);
      case 'priority_listing_expiring':
        return emailTemplates.priorityListingExpiringEmail(data);
      case 'payment_pending':
        return emailTemplates.paymentPendingEmail(data);
      case 'email_verification':
        return emailTemplates.emailVerificationEmail(data);
      case 'password_reset':
        return emailTemplates.passwordResetEmail(data);
      case 'account_deletion_otp':
        return emailTemplates.accountDeletionOtpEmail(data);
      case 'password_change_otp':
        return emailTemplates.passwordChangeOtpEmail(data);
      case 'content_flagged':
        return emailTemplates.contentFlaggedEmail(data);
      case 'high_risk_company':
        return emailTemplates.highRiskCompanyEmail(data);
      default:
        return null;
    }
  }

  /**
   * Public method for sending email notifications (for external callers)
   * This will look up the custom template if not pre-fetched
   */
  async sendEmailNotification(
    email: string,
    type: NotificationType,
    data: NotificationData
  ): Promise<void> {
    if (!sendGridConfigured) {
      console.warn('[Notifications] SendGrid not configured, skipping email');
      return;
    }

    try {
      let emailContent: { subject: string; html: string } | null = null;

      // First, try to get a custom template from the database
      try {
        emailContent = await getTemplateForType(type, data);
        if (emailContent) {
          console.log(`[Notifications] Using custom template for ${type}`);
        }
      } catch (error) {
        console.warn(`[Notifications] Error fetching custom template for ${type}, falling back to hardcoded:`, error);
      }

      // If no custom template found, fall back to hardcoded templates
      if (!emailContent) {
        console.log(`[Notifications] No custom template available for ${type}, using hardcoded default`);
        emailContent = this.getHardcodedEmailTemplate(type, data);
        if (!emailContent) {
          console.warn(`[Notifications] Unknown email type: ${type}`);
          return;
        }
      }

      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'notifications@affiliatemarketplace.com',
        subject: emailContent.subject,
        html: emailContent.html,
      };

      await sgMail.send(msg);
      console.log(`[Notifications] Email sent to ${email}: ${type}`);
    } catch (error) {
      console.error('[Notifications] Error sending email:', error);
    }
  }

  private async sendPushNotification(
    preferences: UserNotificationPreferences | null,
    title: string,
    message: string,
    data: NotificationData
  ): Promise<void> {
    if (!webPushConfigured) {
      console.warn('[Notifications] Web Push not configured, skipping push notification');
      return;
    }

    if (!preferences?.pushSubscription) {
      console.log('[Notifications] No push subscription found for user');
      return;
    }

    try {
      const payload = JSON.stringify({
        title,
        body: message,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: {
          url: data.linkUrl || '/',
        },
      });

      await webpush.sendNotification(
        preferences.pushSubscription as webpush.PushSubscription,
        payload
      );
      console.log(`[Notifications] Push notification sent: ${title}`);
    } catch (error) {
      console.error('[Notifications] Error sending push notification:', error);
      if ((error as any)?.statusCode === 410 || (error as any)?.statusCode === 404) {
        await this.storage.updateUserNotificationPreferences(preferences.userId, {
          pushSubscription: null,
        });
        console.log('[Notifications] Removed invalid push subscription');
      }
    }
  }

  private shouldSendEmail(type: NotificationType, preferences: UserNotificationPreferences | null): boolean {
    if (!preferences) return true;

    switch (type) {
      case 'application_status_change':
        return preferences.emailApplicationStatus;
      case 'new_message':
        return preferences.emailNewMessage;
      case 'payment_received':
      case 'payment_approved':
      case 'payment_pending':
      case 'payment_disputed':
      case 'payment_dispute_resolved':
      case 'payment_refunded':
      case 'payment_failed_insufficient_funds':
      case 'work_completion_approval':
        return preferences.emailPayment;
      case 'offer_approved':
      case 'offer_rejected':
      case 'new_application':
        return preferences.emailOffer;
      case 'review_received':
        return preferences.emailReview;
      case 'system_announcement':
      case 'registration_approved':
      case 'registration_rejected':
      case 'priority_listing_expiring':
      case 'content_flagged':
      case 'high_risk_company':
        return preferences.emailSystem;
      default:
        return true;
    }
  }

  private shouldSendPush(type: NotificationType, preferences: UserNotificationPreferences | null): boolean {
    if (!preferences) return true;

    switch (type) {
      case 'application_status_change':
        return preferences.pushApplicationStatus;
      case 'new_message':
        return preferences.pushNewMessage;
      case 'payment_received':
      case 'payment_approved':
      case 'payment_pending':
      case 'payment_disputed':
      case 'payment_dispute_resolved':
      case 'payment_refunded':
      case 'payment_failed_insufficient_funds':
      case 'work_completion_approval':
        return preferences.pushPayment;
      default:
        return true;
    }
  }

  async broadcastSystemAnnouncement(
    title: string,
    message: string,
    linkUrl?: string,
    targetRole?: 'creator' | 'company' | 'admin'
  ): Promise<void> {
    try {
      const users = await this.storage.getAllUsers();
      const filteredUsers = targetRole
        ? users.filter((user) => user.role === targetRole)
        : users;

      for (const user of filteredUsers) {
        await this.sendNotification(
          user.id,
          'system_announcement',
          title,
          message,
          {
            linkUrl,
            announcementTitle: title,
            announcementMessage: message,
          }
        );
      }

      console.log(`[Notifications] System announcement sent to ${filteredUsers.length} users`);
    } catch (error) {
      console.error('[Notifications] Error broadcasting system announcement:', error);
    }
  }
}