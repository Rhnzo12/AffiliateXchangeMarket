-- Add password change OTP fields to users table
-- This adds one-time password verification for password change security

-- Add password change OTP column if it doesn't exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_otp varchar;

-- Add password change OTP expiry column if it doesn't exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_otp_expiry timestamp;

-- Add index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_users_password_change_otp ON users(password_change_otp) WHERE password_change_otp IS NOT NULL;

-- Migration complete
