import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from './logger';

const logger = createLogger('rate-limit');

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

const IS_RATE_LIMITING_ENABLED = false; // Set to false to disable all rate-limiting

let redis: Redis | null = null;

if (IS_RATE_LIMITING_ENABLED) {
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      throw new Error('Redis credentials are not configured for rate limiting.');
    }

    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    logger.info('Rate limiting enabled and connected to Redis.');
  } catch (error) {
    logger.warn('Failed to initialize Redis for rate limiting. Rate limiting will be disabled.', {
      error: error instanceof Error ? error.message : String(error)
    });
    redis = null;
  }
} else {
  logger.warn('Rate limiting is globally disabled.');
}

const createLimiter = (limiter: any) => {
  if (IS_RATE_LIMITING_ENABLED && redis) {
    return new Ratelimit({ redis, limiter });
  }
  // If disabled, return a dummy object that always allows requests.
  return {
    limit: async (_identifier: string) => ({
      success: true,
      pending: Promise.resolve(),
      limit: 0,
      reset: 0,
      remaining: 0,
    }),
  };
};

export const generalApiLimiter = createLimiter(Ratelimit.slidingWindow(20, '10s'));
export const videoProcessingLimiter = createLimiter(Ratelimit.slidingWindow(10, '1h'));
export const authLimiter = createLimiter(Ratelimit.slidingWindow(5, '1m'));

export async function rateLimiter(request: NextRequest): Promise<NextResponse> {
  try {
    // Skip rate limiting in development to make testing easier
    if (process.env.NODE_ENV === "development" && !process.env.ENABLE_DEV_RATE_LIMIT) {
      return NextResponse.next();
    }
    
    const ip = request.ip ?? "127.0.0.1";
    
    // Both Ratelimit and InMemoryRateLimiter have a limit method
    const result = await generalApiLimiter.limit(ip);
    
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