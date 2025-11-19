-- Add Google OAuth support to users table
-- This adds googleId field for OAuth users and makes password optional

-- Add googleId column if it doesn't exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar UNIQUE;

-- Make password nullable to support OAuth users without passwords
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Add index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Migration complete
