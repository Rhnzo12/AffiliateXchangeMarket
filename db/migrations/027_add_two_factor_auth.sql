-- Migration: Add Two-Factor Authentication (2FA) fields to users table
-- This migration adds support for TOTP-based 2FA with backup codes

-- Add 2FA columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64),
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT;

-- Add index on two_factor_enabled for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Comment on columns for documentation
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret for authenticator apps';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'JSON array of hashed backup codes for recovery';
