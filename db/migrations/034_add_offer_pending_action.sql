-- ========================================
-- Migration: Add offer pending action support
-- Description: Adds notification types and fields for offer delete/suspend approval workflow
-- ========================================

-- Add new notification type values for offer delete/suspend requests and approvals
-- Note: These cannot be rolled back easily in PostgreSQL
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_delete_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_delete_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_delete_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_suspend_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_suspend_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'offer_suspend_rejected';

-- Create enum for offer pending actions
DO $$ BEGIN
    CREATE TYPE offer_pending_action AS ENUM ('delete', 'suspend');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add pending action columns to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pending_action offer_pending_action;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pending_action_requested_at TIMESTAMP;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pending_action_reason TEXT;

-- ========================================
-- Migration complete
-- ========================================
