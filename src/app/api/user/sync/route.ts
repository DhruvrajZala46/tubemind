import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { neon, NeonDbError } from '@neondatabase/serverless';
import { createLogger, logApiResponse } from '../../../../lib/logger';

const sql = neon(process.env.DATABASE_URL!);
const logger = createLogger('auth:user-sync');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  logger.info('User sync API called');

  const user = await currentUser();
  if (!user) {
    logger.warn('Authentication failed - no user found');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userEmail = user.emailAddresses[0]?.emailAddress;
  if (!userEmail) {
    logger.warn('No email found for user', { userId: user.id });
    return NextResponse.json({ error: 'No email found' }, { status: 400 });
  }

  logger.debug('User authenticated', { userId: user.id, email: userEmail });

  try {
    // Final, robust user sync logic. This avoids complex ON CONFLICT syntax.
    
    // 1. Try to find the user by their Clerk ID.
    let dbUser = (await sql`SELECT id, email FROM users WHERE id = ${user.id}`)[0];

    if (dbUser) {
      // User found by ID. Ensure email is up-to-date.
      if (dbUser.email !== userEmail) {
        logger.info('User found by ID, updating email', { userId: user.id });
        await sql`UPDATE users SET email = ${userEmail}, updated_at = NOW() WHERE id = ${user.id}`;
      } else {
        logger.info('User found by ID, no changes needed', { userId: user.id });
      }
    } else {
      // User not found by ID. This could be a new user, or an existing user with a new login method.
      // 2. Try to find the user by email.
      dbUser = (await sql`SELECT id, email FROM users WHERE email = ${userEmail}`)[0];
      
      if (dbUser) {
        // User found by email. This means they logged in with a different method (e.g., Google then GitHub).
        // We'll update their record to use the new Clerk ID. This merges the accounts.
        logger.info('User found by email, updating their Clerk ID to merge accounts', { oldId: dbUser.id, newId: user.id });
        await sql`UPDATE users SET id = ${user.id}, updated_at = NOW() WHERE email = ${userEmail}`;
      } else {
        // 3. User not found by ID or email. This is a genuinely new user. Create them.
        logger.info('Creating new user record', { userId: user.id, email: userEmail });
        await sql`
          INSERT INTO users (id, email, subscription_tier, subscription_status, credits_used, last_credit_reset)
          VALUES (${user.id}, ${userEmail}, 'free', 'inactive', 0, NOW())
        `;
      }
    }
    
    logger.info('User synced successfully', { userId: user.id, email: userEmail });
    const response = { success: true };
    logApiResponse(200, response, 'auth:user-sync', user.id);
    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('User sync failed with an unexpected error', { userId: user.id, error: errorMessage });
    if (error instanceof NeonDbError) {
      logger.error('Neon DB Error Details:', { code: error.code, severity: error.severity });
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
} 