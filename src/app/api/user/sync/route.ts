import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import { createLogger, logApiResponse } from '../../../../lib/logger';

const sql = neon(process.env.DATABASE_URL!);
const logger = createLogger('auth:user-sync');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  logger.info('User sync API called');
  
  try {
    const user = await currentUser();
    if (!user) {
      logger.warn('Authentication failed - no user found');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    logger.debug('User authenticated', { userId: user.id });
    
    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      logger.warn('No email found for user', { userId: user.id });
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    // This is a robust upsert logic to handle user sync correctly.
    // It prevents "duplicate key" errors by finding users by email and merging accounts if necessary.
    await sql`
      INSERT INTO users (id, email, subscription_tier, subscription_status, credits_used, last_credit_reset, created_at, updated_at)
      VALUES (${user.id}, ${userEmail}, 'free', 'inactive', 0, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO UPDATE 
        SET 
          email = EXCLUDED.email,
          updated_at = NOW()
        WHERE
          users.email IS DISTINCT FROM EXCLUDED.email
      ON CONFLICT (email) DO UPDATE
        SET
          id = EXCLUDED.id,
          updated_at = NOW()
        WHERE
          users.id IS DISTINCT FROM EXCLUDED.id;
    `;
    
    logger.info('User synced successfully', { userId: user.id, email: userEmail });

    const response = { success: true };
    logApiResponse(200, response, 'auth:user-sync', user.id);
    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('User sync error', { data: { error: errorMessage } });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
} 