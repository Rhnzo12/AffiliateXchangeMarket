# Apply Migration 008: Add Payment Notification Types

## Problem
The database errors:
```
invalid input value for enum notification_type: "payment_failed_insufficient_funds"
invalid input value for enum notification_type: "payment_approved"
```

These occur because the `notification_type` enum in the database doesn't include these values.

## Solution
Run the migration to add both notification types to the enum.

## How to Run the Migration

### Option 1: Using the migration script (Recommended)
```bash
npx tsx scripts/run-migration-008.ts
```

### Option 2: Using psql command line
```bash
psql $DATABASE_URL -f db/migrations/008_add_insufficient_funds_notification.sql
```

### Option 3: Direct SQL (if you have database access)
Connect to your PostgreSQL database and run:
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_approved';
```

### Option 4: Using your database client (Neon, Supabase, etc.)
1. Open your database client (e.g., Neon Console, pgAdmin, DBeaver)
2. Connect to your database
3. Execute these SQL commands:
   ```sql
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed_insufficient_funds';
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_approved';
   ```

## Verification
After running the migration:
1. Restart your server
2. Process a payment (successful or failed)
3. Check the logs - you should see:
   ```
   [Storage] Notification created successfully: ...
   [Notifications] In-app notification created for user...
   ```
4. Check the company's notification bell - notifications should appear!

## What This Fixes
- ✅ In-app notifications for insufficient funds will be created and saved to database
- ✅ In-app notifications for successful payments will be created and saved to database
- ✅ Company users will see both success and failure notifications in the notification bell
- ✅ Clicking notifications will navigate to payment details
- ✅ Email notifications already work (this fixes the in-app part)

## Notification Types Added
1. **payment_failed_insufficient_funds** - When PayPal account has insufficient funds
2. **payment_approved** - When payment is successfully sent to creator
