import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import { createLogger, logApiRequest, logApiResponse } from '../../../../lib/logger';

const sql = neon(process.env.DATABASE_URL!);
const logger = createLogger('auth:user-sync');

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

    // Check if user exists in database
    logger.debug('Checking if user exists in database', { userId: user.id });
    const existingUser = await sql`
      SELECT id, email, subscription_tier FROM users WHERE id = ${user.id}
    `;

    logger.debug('Database query result', { 
      userId: user.id, 
      data: { existingUser: existingUser.length > 0 ? 'found' : 'not found' } 
    });

    if (existingUser.length === 0) {
      // User doesn't exist, create them
      logger.info('Creating new user', { userId: user.id, email: userEmail });
      await sql`
        INSERT INTO users (
          id, 
          email,
          subscription_tier, 
          subscription_status, 
          credits_used,
          last_credit_reset,
          created_at,
          updated_at
        )
        VALUES (
          ${user.id},
          ${userEmail},
          'free',
          'inactive',
          0,
          NOW(),
          NOW(),
          NOW()
        )
      `;
      logger.info(`User created successfully`, { userId: user.id, email: userEmail });
    } else if (!existingUser[0].email) {
      // User exists but has no email, update it
      logger.info('Updating user email', { userId: user.id, email: userEmail });
      await sql`
        UPDATE users 
        SET 
          email = ${userEmail},
          updated_at = NOW()
        WHERE id = ${user.id}
      `;
      logger.info('User email updated successfully', { userId: user.id });
    } else {
      logger.info('User already exists, no action needed', { 
        userId: user.id,
        data: { 
          email: existingUser[0].email,
          tier: existingUser[0].subscription_tier
        }
      });
    }

    const response = { success: true };
    logApiResponse(200, response, 'auth:user-sync', user.id);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('User sync error', { data: { error } });
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
} 