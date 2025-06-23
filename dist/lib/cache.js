"use strict";
// ⚡ PHASE 2.3: COMPREHENSIVE CACHING SYSTEM
// Dramatically improves performance and reduces costs
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.getCacheManager = getCacheManager;
exports.withCache = withCache;
exports.withCacheSafe = withCacheSafe;
exports.getCacheMetrics = getCacheMetrics;
exports.getCacheStats = getCacheStats;
exports.clearCache = clearCache;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('cache');
// 🚀 MULTI-LAYER CACHE MANAGER
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.metrics = { hits: 0, misses: 0 };
        this.cleanupInterval = null;
        // 🎯 CACHE CONFIGURATION
        this.config = {
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
        this.startCleanupProcess();
    }
    static getInstance() {
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
    get(key) {
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
        return item.data;
    }
    /**
     * Set item in cache
     * @param key Cache key
     * @param data Data to cache
     * @param ttl Time to live in milliseconds (optional)
     */
    set(key, data, ttl) {
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
    cacheYouTubeTranscript(videoId, transcript) {
        const key = `yt_transcript:${videoId}`;
        this.set(key, transcript, this.config.ttl.videoTranscript);
        logger.info(`📝 Cached transcript for video: ${videoId}`);
    }
    /**
     * Get cached YouTube transcript
     */
    getCachedYouTubeTranscript(videoId) {
        const key = `yt_transcript:${videoId}`;
        const cached = this.get(key);
        if (cached) {
            logger.debug(`⚡ Cache HIT for transcript: ${videoId}`);
        }
        return cached;
    }
    /**
     * Cache video metadata
     */
    cacheVideoMetadata(videoId, metadata) {
        const key = `yt_metadata:${videoId}`;
        this.set(key, metadata, this.config.ttl.videoMetadata);
        logger.info(`📊 Cached metadata for video: ${videoId}`);
    }
    /**
     * Get cached video metadata
     */
    getCachedVideoMetadata(videoId) {
        const key = `yt_metadata:${videoId}`;
        const cached = this.get(key);
        if (cached) {
            logger.debug(`⚡ Cache HIT for metadata: ${videoId}`);
        }
        return cached;
    }
    /**
     * Cache AI processing results (very long-term)
     */
    cacheAIProcessing(videoId, userId, result) {
        const key = `ai_result:${userId}:${videoId}`;
        this.set(key, result, this.config.ttl.aiProcessing);
        logger.info(`🤖 Cached AI result for user: ${userId}, video: ${videoId}`);
    }
    /**
     * Get cached AI processing results
     */
    getCachedAIProcessing(videoId, userId) {
        const key = `ai_result:${userId}:${videoId}`;
        const cached = this.get(key);
        if (cached) {
            logger.debug(`⚡ Cache HIT for AI result: ${userId}:${videoId}`);
        }
        return cached;
    }
    /**
     * Cache user subscription data (short-term)
     */
    cacheUserSubscription(userId, subscription) {
        const key = `user_sub:${userId}`;
        this.set(key, subscription, this.config.ttl.userSubscription);
    }
    /**
     * Get cached user subscription
     */
    getCachedUserSubscription(userId) {
        const key = `user_sub:${userId}`;
        return this.get(key);
    }
    /**
     * Invalidate user subscription cache (when subscription changes)
     */
    invalidateUserSubscription(userId) {
        const key = `user_sub:${userId}`;
        this.memoryCache.delete(key);
        logger.info(`🗑️ Invalidated subscription cache for user: ${userId}`);
    }
    // 🚀 PHASE 5.2: ENHANCED SMART CACHING FOR AI PROCESSING
    /**
     * Check if video has been processed for ANY user (for transcript sharing)
     * This allows us to reuse transcripts across users for massive cost savings
     */
    getSharedTranscriptProcessing(videoId) {
        // Check if ANY user has processed this video's transcript
        const sharedKey = `shared_transcript:${videoId}`;
        const cached = this.get(sharedKey);
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
    cacheSharedTranscriptProcessing(videoId, transcriptData) {
        const sharedKey = `shared_transcript:${videoId}`;
        // Cache for 30 days since transcripts rarely change
        this.set(sharedKey, transcriptData, 30 * 24 * 60 * 60 * 1000);
        logger.info(`💎 Cached SHARED transcript processing for video: ${videoId}`);
    }
    /**
     * Smart AI caching with content-based keys
     * Same content = same result, regardless of user
     */
    cacheAIByContent(contentHash, aiResult, operation) {
        const key = `ai_content:${operation}:${contentHash}`;
        this.set(key, aiResult, this.config.ttl.aiProcessing);
        logger.info(`🧠 Cached AI result by content hash: ${operation}:${contentHash.substring(0, 8)}...`);
    }
    /**
     * Get AI result by content hash
     */
    getAIByContent(contentHash, operation) {
        const key = `ai_content:${operation}:${contentHash}`;
        const cached = this.get(key);
        if (cached) {
            logger.debug(`🧠 Content-based cache HIT: ${operation}:${contentHash.substring(0, 8)}...`);
        }
        return cached;
    }
    /**
     * Cache expensive YouTube API calls
     */
    cacheYouTubeAPICall(endpoint, params, result) {
        const paramsStr = JSON.stringify(params);
        const key = `yt_api:${endpoint}:${Buffer.from(paramsStr).toString('base64').substring(0, 32)}`;
        this.set(key, result, this.config.ttl.videoMetadata);
        logger.info(`📺 Cached YouTube API call: ${endpoint}`);
    }
    /**
     * Get cached YouTube API result
     */
    getCachedYouTubeAPICall(endpoint, params) {
        const paramsStr = JSON.stringify(params);
        const key = `yt_api:${endpoint}:${Buffer.from(paramsStr).toString('base64').substring(0, 32)}`;
        const cached = this.get(key);
        if (cached) {
            logger.debug(`📺 YouTube API cache HIT: ${endpoint}`);
        }
        return cached;
    }
    /**
     * Smart invalidation for AI results when video updates
     */
    invalidateVideoProcessing(videoId) {
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
    preWarmCache(popularVideoIds) {
        logger.info(`🔥 Pre-warming cache for ${popularVideoIds.length} popular videos`);
        // This would trigger background processing for popular videos
        // Implementation depends on your background job system
    }
    /**
     * Get cache efficiency report
     */
    getCacheEfficiencyReport() {
        const totalRequests = this.metrics.hits + this.metrics.misses;
        const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
        // Categorize cache by type
        const cacheByType = {};
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
    estimateCostSavings() {
        // Rough estimates based on typical costs
        const estimates = {
            youtubeAPICall: 0.001, // $0.001 per call saved
            aiProcessing: 0.05, // $0.05 per AI call saved
            transcriptFetch: 0.002, // $0.002 per transcript fetch saved
        };
        let totalSavings = 0;
        let breakdown = {};
        for (const [key, item] of this.memoryCache) {
            const type = key.split(':')[0];
            let costPerHit = 0;
            if (type === 'yt_api' || type === 'yt_metadata')
                costPerHit = estimates.youtubeAPICall;
            else if (type === 'ai_result' || type === 'ai_content')
                costPerHit = estimates.aiProcessing;
            else if (type === 'yt_transcript')
                costPerHit = estimates.transcriptFetch;
            const savings = item.hits * costPerHit;
            totalSavings += savings;
            if (!breakdown[type])
                breakdown[type] = { hits: 0, savings: 0 };
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
    getCacheRecommendations(hitRate) {
        const recommendations = [];
        if (hitRate < 50) {
            recommendations.push("🔴 Low cache hit rate - consider increasing TTL for stable data");
        }
        else if (hitRate < 75) {
            recommendations.push("🟡 Moderate cache hit rate - review caching strategy");
        }
        else {
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
    cleanup() {
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
    evictOldestItems(count) {
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
    startCleanupProcess() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    // 📊 CACHE METRICS & MONITORING
    /**
     * Get cache performance metrics
     */
    getMetrics() {
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
    getDetailedStats() {
        const stats = {
            totalItems: this.memoryCache.size,
            itemsByType: {},
            oldestItem: null,
            newestItem: null,
            topHitItems: []
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
    clearCacheType(type) {
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
    clearAll() {
        const size = this.memoryCache.size;
        this.memoryCache.clear();
        this.metrics = { hits: 0, misses: 0 };
        logger.info(`🗑️ Cache cleared: removed ${size} items`);
    }
    /**
     * Graceful shutdown
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clearAll();
        logger.info('⚡ Cache system shutdown complete');
    }
}
// 🎯 EXPORTED CACHE INSTANCE
exports.cache = CacheManager.getInstance();
// Export the cache manager function for compatibility
function getCacheManager() {
    return CacheManager.getInstance();
}
// 🚀 CACHE-OPTIMIZED UTILITY FUNCTIONS
/**
 * Generic cache wrapper for expensive operations
 */
async function withCache(key, fetchFn, ttl) {
    // Try cache first
    const cached = exports.cache.get(key);
    if (cached !== null) {
        return cached;
    }
    // Cache miss - fetch data
    logger.info(`🔄 Cache MISS for key: ${key}, fetching...`);
    const data = await fetchFn();
    // Store in cache
    exports.cache.set(key, data, ttl);
    return data;
}
/**
 * Cache wrapper with error handling
 */
async function withCacheSafe(key, fetchFn, fallbackFn, ttl) {
    try {
        return await withCache(key, fetchFn, ttl);
    }
    catch (error) {
        logger.warn(`⚠️ Cache operation failed for key: ${key} - ${error instanceof Error ? error.message : String(error)}`);
        // Try to return cached data even if expired
        const cached = exports.cache.get(key);
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
function getCacheMetrics() {
    return exports.cache.getMetrics();
}
function getCacheStats() {
    return exports.cache.getDetailedStats();
}
// 🧹 EXPORT CACHE MANAGEMENT
function clearCache(type) {
    if (type) {
        return exports.cache.clearCacheType(type);
    }
    exports.cache.clearAll();
    return 0;
}
