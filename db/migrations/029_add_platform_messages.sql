-- Migration: Add sender_type column to messages table for admin platform messaging
-- This allows admins to send messages as "platform" instead of a regular user

-- Add sender_type column to distinguish between regular user messages and platform/admin messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type VARCHAR(20) DEFAULT 'user';

-- Create index for faster filtering by sender type
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages (sender_type);

-- Comment on column
COMMENT ON COLUMN messages.sender_type IS 'Type of message sender: user (regular) or platform (admin)';
