-- Migration: Add website verification fields to company_profiles
-- This enables automated website verification via Meta tag or DNS TXT record

-- Create enum for verification method
DO $$ BEGIN
  CREATE TYPE website_verification_method AS ENUM ('meta_tag', 'dns_txt');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add website verification fields to company_profiles table
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS website_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS website_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS website_verification_method website_verification_method,
ADD COLUMN IF NOT EXISTS website_verified_at TIMESTAMP;

-- Add index for faster lookup of verification tokens
CREATE INDEX IF NOT EXISTS idx_company_profiles_verification_token
ON company_profiles(website_verification_token)
WHERE website_verification_token IS NOT NULL;

-- Add index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_company_profiles_website_verified
ON company_profiles(website_verified);
