/**
 * Template Engine for Email Templates
 * Handles variable substitution with {{variableName}} syntax
 */

import { storage } from "../storage";

interface TemplateData {
  // User & Company
  userName?: string;
  companyName?: string;
  companyUserId?: string;

  // Offer & Application
  offerTitle?: string;
  offerId?: string;
  applicationId?: string;
  applicationStatus?: string;
  trackingLink?: string;
  trackingCode?: string;

  // Payment
  amount?: string;
  grossAmount?: string;
  platformFee?: string;
  processingFee?: string;
  transactionId?: string;
  paymentId?: string;

  // Reviews
  reviewRating?: number;
  reviewText?: string;

  // Messages
  messagePreview?: string;

  // Priority Listing
  daysUntilExpiration?: number;

  // Retainer Contracts
  contractTitle?: string;
  contractId?: string;
  monthNumber?: number;

  // Deliverables
  reason?: string;
  revisionInstructions?: string;

  // URLs & Links
  linkUrl?: string;
  verificationUrl?: string;
  resetUrl?: string;

  // Authentication
  otpCode?: string;

  // Content Moderation
  contentType?: string;
  contentId?: string;
  matchedKeywords?: string[];
  reviewStatus?: string;
  actionTaken?: string;

  // System Announcements
  announcementTitle?: string;
  announcementMessage?: string;

  // Catch-all for any additional data
  [key: string]: any;
}

/**
 * Process a template string by replacing all {{variable}} patterns with data
 */
export function processTemplate(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    const value = data[variable];
    if (value === undefined || value === null) {
      return ''; // Return empty string for undefined variables
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  });
}

/**
 * Process both subject and HTML content with data
 */
export function processEmailTemplate(
  subject: string,
  htmlContent: string,
  data: TemplateData
): { subject: string; html: string } {
  return {
    subject: processTemplate(subject, data),
    html: processTemplate(htmlContent, data),
  };
}

/**
 * Get and process a template by its slug
 * Returns null if template doesn't exist or is inactive
 */
export async function getProcessedTemplate(
  slug: string,
  data: TemplateData
): Promise<{ subject: string; html: string } | null> {
  try {
    const template = await storage.getEmailTemplateBySlug(slug);

    if (!template) {
      console.log(`[TemplateEngine] No custom template found for slug '${slug}', will use default`);
      return null;
    }

    if (!template.isActive) {
      console.log(`[TemplateEngine] Template '${slug}' exists but is INACTIVE (isActive: false), will use default`);
      return null;
    }

    console.log(`[TemplateEngine] Found active custom template for slug '${slug}'`);
    return processEmailTemplate(template.subject, template.htmlContent, data);
  } catch (error) {
    console.error(`[TemplateEngine] Error fetching template '${slug}':`, error);
    return null;
  }
}

/**
 * Map notification type to template slug
 * This allows the system to look up templates by notification type
 */
export function getTemplateSlugForNotificationType(type: string): string | null {
  const typeToSlugMap: Record<string, string> = {
    // Application templates
    'application_status_change': 'application-status-change',
    'new_application': 'new-application',

    // Payment templates
    'payment_received': 'payment-received',
    'payment_pending': 'payment-pending',
    'payment_approved': 'payment-approved',
    'payment_failed_insufficient_funds': 'payment-failed-insufficient-funds',
    'payment_disputed': 'payment-disputed',
    'payment_dispute_resolved': 'payment-dispute-resolved',
    'payment_refunded': 'payment-refunded',

    // Offer templates
    'offer_approved': 'offer-approved',
    'offer_rejected': 'offer-rejected',
    'offer_delete_requested': 'offer-delete-requested',
    'offer_delete_approved': 'offer-delete-approved',
    'offer_delete_rejected': 'offer-delete-rejected',
    'offer_suspend_requested': 'offer-suspend-requested',
    'offer_suspend_approved': 'offer-suspend-approved',
    'offer_suspend_rejected': 'offer-suspend-rejected',

    // Company templates
    'registration_approved': 'registration-approved',
    'registration_rejected': 'registration-rejected',

    // System templates
    'system_announcement': 'system-announcement',
    'new_message': 'new-message',
    'review_received': 'review-received',
    'work_completion_approval': 'work-completion-approval',
    'priority_listing_expiring': 'priority-listing-expiring',

    // Retainer/Deliverable templates
    'deliverable_rejected': 'deliverable-rejected',
    'deliverable_submitted': 'deliverable-submitted',
    'deliverable_resubmitted': 'deliverable-resubmitted',
    'revision_requested': 'revision-requested',

    // Moderation templates
    'content_flagged': 'content-flagged',

    // Authentication templates
    'email_verification': 'email-verification',
    'password_reset': 'password-reset',
    'account_deletion_otp': 'account-deletion-otp',
    'password_change_otp': 'password-change-otp',
  };

  return typeToSlugMap[type] || null;
}

