"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
const server_1 = require("next/server");
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
// Check for Redis URL and clean it if it has quotes
let redisUrl = process.env.UPSTASH_REDIS_REST_URL;
let redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (redisUrl && (redisUrl.startsWith('"') || redisUrl.startsWith("'"))) {
    redisUrl = redisUrl.replace(/^['"](.*)['"]$/, '$1');
    console.log('⚠️ Cleaned quotes from Redis URL in rate-limit');
}
if (redisToken && (redisToken.startsWith('"') || redisToken.startsWith("'"))) {
    redisToken = redisToken.replace(/^['"](.*)['"]$/, '$1');
    console.log('⚠️ Cleaned quotes from Redis token in rate-limit');
}
// Debug Redis connection
console.log('🔍 Rate limiter Redis check:');
console.log(`- UPSTASH_REDIS_REST_URL: ${redisUrl ? redisUrl.substring(0, 15) + '...' : 'undefined'}`);
console.log(`- UPSTASH_REDIS_REST_TOKEN: ${redisToken ? '[Set]' : 'undefined'}`);
// Create appropriate rate limiter based on environment
let ratelimit;
if (redisUrl && redisToken) {
    try {
        const redis = new redis_1.Redis({
            url: redisUrl,
            token: redisToken,
        });
        // Use a more limited set of Redis commands for compatibility with free tier
        ratelimit = new ratelimit_1.Ratelimit({
            redis,
            limiter: ratelimit_1.Ratelimit.slidingWindow(10, "10 s"),
            analytics: true,
            prefix: "ratelimit",
        });
        console.log("✅ Using Upstash Redis for rate limiting (basic commands only)");
    }
    catch (error) {
        console.warn("⚠️ Failed to initialize Redis rate limiter:", error);
        ratelimit = new InMemoryRateLimiter(10, 10000); // 10 requests per 10 seconds
        console.warn("⚠️ Fallback to in-memory rate limiting");
    }
}
else {
    ratelimit = new InMemoryRateLimiter(10, 10000); // 10 requests per 10 seconds
    console.warn("⚠️ Using memory-based rate limiting (no Redis credentials found)");
}
async function rateLimiter(request) {
    try {
        // Skip rate limiting in development to make testing easier
        if (process.env.NODE_ENV === "development" && !process.env.ENABLE_DEV_RATE_LIMIT) {
            return server_1.NextResponse.next();
        }
        const ip = request.ip ?? "127.0.0.1";
        // Both Ratelimit and InMemoryRateLimiter have a limit method
        const result = await ratelimit.limit(ip);
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
