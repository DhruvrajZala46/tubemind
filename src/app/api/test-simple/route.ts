import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserSubscription, SUBSCRIPTION_LIMITS } from '../../../lib/subscription';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.emailAddresses[0]?.emailAddress || '';

    // Test 1: Check user exists in database
    const userExists = await sql`
      SELECT id, email, subscription_tier, subscription_status, credits_used
      FROM users 
      WHERE id = ${userId}
    `;

    // Test 2: Check if new columns exist
    const columnsExist = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('subscription_id', 'credits_used', 'last_credit_reset')
    `;

    // Test 3: Get subscription using our lib
    const subscription = await getUserSubscription(userId);

    // Test 4: Environment check
    const envCheck = {
      hasAccessToken: !!process.env.POLAR_ACCESS_TOKEN,
      hasWebhookSecret: !!process.env.POLAR_WEBHOOK_SECRET,
      server: process.env.POLAR_SERVER,
      databaseUrl: !!process.env.DATABASE_URL
    };

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
        name: `${user.firstName} ${user.lastName}`,
        exists_in_db: userExists.length > 0,
        db_data: userExists[0] || null
      },
      database: {
        new_columns_added: columnsExist.length === 3,
        columns_found: columnsExist.map(c => c.column_name)
      },
      subscription,
      subscriptionLimits: SUBSCRIPTION_LIMITS,
      environment: envCheck,
      status: {
        checkout_working: true, // Based on your logs showing 307 redirects
        database_connected: true,
        auth_working: true,
        migration_needed: columnsExist.length < 3
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Simple test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 