/**
 * Get the list of available variables for a specific template type/slug
 * This helps the admin UI show the correct variables for each template
 */
export function getAvailableVariablesForTemplate(slug: string): Array<{
  name: string;
  description: string;
  example: string;
}> {
  const variablesByTemplate: Record<string, Array<{ name: string; description: string; example: string }>> = {
    // Application templates
    'application-status-change': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'applicationId', description: 'Application ID', example: 'app_123abc' },
      { name: 'applicationStatus', description: 'New status (approved/rejected/pending)', example: 'approved' },
      { name: 'trackingLink', description: 'Creator\'s tracking link (for approved)', example: 'https://example.com/go/ABC123' },
      { name: 'trackingCode', description: 'Tracking code (for approved)', example: 'ABC123' },
      { name: 'linkUrl', description: 'Link to application details', example: '/applications/app_123' },
    ],
    'new-application': [
      { name: 'userName', description: 'Recipient\'s name (admin or company)', example: 'Admin' },
      { name: 'companyName', description: 'Company name (for admin notifications)', example: 'Acme Corp' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'applicationId', description: 'Application ID', example: 'app_123abc' },
      { name: 'offerId', description: 'Offer ID', example: 'offer_456def' },
      { name: 'linkUrl', description: 'Link to review the application', example: '/admin/offers' },
    ],

    // Payment templates
    'payment-received': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'offerTitle', description: 'Offer or contract title', example: 'Monthly SEO Package' },
      { name: 'amount', description: 'Net amount received', example: '$930.00' },
      { name: 'grossAmount', description: 'Gross amount before fees', example: '$1,000.00' },
      { name: 'platformFee', description: 'Platform fee (varies by company)', example: '$40.00' },
      { name: 'processingFee', description: 'Processing fee (3%)', example: '$30.00' },
      { name: 'transactionId', description: 'Payment transaction ID', example: 'tr_abc123xyz' },
      { name: 'paymentId', description: 'Internal payment ID', example: 'pay_789' },
      { name: 'linkUrl', description: 'Link to payment details', example: '/payments/pay_789' },
    ],
    'payment-pending': [
      { name: 'userName', description: 'Recipient\'s name', example: 'John' },
      { name: 'offerTitle', description: 'Offer or contract title', example: 'Monthly SEO Package' },
      { name: 'amount', description: 'Payment amount', example: '$930.00' },
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
      { name: 'linkUrl', description: 'Link to payment or settings', example: '/settings/payment' },
    ],
    'payment-approved': [
      { name: 'userName', description: 'Recipient\'s name', example: 'John' },
      { name: 'companyName', description: 'Company name (for company notifications)', example: 'Acme Corp' },
      { name: 'offerTitle', description: 'Offer or contract title', example: 'Monthly SEO Package' },
      { name: 'amount', description: 'Net amount', example: '$930.00' },
      { name: 'grossAmount', description: 'Gross amount', example: '$1,000.00' },
      { name: 'platformFee', description: 'Platform fee', example: '$40.00' },
      { name: 'processingFee', description: 'Processing fee', example: '$30.00' },
      { name: 'transactionId', description: 'Transaction ID', example: 'tr_abc123xyz' },
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
      { name: 'linkUrl', description: 'Link to payment details', example: '/payments/pay_789' },
    ],
    'payment-failed-insufficient-funds': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'companyName', description: 'Company name', example: 'Acme Corp' },
      { name: 'amount', description: 'Payment amount', example: '$930.00' },
      { name: 'grossAmount', description: 'Gross amount', example: '$1,000.00' },
      { name: 'platformFee', description: 'Platform fee', example: '$40.00' },
      { name: 'processingFee', description: 'Processing fee', example: '$30.00' },
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
      { name: 'linkUrl', description: 'Link to payment details', example: '/payments/pay_789' },
    ],
    'payment-disputed': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'offerTitle', description: 'Offer or contract title', example: 'Monthly SEO Package' },
      { name: 'amount', description: 'Disputed amount', example: '$930.00' },
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
      { name: 'linkUrl', description: 'Link to messages', example: '/messages' },
    ],
    'payment-dispute-resolved': [
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
    ],
    'payment-refunded': [
      { name: 'paymentId', description: 'Payment ID', example: 'pay_789' },
    ],

    // Offer templates
    'offer-approved': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the approved offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to the offer', example: '/company/offers/offer_123' },
    ],
    'offer-rejected': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to the offer', example: '/company/offers/offer_123' },
    ],
    'offer-delete-requested': [
      { name: 'userName', description: 'Admin name', example: 'Admin' },
      { name: 'companyName', description: 'Company requesting deletion', example: 'Acme Corp' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'reason', description: 'Reason for deletion request', example: 'Product discontinued' },
      { name: 'linkUrl', description: 'Link to review the request', example: '/admin-offer-detail/offer_123' },
    ],
    'offer-delete-approved': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the deleted offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to offers page', example: '/company/offers' },
    ],
    'offer-delete-rejected': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to the offer', example: '/company/offers/offer_123' },
    ],
    'offer-suspend-requested': [
      { name: 'userName', description: 'Admin name', example: 'Admin' },
      { name: 'companyName', description: 'Company requesting suspension', example: 'Acme Corp' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'reason', description: 'Reason for suspension request', example: 'Seasonal pause' },
      { name: 'linkUrl', description: 'Link to review the request', example: '/admin-offer-detail/offer_123' },
    ],
    'offer-suspend-approved': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the suspended offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to the offer', example: '/company/offers/offer_123' },
    ],
    'offer-suspend-rejected': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Title of the offer', example: 'Premium SEO Package' },
      { name: 'linkUrl', description: 'Link to the offer', example: '/company/offers/offer_123' },
    ],

    // Company/Registration templates
    'registration-approved': [
      { name: 'userName', description: 'User\'s name', example: 'Jane' },
      { name: 'linkUrl', description: 'Link to dashboard', example: '/company/dashboard' },
    ],
    'registration-rejected': [
      { name: 'userName', description: 'User\'s name', example: 'Jane' },
      { name: 'linkUrl', description: 'Link to contact support', example: '/contact' },
    ],

    // System templates
    'system-announcement': [
      { name: 'userName', description: 'Recipient\'s name', example: 'John' },
      { name: 'announcementTitle', description: 'Announcement title', example: 'New Feature Launch' },
      { name: 'announcementMessage', description: 'Announcement content', example: 'We have exciting news...' },
      { name: 'linkUrl', description: 'Learn more link', example: '/blog/new-feature' },
    ],
    'new-message': [
      { name: 'userName', description: 'Recipient\'s name', example: 'John' },
      { name: 'companyName', description: 'Sender company name', example: 'Acme Corp' },
      { name: 'offerTitle', description: 'Related offer title', example: 'Premium SEO Package' },
      { name: 'messagePreview', description: 'Preview of the message', example: 'Hi, I wanted to discuss...' },
      { name: 'linkUrl', description: 'Link to conversation', example: '/messages/conv_123' },
    ],
    'review-received': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'reviewRating', description: 'Star rating (1-5)', example: '5' },
      { name: 'reviewText', description: 'Review content', example: 'Great experience working with this company!' },
      { name: 'linkUrl', description: 'Link to review', example: '/company/reviews' },
    ],
    'work-completion-approval': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'offerTitle', description: 'Offer title', example: 'Premium SEO Package' },
      { name: 'amount', description: 'Payment amount', example: '$500.00' },
      { name: 'linkUrl', description: 'Link to details', example: '/applications/app_123' },
    ],
    'priority-listing-expiring': [
      { name: 'userName', description: 'Company contact name', example: 'Jane' },
      { name: 'offerTitle', description: 'Offer title', example: 'Premium SEO Package' },
      { name: 'daysUntilExpiration', description: 'Days until expiration', example: '3' },
      { name: 'offerId', description: 'Offer ID', example: 'offer_123' },
      { name: 'linkUrl', description: 'Link to renew', example: '/company/offers/offer_123' },
    ],

    // Retainer/Deliverable templates
    'deliverable-rejected': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'contractTitle', description: 'Retainer contract title', example: 'Monthly Content Package' },
      { name: 'reason', description: 'Rejection reason/feedback', example: 'Please revise the intro section' },
      { name: 'linkUrl', description: 'Link to deliverable', example: '/retainers/contract_123' },
    ],
    'revision-requested': [
      { name: 'userName', description: 'Creator\'s name', example: 'John' },
      { name: 'contractTitle', description: 'Retainer contract title', example: 'Monthly Content Package' },
      { name: 'revisionInstructions', description: 'Revision instructions', example: 'Please update the call-to-action' },
      { name: 'linkUrl', description: 'Link to deliverable', example: '/retainers/contract_123' },
    ],

    // Moderation templates
    'content-flagged': [
      { name: 'userName', description: 'User\'s name', example: 'John' },
      { name: 'contentType', description: 'Type of content (review, message)', example: 'review' },
      { name: 'contentId', description: 'Content ID', example: 'review_123' },
      { name: 'matchedKeywords', description: 'Flagged keywords (comma-separated)', example: 'spam, inappropriate' },
      { name: 'reviewStatus', description: 'Review status', example: 'pending' },
      { name: 'actionTaken', description: 'Action taken by moderator', example: 'Content removed' },
      { name: 'linkUrl', description: 'Link to notifications', example: '/notifications' },
    ],

    // Authentication templates
    'email-verification': [
      { name: 'userName', description: 'User\'s name', example: 'John' },
      { name: 'verificationUrl', description: 'Email verification link', example: 'https://example.com/verify?token=abc123' },
    ],
    'password-reset': [
      { name: 'userName', description: 'User\'s name', example: 'John' },
      { name: 'resetUrl', description: 'Password reset link', example: 'https://example.com/reset?token=abc123' },
    ],
    'account-deletion-otp': [
      { name: 'userName', description: 'User\'s name', example: 'John' },
      { name: 'otpCode', description: '6-digit verification code', example: '123456' },
    ],
    'password-change-otp': [
      { name: 'userName', description: 'User\'s name', example: 'John' },
      { name: 'otpCode', description: '6-digit verification code', example: '123456' },
    ],
  };

  return variablesByTemplate[slug] || [];
}

