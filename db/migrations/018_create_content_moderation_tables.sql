-- Content Moderation Tables Migration
-- Creates banned_keywords and content_flags tables with seed data

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE keyword_category AS ENUM ('profanity', 'spam', 'legal', 'harassment', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('message', 'review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'dismissed', 'action_taken');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create banned_keywords table
CREATE TABLE IF NOT EXISTS banned_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) NOT NULL,
    category keyword_category NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT true,
    severity INTEGER NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create content_flags table
CREATE TABLE IF NOT EXISTS content_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type content_type NOT NULL,
    content_id VARCHAR NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flag_reason TEXT NOT NULL,
    matched_keywords TEXT[] DEFAULT ARRAY[]::text[],
    status flag_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    action_taken TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_banned_keywords_active ON banned_keywords(is_active);
CREATE INDEX IF NOT EXISTS idx_banned_keywords_category ON banned_keywords(category);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);
CREATE INDEX IF NOT EXISTS idx_content_flags_content_type ON content_flags(content_type);
CREATE INDEX IF NOT EXISTS idx_content_flags_user_id ON content_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_created_at ON content_flags(created_at);

-- Seed default banned keywords for testing
INSERT INTO banned_keywords (keyword, category, severity, description, is_active)
VALUES
    ('scam', 'spam', 4, 'Potential scam-related content', true),
    ('fraud', 'legal', 5, 'Fraud-related term', true),
    ('guaranteed money', 'spam', 3, 'Misleading financial claims', true),
    ('get rich quick', 'spam', 3, 'Misleading financial claims', true),
    ('free money', 'spam', 3, 'Spam-like promotional content', true),
    ('testbadword', 'custom', 2, 'Test keyword for moderation testing', true),
    ('inappropriate', 'harassment', 3, 'General inappropriate content flag', true)
ON CONFLICT DO NOTHING;

-- Output confirmation
SELECT 'Content moderation tables created successfully' AS status;
