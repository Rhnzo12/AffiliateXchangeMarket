-- Create niches table
-- This migrates niches from JSON storage in platform_settings to a dedicated table

-- 1. Create niches table
CREATE TABLE IF NOT EXISTS niches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_niches_name ON niches(name);
CREATE INDEX IF NOT EXISTS idx_niches_active ON niches(is_active);

-- 2. Migrate existing niches from platform_settings JSON to new table
-- This safely extracts niches from the JSON value and inserts them
DO $$
DECLARE
  niches_json text;
  niche_record json;
BEGIN
  -- Get the niches value from platform_settings
  SELECT value INTO niches_json
  FROM platform_settings
  WHERE key = 'niches'
  LIMIT 1;

  -- Only proceed if niches exist in platform_settings
  IF niches_json IS NOT NULL THEN
    -- Parse and insert each niche
    FOR niche_record IN SELECT * FROM json_array_elements(niches_json::json)
    LOOP
      INSERT INTO niches (id, name, description, is_active, created_at, updated_at)
      VALUES (
        (niche_record->>'id')::varchar,
        (niche_record->>'name')::varchar,
        COALESCE((niche_record->>'description')::text, ''),
        COALESCE((niche_record->>'isActive')::boolean, true),
        COALESCE((niche_record->>'createdAt')::timestamp, now()),
        COALESCE((niche_record->>'updatedAt')::timestamp, now())
      )
      ON CONFLICT (name) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 3. If no niches were migrated, insert default niches
INSERT INTO niches (name, description, is_active)
SELECT 'Tech & Gadgets', 'Technology products and gadgets', true
WHERE NOT EXISTS (SELECT 1 FROM niches LIMIT 1);

INSERT INTO niches (name, description, is_active)
SELECT 'Beauty & Skincare', 'Beauty and skincare products', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Beauty & Skincare');

INSERT INTO niches (name, description, is_active)
SELECT 'Fashion & Apparel', 'Fashion and clothing products', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Fashion & Apparel');

INSERT INTO niches (name, description, is_active)
SELECT 'Health & Fitness', 'Health and fitness products and services', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Health & Fitness');

INSERT INTO niches (name, description, is_active)
SELECT 'Home & Living', 'Home improvement and lifestyle products', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Home & Living');

INSERT INTO niches (name, description, is_active)
SELECT 'Food & Beverage', 'Food and beverage products', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Food & Beverage');

INSERT INTO niches (name, description, is_active)
SELECT 'Gaming & Entertainment', 'Gaming and entertainment products', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Gaming & Entertainment');

INSERT INTO niches (name, description, is_active)
SELECT 'Travel & Lifestyle', 'Travel and lifestyle services', true
WHERE NOT EXISTS (SELECT 1 FROM niches WHERE name = 'Travel & Lifestyle');

-- Migration complete
