import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter for development/restricted environments
class InMemoryRateLimiter {
  private storage = new Map<string, { count: number, reset: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number; // in ms
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async limit(identifier: string) {
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
let ratelimit: Ratelimit | InMemoryRateLimiter;

if (redisUrl && redisToken) {
  try {
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    
    // Use a more limited set of Redis commands for compatibility with free tier
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "ratelimit",
    });
    console.log("✅ Using Upstash Redis for rate limiting (basic commands only)");
  } catch (error) {
    console.warn("⚠️ Failed to initialize Redis rate limiter:", error);
    ratelimit = new InMemoryRateLimiter(10, 10000); // 10 requests per 10 seconds
    console.warn("⚠️ Fallback to in-memory rate limiting");
  }
} else {
  ratelimit = new InMemoryRateLimiter(10, 10000); // 10 requests per 10 seconds
  console.warn("⚠️ Using memory-based rate limiting (no Redis credentials found)");
}

export async function rateLimiter(request: NextRequest): Promise<NextResponse> {
  try {
    // Skip rate limiting in development to make testing easier
    if (process.env.NODE_ENV === "development" && !process.env.ENABLE_DEV_RATE_LIMIT) {
      return NextResponse.next();
    }
    
    const ip = request.ip ?? "127.0.0.1";
    
    // Both Ratelimit and InMemoryRateLimiter have a limit method
    const result = await ratelimit.limit(ip);
    
    if (!result.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }
    
    return NextResponse.next();
  } catch (error) {
    // Log error but don't block the request if rate limiting fails
    console.error("Rate limiting error:", error);
    return NextResponse.next();
  }
} 