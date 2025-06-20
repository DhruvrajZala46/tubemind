// 🎯 PERFORMANCE DECORATORS - Automatic function monitoring
// Decorators for tracking function performance, errors, and metrics

import { monitoring, alerts } from './monitoring';
import { createLogger } from './logger';

const logger = createLogger('performance');

// Track function performance and errors
export function trackPerformance(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: any = null;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err;
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        
        monitoring.recordPerformance({
          operation: operation || `${target.constructor.name}.${propertyName}`,
          duration,
          success,
          metadata: { 
            error: error?.message,
            class: target.constructor.name,
            method: propertyName
          }
        });

        if (!success) {
          logger.error(`❌ Performance tracking: ${operation} failed`, {
            data: {
              operation,
              duration,
              error: error?.message,
              stack: error?.stack
            }
          });
        } else if (duration > 5000) {
          logger.warn(`⚠️ Performance tracking: ${operation} slow execution`, {
            data: {
              operation,
              duration,
              threshold: 5000
            }
          });
        }
      }
    };

    return descriptor;
  };
}

// Track errors and send alerts
export function trackErrors(service: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error: any) {
        alerts.high(
          `Error in ${service}.${propertyName}: ${error.message}`,
          service,
          {
            method: propertyName,
            class: target.constructor.name,
            error: error.message,
            stack: error.stack,
            args: args.length
          }
        );

        logger.error(`🚨 Error tracking: ${service}.${propertyName}`, {
          data: {
            service,
            method: propertyName,
            error: error.message,
            stack: error.stack
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// Track database operations
export function trackDatabase(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;

      try {
        const result = await method.apply(this, args);
        success = true;
        return result;
      } catch (error: any) {
        success = false;
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        
        // Track DB metrics
        monitoring.incrementCounter('db_queries_total', 1, { 
          operation, 
          success: success.toString() 
        });
        
        monitoring.recordTimer('db_query_duration', startTime, { operation });

        if (!success) {
          monitoring.incrementCounter('db_errors_total', 1, { operation });
        }

        // Alert on slow queries
        if (duration > 2000) {
          alerts.medium(
            `Slow Database Query: ${operation} took ${duration}ms`,
            'database',
            { operation, duration, method: propertyName }
          );
        }

        logger.debug(`🗃️ DB Operation: ${operation} (${duration}ms)`, {
          data: { operation, duration, success, method: propertyName }
        });
      }
    };

    return descriptor;
  };
}

// Track API endpoints
export function trackAPI(endpoint: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const request = args[0];
      const httpMethod = request?.method || 'UNKNOWN';
      
      try {
        const response = await method.apply(this, args);
        const duration = Date.now() - startTime;
        const statusCode = response?.status || 200;
        
        // Track API metrics
        monitoring.incrementCounter('api_requests_total', 1, {
          endpoint,
          method: httpMethod,
          status: statusCode.toString()
        });
        
        monitoring.recordTimer('api_request_duration', startTime, {
          endpoint,
          method: httpMethod
        });

        if (statusCode >= 400) {
          monitoring.incrementCounter('api_errors_total', 1, {
            endpoint,
            method: httpMethod,
            status: statusCode.toString()
          });
        }

        logger.info(`📡 API ${httpMethod} ${endpoint} - ${statusCode} (${duration}ms)`, {
          data: { endpoint, method: httpMethod, statusCode, duration }
        });

        return response;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        monitoring.incrementCounter('api_errors_total', 1, {
          endpoint,
          method: httpMethod,
          status: '500'
        });

        alerts.critical(
          `API Error: ${httpMethod} ${endpoint} - ${error.message}`,
          'api',
          {
            endpoint,
            method: httpMethod,
            error: error.message,
            stack: error.stack,
            duration
          }
        );

        throw error;
      }
    };

    return descriptor;
  };
}

// Track external service calls
export function trackExternalService(serviceName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (error: any) {
        success = false;
        
        alerts.high(
          `External Service Error: ${serviceName} - ${error.message}`,
          'external-service',
          {
            service: serviceName,
            method: propertyName,
            error: error.message,
            stack: error.stack
          }
        );
        
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        
        monitoring.incrementCounter('external_service_calls_total', 1, {
          service: serviceName,
          method: propertyName,
          success: success.toString()
        });
        
        monitoring.recordTimer('external_service_duration', startTime, {
          service: serviceName,
          method: propertyName
        });

        if (!success) {
          monitoring.incrementCounter('external_service_errors_total', 1, {
            service: serviceName,
            method: propertyName
          });
        }

        logger.debug(`🌐 External Service: ${serviceName}.${propertyName} (${duration}ms)`, {
          data: { service: serviceName, method: propertyName, duration, success }
        });
      }
    };

    return descriptor;
  };
}

// Track user actions
export function trackUserAction(actionType: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const userId = args[0]?.userId || args[0]?.id || 'unknown';
      
      monitoring.incrementCounter('user_actions_total', 1, {
        action: actionType,
        method: propertyName
      });

      logger.info(`👤 User Action: ${actionType}`, {
        data: { action: actionType, userId, method: propertyName }
      });

      return await method.apply(this, args);
    };

    return descriptor;
  };
} 