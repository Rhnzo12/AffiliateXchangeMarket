// Migration script to add deliverable notification types to the database enum
// Run this with: node --import tsx server/migrations/add-deliverable-notification-enums.ts
import { pool } from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('[Migration] Starting deliverable notification enum migration...');

  const client = await pool.connect();

  try {
    // Read and execute the SQL file
    const sqlPath = join(__dirname, 'add-deliverable-notification-enums.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('[Migration] Executing SQL migration...');
    await client.query(sql);

    console.log('[Migration] ✓ Successfully added deliverable notification enum values!');
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
