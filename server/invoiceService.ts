/**
 * Invoice Service - Generates PDF invoices for payments
 *
 * Provides invoice generation for:
 * - Creator payouts
 * - Company charges
 * - Platform fee receipts
 */

import { storage } from "./storage";

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate?: Date;
  // Sender (Platform)
  platformName: string;
  platformAddress: string;
  platformEmail: string;
  // Recipient
  recipientName: string;
  recipientEmail: string;
  recipientAddress?: string;
  // Payment details
  paymentId: string;
  description: string;
  grossAmount: number;
  platformFee: number;
  stripeFee: number;
  netAmount: number;
  currency: string;
  // Status
  status: 'pending' | 'paid' | 'failed';
  paidAt?: Date;
  // Additional
  offerTitle?: string;
  trackingCode?: string;
  conversions?: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceNumber: string;
  html: string;
  data: InvoiceData;
}

/**
 * Generate unique invoice number
 */
export function generateInvoiceNumber(prefix: string = 'INV'): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}${month}-${random}`;
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Generate HTML invoice (can be converted to PDF using browser print or puppeteer)
 */
export function generateInvoiceHtml(data: InvoiceData): string {
  const statusColors = {
    pending: '#f59e0b',
    paid: '#10b981',
    failed: '#ef4444',
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 40px;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #6366f1;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-number {
      font-size: 14px;
      color: #6b7280;
    }
    .invoice-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: white;
      background: ${statusColors[data.status]};
      margin-top: 8px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .party {
      width: 45%;
    }
    .party-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .party-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .party-detail {
      font-size: 14px;
      color: #6b7280;
    }
    .details {
      margin-bottom: 40px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-table th {
      text-align: left;
      padding: 12px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
    }
    .details-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table .amount {
      text-align: right;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    .summary {
      margin-left: auto;
      width: 300px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-row.total {
      font-weight: 700;
      font-size: 18px;
      border-bottom: 2px solid #1f2937;
      margin-top: 8px;
      padding-top: 16px;
    }
    .summary-label {
      color: #6b7280;
    }
    .summary-value {
      font-family: 'Monaco', 'Menlo', monospace;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .tracking-info {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .tracking-info p {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .tracking-code {
      font-family: 'Monaco', 'Menlo', monospace;
      background: #e5e7eb;
      padding: 2px 8px;
      border-radius: 4px;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .invoice {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">AffiliateXchange</div>
      <div class="invoice-info">
        <div class="invoice-number">Invoice #${data.invoiceNumber}</div>
        <div class="invoice-number">Issue Date: ${formatDate(data.issueDate)}</div>
        ${data.paidAt ? `<div class="invoice-number">Paid: ${formatDate(data.paidAt)}</div>` : ''}
        <div class="invoice-status">${data.status}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">From</div>
        <div class="party-name">${data.platformName}</div>
        <div class="party-detail">${data.platformAddress}</div>
        <div class="party-detail">${data.platformEmail}</div>
      </div>
      <div class="party">
        <div class="party-label">To</div>
        <div class="party-name">${data.recipientName}</div>
        <div class="party-detail">${data.recipientEmail}</div>
        ${data.recipientAddress ? `<div class="party-detail">${data.recipientAddress}</div>` : ''}
      </div>
    </div>

    ${data.trackingCode ? `
    <div class="tracking-info">
      <p><strong>Offer:</strong> ${data.offerTitle || 'N/A'}</p>
      <p><strong>Tracking Code:</strong> <span class="tracking-code">${data.trackingCode}</span></p>
      ${data.conversions ? `<p><strong>Conversions:</strong> ${data.conversions}</p>` : ''}
    </div>
    ` : ''}

    <div class="details">
      <table class="details-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data.description}</td>
            <td class="amount">${formatCurrency(data.grossAmount, data.currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Subtotal</span>
        <span class="summary-value">${formatCurrency(data.grossAmount, data.currency)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Platform Fee (4%)</span>
        <span class="summary-value">-${formatCurrency(data.platformFee, data.currency)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Processing Fee (3%)</span>
        <span class="summary-value">-${formatCurrency(data.stripeFee, data.currency)}</span>
      </div>
      <div class="summary-row total">
        <span class="summary-label">Net Amount</span>
        <span class="summary-value">${formatCurrency(data.netAmount, data.currency)}</span>
      </div>
    </div>

    <div class="footer">
      <p>Payment ID: ${data.paymentId}</p>
      <p>This invoice was generated automatically by AffiliateXchange.</p>
      <p>For questions, contact support@affiliatexchange.com</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate invoice for a payment
 */
export async function generatePaymentInvoice(paymentId: string): Promise<InvoiceResult | null> {
  try {
    // Get payment details
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      console.error(`[Invoice] Payment not found: ${paymentId}`);
      return null;
    }

    // Get creator details
    const creator = await storage.getUserById(payment.creatorId);
    if (!creator) {
      console.error(`[Invoice] Creator not found: ${payment.creatorId}`);
      return null;
    }

    // Get application and offer details
    const application = await storage.getApplication(payment.applicationId);
    const offer = application ? await storage.getOffer(application.offerId) : null;

    const invoiceNumber = generateInvoiceNumber('PAY');

    const invoiceData: InvoiceData = {
      invoiceNumber,
      issueDate: new Date(payment.createdAt || Date.now()),
      platformName: 'AffiliateXchange',
      platformAddress: '123 Affiliate Street, Marketing City, MC 12345',
      platformEmail: 'billing@affiliatexchange.com',
      recipientName: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username,
      recipientEmail: creator.email,
      paymentId: payment.id,
      description: offer
        ? `Commission payout for "${offer.title}"`
        : 'Affiliate commission payout',
      grossAmount: parseFloat(payment.grossAmount),
      platformFee: parseFloat(payment.platformFeeAmount),
      stripeFee: parseFloat(payment.stripeFeeAmount),
      netAmount: parseFloat(payment.netAmount),
      currency: 'USD',
      status: payment.status as 'pending' | 'paid' | 'failed',
      paidAt: payment.completedAt ? new Date(payment.completedAt) : undefined,
      offerTitle: offer?.title,
      trackingCode: application?.trackingCode || undefined,
    };

    const html = generateInvoiceHtml(invoiceData);

    return {
      success: true,
      invoiceNumber,
      html,
      data: invoiceData,
    };
  } catch (error) {
    console.error('[Invoice] Error generating invoice:', error);
    return null;
  }
}

/**
 * Generate company charge invoice (for company billing)
 */
export async function generateCompanyChargeInvoice(
  companyId: string,
  chargeAmount: number,
  description: string
): Promise<InvoiceResult | null> {
  try {
    const company = await storage.getCompanyProfileById(companyId);
    if (!company) {
      console.error(`[Invoice] Company not found: ${companyId}`);
      return null;
    }

    const invoiceNumber = generateInvoiceNumber('CHG');

    const invoiceData: InvoiceData = {
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
      platformName: 'AffiliateXchange',
      platformAddress: '123 Affiliate Street, Marketing City, MC 12345',
      platformEmail: 'billing@affiliatexchange.com',
      recipientName: company.legalName || company.tradeName || 'Company',
      recipientEmail: company.contactName ? `${company.contactName}` : 'company@example.com',
      recipientAddress: company.businessAddress || undefined,
      paymentId: `charge-${Date.now()}`,
      description,
      grossAmount: chargeAmount,
      platformFee: 0,
      stripeFee: chargeAmount * 0.03, // 3% Stripe fee
      netAmount: chargeAmount,
      currency: 'USD',
      status: 'pending',
    };

    const html = generateInvoiceHtml(invoiceData);

    return {
      success: true,
      invoiceNumber,
      html,
      data: invoiceData,
    };
  } catch (error) {
    console.error('[Invoice] Error generating company charge invoice:', error);
    return null;
  }
}

export default {
  generateInvoiceNumber,
  generateInvoiceHtml,
  generatePaymentInvoice,
  generateCompanyChargeInvoice,
};
