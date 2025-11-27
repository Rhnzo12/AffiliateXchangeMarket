-- Migration: Add per-company custom platform fee override
-- This allows the platform to set special fee percentages for specific companies
-- NULL means the company uses the default platform fee (4%)

-- Add custom_platform_fee_percentage column to company_profiles
ALTER TABLE company_profiles
ADD COLUMN custom_platform_fee_percentage DECIMAL(5, 4) DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN company_profiles.custom_platform_fee_percentage IS 'Custom platform fee percentage for this company (0.01 = 1%). NULL means default fee applies.';

-- Create index for companies with custom fees (for reporting/admin queries)
CREATE INDEX idx_company_profiles_custom_fee ON company_profiles(custom_platform_fee_percentage) WHERE custom_platform_fee_percentage IS NOT NULL;
