import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import env from '../../../lib/env';
import { executeQuery } from '../../../lib/db';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('api:setup-db');

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    logger.info('🚀 Starting database setup and migration...');

    // 1. Add credits_reserved column to users table if it doesn't exist
    await executeQuery(async (sql) => {
      await sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'credits_reserved'
            ) THEN
                ALTER TABLE users ADD COLUMN credits_reserved INTEGER NOT NULL DEFAULT 0;
                RAISE NOTICE 'Added credits_reserved column to users table';
            ELSE
                RAISE NOTICE 'credits_reserved column already exists in users table';
            END IF;
        END $$
      `;
    });

    // 2. Drop and recreate the user_subscription_summary view with correct schema
    await executeQuery(async (sql) => {
      await sql`DROP VIEW IF EXISTS user_subscription_summary`;
    });

    await executeQuery(async (sql) => {
    await sql`
        CREATE OR REPLACE VIEW user_subscription_summary AS
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.subscription_tier,
          u.subscription_status,
          u.subscription_end_date,
          u.subscription_id,
          COALESCE(u.credits_used, 0) as credits_used,
          COALESCE(u.credits_reserved, 0) as credits_reserved,
          CASE
            WHEN u.subscription_tier = 'free' THEN 60    -- 1 hour = 60 minutes
            WHEN u.subscription_tier = 'basic' THEN 300  -- 5 hours = 300 minutes  
            WHEN u.subscription_tier = 'pro' THEN 900    -- 15 hours = 900 minutes
            WHEN u.subscription_tier = 'enterprise' THEN -1  -- Unlimited
            ELSE 60
          END as credits_limit,
          u.last_credit_reset,
          u.created_at,
          u.updated_at,
          CASE
            WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
            THEN 0 -- Enterprise has unlimited, so 0% usage
            WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) > 0
            THEN (COALESCE(u.credits_used, 0)::numeric / (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END)) * 100
            ELSE 0
          END as usage_percentage,
          CASE
            WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
            THEN 999999 -- Enterprise has unlimited
            ELSE (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) - COALESCE(u.credits_used, 0)
          END as remaining_credits,
          CASE
            WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
            THEN FALSE -- Enterprise never over limit
            ELSE COALESCE(u.credits_used, 0) >= (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END)
          END as is_over_limit
        FROM
          users u
      `;
    });

    // 3. Set default values for existing users who might have NULL credits_used or credits_reserved
    await executeQuery(async (sql) => {
    await sql`
        UPDATE users 
        SET 
          credits_used = COALESCE(credits_used, 0),
          credits_reserved = COALESCE(credits_reserved, 0)
        WHERE 
          credits_used IS NULL OR credits_reserved IS NULL
      `;
    });

    // 4. Create indexes for performance if they don't exist
    await executeQuery(async (sql) => {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier)`;
    });
    
    await executeQuery(async (sql) => {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status)`;
    });
    
    await executeQuery(async (sql) => {
      await sql`CREATE INDEX IF NOT EXISTS idx_users_credits_used ON users(credits_used)`;
    });

    // 5. Verify the schema is correct
    const verificationResult = await executeQuery(async (sql) => {
      return await sql`
        SELECT COUNT(*) as column_count
      FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('id', 'email', 'credits_used', 'credits_reserved', 'subscription_tier', 'subscription_status')
      `;
    });

    const viewExists = await executeQuery(async (sql) => {
      return await sql`
        SELECT COUNT(*) as view_count
        FROM information_schema.views 
        WHERE table_name = 'user_subscription_summary'
      `;
    });

    logger.info('✅ Database setup completed successfully', {
      requiredColumns: verificationResult[0]?.column_count,
      viewExists: viewExists[0]?.view_count > 0
    });
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      details: {
        requiredColumnsFound: verificationResult[0]?.column_count,
        expectedColumns: 6,
        viewExists: viewExists[0]?.view_count > 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Database setup failed', { error: errorMessage });
    
    return NextResponse.json(
      { 
      success: false,
      error: 'Database setup failed',
        details: errorMessage 
      },
      { status: 500 }
    );
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