import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import { PLAN_LIMITS as SUBSCRIPTION_LIMITS, PlanTier } from '../config/plans';
import { getCacheManager } from './cache';
import { createLogger } from './logger';
import { executeQuery } from './db';

const logger = createLogger('subscription');

const sql = neon(process.env.DATABASE_URL!);

// Expanded user subscription data for comprehensive checks
export interface UserSubscription {
  tier: PlanTier;
  status: 'active' | 'inactive' | 'canceled' | 'past_due';
  creditsUsed: number;
  creditsLimit: number;
  creditsReserved: number;
  subscriptionEndDate?: Date;
  subscriptionId?: string;
  features?: string[];
}

// Cache key for user subscription
const USER_SUBSCRIPTION_CACHE_KEY = (userId: string) => `user:subscription:${userId}`;

// Get user subscription data with caching
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const cache = getCacheManager();
  const cacheKey = `user-sub:${userId}`;
  const cachedSub = cache.get<UserSubscription>(cacheKey);
  if (cachedSub) {
    logger.info('User subscription cache HIT', { userId });
    return cachedSub;
  }
  logger.info('User subscription cache MISS', { userId });

  const query = `
    SELECT 
      u.id, 
      u.email, 
      u.full_name,
      s.stripe_price_id as subscription_tier, 
      s.status as subscription_status,
      s.current_period_end as subscription_end_date,
      s.id as subscription_id,
      u.credits_used,
      p.credits as credits_limit,
      u.credits_reserved,
      u.last_credit_reset
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
    LEFT JOIN plans p ON s.stripe_price_id = p.stripe_price_id
    WHERE u.id = $1
  `;
  
  const result = await executeQuery(async (sql) => {
    return await sql.unsafe(query, [userId]);
  });

  if (result.length === 0) return null;

  const subscription = result[0];

  // For free users without a subscription record
  if (!subscription.subscription_tier) {
    subscription.subscription_tier = 'free';
    subscription.credits_limit = 60; // Default free limit
    subscription.subscription_status = 'active';
  }

  cache.set(cacheKey, subscription, 300); // Cache for 5 minutes
  return subscription;
}

/**
 * Check if user can perform an action based on their subscription
 */
export async function canUserPerformAction(
  userId: string, 
  action: 'extract_video' | 'api_access' | 'bulk_processing',
  creditsRequired: number = 1
): Promise<{ allowed: boolean, reason?: string }> {
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return { allowed: false, reason: 'User subscription not found' };
    }

    // IMPORTANT FIX: Since we're only tracking video processing time and not features,
    // we'll skip the feature check entirely and only check credit limits
    
    // For free tier users, always check status
    if (subscription.tier === 'free' && subscription.status !== 'active' && subscription.status !== 'inactive') {
      return { 
        allowed: false, 
        reason: 'Free tier access temporarily unavailable' 
      };
    }

    // For paid tiers, allow access if they have credits (even if canceled)
    // Only block if status is 'past_due' or if subscription has expired
    if (subscription.tier !== 'free') {
      if (subscription.status === 'past_due') {
        return { 
          allowed: false, 
          reason: 'Your payment is past due. Please update your payment method.' 
        };
      }
      
      // Check if subscription has expired
      if (subscription.subscriptionEndDate && subscription.subscriptionEndDate < new Date()) {
        return { 
          allowed: false, 
          reason: 'Your subscription has expired. Please renew to continue using premium features.' 
        };
      }
    }

    // Check credits limit - DO NOT double-count reserved credits!
    // Reserved credits are already accounted for when they were reserved
    const totalUsed = subscription.creditsUsed; // Don't add reserved credits here
    const totalAvailable = subscription.creditsLimit - totalUsed;
    
    if (creditsRequired > totalAvailable) {
      return { 
        allowed: false, 
        reason: `Credit limit exceeded. You need ${creditsRequired} credits for this video but only have ${totalAvailable} credits available.`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return { allowed: false, reason: 'Error checking subscription status' };
  }
}

/**
 * Consume credits for a user action
 */
export async function consumeCredits(userId: string, credits: number): Promise<boolean> {
  logger.info('Consuming credits', { userId, data: { credits } });
  if (credits <= 0) return false;

  await executeQuery(async (sql) => {
    return await sql`
      UPDATE users
      SET 
        credits_used = COALESCE(credits_used, 0) + ${credits},
        credits_reserved = GREATEST(0, COALESCE(credits_reserved, 0) - ${credits})
      WHERE id = ${userId}
    `;
  });

  // Invalidate the user subscription cache to ensure real-time updates
  getCacheManager().invalidateUserSubscription(userId);

  return true;
}

/**
 * Reset monthly credits (call this via cron job or scheduler)
 */
export async function resetMonthlyCredits(): Promise<void> {
  try {
    await sql`
      UPDATE users 
      SET credits_used = 0
      WHERE date_trunc('month', last_credit_reset) < date_trunc('month', NOW())
      OR last_credit_reset IS NULL
    `;

    await sql`
      UPDATE users 
      SET last_credit_reset = NOW()
      WHERE last_credit_reset IS NULL
      OR date_trunc('month', last_credit_reset) < date_trunc('month', NOW())
    `;

    console.log('Monthly credits reset completed');
  } catch (error) {
    console.error('Error resetting monthly credits:', error);
  }
}

/**
 * Reserve credits for a user
 */
export async function reserveCredits(userId: string, creditsToReserve: number): Promise<void> {
  try {
    await executeQuery(async (sql) => {
      return await sql`
        UPDATE users
        SET credits_reserved = COALESCE(credits_reserved, 0) + ${creditsToReserve}
        WHERE id = ${userId}
      `;
    });
    getCacheManager().invalidateUserSubscription(userId);
  } catch (error) {
    console.error('Error reserving credits:', error);
    throw error;
  }
}

// This function is no longer used for feature checks but kept for backward compatibility
function getRequiredFeature(action: string): string | null {
  // Since we're only tracking video processing time and not features,
  // we'll return null for all actions
  return null;
}

export async function requireSubscription(minTier: 'free' | 'basic' | 'pro' = 'free') {
  const user = await currentUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const subscription = await getUserSubscription(user.id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const tierLevel = { free: 0, basic: 1, pro: 2 };
  const userTierLevel = tierLevel[subscription.tier] || 0;
  const requiredTierLevel = tierLevel[minTier] || 0;

  if (userTierLevel < requiredTierLevel) {
    throw new Error(`This feature requires ${minTier} plan or higher`);
  }

  return subscription;
}

// Re-export for backward compatibility
export { SUBSCRIPTION_LIMITS };

export async function releaseCredits(userId: string, credits: number) {
  logger.info('Releasing credits', { userId, data: { credits } });
  if (credits <= 0) return;

  await executeQuery(async (sql) => {
    return await sql`
      UPDATE users
      SET credits_reserved = GREATEST(0, COALESCE(credits_reserved, 0) - ${credits})
      WHERE id = ${userId}
    `;
  });
} 