"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCRIPT_CONFIG = void 0;
// Transcript fetching configuration
exports.TRANSCRIPT_CONFIG = {
    // Retry settings
    maxRetries: 5,
    initialRetryDelay: 1000, // 1 second
    maxRetryDelay: 10000, // 10 seconds
    timeoutMs: 60000, // 60 seconds
    // Supadata.ai Configuration
    supadataApiKey: process.env.SUPADATA_API_KEY,
    // Cache settings
    cacheEnabled: true,
    cacheDurationMs: 30 * 60 * 1000, // 30 minutes
    cacheCleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
    // Debug settings
    verboseLogging: process.env.NODE_ENV === 'development',
    logSuccessfulAttempts: true,
    logFailedAttempts: true
};
// Environment variable overrides
if (process.env.TRANSCRIPT_MAX_RETRIES) {
    exports.TRANSCRIPT_CONFIG.maxRetries = parseInt(process.env.TRANSCRIPT_MAX_RETRIES, 10);
}
if (process.env.TRANSCRIPT_TIMEOUT_MS) {
    exports.TRANSCRIPT_CONFIG.timeoutMs = parseInt(process.env.TRANSCRIPT_TIMEOUT_MS, 10);
}
if (process.env.TRANSCRIPT_CACHE_DISABLED === 'true') {
    exports.TRANSCRIPT_CONFIG.cacheEnabled = false;
}
exports.default = exports.TRANSCRIPT_CONFIG;
