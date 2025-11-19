-- Adds the missing 'paused' status to the application_status enum.
-- Run with: psql $DATABASE_URL -f db/migrations/012_add_paused_application_status.sql
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'paused';
