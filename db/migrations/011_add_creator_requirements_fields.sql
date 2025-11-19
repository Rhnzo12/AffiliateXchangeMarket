-- Add structured creator requirements fields to offers table
-- These fields were added to the schema but never migrated to the database

-- Add minimum followers field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS minimum_followers INTEGER;

-- Add allowed platforms array field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS allowed_platforms TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add geographic restrictions array field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS geographic_restrictions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add age restriction field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS age_restriction VARCHAR;

-- Add content style requirements field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS content_style_requirements TEXT;

-- Add brand safety requirements field
ALTER TABLE offers ADD COLUMN IF NOT EXISTS brand_safety_requirements TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_offers_minimum_followers ON offers(minimum_followers);
CREATE INDEX IF NOT EXISTS idx_offers_allowed_platforms ON offers USING GIN(allowed_platforms);
CREATE INDEX IF NOT EXISTS idx_offers_geographic_restrictions ON offers USING GIN(geographic_restrictions);
CREATE INDEX IF NOT EXISTS idx_offers_age_restriction ON offers(age_restriction);
