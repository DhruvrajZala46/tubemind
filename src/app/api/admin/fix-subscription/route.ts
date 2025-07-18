import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../../lib/logger';
import env from '../../../../lib/env';
import { requireAdmin } from '../../../../lib/auth-utils';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('admin:fix-subscription');

export async function POST(request: NextRequest) {
  logger.info('Fix subscription API called');

  // SECURITY: Require admin authentication
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    logger.warn('Unauthorized access attempt to admin endpoint', {
      data: { error: authResult.error, ip: request.ip || 'unknown' }
    });
    return NextResponse.json({
      success: false,
      error: 'Unauthorized access'
    }, { status: 401 });
  }

  try {
    const { userId, status, tier } = await request.json();

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    // Update user's subscription status
    const result = await sql`
      UPDATE users 
      SET 
        subscription_status = ${status || 'active'},
        subscription_tier = ${tier || 'pro'},
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, subscription_tier, subscription_status, credits_used
    `;

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    logger.info('✅ User subscription fixed', {
      userId,
      newStatus: status || 'active',
      newTier: tier || 'pro'
    });
    
    return NextResponse.json({
      success: true,
      message: 'Subscription status updated successfully',
      user: result[0]
    }, { status: 200 });

  } catch (error: any) {
    logger.error('❌ Failed to fix subscription:', { data: { error: error.message }});
    return NextResponse.json({
      success: false,
      error: 'Failed to update subscription',
      details: error.message
    }, { status: 500 });
  }
} 