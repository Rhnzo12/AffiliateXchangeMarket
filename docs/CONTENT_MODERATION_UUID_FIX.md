# Content Moderation UUID Type Fix

## Problem

The Content Moderation Dashboard was showing an error:
```
operator does not exist: uuid = character varying
```

## Root Cause

The database schema has a type mismatch:
- `users.id` is stored as UUID (after the `fix_schema_types.sql` migration)
- `content_flags.user_id` and `content_flags.reviewed_by` are still VARCHAR
- `banned_keywords.id` and `banned_keywords.created_by` are still VARCHAR

When Drizzle ORM tries to join `content_flags` with `users` using the relation:
```typescript
content_flags.user_id = users.id
```

PostgreSQL fails because you can't compare UUID with VARCHAR without explicit casting.

## Solution

### 1. Run the Migration

Execute the migration to convert VARCHAR columns to UUID:

```bash
tsx scripts/run-migration-015.ts
```

This migration converts:
- `content_flags.id` → UUID
- `content_flags.user_id` → UUID
- `content_flags.reviewed_by` → UUID
- `banned_keywords.id` → UUID
- `banned_keywords.created_by` → UUID

### 2. Updated Drizzle Schema

The `shared/schema.ts` file has been updated to reflect the UUID types, ensuring consistency between the code and database.

## Files Modified

1. `db/migrations/015_fix_content_flags_uuid_types.sql` - SQL migration script
2. `shared/schema.ts` - Updated type definitions for `contentFlags` and `bannedKeywords`
3. `scripts/run-migration-015.ts` - Migration runner script
4. `server/routes.ts` - Reverted incorrect ::uuid casts (no longer needed)
5. `server/moderation/moderationService.ts` - Reverted incorrect ::uuid casts

## Safety Notes

- The migration uses `USING id::uuid` to safely convert existing UUIDs stored as VARCHAR
- Existing foreign key relationships will be maintained
- Make sure to backup your database before running the migration if you have production data
