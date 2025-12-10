import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('Running migration 017_add_password_change_otp.sql...');

    const migrationPath = path.join(process.cwd(), 'db/migrations/017_add_password_change_otp.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the entire migration as raw SQL
    console.log('Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('\u2705 Migration completed successfully!');
    console.log('The following columns have been added:');
    console.log('  - password_change_otp');
    console.log('  - password_change_otp_expiry');
    console.log('  - Index: idx_users_password_change_otp');
    console.log('\nYou can now restart your server.');
    process.exit(0);
  } catch (error) {
    console.error('\u274C Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
