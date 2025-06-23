"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_LIMITS = void 0;
exports.getUserSubscription = getUserSubscription;
exports.canUserPerformAction = canUserPerformAction;
exports.consumeCredits = consumeCredits;
exports.resetMonthlyCredits = resetMonthlyCredits;
exports.reserveCredits = reserveCredits;
exports.requireSubscription = requireSubscription;
exports.releaseCredits = releaseCredits;
const server_1 = require("@clerk/nextjs/server");
const serverless_1 = require("@neondatabase/serverless");
const plans_1 = require("../config/plans");
Object.defineProperty(exports, "SUBSCRIPTION_LIMITS", { enumerable: true, get: function () { return plans_1.PLAN_LIMITS; } });
const cache_1 = require("./cache");
const logger_1 = require("./logger");
const db_1 = require("./db");
const logger = (0, logger_1.createLogger)('subscription');
const sql = (0, serverless_1.neon)(process.env.DATABASE_URL);
// Cache key for user subscription
const USER_SUBSCRIPTION_CACHE_KEY = (userId) => `user:subscription:${userId}`;
// Get user subscription data with caching
async function getUserSubscription(userId) {
    const cache = (0, cache_1.getCacheManager)();
    const cacheKey = `user-sub:${userId}`;
    const cachedSub = cache.get(cacheKey);
    if (cachedSub) {
        logger.info('User subscription cache HIT', { userId });
        return cachedSub;
    }
    logger.info('User subscription cache MISS', { userId });
    // Query the users table directly - this is guaranteed to exist
    const result = await (0, db_1.executeQuery)(async (sql) => {
        return await sql `
      SELECT 
            id, 
            email,
        full_name,
            subscription_tier, 
            subscription_status, 
        subscription_end_date,
        subscription_id,
            credits_used,
            credits_reserved,
            last_credit_reset,
            created_at,
            updated_at
      FROM users
      WHERE id = ${userId}
    `;
    });
    if (result.length === 0) {
        // User doesn't exist at all
        return null;
    }
    const user = result[0];
    // Use credits_limit from DB if present, otherwise fallback to PLAN_LIMITS
    let creditsLimit = 60; // Default to 60 as a final fallback
    if (user.credits_limit !== undefined && user.credits_limit !== null) {
        creditsLimit = user.credits_limit;
    }
    else {
        // Fallback to PLAN_LIMITS config
        const planLimits = plans_1.PLAN_LIMITS[user.subscription_tier];
        if (planLimits?.creditsPerMonth !== undefined) {
            creditsLimit = planLimits.creditsPerMonth;
        }
    }
    const creditsUsed = user.credits_used || 0;
    const creditsReserved = user.credits_reserved || 0;
    const remainingCredits = creditsLimit === -1 ? 999999 : Math.max(0, creditsLimit - creditsUsed);
    const usagePercentage = creditsLimit === -1 ? 0 : Math.round((creditsUsed / creditsLimit) * 100);
    // Normalize the subscription object with computed fields
    const normalizedSubscription = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        subscription_tier: user.subscription_tier || 'free',
        subscription_status: user.subscription_status || 'active',
        subscription_end_date: user.subscription_end_date,
        subscription_id: user.subscription_id,
        credits_used: creditsUsed,
        credits_limit: creditsLimit,
        credits_reserved: creditsReserved,
        last_credit_reset: user.last_credit_reset,
        remaining_credits: remainingCredits,
        usage_percentage: usagePercentage,
        is_over_limit: creditsLimit !== -1 && creditsUsed > creditsLimit,
        // Backward compatibility fields
        tier: user.subscription_tier || 'free',
        status: user.subscription_status || 'active',
        creditsUsed: creditsUsed,
        creditsLimit: creditsLimit,
        creditsReserved: creditsReserved
    };
    cache.set(cacheKey, normalizedSubscription, 300); // Cache for 5 minutes
    return normalizedSubscription;
}
/**
 * Check if user can perform an action based on their subscription
 */
async function canUserPerformAction(userId, action, creditsRequired = 1) {
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
    }
    catch (error) {
        console.error('Error checking user permissions:', error);
        return { allowed: false, reason: 'Error checking subscription status' };
    }
}
/**
 * Consume credits for a user action
 */
async function consumeCredits(userId, credits) {
    logger.info('Consuming credits', { userId, data: { credits } });
    if (credits <= 0)
        return false;
    await (0, db_1.executeQuery)(async (sql) => {
        return await sql `
      UPDATE users 
      SET 
        credits_used = COALESCE(credits_used, 0) + ${credits},
        credits_reserved = GREATEST(0, COALESCE(credits_reserved, 0) - ${credits})
      WHERE id = ${userId}
    `;
    });
    // Invalidate the user subscription cache to ensure real-time updates
    (0, cache_1.getCacheManager)().invalidateUserSubscription(userId);
    return true;
}
/**
 * Reset monthly credits (call this via cron job or scheduler)
 */
async function resetMonthlyCredits() {
    try {
        await (0, db_1.executeQuery)(async (sql) => {
            return await sql `
      UPDATE users 
      SET credits_used = 0
      WHERE date_trunc('month', last_credit_reset) < date_trunc('month', NOW())
      OR last_credit_reset IS NULL
    `;
        });
        await (0, db_1.executeQuery)(async (sql) => {
            return await sql `
      UPDATE users 
      SET last_credit_reset = NOW()
      WHERE last_credit_reset IS NULL
      OR date_trunc('month', last_credit_reset) < date_trunc('month', NOW())
    `;
        });
        console.log('Monthly credits reset completed');
    }
    catch (error) {
        console.error('Error resetting monthly credits:', error);
    }
}
/**
 * Reserve credits for a user
 */
async function reserveCredits(userId, creditsToReserve) {
    try {
        await (0, db_1.executeQuery)(async (sql) => {
            return await sql `
      UPDATE users
        SET credits_reserved = COALESCE(credits_reserved, 0) + ${creditsToReserve}
      WHERE id = ${userId}
    `;
        });
        (0, cache_1.getCacheManager)().invalidateUserSubscription(userId);
    }
    catch (error) {
        console.error('Error reserving credits:', error);
        throw error;
    }
}
// This function is no longer used for feature checks but kept for backward compatibility
function getRequiredFeature(action) {
    // Since we're only tracking video processing time and not features,
    // we'll return null for all actions
    return null;
}
async function requireSubscription(minTier = 'free') {
    const user = await (0, server_1.currentUser)();
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
async function releaseCredits(userId, credits) {
    logger.info('Releasing credits', { userId, data: { credits } });
    if (credits <= 0)
        return;
    await (0, db_1.executeQuery)(async (sql) => {
        return await sql `
      UPDATE users
      SET credits_reserved = GREATEST(0, COALESCE(credits_reserved, 0) - ${credits})
      WHERE id = ${userId}
    `;
    });
}
