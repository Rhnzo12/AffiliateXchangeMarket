/**
 * Manual migration script for Content Moderation tables
 * This script safely creates only the content moderation tables without touching existing schema
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('\u274C ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('\u2705 Connected successfully\n');

    // Read the migration SQL file
    const sqlPath = join(__dirname, '..', 'db', 'migrations', '018_create_content_moderation_tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📝 Running Content Moderation migration...\n');

    // Execute the migration
    await client.query(sql);

    console.log('\n\u2705 Migration completed successfully!');
    console.log('\n📊 Created:');
    console.log('  \u2713 banned_keywords table');
    console.log('  \u2713 content_flags table');
    console.log('  \u2713 Indexes for performance');
    console.log('  \u2713 Default banned keywords');

    // Verify tables were created
    const checkTables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE tablename IN ('banned_keywords', 'content_flags')
    `);

    console.log('\n🔍 Verification:');
    checkTables.rows.forEach(row => {
      console.log(`  \u2713 ${row.tablename} exists`);
    });

    // Check row counts
    const keywordCount = await client.query('SELECT COUNT(*) FROM banned_keywords');
    const flagCount = await client.query('SELECT COUNT(*) FROM content_flags');

    console.log('\n📈 Current data:');
    console.log(`  • Banned keywords: ${keywordCount.rows[0].count}`);
    console.log(`  • Content flags: ${flagCount.rows[0].count}`);

    client.release();

  } catch (error: any) {
    console.error('\n\u274C Migration failed:');
    console.error(error.message);

    if (error.message.includes('already exists')) {
      console.log('\n\u1F4A1 Tables may already exist. This is OK if you ran this migration before.');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('╔════════════════════════════════════════════════╗');
console.log('║   Content Moderation Tables Migration         ║');
console.log('║   Creates: banned_keywords, content_flags      ║');
console.log('╚════════════════════════════════════════════════╝\n');

runMigration();
