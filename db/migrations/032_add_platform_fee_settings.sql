-- Migration: Add platform fee settings to platform_settings table
-- This makes fee percentages configurable via admin UI instead of hardcoded

-- Insert default platform fee settings
INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'platform_fee_percentage', '4', 'Platform fee percentage (e.g., 4 for 4%)', 'fees', NOW(), NOW()),
  (gen_random_uuid(), 'stripe_processing_fee_percentage', '3', 'Stripe processing fee percentage (e.g., 3 for 3%)', 'fees', NOW(), NOW()),
  (gen_random_uuid(), 'minimum_payout_threshold', '50', 'Minimum balance required for payout in dollars', 'fees', NOW(), NOW()),
  (gen_random_uuid(), 'payout_reserve_percentage', '10', 'Percentage held in reserve for chargebacks', 'fees', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert payment configuration settings
INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'payment_settlement_schedule', 'weekly', 'How often payouts are processed (daily, weekly, monthly)', 'general', NOW(), NOW()),
  (gen_random_uuid(), 'payment_auto_disburse', 'true', 'Automatically disburse payments when threshold is met', 'general', NOW(), NOW()),
  (gen_random_uuid(), 'payment_notification_email', 'payments@affiliatexchange.com', 'Email for payment notifications', 'general', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert platform limit settings
INSERT INTO platform_settings (id, key, value, description, category, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'max_offers_per_company', '50', 'Maximum number of active offers per company', 'limits', NOW(), NOW()),
  (gen_random_uuid(), 'max_applications_per_creator', '20', 'Maximum pending applications per creator', 'limits', NOW(), NOW()),
  (gen_random_uuid(), 'max_message_length', '5000', 'Maximum characters per message', 'limits', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
