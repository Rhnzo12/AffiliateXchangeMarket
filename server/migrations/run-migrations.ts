// Migration runner
// Environment variables are already loaded by the runtime (Replit Secrets or .env)
import { pool } from '../db.js';

async function runMigrations() {
  console.log('[Migrations] Starting migrations...');

  if (!process.env.DATABASE_URL) {
    console.error('[Migrations] ERROR: DATABASE_URL environment variable is not set.');
    console.error('[Migrations] Please set DATABASE_URL in your environment or .env file.');
    process.exit(1);
  }

  console.log('[Migrations] Database connection configured');

  try {
    // Import and run the notification enum migration
    const { up } = await import('./add-notification-enum-values.js');
    await up();

    console.log('[Migrations] All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migrations] Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
