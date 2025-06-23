const { neon } = require('@neondatabase/serverless');

// Replace with your actual Neon connection string:
const connectionString = 'postgresql://neondb_owner:npg_mcSxTEF3n1gq@ep-black-sunset-a5nftgtv-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  try {
    const sql = neon(connectionString);
    console.log('✅ Connection pool created');
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Query succeeded:', result);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();