-- Add advanced niche management features
-- Adds display_order for drag-and-drop reordering and is_primary flag

-- 1. Add display_order column for custom ordering
ALTER TABLE niches ADD COLUMN IF NOT EXISTS display_order integer;

-- 2. Add is_primary column to mark the primary niche
ALTER TABLE niches ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- 3. Create index for display_order for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_niches_display_order ON niches(display_order);

-- 4. Initialize display_order based on current alphabetical order
WITH ordered_niches AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM niches
)
UPDATE niches
SET display_order = ordered_niches.rn
FROM ordered_niches
WHERE niches.id = ordered_niches.id
AND niches.display_order IS NULL;

-- 5. Set the first active niche as primary if none is set
UPDATE niches
SET is_primary = true
WHERE id = (
  SELECT id FROM niches
  WHERE is_active = true
  ORDER BY display_order, name
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM niches WHERE is_primary = true);

-- Migration complete
