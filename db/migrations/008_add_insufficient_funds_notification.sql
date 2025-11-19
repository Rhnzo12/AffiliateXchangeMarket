-- ========================================
-- Migration: Add payment notification types to notification_type enum
-- Description: Adds payment_failed_insufficient_funds and payment_approved notification types
-- ========================================

-- Add new notification type values to existing enum
-- Note: These cannot be rolled back easily in PostgreSQL
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_approved';

-- ========================================
-- Migration complete
-- ========================================
