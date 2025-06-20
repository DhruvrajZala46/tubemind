import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import { PLAN_LIMITS as SUBSCRIPTION_LIMITS, PlanTier } from '../config/plans';
import { getCacheManager } from './cache';

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
  // Try to get from cache first
  const cache = getCacheManager();
  const cachedSubscription = cache.getCachedUserSubscription(userId);
  if (cachedSubscription) {
    return cachedSubscription;
  }

  try {
    // Get user data from database
    const userData = await sql`
      SELECT 
        u.subscription_tier as tier,
        u.subscription_status as status,
        u.credits_used,
        u.subscription_end_date,
        u.subscription_id,
        u.credits_reserved
      FROM users u
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (!userData || userData.length === 0) {
      // If user doesn't exist in the database, create a new entry with free tier
      try {
        const user = await currentUser();
        if (!user) {
          return null;
        }
        
        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (!userEmail) {
          return null;
        }
        
        // Create new user with free tier
        await sql`
          INSERT INTO users (
            id, 
            email,
            subscription_tier, 
            subscription_status, 
            credits_used,
            credits_reserved,
            last_credit_reset,
            created_at,
            updated_at
          )
          VALUES (
            ${userId},
            ${userEmail},
            'free',
            'active',
            0,
            0,
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
        
        // Fetch the newly created user
        const newUserData = await sql`
          SELECT 
            u.subscription_tier as tier,
            u.subscription_status as status,
            u.credits_used,
            u.subscription_end_date,
            u.subscription_id,
            u.credits_reserved
          FROM users u
          WHERE u.id = ${userId}
          LIMIT 1
        `;
        
        if (newUserData && newUserData.length > 0) {
          const user = newUserData[0];
          const tier = (user.tier || 'free') as PlanTier;
          const planLimits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
          
          const subscription: UserSubscription = {
            tier: tier,
            status: user.status || 'active',
            creditsUsed: user.credits_used || 0,
            creditsLimit: planLimits.creditsPerMonth,
            creditsReserved: user.credits_reserved || 0,
            subscriptionEndDate: user.subscription_end_date,
            subscriptionId: user.subscription_id,
            features: [...planLimits.features] as string[]
          };
          
          cache.cacheUserSubscription(userId, subscription);
          return subscription;
        }
      } catch (createError) {
        console.error('Error creating new user:', createError);
      }
      
      return null;
    }

    const user = userData[0];
    
    // Get the plan limits for this tier
    const tier = (user.tier || 'free') as PlanTier;
    const planLimits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
    
    // Construct subscription object
    const subscription: UserSubscription = {
      tier: tier,
      status: user.status || 'inactive',
      creditsUsed: user.credits_used || 0,
      creditsLimit: planLimits.creditsPerMonth,
      creditsReserved: user.credits_reserved || 0,
      subscriptionEndDate: user.subscription_end_date,
      subscriptionId: user.subscription_id,
      features: [...planLimits.features] as string[]
    };

    // Cache the subscription data
    cache.cacheUserSubscription(userId, subscription);
    
    return subscription;
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return null;
  }
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
  try {
    const result = await sql`
      UPDATE users 
      SET 
        credits_used = credits_used + ${credits},
        credits_reserved = GREATEST(0, credits_reserved - ${credits})
      WHERE id = ${userId}
      RETURNING credits_used
    `;

    // Invalidate the user subscription cache to ensure real-time updates
    getCacheManager().invalidateUserSubscription(userId);

    return result.length > 0;
  } catch (error) {
    console.error('Error consuming credits:', error);
    return false;
  }
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
    await sql`
      UPDATE users
      SET credits_reserved = credits_reserved + ${creditsToReserve}
      WHERE id = ${userId}
    `;
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