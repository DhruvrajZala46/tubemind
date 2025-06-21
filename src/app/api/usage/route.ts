import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserSubscription } from '../../../lib/subscription';
import { createLogger } from '../../../lib/logger';
import { getOrCreateUser } from '../../../lib/auth-utils';

const logger = createLogger('api:usage');

export const dynamic = 'force-dynamic';

export async function GET() {
  let userId: string | undefined;
  let userEmail: string | undefined;

  try {
    const user = await currentUser();
    if (!user) {
      logger.warn('Authentication failed - no user found');
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }
    await getOrCreateUser(user);

    userId = user.id;
    userEmail = user.emailAddresses?.[0]?.emailAddress;
    
    let subscription = await getUserSubscription(user.id);
    
    // If a user record doesn't exist yet (e.g., right after sign-up),
    // create a default free plan object. This makes the API resilient.
    if (!subscription) {
      logger.info('No subscription found for user, creating default free plan view.', { userId: user.id });
      subscription = {
        tier: 'free',
        status: 'active',
        creditsUsed: 0,
        creditsLimit: 60, // Default free tier limit
        creditsReserved: 0,
      };
    }

    const creditsUsed = subscription.creditsUsed || 0;
    const creditsLimit = subscription.creditsLimit || 60;
    const remaining = Math.max(0, creditsLimit - creditsUsed);

    const response = {
      plan: subscription.tier,
      usage: creditsUsed,
      limit: creditsLimit,
      remaining: remaining
    };

    logger.info(`✅ Usage API response`, { userId: user.id, data: response });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Usage API error', { 
      error: errorMessage, 
      userId, 
      email: userEmail,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // If a truly unexpected error occurs, send a generic 500 response.
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
}

// 🛠️ Helper functions for credit formatting
function formatCreditsTime(minutes: number): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) return "0m";
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

function formatPlanName(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'free':
      return 'Free Plan';
    case 'basic':
      return 'Basic Plan';
    case 'pro':
      return 'Pro Plan';
    case 'enterprise':
      return 'Enterprise Plan';
    default:
      return 'Unknown Plan';
  }
} 