// Stripe Connect Service
// Manages Stripe Connect accounts for creator payouts
import Stripe from 'stripe';
import { storage } from "./storage";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe credentials not configured. Please set STRIPE_SECRET_KEY in your .env file');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * Check if payment sandbox mode is enabled
 * In sandbox mode, payment operations are simulated without calling real APIs
 */
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}

export interface ConnectAccountResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  error?: string;
}

export class StripeConnectService {
  /**
   * Create a Stripe Connect Express account for a creator
   * Express accounts are managed by Stripe and handle their own onboarding
   */
  async createConnectedAccount(
    userId: string,
    email: string,
    country: string = 'CA' // Default to Canada for e-transfers
  ): Promise<ConnectAccountResult> {
    try {
      console.log(`[Stripe Connect] Creating connected account for user ${userId}`);

      const stripe = getStripeClient();

      // Check if user already has a connected account
      const existingSettings = await storage.getPaymentSettings(userId);
      const existingAccount = existingSettings.find(s => s.stripeAccountId);

      if (existingAccount?.stripeAccountId) {
        console.log(`[Stripe Connect] User already has account ${existingAccount.stripeAccountId}`);

        // Verify account still exists and is valid
        try {
          const account = await stripe.accounts.retrieve(existingAccount.stripeAccountId);
          if (account.charges_enabled && account.payouts_enabled) {
            return {
              success: true,
              accountId: existingAccount.stripeAccountId
            };
          }
        } catch (error) {
          console.warn(`[Stripe Connect] Existing account ${existingAccount.stripeAccountId} no longer valid, creating new one`);
        }
      }

      // Create new Express connected account
      const account = await stripe.accounts.create({
        type: 'express',
        country: country,
        email: email,
        capabilities: {
          // In CA, requesting transfers alone triggers a service agreement error;
          // request card_payments alongside transfers to satisfy Stripe's requirements.
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Most creators are individuals
        settings: {
          payouts: {
            schedule: {
              interval: 'manual', // Creator controls when they withdraw
            },
          },
        },
      });

      console.log(`[Stripe Connect] Created account ${account.id}`);

      return {
        success: true,
        accountId: account.id,
      };
    } catch (error: any) {
      console.error('[Stripe Connect] Error creating connected account:', error.message);

      let errorMessage = error.message;
      if (errorMessage?.includes("You can only create new accounts if you've signed up for Connect")) {
        errorMessage = 'Stripe secret key is not for a Connect-enabled platform. Enable Stripe Connect on your account and update STRIPE_SECRET_KEY, then restart the server.';
      } else if (errorMessage?.includes('When requesting the `transfers` capability')) {
        errorMessage = 'Stripe rejected transfers-only capabilities for CA accounts. Request both card_payments and transfers (or set the recipient service agreement) in createConnectedAccount, then retry onboarding.';
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create an account link for onboarding
   * This URL allows the creator to complete their Stripe account setup
   */
  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const stripe = getStripeClient();

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      console.log(`[Stripe Connect] Created account link for ${accountId}`);

      return {
        success: true,
        url: accountLink.url,
      };
    } catch (error: any) {
      console.error('[Stripe Connect] Error creating account link:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if a connected account is fully onboarded and ready for payouts
   */
  async checkAccountStatus(accountId: string): Promise<{
    success: boolean;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    requirements?: string[];
    error?: string;
  }> {
    try {
      // Sandbox mode: Return mock success response
      if (isSandboxMode()) {
        console.log(`[Stripe Connect] 🏖️ SANDBOX MODE: Simulating successful account status for ${accountId}`);
        return {
          success: true,
          detailsSubmitted: true,
          chargesEnabled: true,
          payoutsEnabled: true,
          requirements: [],
        };
      }

      const stripe = getStripeClient();
      const account = await stripe.accounts.retrieve(accountId);

      return {
        success: true,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirements: account.requirements?.currently_due || [],
      };
    } catch (error: any) {
      console.error('[Stripe Connect] Error checking account status:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a transfer to a connected account
   * This sends money from the platform's Stripe balance to the creator's connected account
   */
  async createTransfer(
    accountId: string,
    amount: number,
    currency: string,
    description: string,
    metadata: Record<string, string>
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      const stripe = getStripeClient();

      // Check minimum transfer amount (Stripe typically requires $1.00 minimum)
      const currencyLower = currency.toLowerCase();
      const minimumAmounts: Record<string, number> = {
        'usd': 1.00,
        'cad': 1.00,
        'eur': 1.00,
        'gbp': 1.00,
      };

      const minimumAmount = minimumAmounts[currencyLower] || 1.00;
      if (amount < minimumAmount) {
        console.error(`[Stripe Connect] ERROR: Transfer amount $${amount.toFixed(2)} ${currency.toUpperCase()} is below minimum $${minimumAmount.toFixed(2)}`);
        return {
          success: false,
          error: `Transfer amount $${amount.toFixed(2)} ${currency.toUpperCase()} is below the minimum required amount of $${minimumAmount.toFixed(2)} ${currency.toUpperCase()}. Stripe requires a minimum transfer of at least $${minimumAmount.toFixed(2)} ${currency.toUpperCase()}.`,
        };
      }

      console.log(`[Stripe Connect] Verifying account ${accountId} for transfer of $${amount} ${currency.toUpperCase()}...`);

      // Verify account is ready for transfers
      const accountStatus = await this.checkAccountStatus(accountId);
      if (!accountStatus.payoutsEnabled) {
        console.error(`[Stripe Connect] ERROR: Account ${accountId} not enabled for payouts`);
        return {
          success: false,
          error: 'Connected account is not yet enabled for payouts. Creator must complete onboarding.',
        };
      }

      console.log(`[Stripe Connect] Creating Stripe transfer: ${Math.round(amount * 100)} cents to ${accountId}...`);

      // Sandbox mode: Return mock transfer without calling Stripe API
      if (isSandboxMode()) {
        const mockTransferId = `sandbox_tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[Stripe Connect] 🏖️ SANDBOX MODE: Simulating successful transfer ${mockTransferId} for $${amount} ${currency.toUpperCase()}`);
        console.log(`[Stripe Connect] 🏖️ SANDBOX MODE: No actual money transferred. This is a test transaction.`);

        return {
          success: true,
          transferId: mockTransferId,
        };
      }

      // Create transfer
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination: accountId,
        description: description,
        metadata: metadata,
      });

      console.log(`[Stripe Connect] Created transfer ${transfer.id} for $${amount} ${currency.toUpperCase()}`);

      return {
        success: true,
        transferId: transfer.id,
      };
    } catch (error: any) {
      console.error('[Stripe Connect] Error creating transfer:', error);
      console.error('[Stripe Connect] Error code:', error.code);
      console.error('[Stripe Connect] Error type:', error.type);
      console.error('[Stripe Connect] Error message:', error.message);

      // Enhanced error handling
      let errorMessage = error.message;

      if (error.code === 'insufficient_funds') {
        errorMessage = 'Insufficient balance in platform Stripe account. Please add funds to process payouts.';
      } else if (error.code === 'account_invalid') {
        errorMessage = 'Connected account is invalid or not properly configured.';
      } else if (errorMessage.includes('balance')) {
        errorMessage = 'Insufficient balance in Stripe account. Please ensure your Stripe account has sufficient funds for transfers.';
      }

      console.error(`[Stripe Connect] ERROR: Transfer failed with: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a connected account (for cleanup/testing)
   */
  async deleteConnectedAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripeClient();
      await stripe.accounts.del(accountId);

      console.log(`[Stripe Connect] Deleted account ${accountId}`);

      return { success: true };
    } catch (error: any) {
      console.error('[Stripe Connect] Error deleting account:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a login link for a connected account
   * This allows creators to access their Stripe Express dashboard
   */
  async createLoginLink(accountId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const stripe = getStripeClient();
      const loginLink = await stripe.accounts.createLoginLink(accountId);

      return {
        success: true,
        url: loginLink.url,
      };
    } catch (error: any) {
      console.error('[Stripe Connect] Error creating login link:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const stripeConnectService = new StripeConnectService();
