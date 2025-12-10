// Simple migration script - run this while the dev server is running
// It will use the same database connection as the running server
import { pool } from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('[Migration] Starting notification enum migration...');

  const client = await pool.connect();

  try {
    // Read and execute the SQL file
    const sqlPath = join(__dirname, 'add-notification-enums.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('[Migration] Executing SQL migration...');
    await client.query(sql);

    console.log('[Migration] \u2713 Successfully added notification enum values!');
    console.log('[Migration] The following notification types are now available:');

    // Query to show all enum values
    const result = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = 'notification_type'::regtype
      ORDER BY enumlabel
    `);

    result.rows.forEach((row: any) => {
      console.log(`  - ${row.enumlabel}`);
    });

  } catch (error: any) {
    console.error('[Migration] ✗ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('[Migration] Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Migration failed:', error);
    process.exit(1);
  });
