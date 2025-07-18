import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import env from '../../../lib/env';
import { requireAdmin } from '../../../lib/auth-utils';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('debug:payment');

export async function GET(request: NextRequest) {
  // Block in production unless admin authenticated
  if (env.NODE_ENV === 'production') {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 });
    }
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  
  logger.info('Payment debug API called', { data: { email }});

  try {
    if (email) {
      // Get specific user's payment status
      const userResult = await sql`
        SELECT 
          id,
          email,
          subscription_tier,
          subscription_status,
          subscription_id,
          subscription_end_date,
          credits_used,
          last_credit_reset,
          created_at,
          updated_at
        FROM users 
        WHERE email = ${email}
      `;

      if (userResult.length === 0) {
        return NextResponse.json({
          success: false,
          message: `No user found with email: ${email}`
        }, { status: 404 });
      }

      const user = userResult[0];
      
      // Calculate available credits based on plan
      const creditLimits = {
        free: 60,
        basic: 1800, // 1 hr/day * 30 days
        pro: 6000    // 3 hr/day * 30 days
      };
      
      const creditLimit = creditLimits[user.subscription_tier as keyof typeof creditLimits] || 60;
      const remainingCredits = creditLimit - (user.credits_used || 0);

      return NextResponse.json({
        success: true,
        user: {
          ...user,
          credit_limit: creditLimit,
          remaining_credits: remainingCredits,
          subscription_active: user.subscription_status === 'active'
        }
      });
    }

    // Get overall payment system status
    const [userStats, recentWebhooks, failedWebhooks] = await Promise.all([
      // User statistics by subscription tier
      sql`
        SELECT 
          subscription_tier,
          subscription_status,
          COUNT(*) as count
        FROM users 
        GROUP BY subscription_tier, subscription_status
        ORDER BY subscription_tier, subscription_status
      `,
      
      // Recent webhook events (if table exists)
      sql`
        SELECT 
          idempotency_key,
          created_at
        FROM webhook_events 
        ORDER BY created_at DESC 
        LIMIT 10
      `.catch(() => []),
      
      // Failed webhooks (if table exists)
      sql`
        SELECT 
          event_type,
          error_message,
          created_at,
          retry_count
        FROM failed_webhooks 
        WHERE processed = false
        ORDER BY created_at DESC 
        LIMIT 5
      `.catch(() => [])
    ]);

    return NextResponse.json({
      success: true,
      system_status: {
        user_statistics: userStats,
        recent_webhooks: recentWebhooks,
        failed_webhooks: failedWebhooks,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Payment debug API error:', { data: { error: error.message }});
    return NextResponse.json({
      success: false,
      error: 'Debug API failed',
      details: error.message
    }, { status: 500 });
  }
} 