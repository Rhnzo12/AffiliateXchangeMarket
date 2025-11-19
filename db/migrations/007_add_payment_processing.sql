-- Add payment processing features
-- This adds platform_funding_accounts table, payment provider tracking, and retainer payment enhancements

-- 1. Create platform_funding_accounts table
CREATE TABLE IF NOT EXISTS platform_funding_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  type varchar NOT NULL, -- 'bank', 'wallet', 'card'
  last4 varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'pending', -- 'active', 'pending', 'disabled'
  is_primary boolean DEFAULT false,
  bank_name varchar,
  account_holder_name varchar,
  routing_number varchar,
  account_number varchar,
  swift_code varchar,
  wallet_address text,
  wallet_network varchar,
  card_brand varchar,
  card_expiry varchar,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_funding_accounts_status
  ON platform_funding_accounts(status);
CREATE INDEX IF NOT EXISTS idx_platform_funding_accounts_primary
  ON platform_funding_accounts(is_primary) WHERE is_primary = true;

-- 2. Add payment provider tracking columns to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id varchar;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

-- Add index for provider transaction lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
  ON payments(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- 3. Enhance retainer_payments table for automated monthly payments
-- Make deliverable_id optional (monthly payments don't have a deliverable)
ALTER TABLE retainer_payments
  ALTER COLUMN deliverable_id DROP NOT NULL;

-- Add new columns for retainer payment processing
ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS month_number integer;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS payment_type varchar NOT NULL DEFAULT 'deliverable'; -- 'deliverable', 'monthly', 'bonus'

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS gross_amount decimal(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS platform_fee_amount decimal(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS processing_fee_amount decimal(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS net_amount decimal(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS provider_transaction_id varchar;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS payment_method varchar;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS initiated_at timestamp;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS completed_at timestamp;

ALTER TABLE retainer_payments
  ADD COLUMN IF NOT EXISTS failed_at timestamp;

-- Add indexes for retainer payment queries
CREATE INDEX IF NOT EXISTS idx_retainer_payments_creator
  ON retainer_payments(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retainer_payments_contract
  ON retainer_payments(contract_id, month_number);

CREATE INDEX IF NOT EXISTS idx_retainer_payments_status
  ON retainer_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retainer_payments_provider_tx
  ON retainer_payments(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- 4. Update existing retainer_payments to set gross_amount and net_amount from amount
-- This ensures backwards compatibility
UPDATE retainer_payments
SET gross_amount = amount,
    net_amount = amount
WHERE gross_amount = 0 OR net_amount = 0;

-- Migration complete
