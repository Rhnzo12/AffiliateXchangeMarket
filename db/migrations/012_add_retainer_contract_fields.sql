-- Add monthly retainer contract fields for approval, exclusivity, scheduling, and tiers
ALTER TABLE retainer_contracts
  ADD COLUMN IF NOT EXISTS content_approval_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusivity_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_video_length_seconds integer,
  ADD COLUMN IF NOT EXISTS posting_schedule text,
  ADD COLUMN IF NOT EXISTS retainer_tiers jsonb DEFAULT '[]'::jsonb;

-- Backfill null booleans to maintain NOT NULL constraints
UPDATE retainer_contracts
SET content_approval_required = COALESCE(content_approval_required, false),
    exclusivity_required = COALESCE(exclusivity_required, false)
WHERE content_approval_required IS NULL OR exclusivity_required IS NULL;

-- Enforce booleans to be NOT NULL going forward
ALTER TABLE retainer_contracts
  ALTER COLUMN content_approval_required SET NOT NULL,
  ALTER COLUMN exclusivity_required SET NOT NULL;
