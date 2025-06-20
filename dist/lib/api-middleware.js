"use strict";
// 🔧 API MIDDLEWARE - Automatic monitoring for all API endpoints
// This middleware automatically tracks API performance, errors, and metrics
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackApiRequest = trackApiRequest;
exports.trackApiResponse = trackApiResponse;
exports.withMonitoring = withMonitoring;
exports.trackDatabaseQuery = trackDatabaseQuery;
exports.trackVideoProcessing = trackVideoProcessing;
exports.trackUserAction = trackUserAction;
const server_1 = require("next/server");
const logger_1 = require("./logger");
const monitoring_1 = require("./monitoring");
const logger = (0, logger_1.createLogger)('api-middleware');
// Store request metrics temporarily
const activeRequests = new Map();
function trackApiRequest(request) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endpoint = getEndpointFromUrl(request.url);
    const method = request.method;
    // Store request start time
    activeRequests.set(requestId, {
        startTime: Date.now(),
        endpoint,
        method,
        userId: getUserIdFromRequest(request)
    });
    // Track API request start
    monitoring_1.metrics.apiRequest(endpoint, method, 0, Date.now());
    logger.debug(`📥 API Request started: ${method} ${endpoint}`, {
        data: { requestId, endpoint, method }
    });
    return requestId;
}
function trackApiResponse(requestId, response) {
    const requestMetrics = activeRequests.get(requestId);
    if (requestMetrics) {
        const duration = Date.now() - requestMetrics.startTime;
        const statusCode = response.status;
        // Track API response metrics
        monitoring_1.metrics.apiRequest(requestMetrics.endpoint, requestMetrics.method, statusCode, duration);
        // Record performance
        monitoring_1.monitoring.recordPerformance({
            operation: `api_${requestMetrics.endpoint}`,
            duration,
            success: statusCode < 400,
            userId: requestMetrics.userId,
            metadata: {
                endpoint: requestMetrics.endpoint,
                method: requestMetrics.method,
                statusCode
            }
        });
        // Track errors
        if (statusCode >= 400) {
            const severity = statusCode >= 500 ? 'high' : 'medium';
            monitoring_1.alerts[severity](`API Error: ${requestMetrics.method} ${requestMetrics.endpoint} returned ${statusCode}`, 'api', {
                endpoint: requestMetrics.endpoint,
                method: requestMetrics.method,
                statusCode,
                duration,
                userId: requestMetrics.userId
            });
        }
        // Track slow requests
        if (duration > 3000) { // 3 seconds
            monitoring_1.alerts.medium(`Slow API Request: ${requestMetrics.method} ${requestMetrics.endpoint} took ${duration}ms`, 'performance', {
                endpoint: requestMetrics.endpoint,
                method: requestMetrics.method,
                duration,
                userId: requestMetrics.userId
            });
        }
        logger.info(`📤 API Response: ${requestMetrics.method} ${requestMetrics.endpoint} - ${statusCode} (${duration}ms)`, {
            data: {
                requestId,
                endpoint: requestMetrics.endpoint,
                method: requestMetrics.method,
                statusCode,
                duration,
                userId: requestMetrics.userId
            }
        });
        // Clean up
        activeRequests.delete(requestId);
    }
    return response;
}
// Higher-order function to wrap API handlers with monitoring
function withMonitoring(handler, endpointName) {
    return (async (...args) => {
        const request = args[0];
        const requestId = trackApiRequest(request);
        try {
            const response = await handler(...args);
            return trackApiResponse(requestId, response);
        }
        catch (error) {
            // Handle uncaught errors
            const requestMetrics = activeRequests.get(requestId);
            const endpoint = endpointName || (requestMetrics?.endpoint) || 'unknown';
            monitoring_1.alerts.critical(`Uncaught API Error: ${error.message}`, 'api', {
                endpoint,
                method: request.method,
                error: error.message,
                stack: error.stack,
                userId: requestMetrics?.userId
            });
            logger.error(`💥 Uncaught API Error in ${endpoint}`, {
                data: {
                    requestId,
                    endpoint,
                    method: request.method,
                    error: error.message,
                    stack: error.stack
                }
            });
            // Clean up
            activeRequests.delete(requestId);
            // Return a generic error response
            return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    });
}
// Database operation tracking
function trackDatabaseQuery(operation, queryFn) {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        try {
            const result = await queryFn();
            const duration = Date.now() - startTime;
            // Track successful DB query
            monitoring_1.metrics.dbQuery(operation, duration, true);
            monitoring_1.monitoring.recordPerformance({
                operation: `db_${operation}`,
                duration,
                success: true,
                metadata: { operation }
            });
            // Alert on slow queries
            if (duration > 2000) { // 2 seconds
                monitoring_1.alerts.medium(`Slow Database Query: ${operation} took ${duration}ms`, 'database', { operation, duration });
            }
            logger.debug(`🗃️ DB Query completed: ${operation} (${duration}ms)`, {
                data: { operation, duration, success: true }
            });
            resolve(result);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Track failed DB query
            monitoring_1.metrics.dbQuery(operation, duration, false);
            monitoring_1.monitoring.recordPerformance({
                operation: `db_${operation}`,
                duration,
                success: false,
                metadata: { operation, error: error.message }
            });
            monitoring_1.alerts.high(`Database Query Failed: ${operation} - ${error.message}`, 'database', {
                operation,
                duration,
                error: error.message,
                stack: error.stack
            });
            logger.error(`❌ DB Query failed: ${operation}`, {
                data: {
                    operation,
                    duration,
                    error: error.message,
                    stack: error.stack
                }
            });
            reject(error);
        }
    });
}
// Business metrics tracking
function trackVideoProcessing(userId, videoId, creditsUsed) {
    const startTime = Date.now();
    return {
        complete: (success, metadata) => {
            const duration = Date.now() - startTime;
            if (success) {
                monitoring_1.metrics.videoProcessed(userId, duration, creditsUsed);
                monitoring_1.monitoring.recordPerformance({
                    operation: 'video_processing',
                    duration,
                    success: true,
                    userId,
                    metadata: { videoId, creditsUsed, ...metadata }
                });
                logger.info(`🎬 Video processing completed for user ${userId}`, {
                    data: { userId, videoId, duration, creditsUsed, ...metadata }
                });
            }
            else {
                monitoring_1.alerts.medium(`Video processing failed for user ${userId}`, 'video-processing', { userId, videoId, duration, creditsUsed, ...metadata });
                monitoring_1.monitoring.recordPerformance({
                    operation: 'video_processing',
                    duration,
                    success: false,
                    userId,
                    metadata: { videoId, creditsUsed, ...metadata }
                });
                logger.warn(`⚠️ Video processing failed for user ${userId}`, {
                    data: { userId, videoId, duration, creditsUsed, ...metadata }
                });
            }
        }
    };
}
// User action tracking
function trackUserAction(action, userId, metadata) {
    monitoring_1.metrics.userAction(action, userId);
    logger.info(`👤 User action: ${action}`, {
        data: { action, userId, ...metadata }
    });
}
// Utility functions
function getEndpointFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        // Extract API endpoint pattern (remove /api prefix and dynamic segments)
        const endpoint = pathname
            .replace(/^\/api/, '')
            .replace(/\/[^\/]*\d+[^\/]*/, '/:id') // Replace numeric IDs
            .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i, '/:uuid') // Replace UUIDs
            || '/';
        return endpoint;
    }
    catch {
        return '/unknown';
    }
}
function getUserIdFromRequest(request) {
    // Try to extract user ID from various sources
    try {
        // From headers (if set by auth middleware)
        const userIdHeader = request.headers.get('x-user-id');
        if (userIdHeader)
            return userIdHeader;
        // From cookies (Clerk auth)
        const authCookie = request.cookies.get('__session');
        if (authCookie) {
            // In a real implementation, you'd decode the session
            // For now, just return a placeholder
            return 'authenticated-user';
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
