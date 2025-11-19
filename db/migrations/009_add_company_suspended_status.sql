-- Add 'suspended' status to company_status enum
-- This allows admins to suspend companies from the platform

-- Add 'suspended' value to the company_status enum
ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'suspended';

-- Migration complete
