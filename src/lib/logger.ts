/**
 * logger.ts - Centralized logging utility for TubeMind
 * 
 * This file provides standardized logging functions with timestamps,
 * log levels, and structured formatting to make debugging easier.
 */

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogOptions {
  module?: string;
  userId?: string;
  email?: string;
  [key: string]: any; // Allow any other properties for structured logging
}

/**
 * Format a log message with timestamp, level, and optional metadata
 */
function formatLog(level: LogLevel, message: string, options: LogOptions = {}) {
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
export function logDebug(message: string, options: LogOptions = {}) {
  if (process.env.NODE_ENV === 'production') return; // Skip in production
  console.log(formatLog(LogLevel.DEBUG, message, options));
}

/**
 * Log an info message (general information about system operation)
 */
export function logInfo(message: string, options: LogOptions = {}) {
  console.log(formatLog(LogLevel.INFO, message, options));
}

/**
 * Log a warning message (potential issues that aren't errors)
 */
export function logWarning(message: string, options: LogOptions = {}) {
  console.warn(formatLog(LogLevel.WARN, message, options));
}

/**
 * Log an error message (errors that need attention)
 */
export function logError(message: string, options: LogOptions = {}) {
  console.error(formatLog(LogLevel.ERROR, message, options));
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string) {
  const log = (level: LogLevel, message: string, options: Omit<LogOptions, 'module'> = {}) => {
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
    debug: (message: string, options: Omit<LogOptions, 'module'> = {}) => 
      log(LogLevel.DEBUG, message, options),
    info: (message: string, options: Omit<LogOptions, 'module'> = {}) => 
      log(LogLevel.INFO, message, options),
    warn: (message: string, options: Omit<LogOptions, 'module'> = {}) => 
      log(LogLevel.WARN, message, options),
    error: (message: string, options: Omit<LogOptions, 'module'> = {}) => 
      log(LogLevel.ERROR, message, options),
  };
}

/**
 * Log API request details
 */
export function logApiRequest(req: any, module: string, userId?: string) {
  const method = req.method;
  const url = req.url;
  const body = req.body ? `\nBody: ${JSON.stringify(req.body, null, 2)}` : '';
  const query = req.query ? `\nQuery: ${JSON.stringify(req.query, null, 2)}` : '';
  
  logInfo(`API Request: ${method} ${url}${body}${query}`, { module, userId });
}

/**
 * Log API response details
 */
export function logApiResponse(status: number, data: any, module: string, userId?: string) {
  const isError = status >= 400;
  const logFn = isError ? logError : logInfo;
  
  logFn(
    `API Response: Status ${status}`,
    { module, userId, data: data }
  );
} 