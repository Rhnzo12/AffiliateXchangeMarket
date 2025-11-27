-- Add account deletion OTP fields to users table
-- This adds one-time password verification for account deletion security

-- Add account deletion OTP column if it doesn't exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deletion_otp varchar;

-- Add account deletion OTP expiry column if it doesn't exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deletion_otp_expiry timestamp;

-- Add index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_users_account_deletion_otp ON users(account_deletion_otp) WHERE account_deletion_otp IS NOT NULL;

-- Migration complete
