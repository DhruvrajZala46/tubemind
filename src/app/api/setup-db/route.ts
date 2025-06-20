import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import env from '../../../lib/env';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('database:setup');

export async function POST(request: NextRequest) {
  logger.info('Database setup API called');

  try {
    // Create webhook_events table for idempotency
    await sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    logger.info('✅ webhook_events table created/verified');

    // Create failed_webhooks table for error tracking
    await sql`
      CREATE TABLE IF NOT EXISTS failed_webhooks (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        retry_count INTEGER DEFAULT 0,
        processed BOOLEAN DEFAULT FALSE
      )
    `;
    logger.info('✅ failed_webhooks table created/verified');

    // Ensure users table has all required columns
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMP DEFAULT NOW()`;
      logger.info('✅ users table columns verified/added');
    } catch (alterError: any) {
      logger.warn('Some columns may already exist:', { data: { error: alterError.message }});
    }

    // Create indexes for better performance
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency ON webhook_events(idempotency_key)`;
      logger.info('✅ Database indexes created/verified');
    } catch (indexError: any) {
      logger.warn('Some indexes may already exist:', { data: { error: indexError.message }});
    }

    // Verify table structure
    const tableInfo = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('users', 'webhook_events', 'failed_webhooks')
      ORDER BY table_name, ordinal_position
    `;

    logger.info('✅ Database setup completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      tables: tableInfo
    }, { status: 200 });

  } catch (error: any) {
    logger.error('❌ Database setup failed:', { data: { error: error.message }});
    return NextResponse.json({
      success: false,
      error: 'Database setup failed',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if we're in development or test mode
    const isDevMode = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    if (!isDevMode) {
      return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 });
    }

    // Create test user if it doesn't exist
    try {
      const result = await sql`
        INSERT INTO users (
          id, 
          email,
          subscription_tier, 
          subscription_status, 
          credits_used,
          credits_reserved,
          last_credit_reset,
          created_at,
          updated_at
        )
        VALUES (
          'test_user_id',
          'test@example.com',
          'basic',
          'active',
          0,
          0,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
      
      logger.info('Test user created or already exists');
    } catch (error) {
      logger.error('Error creating test user', { error });
      return NextResponse.json({ error: 'Failed to create test user' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Database setup completed successfully',
      details: 'Test user created with ID: test_user_id'
    });
  } catch (error: any) {
    logger.error('Database setup failed', { error });
    return NextResponse.json({ 
      error: 'Database setup failed', 
      details: error.message 
    }, { status: 500 });
  }
} 