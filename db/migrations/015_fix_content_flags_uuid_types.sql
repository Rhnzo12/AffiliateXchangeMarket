-- Migration: Fix content_flags UUID type mismatches
-- Date: 2025-11-23
-- Description: Convert content_flags VARCHAR columns to UUID to match users table

-- Convert content_flags columns to UUID
ALTER TABLE content_flags
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid,
  ALTER COLUMN reviewed_by TYPE uuid USING reviewed_by::uuid;

-- Convert banned_keywords columns to UUID
ALTER TABLE banned_keywords
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN created_by TYPE uuid USING created_by::uuid;

-- Migration complete
