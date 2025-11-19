import sgMail from '@sendgrid/mail';
import webpush from 'web-push';
import type { DatabaseStorage } from '../storage';
import type { InsertNotification, UserNotificationPreferences } from '../../shared/schema';
import * as emailTemplates from './emailTemplates';

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
  | 'password_reset';

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

      console.log(`[Notifications] Checking in-app notifications: preferences?.inAppNotifications = ${preferences?.inAppNotifications}, will send = ${preferences?.inAppNotifications !== false}`);
      if (preferences?.inAppNotifications !== false) {
        await this.sendInAppNotification(userId, type, title, message, linkUrl, data);
      } else {
        console.log(`[Notifications] Skipping in-app notification (disabled by preferences)`);
      }

      if (preferences?.emailNotifications !== false && this.shouldSendEmail(type, preferences)) {
        // Pass linkUrl in data for email templates
        await this.sendEmailNotification(user.email, type, { ...data, linkUrl });
      }

      if (preferences?.pushNotifications !== false && this.shouldSendPush(type, preferences)) {
        await this.sendPushNotification(preferences, title, message, { ...data, linkUrl });
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
      let emailContent: { subject: string; html: string };

      switch (type) {
        case 'application_status_change':
          emailContent = emailTemplates.applicationStatusChangeEmail(
            data.applicationStatus || 'updated',
            data
          );
          break;
        case 'new_message':
          emailContent = emailTemplates.newMessageEmail(data);
          break;
        case 'payment_received':
          emailContent = emailTemplates.paymentReceivedEmail(data);
          break;
        case 'payment_approved':
          emailContent = emailTemplates.paymentApprovedEmail(data);
          break;
        case 'payment_failed_insufficient_funds':
          emailContent = emailTemplates.paymentFailedInsufficientFundsEmail(data);
          break;
        case 'offer_approved':
          emailContent = emailTemplates.offerApprovedEmail(data);
          break;
        case 'offer_rejected':
          emailContent = emailTemplates.offerRejectedEmail(data);
          break;
        case 'new_application':
          emailContent = emailTemplates.newApplicationEmail(data);
          break;
        case 'review_received':
          emailContent = emailTemplates.reviewReceivedEmail(data);
          break;
        case 'system_announcement':
          emailContent = emailTemplates.systemAnnouncementEmail(
            data.announcementTitle || 'System Announcement',
            data.announcementMessage || '',
            data
          );
          break;
        case 'registration_approved':
          emailContent = emailTemplates.registrationApprovedEmail(data);
          break;
        case 'registration_rejected':
          emailContent = emailTemplates.registrationRejectedEmail(data);
          break;
        case 'work_completion_approval':
          emailContent = emailTemplates.workCompletionApprovalEmail(data);
          break;
        case 'priority_listing_expiring':
          emailContent = emailTemplates.priorityListingExpiringEmail(data);
          break;
        case 'payment_pending':
          emailContent = emailTemplates.paymentPendingEmail(data);
          break;
        case 'email_verification':
          emailContent = emailTemplates.emailVerificationEmail(data);
          break;
        case 'password_reset':
          emailContent = emailTemplates.passwordResetEmail(data);
          break;
        default:
          console.warn(`[Notifications] Unknown email type: ${type}`);
          return;
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