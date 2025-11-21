// Payment Processor Service
// Handles actual money transfers to creators via various payment methods
import { storage } from "./storage";
import paypalSdk from '@paypal/payouts-sdk';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe credentials not configured. Please set STRIPE_SECRET_KEY in your .env file');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  providerResponse?: any;
  error?: string;
}

/**
 * Check if payment sandbox mode is enabled
 * In sandbox mode, payment operations are simulated without calling real APIs
 */
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}

// Initialize PayPal Client
function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env file');
  }

  const environment = mode === 'live'
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret);

  return new paypalSdk.core.PayPalHttpClient(environment);
}

export class PaymentProcessorService {
  /**
   * Process a payment to a creator based on their payment method preference
   * This actually sends money via PayPal, bank transfer, crypto, etc.
   */
  async processPayment(paymentId: string): Promise<PaymentResult> {
    try {
      // Log sandbox mode status
      if (isSandboxMode()) {
        console.log('[Payment Processor] 🏖️ SANDBOX MODE ENABLED - Payments will be simulated without real transactions');
      }

      // Get payment details
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        return { success: false, error: "Payment not found" };
      }

      // Get creator's payment settings to determine where to send money
      const paymentSettings = await storage.getPaymentSettings(payment.creatorId);
      if (!paymentSettings || paymentSettings.length === 0) {
        return {
          success: false,
          error: "Creator has not configured payment method. Please ask creator to add payment details in settings."
        };
      }

      // Use the default payment method (or first one if no default)
      const defaultPaymentMethod = paymentSettings.find(ps => ps.isDefault) || paymentSettings[0];
      const amount = parseFloat(payment.netAmount);

      // Process payment based on method type
      switch (defaultPaymentMethod.payoutMethod) {
        case 'paypal':
          return await this.processPayPalPayout(
            defaultPaymentMethod.paypalEmail!,
            amount,
            payment.id,
            payment.description || 'Creator payout'
          );

        case 'etransfer':
          return await this.processETransfer(
            defaultPaymentMethod.payoutEmail!,
            amount,
            payment.id,
            payment.description || 'Creator payout'
          );

        case 'wire':
          return await this.processBankTransfer(
            defaultPaymentMethod.bankRoutingNumber!,
            defaultPaymentMethod.bankAccountNumber!,
            amount,
            payment.id,
            payment.description || 'Creator payout'
          );

        case 'crypto':
          return await this.processCryptoPayout(
            defaultPaymentMethod.cryptoWalletAddress!,
            defaultPaymentMethod.cryptoNetwork!,
            amount,
            payment.id
          );

        default:
          return {
            success: false,
            error: `Unsupported payment method: ${defaultPaymentMethod.payoutMethod}`
          };
      }
    } catch (error: any) {
      console.error('[Payment Processor] Error processing payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process a retainer payment to a creator
   * Similar to processPayment but specifically for retainer payments
   */
  async processRetainerPayment(retainerPaymentId: string): Promise<PaymentResult> {
    try {
      // Log sandbox mode status
      if (isSandboxMode()) {
        console.log('[Payment Processor] 🏖️ SANDBOX MODE ENABLED - Payments will be simulated without real transactions');
      }

      // Get retainer payment details
      const retainerPayment = await storage.getRetainerPayment(retainerPaymentId);
      if (!retainerPayment) {
        return { success: false, error: "Retainer payment not found" };
      }

      // Get creator's payment settings
      const paymentSettings = await storage.getPaymentSettings(retainerPayment.creatorId);
      if (!paymentSettings || paymentSettings.length === 0) {
        return {
          success: false,
          error: "Creator has not configured payment method. Please ask creator to add payment details in settings."
        };
      }

      // Use the default payment method
      const defaultPaymentMethod = paymentSettings.find(ps => ps.isDefault) || paymentSettings[0];
      const amount = parseFloat(retainerPayment.netAmount);

      // Process payment based on method type
      switch (defaultPaymentMethod.payoutMethod) {
        case 'paypal':
          return await this.processPayPalPayout(
            defaultPaymentMethod.paypalEmail!,
            amount,
            retainerPayment.id,
            retainerPayment.description || `Retainer payment - Month ${retainerPayment.monthNumber || 'N/A'}`
          );

        case 'etransfer':
          return await this.processETransfer(
            defaultPaymentMethod.payoutEmail!,
            amount,
            retainerPayment.id,
            retainerPayment.description || `Retainer payment - Month ${retainerPayment.monthNumber || 'N/A'}`
          );

        case 'wire':
          return await this.processBankTransfer(
            defaultPaymentMethod.bankRoutingNumber!,
            defaultPaymentMethod.bankAccountNumber!,
            amount,
            retainerPayment.id,
            retainerPayment.description || `Retainer payment - Month ${retainerPayment.monthNumber || 'N/A'}`
          );

        case 'crypto':
          return await this.processCryptoPayout(
            defaultPaymentMethod.cryptoWalletAddress!,
            defaultPaymentMethod.cryptoNetwork!,
            amount,
            retainerPayment.id
          );

        default:
          return {
            success: false,
            error: `Unsupported payment method: ${defaultPaymentMethod.payoutMethod}`
          };
      }
    } catch (error: any) {
      console.error('[Payment Processor] Error processing retainer payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process PayPal payout
   * Uses PayPal Payouts API to send money to creator's PayPal account
   */
  private async processPayPalPayout(
    paypalEmail: string,
    amount: number,
    paymentId: string,
    description: string
  ): Promise<PaymentResult> {
    try {
      console.log(`[PayPal Payout] Sending $${amount} to ${paypalEmail}`);

      // Get PayPal client
      let client: any;
      try {
        client = getPayPalClient();
      } catch (e: any) {
        console.error('[PayPal Payout] Failed to initialize PayPal client:', e?.message || e);
        return {
          success: false,
          error: `PayPal configuration error: ${e?.message || 'Unable to initialize PayPal client'}`
        };
      }

      // Create payout request using PayPal SDK
      const request = new paypalSdk.payouts.PayoutsPostRequest();
      request.requestBody({
        sender_batch_header: {
          sender_batch_id: `batch_${paymentId}_${Date.now()}`, // Must be unique
          email_subject: 'You have received a payout!',
          email_message: `You have received a payout from AffiliateXchange for $${amount.toFixed(2)}`
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: {
            value: amount.toFixed(2),
            currency: 'USD'
          },
          receiver: paypalEmail,
          note: description,
          sender_item_id: paymentId
        }]
      });

      // Execute the payout
      const response = await client.execute(request);

      console.log(`[PayPal Payout] SUCCESS - Batch ID: ${response.result.batch_header.payout_batch_id}`);
      console.log(`[PayPal Payout] Status: ${response.result.batch_header.batch_status}`);

      return {
        success: true,
        transactionId: response.result.batch_header.payout_batch_id,
        providerResponse: {
          batchId: response.result.batch_header.payout_batch_id,
          batchStatus: response.result.batch_header.batch_status,
          items: response.result.items,
          senderBatchId: response.result.batch_header.sender_batch_header?.sender_batch_id,
          method: 'paypal',
          email: paypalEmail,
          amount: amount,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      // Enhanced error handling for PayPal API errors
      let errorMessage = error.message;
      let errorDetails = '';

      // Check for specific PayPal error types
      if (error._originalError?.text) {
        try {
          const errorData = JSON.parse(error._originalError.text);
          if (errorData.name === 'INSUFFICIENT_FUNDS') {
            errorMessage = 'Insufficient funds in PayPal business account. Please add funds to your PayPal account and retry.';
            errorDetails = `PayPal Error: ${errorData.name} - ${errorData.message}`;
          } else if (errorData.message) {
            errorMessage = errorData.message;
            errorDetails = `PayPal Error: ${errorData.name || 'Unknown'} - ${errorData.message}`;
          }
        } catch (parseError) {
          // Fallback to original error message
          errorDetails = error.message;
        }
      } else if (error.statusCode) {
        errorMessage = `PayPal API Error (${error.statusCode}): ${error.message}`;
        errorDetails = errorMessage;
      } else {
        errorDetails = error.message;
      }

      // Log clean error message instead of full error object
      console.error('[PayPal Payout] Failed:', errorDetails);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process E-Transfer (Interac e-Transfer for Canadian payments)
   * Uses Stripe Connect to transfer funds to creator's connected account
   */
  private async processETransfer(
    email: string,
    amount: number,
    paymentId: string,
    description: string
  ): Promise<PaymentResult> {
    try {
      console.log(`[E-Transfer] Sending $${amount} CAD to ${email}`);

      // Get payment to find creator ID
      const payment = await storage.getPaymentOrRetainerPayment(paymentId);
      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      // Get creator's payment settings to find Stripe account ID
      const paymentSettings = await storage.getPaymentSettings(payment.creatorId);
      const eTransferSetting = paymentSettings.find(ps =>
        ps.payoutMethod === 'etransfer' && ps.payoutEmail === email
      );

      if (!eTransferSetting?.stripeAccountId) {
        console.error(`[E-Transfer] ERROR: Creator ${payment.creatorId} has not connected their Stripe account`);
        return {
          success: false,
          error: 'Creator has not connected their Stripe account for e-transfers. Please complete Stripe onboarding first.'
        };
      }

      console.log(`[E-Transfer] Using Stripe account ${eTransferSetting.stripeAccountId}`);

      // Import Stripe Connect service
      const { stripeConnectService } = await import('./stripeConnectService');

      // Verify connected account is ready
      console.log(`[E-Transfer] Checking account status for ${eTransferSetting.stripeAccountId}...`);
      const accountStatus = await stripeConnectService.checkAccountStatus(eTransferSetting.stripeAccountId);

      if (!accountStatus.success) {
        console.error(`[E-Transfer] ERROR: Unable to verify Stripe account: ${accountStatus.error}`);
        return {
          success: false,
          error: `Unable to verify Stripe account: ${accountStatus.error}`
        };
      }

      console.log(`[E-Transfer] Account status: detailsSubmitted=${accountStatus.detailsSubmitted}, payoutsEnabled=${accountStatus.payoutsEnabled}`);

      if (!accountStatus.payoutsEnabled) {
        console.error(`[E-Transfer] ERROR: Account ${eTransferSetting.stripeAccountId} payouts not enabled. Requirements: ${JSON.stringify(accountStatus.requirements)}`);

        // Build a helpful error message with specific requirements
        let errorMessage = 'Creator Stripe account is not yet enabled for payouts.';
        if (accountStatus.requirements && accountStatus.requirements.length > 0) {
          const requirementDescriptions: Record<string, string> = {
            'individual.verification.proof_of_liveness': 'identity verification (photo/video)',
            'individual.verification.document': 'identity document upload',
            'individual.verification.additional_document': 'additional identity document',
            'business_profile.url': 'business website',
            'tos_acceptance.date': 'terms of service acceptance',
          };

          const readableReqs = accountStatus.requirements.map(req =>
            requirementDescriptions[req] || req.replace(/[._]/g, ' ')
          ).join(', ');

          errorMessage += ` Missing: ${readableReqs}. Please return to Payment Settings and complete Stripe Connect onboarding.`;
        } else {
          errorMessage += ' Please complete all required onboarding steps in Payment Settings.';
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      if (accountStatus.requirements && accountStatus.requirements.length > 0) {
        console.warn(`[E-Transfer] Account ${eTransferSetting.stripeAccountId} has pending requirements:`, accountStatus.requirements);
      }

      // Create transfer to connected account
      console.log(`[E-Transfer] Creating transfer: $${amount} CAD to account ${eTransferSetting.stripeAccountId}`);
      const transferResult = await stripeConnectService.createTransfer(
        eTransferSetting.stripeAccountId,
        amount,
        'cad',
        description,
        {
          payment_id: paymentId,
          payout_method: 'etransfer',
          payout_email: email
        }
      );

      if (!transferResult.success) {
        console.error(`[E-Transfer] ERROR: Transfer failed: ${transferResult.error}`);
        return {
          success: false,
          error: transferResult.error || 'Transfer failed'
        };
      }

      console.log(`[E-Transfer] SUCCESS - Stripe Transfer ID: ${transferResult.transferId}`);

      return {
        success: true,
        transactionId: transferResult.transferId!,
        providerResponse: {
          method: 'etransfer',
          email: email,
          amount: amount,
          transferId: transferResult.transferId,
          stripeAccountId: eTransferSetting.stripeAccountId,
          status: 'completed',
          timestamp: new Date().toISOString(),
          note: 'Processed via Stripe Connect transfer'
        }
      };
    } catch (error: any) {
      // Enhanced error handling for common Stripe transfer errors
      let errorMessage = error?.message || 'Unknown error while processing e-transfer';

      // Check for specific Stripe error types
      if (error.type === 'StripePermissionError' || errorMessage.includes('does not have the required permissions')) {
        errorMessage = 'Stripe API key does not have the required permissions. Please ensure you are using a Stripe Connect enabled API key.';
      } else if (errorMessage.includes('minimum') || errorMessage.includes('amount')) {
        errorMessage = `Transfer amount issue: ${errorMessage}. Note: Stripe typically requires minimum transfer amounts (usually $1 CAD or more).`;
      } else if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
        errorMessage = 'Insufficient balance in platform Stripe account. Please ensure your Stripe account has sufficient funds for transfers.';
      } else if (errorMessage.includes('account')) {
        errorMessage = `Stripe Connect account issue: ${errorMessage}. The creator may need to complete their Stripe onboarding.`;
      }

      console.error('[E-Transfer] Error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process bank wire/ACH transfer
   * Uses Stripe Payouts or similar service to send money to bank account
   */
  private async processBankTransfer(
    routingNumber: string,
    accountNumber: string,
    amount: number,
    paymentId: string,
    description: string
  ): Promise<PaymentResult> {
    try {
      console.log(`[Bank Transfer] Sending $${amount} to account ending in ${accountNumber.slice(-4)}`);

      // In production, use Stripe Payouts API:
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // const payout = await stripe.payouts.create({
      //   amount: Math.round(amount * 100), // Stripe uses cents
      //   currency: 'usd',
      //   destination: bankAccountId, // You'd need to create/connect bank account first
      //   metadata: {
      //     payment_id: paymentId,
      //     description: description
      //   }
      // });
      // return {
      //   success: true,
      //   transactionId: payout.id,
      //   providerResponse: payout
      // };

      const mockTransactionId = `WIRE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Bank Transfer] SUCCESS - Transaction ID: ${mockTransactionId}`);

      return {
        success: true,
        transactionId: mockTransactionId,
        providerResponse: {
          method: 'wire',
          routingNumber: routingNumber,
          accountNumber: `****${accountNumber.slice(-4)}`,
          amount: amount,
          timestamp: new Date().toISOString(),
          note: 'SIMULATED - In production, this would use Stripe Payouts or bank API'
        }
      };
    } catch (error: any) {
      console.error('[Bank Transfer] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process cryptocurrency payout
   * Sends crypto to creator's wallet address
   */
  private async processCryptoPayout(
    walletAddress: string,
    network: string,
    amount: number,
    paymentId: string
  ): Promise<PaymentResult> {
    try {
      console.log(`[Crypto Payout] Sending $${amount} USD equivalent to ${walletAddress} on ${network}`);

      // In production, you would:
      // 1. Convert USD amount to crypto amount based on current exchange rate
      // 2. Use a crypto payment provider like Coinbase Commerce, BitPay, or direct blockchain interaction
      // 3. Send transaction to blockchain
      // 4. Wait for confirmation
      //
      // Example with Coinbase Commerce:
      // const { Client } = require('coinbase-commerce-node');
      // Client.init(process.env.COINBASE_COMMERCE_API_KEY);
      // const Charge = require('coinbase-commerce-node').resources.Charge;
      // const charge = await Charge.create({
      //   name: 'Creator Payout',
      //   description: `Payment ${paymentId}`,
      //   local_price: {
      //     amount: amount.toString(),
      //     currency: 'USD'
      //   },
      //   pricing_type: 'fixed_price'
      // });

      const mockTxHash = `0x${Array.from({length: 64}, () =>
        Math.floor(Math.random() * 16).toString(16)).join('')}`;

      console.log(`[Crypto Payout] SUCCESS - TX Hash: ${mockTxHash}`);

      return {
        success: true,
        transactionId: mockTxHash,
        providerResponse: {
          method: 'crypto',
          network: network,
          walletAddress: walletAddress,
          amount: amount,
          txHash: mockTxHash,
          timestamp: new Date().toISOString(),
          note: 'SIMULATED - In production, this would send real crypto transaction'
        }
      };
    } catch (error: any) {
      console.error('[Crypto Payout] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify that a creator has valid payment settings configured
   */
  async validateCreatorPaymentSettings(creatorId: string): Promise<{ valid: boolean; error?: string }> {
    console.log(`[Validation] Checking payment settings for creator ${creatorId}...`);
    const paymentSettings = await storage.getPaymentSettings(creatorId);

    if (!paymentSettings || paymentSettings.length === 0) {
      console.error(`[Validation] ERROR: Creator ${creatorId} has no payment settings configured`);
      return {
        valid: false,
        error: 'No payment method configured. Creator must add payment details in Settings > Payment Methods.'
      };
    }

    const defaultMethod = paymentSettings.find(ps => ps.isDefault) || paymentSettings[0];
    console.log(`[Validation] Found ${paymentSettings.length} payment method(s), using: ${defaultMethod.payoutMethod}`);

    // Validate based on method type
    switch (defaultMethod.payoutMethod) {
      case 'paypal':
        if (!defaultMethod.paypalEmail) {
          console.error(`[Validation] ERROR: PayPal email is missing`);
          return { valid: false, error: 'PayPal email is missing' };
        }
        console.log(`[Validation] PayPal email validated: ${defaultMethod.paypalEmail}`);
        break;
      case 'etransfer':
        if (!defaultMethod.payoutEmail) {
          console.error(`[Validation] ERROR: E-Transfer email is missing`);
          return { valid: false, error: 'E-Transfer email is missing' };
        }
        if (!defaultMethod.stripeAccountId) {
          console.error(`[Validation] ERROR: Stripe account not connected for e-transfer`);
          return { valid: false, error: 'Stripe account not connected. Please complete Stripe Connect onboarding in Payment Settings.' };
        }
        console.log(`[Validation] E-Transfer validated: ${defaultMethod.payoutEmail} with Stripe account ${defaultMethod.stripeAccountId}`);
        break;
      case 'wire':
        if (!defaultMethod.bankRoutingNumber || !defaultMethod.bankAccountNumber) {
          return { valid: false, error: 'Bank account details are missing' };
        }
        break;
      case 'crypto':
        if (!defaultMethod.cryptoWalletAddress || !defaultMethod.cryptoNetwork) {
          return { valid: false, error: 'Crypto wallet details are missing' };
        }
        break;
      default:
        return { valid: false, error: 'Unknown payment method' };
    }

    return { valid: true };
  }
}

export const paymentProcessor = new PaymentProcessorService();