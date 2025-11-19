-- Migration: Fix database schema type mismatches
-- Date: 2025-10-26
-- Description: Convert VARCHAR columns to UUID and add missing columns

-- Step 1: Fix analytics table
-- Backup existing data is recommended before running this

-- Truncate analytics if you don't have important data
-- If you have data, you'll need to export it first
TRUNCATE TABLE analytics CASCADE;

-- Convert VARCHAR columns to UUID
ALTER TABLE analytics
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN application_id TYPE uuid USING application_id::uuid,
  ALTER COLUMN offer_id TYPE uuid USING offer_id::uuid,
  ALTER COLUMN creator_id TYPE uuid USING creator_id::uuid;

-- Add foreign key constraints
ALTER TABLE analytics
  DROP CONSTRAINT IF EXISTS analytics_application_id_fkey,
  ADD CONSTRAINT analytics_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

-- Step 2: Fix click_events table to match TypeScript schema
DROP TABLE IF EXISTS click_events CASCADE;

CREATE TABLE click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  ip_address varchar(255),
  user_agent text,
  referer varchar(255),
  country varchar(255),
  city varchar(255),
  timestamp timestamp DEFAULT NOW()
);

-- Step 3: Add created_at to favorites table
ALTER TABLE favorites
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW();

-- Step 4: Update favorites to set created_at for existing records
UPDATE favorites SET created_at = NOW() WHERE created_at IS NULL;

-- Step 5: Fix messages table to match schema
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp DEFAULT NOW()
);

-- Step 6: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_application_id ON analytics(application_id);
CREATE INDEX IF NOT EXISTS idx_analytics_creator_id ON analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_click_events_application_id ON click_events(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Migration complete
