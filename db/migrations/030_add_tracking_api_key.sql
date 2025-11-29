-- Migration: Add missing columns to company_profiles
-- Includes tracking API key fields and rejection retry restriction fields

-- Add tracking_api_key column (64 character key for API authentication)
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS tracking_api_key VARCHAR(64) DEFAULT NULL;

-- Add tracking_api_key_created_at column (timestamp when key was generated)
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS tracking_api_key_created_at TIMESTAMP DEFAULT NULL;

-- Add rejection retry restriction columns
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMP DEFAULT NULL;

ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

-- Add comments explaining the fields
COMMENT ON COLUMN company_profiles.tracking_api_key IS 'API key for postback/tracking integrations. NULL means no key has been generated.';
COMMENT ON COLUMN company_profiles.tracking_api_key_created_at IS 'Timestamp when the tracking API key was created/regenerated.';
COMMENT ON COLUMN company_profiles.last_rejected_at IS 'Timestamp when the company registration was last rejected.';
COMMENT ON COLUMN company_profiles.rejection_count IS 'Number of times the company registration has been rejected.';

-- Create index for API key lookups
CREATE INDEX IF NOT EXISTS idx_company_profiles_tracking_api_key ON company_profiles(tracking_api_key) WHERE tracking_api_key IS NOT NULL;
