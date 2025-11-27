/**
 * Seed script for Content Moderation test data
 * This script adds test banned keywords to the database for testing the moderation system
 *
 * Run with: npx tsx scripts/seed-moderation-keywords.ts
 * Or if the app is running, use the admin UI at /admin/keyword-management
 */

import pg from 'pg';

const { Pool } = pg;

const testKeywords = [
  { keyword: 'scam', category: 'spam', severity: 4, description: 'Potential scam-related content' },
  { keyword: 'fraud', category: 'legal', severity: 5, description: 'Fraud-related term' },
  { keyword: 'guaranteed money', category: 'spam', severity: 3, description: 'Misleading financial claims' },
  { keyword: 'get rich quick', category: 'spam', severity: 3, description: 'Misleading financial claims' },
  { keyword: 'free money', category: 'spam', severity: 3, description: 'Spam-like promotional content' },
  { keyword: 'testbadword', category: 'custom', severity: 2, description: 'Test keyword for moderation testing' },
  { keyword: 'inappropriate', category: 'harassment', severity: 3, description: 'General inappropriate content flag' },
  { keyword: 'hate', category: 'harassment', severity: 4, description: 'Hate speech indicator' },
  { keyword: 'illegal', category: 'legal', severity: 4, description: 'Potentially illegal content' },
];

async function seedKeywords() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    console.log('\nTo run this script:');
    console.log('1. Make sure your .env file has DATABASE_URL set');
    console.log('2. Run: npx tsx scripts/seed-moderation-keywords.ts');
    console.log('\nAlternatively, use the admin UI at /admin/keyword-management to add keywords manually.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected!\n');

    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'banned_keywords'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('banned_keywords table does not exist.');
      console.log('Please run the migration first: npm run migrate:content-moderation');
      client.release();
      process.exit(1);
    }

    console.log('Seeding banned keywords...\n');

    let inserted = 0;
    let skipped = 0;

    for (const kw of testKeywords) {
      // Check if keyword already exists
      const existing = await client.query(
        'SELECT id FROM banned_keywords WHERE LOWER(keyword) = LOWER($1)',
        [kw.keyword]
      );

      if (existing.rows.length > 0) {
        console.log(`  [SKIP] "${kw.keyword}" already exists`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO banned_keywords (keyword, category, severity, description, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [kw.keyword, kw.category, kw.severity, kw.description]
      );
      console.log(`  [ADD] "${kw.keyword}" (${kw.category}, severity: ${kw.severity})`);
      inserted++;
    }

    console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);

    // Show current count
    const count = await client.query('SELECT COUNT(*) FROM banned_keywords WHERE is_active = true');
    console.log(`\nTotal active banned keywords: ${count.rows[0].count}`);

    client.release();
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('='.repeat(50));
console.log('  Content Moderation - Seed Test Keywords');
console.log('='.repeat(50));
console.log('');

seedKeywords();
