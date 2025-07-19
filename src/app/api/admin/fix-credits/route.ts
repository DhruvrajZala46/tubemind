import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { executeQuery } from '../../../../lib/db';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('admin:fix-credits');

export async function POST() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Simple admin check - you can enhance this
    const adminEmails = ['your-admin-email@example.com']; // Replace with actual admin emails
    if (!adminEmails.includes(user.emailAddresses[0]?.emailAddress || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    logger.info('Starting credit corruption fix...', { userId: user.id });

    // 1. Reset any negative credits_reserved to 0
    const negativeResult = await executeQuery(async (sql) => {
      return await sql`
        UPDATE users 
        SET credits_reserved = 0 
        WHERE credits_reserved < 0
        RETURNING id, credits_reserved
      `;
    });
    logger.info(`Fixed ${negativeResult.length} users with negative credits_reserved`);

    // 2. Reset any credits_reserved that exceed the user's limit
    const exceedResult = await executeQuery(async (sql) => {
      return await sql`
        UPDATE users u
        SET credits_reserved = 0
        WHERE credits_reserved > COALESCE(credits_limit, 60)
        RETURNING id, credits_reserved, credits_limit
      `;
    });
    logger.info(`Fixed ${exceedResult.length} users with excessive credits_reserved`);

    // 3. Reset credits_reserved for users with no active processing jobs
    const staleResult = await executeQuery(async (sql) => {
      return await sql`
        UPDATE users u
        SET credits_reserved = 0
        WHERE credits_reserved > 0
          AND NOT EXISTS (
            SELECT 1
            FROM video_summaries vs
            JOIN videos v ON v.id = vs.video_id
            WHERE v.user_id = u.id
              AND vs.processing_status IN ('queued','processing','transcribing','summarizing','finalizing')
          )
        RETURNING id, credits_reserved
      `;
    });
    logger.info(`Fixed ${staleResult.length} users with stale credits_reserved`);

    // 4. Get summary of current state
    const summary = await executeQuery(async (sql) => {
      return await sql`
        SELECT 
          id,
          subscription_tier,
          credits_used,
          credits_limit,
          credits_reserved,
          (credits_limit - credits_used - GREATEST(0, credits_reserved)) as available_credits
        FROM users
        ORDER BY available_credits ASC
        LIMIT 10
      `;
    });

    logger.info('Credit corruption fix completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Credits fixed successfully',
      summary: {
        negativeFixed: negativeResult.length,
        excessiveFixed: exceedResult.length,
        staleFixed: staleResult.length,
        topUsers: summary
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error fixing credits', { error: errorMessage });
    
    return NextResponse.json(
      { error: 'Failed to fix credits', details: errorMessage },
      { status: 500 }
    );
  }
} 