-- Migration: Migrate reviews table from old to new schema
-- Date: 2025-10-30
-- Description: Update reviews table to match TypeScript schema while preserving existing data

-- Step 1: Add all new columns (safe to run multiple times)
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

-- Step 2: Migrate existing data from old columns to new columns
-- Copy 'rating' to 'overall_rating' where overall_rating is null
UPDATE reviews
SET overall_rating = rating
WHERE overall_rating IS NULL AND rating IS NOT NULL;

-- Copy 'admin_notes' to 'admin_note' where admin_note is null
UPDATE reviews
SET admin_note = admin_notes
WHERE admin_note IS NULL AND admin_notes IS NOT NULL;

-- Copy 'edited_by_admin' to 'is_edited' where is_edited is false/null
UPDATE reviews
SET is_edited = edited_by_admin
WHERE edited_by_admin = true AND (is_edited IS NULL OR is_edited = false);

-- Step 3: Extract category ratings from JSONB to individual columns (if category_ratings exists and has data)
-- This handles the old format where ratings were stored in a JSONB column
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

-- Step 4: Set default values for new columns where they're still null
UPDATE reviews
SET is_edited = false
WHERE is_edited IS NULL;

UPDATE reviews
SET is_approved = true
WHERE is_approved IS NULL;

UPDATE reviews
SET is_hidden = false
WHERE is_hidden IS NULL;

-- Step 5: Make overall_rating NOT NULL (only if all rows have been migrated)
-- First check if there are any null values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM reviews WHERE overall_rating IS NULL) THEN
    ALTER TABLE reviews ALTER COLUMN overall_rating SET NOT NULL;
  ELSE
    RAISE NOTICE 'Warning: Some reviews still have NULL overall_rating. Manual review needed.';
  END IF;
END
$$;

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_application_id ON reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_reviews_creator_id ON reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved) WHERE is_approved = true;

-- Migration complete
-- Note: Old columns (rating, admin_notes, edited_by_admin, category_ratings, status) are preserved
-- They can be dropped later after verifying the migration worked correctly
