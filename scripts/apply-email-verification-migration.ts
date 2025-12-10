import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("Applying email verification migration...");

  try {
    // Add email verification columns
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("\u2713 Added email_verified column");

    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
    `);
    console.log("\u2713 Added email_verification_token column");

    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expiry TIMESTAMP;
    `);
    console.log("\u2713 Added email_verification_token_expiry column");

    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
    `);
    console.log("\u2713 Added password_reset_token column");

    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;
    `);
    console.log("\u2713 Added password_reset_token_expiry column");

    // Set email_verified to true for Google OAuth users
    await db.execute(sql`
      UPDATE users SET email_verified = true WHERE google_id IS NOT NULL;
    `);
    console.log("\u2713 Set email_verified=true for Google OAuth users");

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
    `);
    console.log("\u2713 Created index on email_verification_token");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
    `);
    console.log("\u2713 Created index on password_reset_token");

    console.log("\n\u2705 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\u274C Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  applyMigration();
}