/**
 * Try to get a custom template, falling back to hardcoded if not found
 */
export async function getTemplateForType(
  type: string,
  data: TemplateData
): Promise<{ subject: string; html: string } | null> {
  const slug = getTemplateSlugForNotificationType(type);

  if (!slug) {
    console.log(`[TemplateEngine] No slug mapping found for notification type '${type}'`);
    return null;
  }

  console.log(`[TemplateEngine] Looking up template for type '${type}' -> slug '${slug}'`);
  return await getProcessedTemplate(slug, data);
}

/**
 * Base email styles used by default templates
 */
export const baseEmailStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    padding: 20px;
  }
  .header {
    background-color: #4F46E5;
    color: #ffffff;
    padding: 30px 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  }
  .content {
    padding: 30px 20px;
  }
  .button {
    display: inline-block;
    padding: 12px 30px;
    background-color: #4F46E5;
    color: #ffffff;
    text-decoration: none;
    border-radius: 6px;
    margin: 20px 0;
    font-weight: 600;
  }
  .footer {
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
  }
  .badge-success {
    background-color: #10B981;
    color: #ffffff;
  }
  .badge-warning {
    background-color: #F59E0B;
    color: #ffffff;
  }
  .badge-danger {
    background-color: #EF4444;
    color: #ffffff;
  }
`;

/**
 * Create a default HTML wrapper for simple email content
 */
export function wrapInDefaultTemplate(
  title: string,
  bodyContent: string,
  buttonText?: string,
  buttonUrl?: string,
  headerColor: string = '#4F46E5'
): string {
  const buttonHtml = buttonText && buttonUrl
    ? `<a href="${buttonUrl}" class="button" style="background-color: ${headerColor};">${buttonText}</a>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseEmailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: ${headerColor};">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${bodyContent}
          ${buttonHtml}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
