/**
 * Migration to add advanced monthly retainer fields (tiers, approval, exclusivity, scheduling)
 */
import { pool } from "../db";

async function main() {
  console.log("Starting monthly retainer fields migration...");
  const client = await pool.connect();

  try {
    await client.query(`
      ALTER TABLE retainer_contracts
        ADD COLUMN IF NOT EXISTS content_approval_required BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS exclusivity_required BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS minimum_video_length_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS posting_schedule TEXT,
        ADD COLUMN IF NOT EXISTS retainer_tiers JSONB DEFAULT '[]'::jsonb;
    `);

    await client.query(`
      UPDATE retainer_contracts
      SET content_approval_required = COALESCE(content_approval_required, false),
          exclusivity_required = COALESCE(exclusivity_required, false)
      WHERE content_approval_required IS NULL OR exclusivity_required IS NULL;
    `);

    await client.query(`
      ALTER TABLE retainer_contracts
        ALTER COLUMN content_approval_required SET NOT NULL,
        ALTER COLUMN exclusivity_required SET NOT NULL;
    `);

    console.log("✓ Monthly retainer columns added (content approval, exclusivity, minimum length, posting schedule, tiers).");
  } catch (error) {
    console.error("✗ Migration failed", error);
    process.exit(1);
  } finally {
    client.release();
  }

  process.exit(0);
}

main();
