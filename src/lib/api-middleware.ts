// 🔧 API MIDDLEWARE - Automatic monitoring for all API endpoints
// This middleware automatically tracks API performance, errors, and metrics

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from './logger';
import { metrics, alerts, monitoring } from './monitoring';

const logger = createLogger('api-middleware');

interface RequestMetrics {
  startTime: number;
  endpoint: string;
  method: string;
  userId?: string;
}

// Store request metrics temporarily
const activeRequests = new Map<string, RequestMetrics>();

export function trackApiRequest(request: NextRequest): string {
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
  metrics.apiRequest(endpoint, method, 0, Date.now());
  
  logger.debug(`📥 API Request started: ${method} ${endpoint}`, {
    data: { requestId, endpoint, method }
  });

  return requestId;
}

export function trackApiResponse(requestId: string, response: NextResponse): NextResponse {
  const requestMetrics = activeRequests.get(requestId);
  
  if (requestMetrics) {
    const duration = Date.now() - requestMetrics.startTime;
    const statusCode = response.status;
    
    // Track API response metrics
    metrics.apiRequest(
      requestMetrics.endpoint,
      requestMetrics.method,
      statusCode,
      duration
    );

    // Record performance
    monitoring.recordPerformance({
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
      alerts[severity](
        `API Error: ${requestMetrics.method} ${requestMetrics.endpoint} returned ${statusCode}`,
        'api',
        {
          endpoint: requestMetrics.endpoint,
          method: requestMetrics.method,
          statusCode,
          duration,
          userId: requestMetrics.userId
        }
      );
    }

    // Track slow requests
    if (duration > 3000) { // 3 seconds
      alerts.medium(
        `Slow API Request: ${requestMetrics.method} ${requestMetrics.endpoint} took ${duration}ms`,
        'performance',
        {
          endpoint: requestMetrics.endpoint,
          method: requestMetrics.method,
          duration,
          userId: requestMetrics.userId
        }
      );
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
export function withMonitoring<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  endpointName?: string
): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;
    const requestId = trackApiRequest(request);
    
    try {
      const response = await handler(...args);
      return trackApiResponse(requestId, response);
    } catch (error: any) {
      // Handle uncaught errors
      const requestMetrics = activeRequests.get(requestId);
      const endpoint = endpointName || (requestMetrics?.endpoint) || 'unknown';
      
      alerts.critical(
        `Uncaught API Error: ${error.message}`,
        'api',
        {
          endpoint,
          method: request.method,
          error: error.message,
          stack: error.stack,
          userId: requestMetrics?.userId
        }
      );

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
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }) as T;
}

// Database operation tracking
export function trackDatabaseQuery<T>(
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      // Track successful DB query
      metrics.dbQuery(operation, duration, true);
      
      monitoring.recordPerformance({
        operation: `db_${operation}`,
        duration,
        success: true,
        metadata: { operation }
      });

      // Alert on slow queries
      if (duration > 2000) { // 2 seconds
        alerts.medium(
          `Slow Database Query: ${operation} took ${duration}ms`,
          'database',
          { operation, duration }
        );
      }

      logger.debug(`🗃️ DB Query completed: ${operation} (${duration}ms)`, {
        data: { operation, duration, success: true }
      });

      resolve(result);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Track failed DB query
      metrics.dbQuery(operation, duration, false);
      
      monitoring.recordPerformance({
        operation: `db_${operation}`,
        duration,
        success: false,
        metadata: { operation, error: error.message }
      });

      alerts.high(
        `Database Query Failed: ${operation} - ${error.message}`,
        'database',
        {
          operation,
          duration,
          error: error.message,
          stack: error.stack
        }
      );

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
export function trackVideoProcessing(userId: string, videoId: string, creditsUsed: number) {
  const startTime = Date.now();
  
  return {
    complete: (success: boolean, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      
      if (success) {
        metrics.videoProcessed(userId, duration, creditsUsed);
        
        monitoring.recordPerformance({
          operation: 'video_processing',
          duration,
          success: true,
          userId,
          metadata: { videoId, creditsUsed, ...metadata }
        });

        logger.info(`🎬 Video processing completed for user ${userId}`, {
          data: { userId, videoId, duration, creditsUsed, ...metadata }
        });
      } else {
        alerts.medium(
          `Video processing failed for user ${userId}`,
          'video-processing',
          { userId, videoId, duration, creditsUsed, ...metadata }
        );

        monitoring.recordPerformance({
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
export function trackUserAction(action: string, userId: string, metadata?: Record<string, any>) {
  metrics.userAction(action, userId);
  
  logger.info(`👤 User action: ${action}`, {
    data: { action, userId, ...metadata }
  });
}

// Utility functions
function getEndpointFromUrl(url: string): string {
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
  } catch {
    return '/unknown';
  }
}

function getUserIdFromRequest(request: NextRequest): string | undefined {
  // Try to extract user ID from various sources
  try {
    // From headers (if set by auth middleware)
    const userIdHeader = request.headers.get('x-user-id');
    if (userIdHeader) return userIdHeader;
    
    // From cookies (Clerk auth)
    const authCookie = request.cookies.get('__session');
    if (authCookie) {
      // In a real implementation, you'd decode the session
      // For now, just return a placeholder
      return 'authenticated-user';
    }
    
    return undefined;
  } catch {
    return undefined;
  }
} 