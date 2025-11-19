# Running Database Migrations

## For the reviews schema fix (003_fix_reviews_schema.sql)

### Option 1: Using psql command line
```bash
psql $DATABASE_URL -f db/migrations/003_fix_reviews_schema.sql
```

### Option 2: Using a PostgreSQL client
1. Connect to your database
2. Execute the SQL file `db/migrations/003_fix_reviews_schema.sql`

### Option 3: Copy and paste
Open your database client and run the SQL commands from `003_fix_reviews_schema.sql`

## What this migration does:
- Creates the reviews table if it doesn't exist
- Adds any missing columns to an existing reviews table
- Creates performance indexes on the reviews table
- Fixes the schema mismatch warning: `[Storage] reviews column mismatch while fetching company reviews`

## Verification
After running the migration, restart your server. You should no longer see the warning:
```
[Storage] reviews column mismatch while fetching company reviews - attempting legacy fallback.
```

## Note on notifications warning
The warning `[Storage] notifications relation missing while fetching notifications - returning empty array` can be fixed by running:
```bash
psql $DATABASE_URL -f db/migrations/002_add_notifications.sql
```

This creates the notifications table and related structures.
