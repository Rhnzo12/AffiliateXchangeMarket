# Saved Searches SQL

The saved searches feature uses the following SQL schema to store creator filter presets:

```sql
-- Saved searches for creators
-- Provides reusable filter presets on the browse page.

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_creator ON saved_searches(creator_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at ON saved_searches(updated_at);
```
