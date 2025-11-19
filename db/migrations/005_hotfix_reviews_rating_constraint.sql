-- HOTFIX: Remove NOT NULL constraint from old rating column
-- This allows new reviews to be inserted with overall_rating instead of rating
-- Run this IMMEDIATELY to fix the insert error

-- Remove NOT NULL constraint from old 'rating' column
ALTER TABLE reviews ALTER COLUMN rating DROP NOT NULL;

-- Add new columns if they don't exist (idempotent)
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

-- Migrate existing data from old columns to new columns
UPDATE reviews
SET overall_rating = rating
WHERE overall_rating IS NULL AND rating IS NOT NULL;

UPDATE reviews
SET admin_note = admin_notes
WHERE admin_note IS NULL AND admin_notes IS NOT NULL;

UPDATE reviews
SET is_edited = edited_by_admin
WHERE edited_by_admin = true AND (is_edited IS NULL OR is_edited = false);

-- Extract category ratings from JSONB to individual columns
UPDATE reviews
SET
  payment_speed_rating = COALESCE((category_ratings->>'payment_speed')::integer, (category_ratings->>'paymentSpeed')::integer, (category_ratings->>'payment_timing')::integer),
  communication_rating = COALESCE((category_ratings->>'communication')::integer, (category_ratings->>'responsiveness')::integer),
  offer_quality_rating = COALESCE((category_ratings->>'offer_quality')::integer, (category_ratings->>'offerQuality')::integer, (category_ratings->>'quality')::integer),
  support_rating = COALESCE((category_ratings->>'support')::integer, (category_ratings->>'customer_support')::integer)
WHERE category_ratings IS NOT NULL
  AND (
    payment_speed_rating IS NULL
    OR communication_rating IS NULL
    OR offer_quality_rating IS NULL
    OR support_rating IS NULL
  );

-- Set defaults for new boolean columns
UPDATE reviews SET is_edited = false WHERE is_edited IS NULL;
UPDATE reviews SET is_approved = true WHERE is_approved IS NULL;
UPDATE reviews SET is_hidden = false WHERE is_hidden IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_application_id ON reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_reviews_creator_id ON reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved) WHERE is_approved = true;

-- Migration complete
