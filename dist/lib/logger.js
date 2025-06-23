"use strict";
/**
 * logger.ts - Centralized logging utility for TubeMind
 *
 * This file provides standardized logging functions with timestamps,
 * log levels, and structured formatting to make debugging easier.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.logDebug = logDebug;
exports.logInfo = logInfo;
exports.logWarning = logWarning;
exports.logError = logError;
exports.createLogger = createLogger;
exports.logApiRequest = logApiRequest;
exports.logApiResponse = logApiResponse;
// Log levels
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Format a log message with timestamp, level, and optional metadata
 */
function formatLog(level, message, options = {}) {
    const timestamp = new Date().toISOString();
    const { module = 'app', userId = '', email = '', data } = options;
    const parts = [
        `[${timestamp}]`,
        `[${level}]`,
        `[${module}]`,
        userId ? `[User: ${userId}]` : '',
        email ? `[Email: ${email}]` : '',
        message
    ];
    const logMessage = parts.filter(Boolean).join(' ');
    if (data) {
        return `${logMessage}\n${JSON.stringify(data, null, 2)}`;
    }
    return logMessage;
}
/**
 * Log a debug message (detailed information for debugging)
 */
function logDebug(message, options = {}) {
    if (process.env.NODE_ENV === 'production')
        return; // Skip in production
    console.log(formatLog(LogLevel.DEBUG, message, options));
}
/**
 * Log an info message (general information about system operation)
 */
function logInfo(message, options = {}) {
    console.log(formatLog(LogLevel.INFO, message, options));
}
/**
 * Log a warning message (potential issues that aren't errors)
 */
function logWarning(message, options = {}) {
    console.warn(formatLog(LogLevel.WARN, message, options));
}
/**
 * Log an error message (errors that need attention)
 */
function logError(message, options = {}) {
    console.error(formatLog(LogLevel.ERROR, message, options));
}
/**
 * Create a logger instance for a specific module
 */
function createLogger(module) {
    const log = (level, message, options = {}) => {
        const timestamp = new Date().toISOString();
        const logData = {
            ...options,
            userId: options.userId,
            email: options.email,
        };
        // Main log message
        const logMessage = `[${timestamp}] [${level}] [${module}] ${message}`;
        // Log to console with structured data
        switch (level) {
            case LogLevel.ERROR:
                console.error(logMessage, logData);
                break;
            case LogLevel.WARN:
                console.warn(logMessage, logData);
                break;
            case LogLevel.DEBUG:
                // Avoid verbose debug logs in production
                if (process.env.NODE_ENV !== 'production') {
                    console.debug(logMessage, logData);
                }
                break;
            case LogLevel.INFO:
            default:
                console.info(logMessage, logData);
                break;
        }
    };
    return {
        debug: (message, options = {}) => log(LogLevel.DEBUG, message, options),
        info: (message, options = {}) => log(LogLevel.INFO, message, options),
        warn: (message, options = {}) => log(LogLevel.WARN, message, options),
        error: (message, options = {}) => log(LogLevel.ERROR, message, options),
    };
}
/**
 * Log API request details
 */
function logApiRequest(req, module, userId) {
    const method = req.method;
    const url = req.url;
    const body = req.body ? `\nBody: ${JSON.stringify(req.body, null, 2)}` : '';
    const query = req.query ? `\nQuery: ${JSON.stringify(req.query, null, 2)}` : '';
    logInfo(`API Request: ${method} ${url}${body}${query}`, { module, userId });
}
/**
 * Log API response details
 */
function logApiResponse(status, data, module, userId) {
    const isError = status >= 400;
    const logFn = isError ? logError : logInfo;
    logFn(`API Response: Status ${status}`, { module, userId, data: data });
}
