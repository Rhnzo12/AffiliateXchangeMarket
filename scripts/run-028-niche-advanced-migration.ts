import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log("Running migration 028: Add niche advanced features...");

  try {
    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      "db/migrations/028_add_niche_advanced_features.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    // Split by statements and execute each one
    const statements = migrationSql
      .split(/;(?=\s*(?:--|ALTER|CREATE|UPDATE|WITH|DO))/i)
      .filter((s) => s.trim().length > 0);

    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        console.log("Executing:", trimmedStatement.substring(0, 80) + "...");
        await sql(trimmedStatement);
      }
    }

    console.log("Migration 028 completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
