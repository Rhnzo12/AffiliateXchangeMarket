# 🔴 CRITICAL: Apply Reviews Migration

## The Problem
Your reviews table has the OLD schema. Reviews are not saving because:
1. The old `rating` column has a NOT NULL constraint
2. The code is trying to insert into `overall_rating` (new column)
3. Result: **"null value in column "rating" violates not-null constraint"**

**Current Database:**
- Has: `rating` (NOT NULL), `category_ratings` (JSONB), `status`, `edited_by_admin`, `admin_notes`
- Missing: `overall_rating`, `payment_speed_rating`, `communication_rating`, etc.

## The Solution
Run the HOTFIX migration to update your database schema.

## ⚡ QUICK FIX (Run This Now!)

### Option 1: Using psql (Recommended)
```bash
psql $DATABASE_URL -f db/migrations/005_hotfix_reviews_rating_constraint.sql
```

### Option 2: Using Database Client
1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open and execute: `db/migrations/005_hotfix_reviews_rating_constraint.sql`

### Option 3: If you have connection string
```bash
psql "postgresql://username:password@host:port/database" -f db/migrations/005_hotfix_reviews_rating_constraint.sql
```

## What This Migration Does

1. **🔥 REMOVES NOT NULL constraint from old `rating` column** (CRITICAL FIX)
   - This allows new reviews to be inserted without failing
   - The code uses `overall_rating` now, not `rating`

2. **Adds new columns** (safe, won't break existing data)
   - `overall_rating`, `payment_speed_rating`, `communication_rating`, `offer_quality_rating`, `support_rating`
   - `company_response`, `company_responded_at`
   - `is_edited`, `admin_note`, `is_approved`, `approved_by`, `approved_at`, `is_hidden`

3. **Migrates existing data**
   - Copies `rating` → `overall_rating`
   - Copies `admin_notes` → `admin_note`
   - Copies `edited_by_admin` → `is_edited`
   - Extracts individual ratings from `category_ratings` JSONB

4. **Adds performance indexes**

5. **Preserves old columns** (for safety, can be removed later)

## After Running the Migration

1. Restart your server
2. The error `[Storage] reviews column mismatch` should disappear
3. Reviews will start saving correctly
4. Existing reviews will be migrated automatically

## Verification

After running, check if it worked:
```sql
-- Check the new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reviews'
ORDER BY column_name;

-- Check if data was migrated
SELECT id, overall_rating, payment_speed_rating, company_response
FROM reviews
LIMIT 5;
```

## Rollback (if needed)
The old columns are preserved. If something goes wrong:
1. The old data is still there
2. You can manually copy it back if needed

## Need Help?
If you can't run the migration, provide:
1. Your database connection method (local, cloud, Replit)
2. Any error messages you get
