-- Migration: Create email_templates table for admin-managed email templates
-- This enables admins to customize email content without code changes

-- Create enum type for email template categories
DO $$ BEGIN
  CREATE TYPE email_template_category AS ENUM (
    'application',
    'payment',
    'offer',
    'company',
    'system',
    'moderation',
    'authentication'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category email_template_category NOT NULL,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  visual_data JSONB, -- Visual email builder data (blocks, header, etc.)
  description TEXT,
  available_variables TEXT[] DEFAULT ARRAY[]::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  updated_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS email_templates_slug_idx ON email_templates(slug);
CREATE INDEX IF NOT EXISTS email_templates_category_idx ON email_templates(category);
CREATE INDEX IF NOT EXISTS email_templates_is_active_idx ON email_templates(is_active);

-- Add comment to table
COMMENT ON TABLE email_templates IS 'Admin-managed email templates with variable substitution support';
COMMENT ON COLUMN email_templates.slug IS 'Unique identifier used to lookup templates (e.g., application-status-change)';
COMMENT ON COLUMN email_templates.html_content IS 'HTML email content with {{variable}} placeholders';
COMMENT ON COLUMN email_templates.available_variables IS 'List of variable names that can be used in this template';
COMMENT ON COLUMN email_templates.is_system IS 'System templates cannot be deleted, only deactivated';
