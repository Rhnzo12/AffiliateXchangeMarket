-- Migration: Fix reviews table schema
-- Date: 2025-10-30
-- Description: Ensure reviews table has all required columns matching the TypeScript schema

-- Create reviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  review_text text,
  overall_rating integer NOT NULL,
  payment_speed_rating integer,
  communication_rating integer,
  offer_quality_rating integer,
  support_rating integer,
  company_response text,
  company_responded_at timestamp,
  is_edited boolean DEFAULT false,
  admin_note text,
  is_approved boolean DEFAULT true,
  approved_by uuid,
  approved_at timestamp,
  is_hidden boolean DEFAULT false,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Add missing columns if they don't exist (for existing tables)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_text text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS overall_rating integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS payment_speed_rating integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS communication_rating integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS offer_quality_rating integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS support_rating integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS company_response text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS company_responded_at timestamp;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Ensure created_at and updated_at exist
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW();
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_application_id ON reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_reviews_creator_id ON reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved) WHERE is_approved = true;

-- Migration complete
