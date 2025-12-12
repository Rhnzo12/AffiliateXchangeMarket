-- Add deliverable notification type values to existing enum
-- Note: Using DO block to safely add values only if they don't exist

DO $$
BEGIN
    -- Add deliverable_submitted if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deliverable_submitted' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'deliverable_submitted';
    END IF;
END$$;

DO $$
BEGIN
    -- Add deliverable_resubmitted if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deliverable_resubmitted' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'deliverable_resubmitted';
    END IF;
END$$;

DO $$
BEGIN
    -- Add deliverable_rejected if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deliverable_rejected' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'deliverable_rejected';
    END IF;
END$$;

DO $$
BEGIN
    -- Add revision_requested if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'revision_requested' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'revision_requested';
    END IF;
END$$;
