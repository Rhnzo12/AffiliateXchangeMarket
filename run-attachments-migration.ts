import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Checking if attachments column exists...");
    
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'attachments'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Attachments column already exists!");
      console.log("Column details:", result.rows[0]);
    } else {
      console.log("Column does not exist. Creating it now...");
      
      await db.execute(sql`
        ALTER TABLE messages
        ADD COLUMN attachments text[] DEFAULT ARRAY[]::text[]
      `);
      
      console.log("✅ Successfully added attachments column to messages table!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
