# Applying Migration 011: Add Creator Requirements Fields

## What this migration does
This migration adds structured creator requirements fields to the `offers` table. These fields allow companies to specify detailed requirements for creators who want to apply to their offers:

- `minimum_followers` - Minimum follower/subscriber count required
- `allowed_platforms` - Array of allowed platforms (YouTube, TikTok, Instagram, etc.)
- `geographic_restrictions` - Array of allowed countries/regions
- `age_restriction` - Age restrictions for creator audiences (18+, 21+)
- `content_style_requirements` - Description of desired content style
- `brand_safety_requirements` - Brand safety guidelines and restrictions

## How to run this migration

### Option 1: Using psql command line
```bash
psql $DATABASE_URL -f db/migrations/011_add_creator_requirements_fields.sql
```

### Option 2: Using a PostgreSQL client
1. Connect to your database
2. Execute the SQL file `db/migrations/011_add_creator_requirements_fields.sql`

### Option 3: Copy and paste
Open your database client and run the SQL commands from `011_add_creator_requirements_fields.sql`

### Option 4: For Replit/Cloud environments
If your database URL is stored in Replit secrets or environment variables:
```bash
# Export the DATABASE_URL first
export DATABASE_URL="your_database_url_here"

# Then run the migration
psql $DATABASE_URL -f db/migrations/011_add_creator_requirements_fields.sql
```

## Verification
After running the migration, you can verify the columns were added:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'offers'
AND column_name IN (
  'minimum_followers',
  'allowed_platforms',
  'geographic_restrictions',
  'age_restriction',
  'content_style_requirements',
  'brand_safety_requirements'
);
```

You should see all 6 new columns listed.

## What happens after migration
Once this migration is applied:
1. Existing offers will have these fields set to NULL or default values
2. New offers created through the company dashboard will populate these fields
3. The creator-side offer detail page will display these requirements
4. Creators can see detailed requirements before applying to offers

## Rollback (if needed)
To remove these columns (not recommended if data exists):
```sql
ALTER TABLE offers DROP COLUMN IF EXISTS minimum_followers;
ALTER TABLE offers DROP COLUMN IF EXISTS allowed_platforms;
ALTER TABLE offers DROP COLUMN IF EXISTS geographic_restrictions;
ALTER TABLE offers DROP COLUMN IF EXISTS age_restriction;
ALTER TABLE offers DROP COLUMN IF EXISTS content_style_requirements;
ALTER TABLE offers DROP COLUMN IF EXISTS brand_safety_requirements;
```
