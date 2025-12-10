import { neon } from '@neondatabase/serverless';

async function verifyColumns() {
  if (!process.env.DATABASE_URL) {
    console.error('\u274C DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('🔍 Checking for OTP columns in users table...\n');

    // Check if columns exist
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('account_deletion_otp', 'account_deletion_otp_expiry')
      ORDER BY column_name;
    `;

    if (result.length === 2) {
      console.log('\u2705 Both OTP columns exist:');
      result.forEach((col: any) => {
        console.log(`   • ${col.column_name} (${col.data_type})`);
      });
      console.log('\n\u2728 Database is properly configured!');
    } else if (result.length === 1) {
      console.log('\u26A0\uFE0F  Only one column exists:');
      result.forEach((col: any) => {
        console.log(`   • ${col.column_name} (${col.data_type})`);
      });
      console.log('\n\u274C Missing column - run: npm run migrate:otp');
    } else {
      console.log('\u274C OTP columns are missing!');
      console.log('\n📝 Please run: npm run migrate:otp');
    }

    // Check for index
    const indexResult = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'users'
      AND indexname = 'idx_users_account_deletion_otp';
    `;

    if (indexResult.length > 0) {
      console.log('\u2705 OTP index exists');
    } else {
      console.log('\u26A0\uFE0F  OTP index is missing');
    }

  } catch (error: any) {
    console.error('\u274C Error checking columns:', error.message);
    process.exit(1);
  }
}

verifyColumns();
