// Retainer Payment Scheduler
// Automatically generates and processes monthly retainer payments for active contracts

import { storage } from "./storage";
import { paymentProcessor } from "./paymentProcessor";
import { calculateFees, formatFeePercentage, DEFAULT_PLATFORM_FEE_PERCENTAGE } from "./feeCalculator";
import type { NotificationService } from "./notifications/notificationService";

export class RetainerPaymentScheduler {
  constructor(private notificationService: NotificationService) {}
  /**
   * Process monthly retainer payments for all active contracts
   * This should be called on the 1st of each month via a cron job
   */
  async processMonthlyRetainerPayments(): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    errors: Array<{ contractId: string; error: string }>;
  }> {
    console.log('[Retainer Scheduler] Starting monthly payment processing...');

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ contractId: string; error: string }>,
    };

    try {
      // Get all active retainer contracts
      const activeContracts = await this.getActiveRetainerContracts();
      console.log(`[Retainer Scheduler] Found ${activeContracts.length} active retainer contracts`);

      for (const contract of activeContracts) {
        try {
          // Check if payment already exists for this month
          const currentMonth = this.getCurrentMonthNumber(contract);
          const existingPayment = await this.getMonthlyPayment(contract.id, currentMonth);

          if (existingPayment) {
            console.log(`[Retainer Scheduler] Payment already exists for contract ${contract.id}, month ${currentMonth} - skipping`);
            results.skipped++;
            continue;
          }

          // Create monthly payment
          const paymentCreated = await this.createMonthlyPayment(contract, currentMonth);

          if (paymentCreated) {
            results.processed++;
          } else {
            results.skipped++;
          }
        } catch (error: any) {
          console.error(`[Retainer Scheduler] Error processing contract ${contract.id}:`, error);
          results.failed++;
          results.errors.push({
            contractId: contract.id,
            error: error.message,
          });
        }
      }

      console.log(`[Retainer Scheduler] Monthly payment processing complete:`, results);
      return results;
    } catch (error: any) {
      console.error('[Retainer Scheduler] Fatal error during payment processing:', error);
      throw error;
    }
  }

  /**
   * Get all active retainer contracts that should receive monthly payments
   */
  private async getActiveRetainerContracts() {
    const allContracts = await storage.getRetainerContracts();

    const now = new Date();

    return allContracts.filter((contract: any) => {
      // Must have an assigned creator
      if (!contract.assignedCreatorId) return false;

      // Must be in 'active' status
      if (contract.status !== 'active') return false;

      // Must have started
      if (!contract.startDate || new Date(contract.startDate) > now) return false;

      // Must not have ended
      if (contract.endDate && new Date(contract.endDate) < now) return false;

      return true;
    });
  }

  /**
   * Calculate which month of the contract we're in (1-based)
   */
  private getCurrentMonthNumber(contract: any): number {
    if (!contract.startDate) return 1;

    const startDate = new Date(contract.startDate);
    const now = new Date();

    // Calculate months elapsed since start
    const monthsElapsed = (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth()) + 1;

    return Math.max(1, monthsElapsed);
  }

  /**
   * Check if a monthly payment already exists for this contract and month
   */
  private async getMonthlyPayment(contractId: string, monthNumber: number) {
    const payments = await storage.getRetainerPaymentsByContract(contractId);

    return payments.find(payment =>
      payment.paymentType === 'monthly' &&
      payment.monthNumber === monthNumber
    );
  }

  /**
   * Create and process a monthly retainer payment
   */
  private async createMonthlyPayment(contract: any, monthNumber: number): Promise<boolean> {
    console.log(`[Retainer Scheduler] Creating monthly payment for contract ${contract.id}, month ${monthNumber}`);

    const monthlyAmount = parseFloat(contract.monthlyAmount);

    // Calculate fees with per-company override support (Section 4.3.H)
    const fees = await calculateFees(monthlyAmount, contract.companyId);

    // Create the payment record
    const payment = await storage.createRetainerPayment({
      contractId: contract.id,
      deliverableId: null, // No specific deliverable for monthly payments
      creatorId: contract.assignedCreatorId,
      companyId: contract.companyId,
      monthNumber: monthNumber,
      paymentType: 'monthly',
      grossAmount: fees.grossAmount.toFixed(2),
      platformFeeAmount: fees.platformFeeAmount.toFixed(2),
      processingFeeAmount: fees.stripeFeeAmount.toFixed(2),
      netAmount: fees.netAmount.toFixed(2),
      amount: fees.grossAmount.toFixed(2), // For backwards compatibility
      status: 'pending',
      description: `Monthly retainer payment for ${contract.title} - Month ${monthNumber}`,
      initiatedAt: new Date(),
    });

    const feeLabel = fees.isCustomFee ? `Custom ${formatFeePercentage(fees.platformFeePercentage)}` : formatFeePercentage(DEFAULT_PLATFORM_FEE_PERCENTAGE);
    console.log(`[Retainer Scheduler] Created payment ${payment.id} of $${fees.netAmount.toFixed(2)} (net) - Platform Fee: ${feeLabel}`);

    // Validate creator has payment settings
    const validation = await paymentProcessor.validateCreatorPaymentSettings(contract.assignedCreatorId);

    if (!validation.valid) {
      console.warn(`[Retainer Scheduler] Creator ${contract.assignedCreatorId} has no payment method - payment created as pending`);

      await storage.updateRetainerPaymentStatus(payment.id, 'pending', {
        description: `${payment.description}. PENDING: ${validation.error}`,
      });

      // Notify creator to configure payment method
      await this.notificationService.sendNotification(
        contract.assignedCreatorId,
        'payment_pending',
        'Payment Method Required',
        `Your monthly retainer payment of $${fees.netAmount.toFixed(2)} for "${contract.title}" is pending. Please configure your payment method to receive funds.`,
        {
          linkUrl: '/settings/payment',
        }
      );

      return false;
    }

    // Process the payment
    const paymentResult = await paymentProcessor.processRetainerPayment(payment.id);

    if (paymentResult.success) {
      // Update payment as completed
      await storage.updateRetainerPaymentStatus(payment.id, 'completed', {
        providerTransactionId: paymentResult.transactionId,
        providerResponse: paymentResult.providerResponse,
        completedAt: new Date(),
      });

      console.log(`[Retainer Scheduler] Successfully processed payment ${payment.id} - TX: ${paymentResult.transactionId}`);

      // Notify creator about successful payment
      const creator = await storage.getUserById(contract.assignedCreatorId);
      if (creator) {
        await this.notificationService.sendNotification(
          contract.assignedCreatorId,
          'payment_received',
          'Monthly Retainer Payment Received! 💰',
          `$${fees.netAmount.toFixed(2)} has been sent to your payment method for month ${monthNumber} of "${contract.title}". Transaction ID: ${paymentResult.transactionId}`,
          {
            userName: creator.firstName || creator.username,
            offerTitle: contract.title,
            amount: `$${fees.netAmount.toFixed(2)}`,
            grossAmount: `$${fees.grossAmount.toFixed(2)}`,
            platformFee: `$${fees.platformFeeAmount.toFixed(2)}`,
            processingFee: `$${fees.stripeFeeAmount.toFixed(2)}`,
            transactionId: paymentResult.transactionId,
            paymentId: payment.id,
            linkUrl: `/payments/${payment.id}`,
          }
        );
      }

      return true;
    } else {
      // Payment failed
      await storage.updateRetainerPaymentStatus(payment.id, 'failed', {
        failedAt: new Date(),
        description: `${payment.description}. FAILED: ${paymentResult.error}`,
      });

      console.error(`[Retainer Scheduler] Failed to process payment ${payment.id}: ${paymentResult.error}`);

      // Notify admin about failed payment
      // TODO: Send admin notification

      return false;
    }
  }

  /**
   * Process a single contract's monthly payment (for manual triggering)
   */
  async processContractMonthlyPayment(contractId: string): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      const contract = await storage.getRetainerContract(contractId);

      if (!contract) {
        return { success: false, error: 'Contract not found' };
      }

      if (contract.status !== 'active') {
        return { success: false, error: 'Contract is not active' };
      }

      if (!contract.assignedCreatorId) {
        return { success: false, error: 'Contract has no assigned creator' };
      }

      const currentMonth = this.getCurrentMonthNumber(contract);
      const existingPayment = await this.getMonthlyPayment(contract.id, currentMonth);

      if (existingPayment) {
        return {
          success: false,
          error: `Payment already exists for month ${currentMonth}`,
          paymentId: existingPayment.id,
        };
      }

      const created = await this.createMonthlyPayment(contract, currentMonth);

      if (created) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to create payment' };
      }
    } catch (error: any) {
      console.error(`[Retainer Scheduler] Error processing contract ${contractId}:`, error);
      return { success: false, error: error.message };
    }
  }
}
