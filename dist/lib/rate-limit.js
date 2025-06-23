"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.videoProcessingLimiter = exports.generalApiLimiter = void 0;
exports.rateLimiter = rateLimiter;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
const server_1 = require("next/server");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('rate-limit');
// In-memory rate limiter for development/restricted environments
class InMemoryRateLimiter {
    constructor(maxRequests, windowMs) {
        this.storage = new Map();
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }
    async limit(identifier) {
        const now = Date.now();
        const reset = now + this.windowMs;
        // Clean up expired entries
        if (Math.random() < 0.01) { // 1% chance to avoid doing this on every request
            for (const [key, value] of this.storage.entries()) {
                if (now > value.reset) {
                    this.storage.delete(key);
                }
            }
        }
        // Get or create entry
        const entry = this.storage.get(identifier) || { count: 0, reset: reset };
        // Reset if window expired
        if (now > entry.reset) {
            entry.count = 0;
            entry.reset = reset;
        }
        // Increment and check
        entry.count++;
        this.storage.set(identifier, entry);
        const success = entry.count <= this.maxRequests;
        return {
            success,
            limit: this.maxRequests,
            remaining: Math.max(0, this.maxRequests - entry.count),
            reset: entry.reset,
        };
    }
}
const IS_RATE_LIMITING_ENABLED = true; // Set to false to disable all rate-limiting
let redis = null;
if (IS_RATE_LIMITING_ENABLED) {
    try {
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!redisUrl || !redisToken) {
            throw new Error('Redis credentials are not configured for rate limiting.');
        }
        redis = new redis_1.Redis({
            url: redisUrl,
            token: redisToken,
        });
        logger.info('Rate limiting enabled and connected to Redis.');
    }
    catch (error) {
        logger.warn('Failed to initialize Redis for rate limiting. Rate limiting will be disabled.', {
            error: error instanceof Error ? error.message : String(error)
        });
        redis = null;
    }
}
else {
    logger.warn('Rate limiting is globally disabled.');
}
// Upstash free tier doesn't support `EVAL` scripts, so we use the `fixedWindow` algorithm
// which does not use scripts. This is a necessary workaround.
const getRateLimiter = (limit, duration) => {
    if (!redis) {
        logger.warn('Redis client not available for rate limiting. A dummy limiter that allows all requests is being used.');
        return {
            limit: async (_identifier) => ({
                success: true,
                pending: Promise.resolve(),
                limit: limit,
                reset: 0,
                remaining: limit,
            }),
        };
    }
    logger.info(`Using Fixed Window rate limiting due to Upstash Free Tier script limitations: ${limit} reqs / ${duration}`);
    return new ratelimit_1.Ratelimit({
        redis,
        limiter: ratelimit_1.Ratelimit.fixedWindow(limit, duration),
        analytics: true,
        prefix: '@upstash/ratelimit',
    });
};
exports.generalApiLimiter = getRateLimiter(20, '10s');
exports.videoProcessingLimiter = getRateLimiter(10, '1h');
exports.authLimiter = getRateLimiter(5, '1m');
async function rateLimiter(request) {
    try {
        // Skip rate limiting in development to make testing easier
        if (process.env.NODE_ENV === "development" && !process.env.ENABLE_DEV_RATE_LIMIT) {
            return server_1.NextResponse.next();
        }
        const ip = request.ip ?? "127.0.0.1";
        // Both Ratelimit and InMemoryRateLimiter have a limit method
        const result = await exports.generalApiLimiter.limit(ip);
        if (!result.success) {
            return new server_1.NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    "Content-Type": "text/plain",
                },
            });
        }
        return server_1.NextResponse.next();
    }
    catch (error) {
        // Log error but don't block the request if rate limiting fails
        console.error("Rate limiting error:", error);
        return server_1.NextResponse.next();
    }
}
