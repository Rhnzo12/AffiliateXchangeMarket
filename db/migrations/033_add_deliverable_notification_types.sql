-- ========================================
-- Migration: Add deliverable notification types to notification_type enum
-- Description: Adds notification types for retainer deliverable events (video uploads)
-- ========================================

-- Add new notification type values for deliverable events
-- Note: These cannot be rolled back easily in PostgreSQL
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deliverable_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deliverable_resubmitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deliverable_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'revision_requested';

-- ========================================
-- Migration complete
-- ========================================
