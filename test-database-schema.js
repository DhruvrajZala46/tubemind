// Test script for database schema alignment
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const config = {
  databaseUrl: process.env.DATABASE_URL,
  schemaFile: path.join(__dirname, 'schema.sql')
};

// Check if DATABASE_URL is defined
if (!config.databaseUrl) {
  console.error('❌ DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

// Initialize database connection
const sql = neon(config.databaseUrl);

// Main function to test database schema
async function testDatabaseSchema() {
  console.log('🔍 Testing database schema alignment');
  
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const testResult = await sql`SELECT 1 as test`;
    if (testResult && testResult[0]?.test === 1) {
      console.log('✅ Database connection successful');
    } else {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    
    // Get list of tables in the database
    console.log('🔄 Fetching database tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    if (!tables || tables.length === 0) {
      console.error('❌ No tables found in the database');
      process.exit(1);
    }
    
    console.log(`✅ Found ${tables.length} tables in the database:`);
    tables.forEach(table => console.log(`   - ${table.table_name}`));
    
    // Check required tables
    const requiredTables = [
      'videos', 'users', 'usage_tracking', 'video_summaries', 
      'payments', 'subscriptions', 'user_subscription_summary',
      'user_credit_audit', 'video_segments', 'video_takeaways',
      'failed_webhooks'
    ];
    
    const missingTables = requiredTables.filter(
      requiredTable => !tables.some(table => table.table_name === requiredTable)
    );
    
    if (missingTables.length > 0) {
      console.error(`❌ Missing required tables: ${missingTables.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ All required tables are present');
    
    // Check columns in key tables
    console.log('🔄 Checking columns in key tables...');
    
    // Check users table
    const userColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY column_name
    `;
    
    console.log(`✅ Users table has ${userColumns.length} columns`);
    
    // Check subscriptions table
    const subscriptionColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'subscriptions'
      ORDER BY column_name
    `;
    
    console.log(`✅ Subscriptions table has ${subscriptionColumns.length} columns`);
    
    // Check for polar_product_id column in subscriptions table
    const hasPolarProductId = subscriptionColumns.some(col => col.column_name === 'polar_product_id');
    if (!hasPolarProductId) {
      console.error('❌ Missing polar_product_id column in subscriptions table');
      console.log('   This column is required for Polar payment integration');
    } else {
      console.log('✅ polar_product_id column found in subscriptions table');
    }
    
    // Check for provider column in subscriptions table
    const hasProvider = subscriptionColumns.some(col => col.column_name === 'provider');
    if (!hasProvider) {
      console.error('❌ Missing provider column in subscriptions table');
      console.log('   This column is required for payment provider tracking');
    } else {
      console.log('✅ provider column found in subscriptions table');
    }
    
    // Check failed_webhooks table
    try {
      const failedWebhooksColumns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'failed_webhooks'
        ORDER BY column_name
      `;
      
      console.log(`✅ Failed_webhooks table has ${failedWebhooksColumns.length} columns`);
    } catch (err) {
      console.error('❌ Error checking failed_webhooks table:', err.message);
    }
    
    console.log('✅ Database schema verification complete');
    
  } catch (error) {
    console.error('❌ Error testing database schema:', error.message);
    process.exit(1);
  }
}

// Run the test
testDatabaseSchema()
  .then(() => {
    console.log('✅ All database schema tests passed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database schema test failed:', err.message);
    process.exit(1);
  }); 