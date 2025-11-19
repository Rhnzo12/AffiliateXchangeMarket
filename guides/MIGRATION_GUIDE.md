# Database Migration Guide

This guide helps you export your AffiliateXchange data from Replit and run it elsewhere.

## Option 1: Export to JSON (Recommended for Small Datasets)

### Step 1: Export Your Data

Run the export script:
```bash
npm run tsx scripts/export-database.ts
```

This creates a `database-export-[timestamp].json` file with all your data.

### Step 2: Download the Export File

Click on the exported JSON file in the Files panel and download it to your computer.

---

## Option 2: PostgreSQL Dump (Recommended for Large Datasets)

### Step 1: Export as SQL

In the Replit Shell, run:
```bash
pg_dump $DATABASE_URL > database-dump.sql
```

### Step 2: Download the SQL File

Download `database-dump.sql` from the Files panel.

---

## Setting Up a New Database

### Option A: Neon.tech (Same Provider as Replit)

1. Go to [neon.tech](https://neon.tech)
2. Create a free account
3. Create a new project
4. Copy the connection string
5. It will look like: `postgresql://user:pass@host.neon.tech/dbname`

### Option B: Supabase (Free Tier Available)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (use the "Connection pooling" one)

### Option C: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database:
   ```bash
   createdb affiliatexchange
   ```
3. Connection string: `postgresql://localhost/affiliatexchange`

---

## Importing Your Data

### Method 1: Import from JSON

1. Set up your new database URL:
   ```bash
   export DATABASE_URL="your-new-database-url"
   ```

2. Run schema migrations:
   ```bash
   npm run db:push
   ```

3. Create an import script or manually insert data using the exported JSON

### Method 2: Import from SQL Dump

1. Run the import:
   ```bash
   psql your-new-database-url < database-dump.sql
   ```

---

## Running the Project Elsewhere

### Step 1: Clone/Download Your Code

Download all project files from Replit.

### Step 2: Set Environment Variables

Create a `.env` file:
```env
DATABASE_URL=your-new-database-url
SESSION_SECRET=your-session-secret
NODE_ENV=development

# Optional: Stripe keys if using payments
STRIPE_SECRET_KEY=your-stripe-key
VITE_STRIPE_PUBLIC_KEY=your-public-key
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run Migrations

```bash
npm run db:push
```

### Step 5: Start the App

```bash
npm run dev
```

Your app should now be running with your data!

---

## Important Notes

### Security Considerations

1. **Passwords**: The JSON export excludes password hashes for security. Users will need to reset passwords.
2. **Environment Secrets**: Never commit `.env` files to version control
3. **API Keys**: You'll need to set up new Stripe/payment keys if using those features

### File Storage

If you've uploaded files (images, videos) to Replit's Object Storage, you'll need to:
1. Download those files manually
2. Upload them to a new storage service (AWS S3, Google Cloud Storage, Cloudflare R2, etc.)
3. Update the URLs in your database

### What's Portable

✅ **Included in export:**
- All user accounts (except passwords)
- Creator and company profiles
- Offers and applications
- Messages and conversations
- Reviews and ratings
- Click tracking data
- Payment records

❌ **Not included:**
- Password hashes (security)
- Active sessions
- Uploaded files (images/videos)
- Stripe connection data

---

## Testing Your Migration

1. Start with a test database first
2. Import a small sample of data
3. Test all features work correctly
4. Then do the full migration

---

## Troubleshooting

### "Permission denied" error
- Make sure your new database user has CREATE/INSERT permissions

### Missing tables
- Run `npm run db:push` to create the schema first

### Connection timeout
- Check your DATABASE_URL is correct
- Verify firewall/network settings allow database connections

---

## Need Help?

- Check the Replit database documentation
- Review the PostgreSQL documentation
- Contact your hosting provider's support

---

## Quick Reference: npm Scripts

```bash
# Export data to JSON
npm run tsx scripts/export-database.ts

# Push schema to database
npm run db:push

# Start development server
npm run dev
```
