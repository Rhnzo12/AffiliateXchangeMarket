-- Migration: Add deleted_for column to messages table for soft delete functionality
-- This allows users to delete messages "for me" without removing them from the other user's view

-- Add deleted_for column as text array to track which users have deleted the message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for faster filtering when fetching messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted_for ON messages USING GIN (deleted_for);

-- Comment on column
COMMENT ON COLUMN messages.deleted_for IS 'Array of user IDs who have deleted this message for themselves';
