import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Bq6i5VAfpGCz@ep-dawn-butterfly-a1y95rqd-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function fixDatabase() {
  console.log('🔧 Fixing database schema issues...\n');

  const sql = neon(DATABASE_URL);

  const migrations = [
    {
      name: 'Truncate analytics table',
      sql: 'TRUNCATE TABLE analytics CASCADE'
    },
    {
      name: 'Convert analytics.id to UUID',
      sql: 'ALTER TABLE analytics ALTER COLUMN id TYPE uuid USING id::uuid'
    },
    {
      name: 'Convert analytics.application_id to UUID',
      sql: 'ALTER TABLE analytics ALTER COLUMN application_id TYPE uuid USING application_id::uuid'
    },
    {
      name: 'Convert analytics.offer_id to UUID',
      sql: 'ALTER TABLE analytics ALTER COLUMN offer_id TYPE uuid USING offer_id::uuid'
    },
    {
      name: 'Convert analytics.creator_id to UUID',
      sql: 'ALTER TABLE analytics ALTER COLUMN creator_id TYPE uuid USING creator_id::uuid'
    },
    {
      name: 'Add foreign key to analytics.application_id',
      sql: 'ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_application_id_fkey, ADD CONSTRAINT analytics_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE'
    },
    {
      name: 'Add created_at column to favorites',
      sql: 'ALTER TABLE favorites ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW()'
    },
    {
      name: 'Update existing favorites records',
      sql: "UPDATE favorites SET created_at = NOW() WHERE created_at IS NULL"
    },
    {
      name: 'Drop and recreate click_events table',
      sql: `DROP TABLE IF EXISTS click_events CASCADE;
            CREATE TABLE click_events (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
              ip_address varchar(255),
              user_agent text,
              referer varchar(255),
              country varchar(255),
              city varchar(255),
              timestamp timestamp DEFAULT NOW()
            )`
    },
    {
      name: 'Create analytics indexes',
      sql: 'CREATE INDEX IF NOT EXISTS idx_analytics_application_id ON analytics(application_id); CREATE INDEX IF NOT EXISTS idx_analytics_creator_id ON analytics(creator_id); CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date)'
    },
  ];

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    try {
      console.log(`[${i + 1}/${migrations.length}] ${migration.name}...`);
      await sql(migration.sql);
      console.log(`✅ Success\n`);
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('already exists')) {
        console.log(`⚠️  Skipped (already applied)\n`);
      } else {
        console.error(`❌ Error: ${error.message}\n`);
      }
    }
  }

  console.log('✅ Database schema fixed!');
  console.log('\n🔄 Please restart your server');
}

fixDatabase().catch(console.error);
