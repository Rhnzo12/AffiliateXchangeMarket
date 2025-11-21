-- Migration: Add Stripe Connect account ID to payment settings
-- This enables Stripe Connect integration for e-transfer payments

-- Add stripe_account_id column to payment_settings table
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);

-- Add index for faster lookups by Stripe account ID
CREATE INDEX IF NOT EXISTS idx_payment_settings_stripe_account_id
ON payment_settings(stripe_account_id);

-- Add comment for documentation
COMMENT ON COLUMN payment_settings.stripe_account_id IS 'Stripe Connect account ID for creators receiving e-transfer payouts via Stripe Connect';
