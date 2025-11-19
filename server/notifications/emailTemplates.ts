interface EmailTemplateData {
  userName?: string;
  companyName?: string;
  offerTitle?: string;
  applicationId?: string;
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
  verificationUrl?: string;
  resetUrl?: string;
}

const baseStyles = `
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

export function applicationStatusChangeEmail(status: string, data: EmailTemplateData): { subject: string; html: string } {
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  
  const subject = isApproved 
    ? `Your application has been approved!` 
    : isRejected 
    ? `Application Update` 
    : `Application Status Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isApproved ? 'Congratulations!' : 'Application Update'}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          ${isApproved ? `
            <p>Great news! Your application for <strong>${data.offerTitle}</strong> has been approved!</p>
            <p>You can now start promoting this offer and earning commissions.</p>
            ${data.trackingLink ? `
              <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Your Unique Tracking Link:</h3>
                <p style="word-break: break-all; font-family: monospace; background: white; padding: 10px; border-radius: 4px;">
                  ${data.trackingLink}
                </p>
                <p style="margin-bottom: 0; font-size: 14px; color: #666;">Use this link in your content to track your performance and earnings.</p>
              </div>
            ` : ''}
            <a href="${data.linkUrl || '/applications'}" class="button">View Application</a>
          ` : isRejected ? `
            <p>Unfortunately, your application for <strong>${data.offerTitle}</strong> was not approved at this time.</p>
            <p>Don't worry! There are many other great offers available on our platform.</p>
            <a href="/browse" class="button">Browse More Offers</a>
          ` : `
            <p>Your application for <strong>${data.offerTitle}</strong> has been updated to <span class="badge badge-warning">${status.toUpperCase()}</span>.</p>
            <a href="${data.linkUrl || '/applications'}" class="button">View Application</a>
          `}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function newMessageEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `New message from ${data.companyName || 'a company'}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Message</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>You have a new message from <strong>${data.companyName}</strong> regarding <strong>${data.offerTitle}</strong>.</p>
          ${data.messagePreview ? `
            <div style="background-color: #F3F4F6; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${data.messagePreview}"</p>
            </div>
          ` : ''}
          <a href="${data.linkUrl || '/messages'}" class="button">View Message</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function paymentReceivedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Payment received: ${data.amount}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #10B981;">
          <h1>💰 Payment Received!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Great news! You've received a payment for your work${data.offerTitle ? ` on <strong>${data.offerTitle}</strong>` : ''}.</p>

          ${data.amount ? `
            <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #065F46;">Amount You Received</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; color: #047857;">${data.amount}</p>
            </div>
          ` : ''}

          ${data.grossAmount && data.platformFee && data.processingFee ? `
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Payment Breakdown:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #6B7280;">Gross Amount</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #111827; text-align: right;">${data.grossAmount}</td>
                </tr>
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #DC2626;">Platform Fee (4%)</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #DC2626; text-align: right;">-${data.platformFee}</td>
                </tr>
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #DC2626;">Processing Fee (3%)</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #DC2626; text-align: right;">-${data.processingFee}</td>
                </tr>
                <tr style="background-color: #ECFDF5;">
                  <td style="padding: 12px 0; color: #065F46; font-weight: bold;">Net Amount (You Receive)</td>
                  <td style="padding: 12px 0; font-weight: bold; color: #047857; text-align: right; font-size: 18px;">${data.amount}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                💡 <strong>How fees are calculated:</strong><br>
                Platform fee (4%) and processing fee (3%) are automatically deducted from your gross earnings. The remaining amount is what you receive.
              </p>
            </div>
          ` : ''}

          ${data.transactionId ? `
            <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
              <strong>Transaction ID:</strong> ${data.transactionId}
            </p>
          ` : ''}

          <a href="${data.linkUrl || '/payment-settings'}" class="button" style="background-color: #10B981;">View Full Payment Details</a>

          <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
            The payment has been successfully processed and will be sent to your configured payment method.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function paymentApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Payment sent successfully: ${data.amount}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #10B981;">
          <h1>✓ Payment Sent Successfully!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Your payment has been successfully sent to the creator${data.offerTitle ? ` for <strong>${data.offerTitle}</strong>` : ''}.</p>

          ${data.amount ? `
            <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #065F46;">Payment Amount Sent</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; color: #047857;">${data.amount}</p>
            </div>
          ` : ''}

          ${data.grossAmount && data.platformFee && data.processingFee ? `
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Payment Breakdown:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #6B7280;">Gross Amount</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #111827; text-align: right;">${data.grossAmount}</td>
                </tr>
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #7C3AED;">Platform Fee (4%)</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #7C3AED; text-align: right;">${data.platformFee}</td>
                </tr>
                <tr style="border-bottom: 1px solid #D1D5DB;">
                  <td style="padding: 12px 0; color: #7C3AED;">Processing Fee (3%)</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #7C3AED; text-align: right;">${data.processingFee}</td>
                </tr>
                <tr style="background-color: #ECFDF5;">
                  <td style="padding: 12px 0; color: #065F46; font-weight: bold;">Creator Receives</td>
                  <td style="padding: 12px 0; font-weight: bold; color: #047857; text-align: right; font-size: 18px;">${data.amount}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #1E40AF;">
                💡 <strong>Payment Structure:</strong><br>
                The platform and processing fees (7% total) are deducted from the gross amount. The creator receives the net amount after fees.
              </p>
            </div>
          ` : ''}

          <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #065F46;">✓ Payment processed successfully</p>
            <p style="margin: 5px 0 0 0; color: #047857; font-size: 14px;">The creator will receive the funds according to their payment method settings.</p>
          </div>

          ${data.transactionId ? `
            <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
              <strong>Transaction ID:</strong> ${data.transactionId}
            </p>
          ` : ''}

          <a href="${data.linkUrl || '/payment-settings'}" class="button" style="background-color: #10B981;">View Full Payment Details</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function paymentFailedInsufficientFundsEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Payment Processing Failed - Insufficient Funds`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #F59E0B;">
          <h1>Payment Processing Alert</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName || data.companyName},</p>
          <p>We attempted to process a payment request but encountered an issue:</p>

          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: 600; color: #92400E;">Your PayPal business account has insufficient funds to complete this payment.</p>
          </div>

          ${data.amount ? `
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Payment Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">${data.amount}</td>
                </tr>
              </table>
            </div>
          ` : ''}

          <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #065F46;">What to do next:</p>
            <ol style="margin: 0; padding-left: 20px; color: #047857;">
              <li style="margin-bottom: 8px;">Add funds to your PayPal business account</li>
              <li style="margin-bottom: 8px;">Wait a few moments for the funds to become available</li>
              <li style="margin-bottom: 0;">Contact the admin to retry the payment</li>
            </ol>
          </div>

          <p style="color: #6B7280; font-size: 14px; font-style: italic;">The payment status has been updated to "failed" and can be retried once your account has sufficient funds.</p>

          <a href="${data.linkUrl || '/payment-settings'}" class="button" style="background-color: #F59E0B;">View Payment Details</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function offerApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Your offer "${data.offerTitle}" has been approved!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Offer Approved!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Congratulations! Your offer <strong>"${data.offerTitle}"</strong> has been approved and is now live on the marketplace.</p>
          <p>Creators can now discover and apply to your offer.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">View Your Offer</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function offerRejectedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Offer Review Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Offer Review Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Your offer <strong>"${data.offerTitle}"</strong> requires some adjustments before it can be published.</p>
          <p>Please review the feedback and resubmit your offer.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">View Offer</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function newApplicationEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = data.offerTitle
    ? `New offer pending review: "${data.offerTitle}"`
    : `New application for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${data.companyName ? 'New Offer Pending Review' : 'New Application Received'}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          ${data.companyName ? `
            <p>${data.companyName} has submitted a new offer <strong>"${data.offerTitle}"</strong> for review.</p>
            <p>Please review and approve or reject this offer.</p>
          ` : `
            <p>You've received a new application for your offer <strong>"${data.offerTitle}"</strong>.</p>
            <p>Review the creator's profile and application to make your decision.</p>
          `}
          <a href="${data.linkUrl || (data.companyName ? '/admin/offers' : '/company/applications')}" class="button">${data.companyName ? 'Review Offer' : 'View Application'}</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function reviewReceivedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const rating = `${data.reviewRating || 5} out of 5 stars`;
  const subject = `New review received (${rating})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Review Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>You've received a new review for your company!</p>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${rating}</p>
            ${data.reviewText ? `<p style="font-style: italic; margin: 0;">"${data.reviewText}"</p>` : ''}
          </div>
          <a href="${data.linkUrl || '/company-reviews'}" class="button">View Review</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function systemAnnouncementEmail(title: string, message: string, data: EmailTemplateData): { subject: string; html: string } {
  const subject = `${title}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>${message}</p>
          </div>
          ${data.linkUrl ? `<a href="${data.linkUrl}" class="button">Learn More</a>` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function registrationApprovedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Welcome to Affiliate Marketplace! Your account has been approved`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Affiliate Marketplace!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Great news! Your company account has been approved and you can now start creating offers and connecting with creators.</p>
          <a href="${data.linkUrl || '/company-dashboard'}" class="button">Get Started</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function registrationRejectedEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Account Registration Update`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Registration Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Thank you for your interest in Affiliate Marketplace. Unfortunately, we're unable to approve your company account at this time.</p>
          <p>If you believe this is an error or would like more information, please contact our support team.</p>
          <a href="${data.linkUrl || '/contact'}" class="button">Contact Support</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function workCompletionApprovalEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Work approved for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Work Approved!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Congratulations! Your work for <strong>"${data.offerTitle}"</strong> has been approved.</p>
          ${data.amount ? `<p>Your payment of <strong>${data.amount}</strong> has been initiated and will be processed shortly.</p>` : ''}
          <a href="${data.linkUrl || '/applications'}" class="button">View Details</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function priorityListingExpiringEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Priority listing expiring soon for "${data.offerTitle}"`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Priority Listing Expiring</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Your priority listing for <strong>"${data.offerTitle}"</strong> will expire in <strong>${data.daysUntilExpiration} days</strong>.</p>
          <p>Renew now to keep your offer at the top of search results and maintain maximum visibility.</p>
          <a href="${data.linkUrl || '/company-offers'}" class="button">Renew Priority Listing</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function paymentPendingEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `New Affiliate Payment Ready for Processing`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background-color: #F59E0B;">
          <h1>Payment Pending Review</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>A new affiliate payment is ready for processing and requires your review.</p>
          ${data.amount ? `
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Payment Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">${data.amount}</td>
                </tr>
                ${data.offerTitle ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280;">Offer:</td>
                    <td style="padding: 8px 0; color: #111827; text-align: right;">${data.offerTitle}</td>
                  </tr>
                ` : ''}
              </table>
            </div>
          ` : ''}
          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: 600; color: #92400E;">Action Required</p>
            <p style="margin: 5px 0 0 0; color: #78350F; font-size: 14px;">Please review and process this payment at your earliest convenience.</p>
          </div>
          <a href="${data.linkUrl || '/payment-settings'}" class="button" style="background-color: #F59E0B;">Review Payment</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Affiliate Marketplace.</p>
          <p>Update your <a href="/settings">notification preferences</a> anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function emailVerificationEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Verify your email address`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Affiliate Marketplace!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>Thank you for registering with Affiliate Marketplace. To complete your registration and start using your account, please verify your email address by clicking the button below.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">This verification link will expire in 24 hours.</p>
          <p style="color: #6B7280; font-size: 14px;">If you didn't create an account with Affiliate Marketplace, you can safely ignore this email.</p>
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #374151;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-family: monospace; font-size: 12px; color: #4F46E5; margin: 10px 0 0 0;">${data.verificationUrl}</p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated email from Affiliate Marketplace.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

export function passwordResetEmail(data: EmailTemplateData): { subject: string; html: string } {
  const subject = `Reset your password`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>We received a request to reset your password for your Affiliate Marketplace account. Click the button below to create a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">This password reset link will expire in 1 hour.</p>
          <p style="color: #6B7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #374151;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-family: monospace; font-size: 12px; color: #4F46E5; margin: 10px 0 0 0;">${data.resetUrl}</p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated email from Affiliate Marketplace.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
