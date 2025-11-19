import { Pool } from '@neondatabase/serverless';

async function inspect() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set; exiting');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Inspecting column types for users and platform_funding_accounts...');

    const colRes = await pool.query(
      `SELECT table_name, column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_name IN ('users', 'platform_funding_accounts')
       ORDER BY table_name, ordinal_position;`
    );

    console.table(colRes.rows);

    const countRes = await pool.query(`SELECT COUNT(*) AS cnt FROM platform_funding_accounts;`);
    console.log('platform_funding_accounts total rows:', countRes.rows[0].cnt);

    const notNullRes = await pool.query(`SELECT COUNT(*) AS cnt FROM platform_funding_accounts WHERE created_by IS NOT NULL;`);
    console.log('platform_funding_accounts rows with created_by:', notNullRes.rows[0].cnt);

    const uuidLikeRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM platform_funding_accounts WHERE created_by ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';`
    );
    console.log('platform_funding_accounts.created_by values that look like UUIDs:', uuidLikeRes.rows[0].cnt);

    const samples = await pool.query(`SELECT created_by FROM platform_funding_accounts LIMIT 10;`);
    console.log('Sample created_by values (up to 10):', samples.rows.map(r => r.created_by));

    // Also inspect users.id type explicitly
    const usersId = await pool.query(
      `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='users' AND column_name='id';`
    );
    console.log('users.id:', usersId.rows[0]);

  } catch (err) {
    console.error('Error during inspection:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

inspect();
