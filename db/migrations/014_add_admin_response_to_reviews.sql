-- Add missing columns to reviews table to match schema
-- These columns are defined in shared/schema.ts but missing in the database

-- Add columns without FK constraint first
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamp,
  ADD COLUMN IF NOT EXISTS responded_by varchar,
  ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by varchar,
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Add foreign key constraint for responded_by (if column was just created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_responded_by_users_id_fk'
  ) THEN
    ALTER TABLE reviews
    ADD CONSTRAINT reviews_responded_by_users_id_fk
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
