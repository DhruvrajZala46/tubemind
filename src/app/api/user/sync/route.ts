import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createLogger, logApiResponse } from '../../../../lib/logger';
import { getOrCreateUser } from '../../../../lib/auth-utils';

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

    // Use the robust, centralized function to handle user creation and updates.
    await getOrCreateUser(user);
    
    logger.info('User synced successfully', { userId: user.id });
    const response = { success: true };
    logApiResponse(200, response, 'auth:user-sync', user.id);
    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('User sync failed with an unexpected error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
} 