// ⚡ PHASE 2.3: COMPREHENSIVE CACHING SYSTEM
// Dramatically improves performance and reduces costs

import { createLogger } from './logger';
const logger = createLogger('cache');

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// 🚀 MULTI-LAYER CACHE MANAGER
class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private metrics: { hits: number; misses: number } = { hits: 0, misses: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;

  // 🎯 CACHE CONFIGURATION
  private readonly config = {
    defaultTTL: 60 * 60 * 1000, // 1 hour default
    maxMemoryItems: 1000, // Maximum number of items in memory cache
    ttl: {
      videoMetadata: 24 * 60 * 60 * 1000, // 24 hours
      videoTranscript: 7 * 24 * 60 * 60 * 1000, // 7 days
      aiProcessing: 30 * 24 * 60 * 60 * 1000, // 30 days
      userSubscription: 10 * 1000, // 10 seconds (reduced from longer duration)
      rateLimit: 60 * 60 * 1000, // 1 hour
    },
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
  };

  private constructor() {
    this.startCleanupProcess();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
      logger.info('⚡ Cache system initialized');
    }
    return CacheManager.instance;
  }

  // 📝 GENERIC CACHE OPERATIONS

  /**
   * Get item from cache
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  public get<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      this.metrics.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(key);
      this.metrics.misses++;
      return null;
    }

    // Update hit count and metrics
    item.hits++;
    this.metrics.hits++;
    
    return item.data as T;
  }

  /**
   * Set item in cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (optional)
   */
  public set<T>(key: string, data: T, ttl?: number): void {
    const expirationTime = ttl || this.config.defaultTTL;
    const expiresAt = Date.now() + expirationTime;

    // Enforce memory limits
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      this.evictOldestItems(Math.floor(this.config.maxMemoryItems * 0.1)); // Remove 10%
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
      hits: 0
    });
  }

  // 🎯 SPECIALIZED CACHE METHODS FOR OUR USE CASES

  /**
   * Cache YouTube transcript (long-term)
   */
  public cacheYouTubeTranscript(videoId: string, transcript: any[]): void {
    const key = `yt_transcript:${videoId}`;
    this.set(key, transcript, this.config.ttl.videoTranscript);
    logger.info(`📝 Cached transcript for video: ${videoId}`);
  }

  /**
   * Get cached YouTube transcript
   */
  public getCachedYouTubeTranscript(videoId: string): any[] | null {
    const key = `yt_transcript:${videoId}`;
    const cached = this.get<any[]>(key);
    if (cached) {
      logger.debug(`⚡ Cache HIT for transcript: ${videoId}`);
    }
    return cached;
  }

  /**
   * Cache video metadata
   */
  public cacheVideoMetadata(videoId: string, metadata: any): void {
    const key = `yt_metadata:${videoId}`;
    this.set(key, metadata, this.config.ttl.videoMetadata);
    logger.info(`📊 Cached metadata for video: ${videoId}`);
  }

  /**
   * Get cached video metadata
   */
  public getCachedVideoMetadata(videoId: string): any | null {
    const key = `yt_metadata:${videoId}`;
    const cached = this.get<any>(key);
    if (cached) {
      logger.debug(`⚡ Cache HIT for metadata: ${videoId}`);
    }
    return cached;
  }

  /**
   * Cache AI processing results (very long-term)
   */
  public cacheAIProcessing(videoId: string, userId: string, result: any): void {
    const key = `ai_result:${userId}:${videoId}`;
    this.set(key, result, this.config.ttl.aiProcessing);
    logger.info(`🤖 Cached AI result for user: ${userId}, video: ${videoId}`);
  }

  /**
   * Get cached AI processing results
   */
  public getCachedAIProcessing(videoId: string, userId: string): any | null {
    const key = `ai_result:${userId}:${videoId}`;
    const cached = this.get<any>(key);
    if (cached) {
      logger.debug(`⚡ Cache HIT for AI result: ${userId}:${videoId}`);
    }
    return cached;
  }

  /**
   * Cache user subscription data (short-term)
   */
  public cacheUserSubscription(userId: string, subscription: any): void {
    const key = `user_sub:${userId}`;
    this.set(key, subscription, this.config.ttl.userSubscription);
  }

  /**
   * Get cached user subscription
   */
  public getCachedUserSubscription(userId: string): any | null {
    const key = `user_sub:${userId}`;
    return this.get<any>(key);
  }

  /**
   * Invalidate user subscription cache (when subscription changes)
   */
  public invalidateUserSubscription(userId: string): void {
    const key = `user_sub:${userId}`;
    this.memoryCache.delete(key);
    logger.info(`🗑️ Invalidated subscription cache for user: ${userId}`);
  }

  // 🚀 PHASE 5.2: ENHANCED SMART CACHING FOR AI PROCESSING
  
  /**
   * Check if video has been processed for ANY user (for transcript sharing)
   * This allows us to reuse transcripts across users for massive cost savings
   */
  public getSharedTranscriptProcessing(videoId: string): any | null {
    // Check if ANY user has processed this video's transcript
    const sharedKey = `shared_transcript:${videoId}`;
    const cached = this.get<any>(sharedKey);
    if (cached) {
      logger.info(`💎 SHARED CACHE HIT: Transcript for video ${videoId} already processed!`);
      return cached;
    }
    return null;
  }

  /**
   * Cache transcript processing that can be shared across users
   * (Transcript + basic metadata, but NOT user-specific AI analysis)
   */
  public cacheSharedTranscriptProcessing(videoId: string, transcriptData: any): void {
    const sharedKey = `shared_transcript:${videoId}`;
    // Cache for 30 days since transcripts rarely change
    this.set(sharedKey, transcriptData, 30 * 24 * 60 * 60 * 1000);
    logger.info(`💎 Cached SHARED transcript processing for video: ${videoId}`);
  }

  /**
   * Smart AI caching with content-based keys
   * Same content = same result, regardless of user
   */
  public cacheAIByContent(contentHash: string, aiResult: any, operation: string): void {
    const key = `ai_content:${operation}:${contentHash}`;
    this.set(key, aiResult, this.config.ttl.aiProcessing);
    logger.info(`🧠 Cached AI result by content hash: ${operation}:${contentHash.substring(0, 8)}...`);
  }

  /**
   * Get AI result by content hash
   */
  public getAIByContent(contentHash: string, operation: string): any | null {
    const key = `ai_content:${operation}:${contentHash}`;
    const cached = this.get<any>(key);
    if (cached) {
      logger.debug(`🧠 Content-based cache HIT: ${operation}:${contentHash.substring(0, 8)}...`);
    }
    return cached;
  }

  /**
   * Cache expensive YouTube API calls
   */
  public cacheYouTubeAPICall(endpoint: string, params: any, result: any): void {
    const paramsStr = JSON.stringify(params);
    const key = `yt_api:${endpoint}:${Buffer.from(paramsStr).toString('base64').substring(0, 32)}`;
    this.set(key, result, this.config.ttl.videoMetadata);
    logger.info(`📺 Cached YouTube API call: ${endpoint}`);
  }

  /**
   * Get cached YouTube API result
   */
  public getCachedYouTubeAPICall(endpoint: string, params: any): any | null {
    const paramsStr = JSON.stringify(params);
    const key = `yt_api:${endpoint}:${Buffer.from(paramsStr).toString('base64').substring(0, 32)}`;
    const cached = this.get<any>(key);
    if (cached) {
      logger.debug(`📺 YouTube API cache HIT: ${endpoint}`);
    }
    return cached;
  }

  /**
   * Smart invalidation for AI results when video updates
   */
  public invalidateVideoProcessing(videoId: string): number {
    let deletedCount = 0;
    for (const [key] of this.memoryCache) {
      if (key.includes(videoId)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }
    logger.info(`🗑️ Invalidated ${deletedCount} cached items for video: ${videoId}`);
    return deletedCount;
  }

  /**
   * Pre-warm cache with popular content
   */
  public preWarmCache(popularVideoIds: string[]): void {
    logger.info(`🔥 Pre-warming cache for ${popularVideoIds.length} popular videos`);
    // This would trigger background processing for popular videos
    // Implementation depends on your background job system
  }

  /**
   * Get cache efficiency report
   */
  public getCacheEfficiencyReport() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    
    // Categorize cache by type
    const cacheByType: Record<string, number> = {};
    for (const [key] of this.memoryCache) {
      const type = key.split(':')[0];
      cacheByType[type] = (cacheByType[type] || 0) + 1;
    }

    const costSavings = this.estimateCostSavings();

    return {
      metrics: {
        totalRequests,
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        hitRate: `${hitRate.toFixed(2)}%`,
        cacheSize: this.memoryCache.size
      },
      cacheByType,
      costSavings,
      recommendations: this.getCacheRecommendations(hitRate)
    };
  }

  /**
   * Estimate cost savings from caching
   */
  private estimateCostSavings() {
    // Rough estimates based on typical costs
    const estimates = {
      youtubeAPICall: 0.001, // $0.001 per call saved
      aiProcessing: 0.05,    // $0.05 per AI call saved
      transcriptFetch: 0.002, // $0.002 per transcript fetch saved
    };

    let totalSavings = 0;
    let breakdown: Record<string, { hits: number; savings: number }> = {};

    for (const [key, item] of this.memoryCache) {
      const type = key.split(':')[0];
      let costPerHit = 0;
      
      if (type === 'yt_api' || type === 'yt_metadata') costPerHit = estimates.youtubeAPICall;
      else if (type === 'ai_result' || type === 'ai_content') costPerHit = estimates.aiProcessing;
      else if (type === 'yt_transcript') costPerHit = estimates.transcriptFetch;

      const savings = item.hits * costPerHit;
      totalSavings += savings;

      if (!breakdown[type]) breakdown[type] = { hits: 0, savings: 0 };
      breakdown[type].hits += item.hits;
      breakdown[type].savings += savings;
    }

    return {
      totalEstimatedSavings: `$${totalSavings.toFixed(4)}`,
      breakdown
    };
  }

  /**
   * Get caching recommendations
   */
  private getCacheRecommendations(hitRate: number): string[] {
    const recommendations: string[] = [];

    if (hitRate < 50) {
      recommendations.push("🔴 Low cache hit rate - consider increasing TTL for stable data");
    } else if (hitRate < 75) {
      recommendations.push("🟡 Moderate cache hit rate - review caching strategy");
    } else {
      recommendations.push("🟢 Good cache hit rate - caching is effective");
    }

    if (this.memoryCache.size > this.config.maxMemoryItems * 0.9) {
      recommendations.push("⚠️ Cache approaching memory limit - consider cleanup");
    }

    const aiCacheCount = Array.from(this.memoryCache.keys()).filter(k => k.startsWith('ai_')).length;
    if (aiCacheCount < 10) {
      recommendations.push("💡 Consider pre-warming AI cache for popular content");
    }

    return recommendations;
  }

  // 🧹 CACHE MAINTENANCE

  /**
   * Clean up expired items
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cache cleanup: removed ${cleaned} expired items`);
    }
  }

  /**
   * Evict oldest items to make room
   */
  private evictOldestItems(count: number): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    entries.forEach(([key]) => {
      this.memoryCache.delete(key);
    });

    logger.info(`🗑️ Cache eviction: removed ${count} oldest items`);
  }

  /**
   * Start automatic cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // 📊 CACHE METRICS & MONITORING

  /**
   * Get cache performance metrics
   */
  public getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      size: this.memoryCache.size,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0
    };
  }

  /**
   * Get detailed cache statistics
   */
  public getDetailedStats() {
    const stats = {
      totalItems: this.memoryCache.size,
      itemsByType: {} as Record<string, number>,
      oldestItem: null as Date | null,
      newestItem: null as Date | null,
      topHitItems: [] as Array<{ key: string; hits: number }>
    };

    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      // Count by type
      const type = key.split(':')[0];
      stats.itemsByType[type] = (stats.itemsByType[type] || 0) + 1;

      // Track timestamps
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        stats.oldestItem = new Date(item.timestamp);
      }
      if (item.timestamp > newestTimestamp) {
        newestTimestamp = item.timestamp;
        stats.newestItem = new Date(item.timestamp);
      }
    }

    // Get top hit items
    stats.topHitItems = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({ key, hits: item.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear specific cache type
   */
  public clearCacheType(type: string): number {
    let cleared = 0;
    for (const [key] of this.memoryCache.entries()) {
      if (key.startsWith(`${type}:`)) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }
    logger.info(`🗑️ Cleared ${cleared} items of type: ${type}`);
    return cleared;
  }

  /**
   * Clear all cache
   */
  public clearAll(): void {
    const size = this.memoryCache.size;
    this.memoryCache.clear();
    this.metrics = { hits: 0, misses: 0 };
    logger.info(`🗑️ Cache cleared: removed ${size} items`);
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
    logger.info('⚡ Cache system shutdown complete');
  }
}

// 🎯 EXPORTED CACHE INSTANCE
export const cache = CacheManager.getInstance();

// Export the cache manager function for compatibility
export function getCacheManager() {
  return CacheManager.getInstance();
}

// 🚀 CACHE-OPTIMIZED UTILITY FUNCTIONS

/**
 * Generic cache wrapper for expensive operations
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch data
  logger.info(`🔄 Cache MISS for key: ${key}, fetching...`);
  const data = await fetchFn();
  
  // Store in cache
  cache.set(key, data, ttl);
  
  return data;
}

/**
 * Cache wrapper with error handling
 */
export async function withCacheSafe<T>(
  key: string,
  fetchFn: () => Promise<T>,
  fallbackFn?: () => T,
  ttl?: number
): Promise<T> {
  try {
    return await withCache(key, fetchFn, ttl);
  } catch (error) {
    logger.warn(`⚠️ Cache operation failed for key: ${key} - ${error instanceof Error ? error.message : String(error)}`);
    
    // Try to return cached data even if expired
    const cached = cache.get<T>(key);
    if (cached !== null) {
      logger.debug(`🔄 Returning stale cache data for key: ${key}`);
      return cached;
    }
    
    // Use fallback if available
    if (fallbackFn) {
      return fallbackFn();
    }
    
    throw error;
  }
}

// 📊 EXPORT METRICS FOR MONITORING
export function getCacheMetrics() {
  return cache.getMetrics();
}

export function getCacheStats() {
  return cache.getDetailedStats();
}

// 🧹 EXPORT CACHE MANAGEMENT
export function clearCache(type?: string) {
  if (type) {
    return cache.clearCacheType(type);
  }
  cache.clearAll();
  return 0;
} 