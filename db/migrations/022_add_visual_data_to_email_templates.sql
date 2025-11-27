-- Migration: Add visual_data column to email_templates table
-- This stores the visual builder block structure for UI-based email editing

ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS visual_data JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN email_templates.visual_data IS 'Visual email builder data containing blocks, header settings, and other UI configuration';
