"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalApiLimiter = exports.videoProcessingLimiter = void 0;
exports.validateVideoProcessingRequest = validateVideoProcessingRequest;
exports.checkGeneralApiRateLimit = checkGeneralApiRateLimit;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('security');
// Initialize Redis client. Assumes UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are in your .env
const redis = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
// CRITICAL FIX: Use fixedWindow instead of slidingWindow to avoid Lua scripts
// This is required for Upstash free tier compatibility
exports.videoProcessingLimiter = new ratelimit_1.Ratelimit({
    redis: redis,
    limiter: ratelimit_1.Ratelimit.fixedWindow(10, "10 m"), // 10 requests per 10 minutes (no scripts)
    prefix: "ratelimit:video_processing",
    analytics: true,
});
// CRITICAL FIX: Use fixedWindow instead of slidingWindow to avoid Lua scripts
exports.generalApiLimiter = new ratelimit_1.Ratelimit({
    redis: redis,
    limiter: ratelimit_1.Ratelimit.fixedWindow(30, "1 m"), // 30 requests per 1 minute (no scripts)
    prefix: "ratelimit:general_api",
    analytics: true,
});
/**
 * Validates if a user can perform a video processing request.
 * Uses the stricter `videoProcessingLimiter`.
 *
 * @param userId - The ID of the user performing the action.
 * @returns {Promise<{ allowed: boolean; reason?: string }>}
 */
async function validateVideoProcessingRequest(userId) {
    try {
        const { success, limit, remaining, reset } = await exports.videoProcessingLimiter.limit(userId);
        if (!success) {
            logger.warn('Video processing rate limit exceeded', {
                data: {
                    userId,
                    limit,
                    remaining,
                    reset: new Date(reset).toISOString()
                }
            });
            return {
                allowed: false,
                reason: `Rate limit exceeded. Please try again in a few minutes.`
            };
        }
        return { allowed: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // If Redis script permissions are blocked, allow the request but log the issue
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.warn('Rate limiting failed due to Redis script permissions. Allowing request.', {
                userId,
                error: errorMessage
            });
            return { allowed: true };
        }
        // For other errors, allow the request but log the issue
        logger.error('Rate limiting error, allowing request', { userId, error: errorMessage });
        return { allowed: true };
    }
}
/**
 * Middleware-style function to check general API rate limits.
 * Can be used at the beginning of any non-critical API route.
 *
 * @param identifier - The identifier to rate limit on (e.g., user ID or IP address).
 * @returns {Promise<Response | null>} - Returns a NextResponse object if rate-limited, otherwise null.
 */
async function checkGeneralApiRateLimit(identifier) {
    try {
        const { success } = await exports.generalApiLimiter.limit(identifier);
        if (!success) {
            logger.warn('General API rate limit exceeded', { data: { identifier } });
            return new Response(JSON.stringify({ error: 'Too many requests. Please try again shortly.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }
        return null; // Not rate-limited
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // If Redis script permissions are blocked, allow the request but log the issue
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.warn('Rate limiting failed due to Redis script permissions. Allowing request.', {
                identifier,
                error: errorMessage
            });
            return null; // Allow the request
        }
        // For other errors, allow the request but log the issue
        logger.error('Rate limiting error, allowing request', { identifier, error: errorMessage });
        return null; // Allow the request
    }
}
