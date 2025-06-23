"use strict";
// 🎯 PERFORMANCE DECORATORS - Automatic function monitoring
// Decorators for tracking function performance, errors, and metrics
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackPerformance = trackPerformance;
exports.trackErrors = trackErrors;
exports.trackDatabase = trackDatabase;
exports.trackAPI = trackAPI;
exports.trackExternalService = trackExternalService;
exports.trackUserAction = trackUserAction;
const monitoring_1 = require("./monitoring");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('performance');
// Track function performance and errors
function trackPerformance(operation) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            let success = true;
            let error = null;
            try {
                const result = await method.apply(this, args);
                return result;
            }
            catch (err) {
                success = false;
                error = err;
                throw err;
            }
            finally {
                const duration = Date.now() - startTime;
                monitoring_1.monitoring.recordPerformance({
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
                }
                else if (duration > 5000) {
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
function trackErrors(service) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await method.apply(this, args);
            }
            catch (error) {
                monitoring_1.alerts.high(`Error in ${service}.${propertyName}: ${error.message}`, service, {
                    method: propertyName,
                    class: target.constructor.name,
                    error: error.message,
                    stack: error.stack,
                    args: args.length
                });
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
function trackDatabase(operation) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            let success = true;
            try {
                const result = await method.apply(this, args);
                success = true;
                return result;
            }
            catch (error) {
                success = false;
                throw error;
            }
            finally {
                const duration = Date.now() - startTime;
                // Track DB metrics
                monitoring_1.monitoring.incrementCounter('db_queries_total', 1, {
                    operation,
                    success: success.toString()
                });
                monitoring_1.monitoring.recordTimer('db_query_duration', startTime, { operation });
                if (!success) {
                    monitoring_1.monitoring.incrementCounter('db_errors_total', 1, { operation });
                }
                // Alert on slow queries
                if (duration > 2000) {
                    monitoring_1.alerts.medium(`Slow Database Query: ${operation} took ${duration}ms`, 'database', { operation, duration, method: propertyName });
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
function trackAPI(endpoint) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            const request = args[0];
            const httpMethod = request?.method || 'UNKNOWN';
            try {
                const response = await method.apply(this, args);
                const duration = Date.now() - startTime;
                const statusCode = response?.status || 200;
                // Track API metrics
                monitoring_1.monitoring.incrementCounter('api_requests_total', 1, {
                    endpoint,
                    method: httpMethod,
                    status: statusCode.toString()
                });
                monitoring_1.monitoring.recordTimer('api_request_duration', startTime, {
                    endpoint,
                    method: httpMethod
                });
                if (statusCode >= 400) {
                    monitoring_1.monitoring.incrementCounter('api_errors_total', 1, {
                        endpoint,
                        method: httpMethod,
                        status: statusCode.toString()
                    });
                }
                logger.info(`📡 API ${httpMethod} ${endpoint} - ${statusCode} (${duration}ms)`, {
                    data: { endpoint, method: httpMethod, statusCode, duration }
                });
                return response;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                monitoring_1.monitoring.incrementCounter('api_errors_total', 1, {
                    endpoint,
                    method: httpMethod,
                    status: '500'
                });
                monitoring_1.alerts.critical(`API Error: ${httpMethod} ${endpoint} - ${error.message}`, 'api', {
                    endpoint,
                    method: httpMethod,
                    error: error.message,
                    stack: error.stack,
                    duration
                });
                throw error;
            }
        };
        return descriptor;
    };
}
// Track external service calls
function trackExternalService(serviceName) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            let success = true;
            try {
                const result = await method.apply(this, args);
                return result;
            }
            catch (error) {
                success = false;
                monitoring_1.alerts.high(`External Service Error: ${serviceName} - ${error.message}`, 'external-service', {
                    service: serviceName,
                    method: propertyName,
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
            finally {
                const duration = Date.now() - startTime;
                monitoring_1.monitoring.incrementCounter('external_service_calls_total', 1, {
                    service: serviceName,
                    method: propertyName,
                    success: success.toString()
                });
                monitoring_1.monitoring.recordTimer('external_service_duration', startTime, {
                    service: serviceName,
                    method: propertyName
                });
                if (!success) {
                    monitoring_1.monitoring.incrementCounter('external_service_errors_total', 1, {
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
function trackUserAction(actionType) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const userId = args[0]?.userId || args[0]?.id || 'unknown';
            monitoring_1.monitoring.incrementCounter('user_actions_total', 1, {
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
