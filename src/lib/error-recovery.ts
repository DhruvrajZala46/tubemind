// 🔄 PHASE 2.4: COMPREHENSIVE ERROR RECOVERY SYSTEM
// Automatically handles failures and provides graceful fallbacks

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

interface ErrorRecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attemptsUsed: number;
  totalTime: number;
  recovered: boolean;
}

interface FallbackStrategy<T> {
  name: string;
  execute: () => Promise<T>;
  priority: number;
}

// 🎯 ERROR CLASSIFICATION
export enum ErrorType {
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
  QUOTA_EXCEEDED = 'quota_exceeded',
  UNKNOWN = 'unknown'
}

// 🚀 COMPREHENSIVE ERROR RECOVERY MANAGER
class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private metrics: {
    totalOperations: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    byErrorType: Record<ErrorType, number>;
  } = {
    totalOperations: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    byErrorType: {
      [ErrorType.NETWORK]: 0,
      [ErrorType.RATE_LIMIT]: 0,
      [ErrorType.AUTHENTICATION]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.SERVER_ERROR]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.QUOTA_EXCEEDED]: 0,
      [ErrorType.UNKNOWN]: 0,
    }
  };

  private constructor() {
    console.log('🔄 Error Recovery System initialized');
  }

  public static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  // 🕵️ ERROR CLASSIFICATION
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network-related errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      name.includes('networkerror')
    ) {
      return ErrorType.NETWORK;
    }

    // Rate limiting
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      name.includes('ratelimit')
    ) {
      return ErrorType.RATE_LIMIT;
    }

    // Authentication
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return ErrorType.AUTHENTICATION;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('400') ||
      name.includes('validationerror')
    ) {
      return ErrorType.VALIDATION;
    }

    // Server errors
    if (
      message.includes('internal server error') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return ErrorType.SERVER_ERROR;
    }

    // Quota exceeded
    if (
      message.includes('quota') ||
      message.includes('limit exceeded') ||
      message.includes('usage limit')
    ) {
      return ErrorType.QUOTA_EXCEEDED;
    }

    return ErrorType.UNKNOWN;
  }

  // ⚙️ RETRY CONFIGURATION BASED ON ERROR TYPE
  private getRetryConfig(errorType: ErrorType): RetryConfig {
    const configs: Record<ErrorType, RetryConfig> = {
      [ErrorType.NETWORK]: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true
      },
      [ErrorType.RATE_LIMIT]: {
        maxAttempts: 3,
        baseDelay: 5000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: true
      },
      [ErrorType.SERVER_ERROR]: {
        maxAttempts: 4,
        baseDelay: 2000,
        maxDelay: 20000,
        backoffMultiplier: 1.5,
        jitter: true
      },
      [ErrorType.TIMEOUT]: {
        maxAttempts: 3,
        baseDelay: 3000,
        maxDelay: 15000,
        backoffMultiplier: 2,
        jitter: false
      },
      [ErrorType.AUTHENTICATION]: {
        maxAttempts: 1, // Don't retry auth errors
        baseDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1,
        jitter: false
      },
      [ErrorType.VALIDATION]: {
        maxAttempts: 1, // Don't retry validation errors
        baseDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1,
        jitter: false
      },
      [ErrorType.QUOTA_EXCEEDED]: {
        maxAttempts: 2,
        baseDelay: 10000,
        maxDelay: 60000,
        backoffMultiplier: 3,
        jitter: true
      },
      [ErrorType.UNKNOWN]: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true
      }
    };

    return configs[errorType];
  }

  // ⏱️ DELAY CALCULATION WITH JITTER
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    if (config.jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay = Math.max(100, delay + jitter); // Minimum 100ms
    }

    return Math.floor(delay);
  }

  // 🔄 CORE RETRY LOGIC
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'Unknown Operation',
    customConfig?: Partial<RetryConfig>
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    let lastError: Error;
    let errorType: ErrorType = ErrorType.UNKNOWN;

    for (let attempt = 1; attempt <= 10; attempt++) { // Max 10 attempts total
      try {
        const result = await operation();
        
        if (attempt > 1) {
          this.metrics.successfulRecoveries++;
          console.log(`✅ ${operationName} succeeded on attempt ${attempt} after ${Date.now() - startTime}ms`);
        }

        return {
          success: true,
          data: result,
          attemptsUsed: attempt,
          totalTime: Date.now() - startTime,
          recovered: attempt > 1
        };

      } catch (error: any) {
        lastError = error;
        errorType = this.classifyError(error);
        this.metrics.byErrorType[errorType]++;

        const config = customConfig ? 
          { ...this.getRetryConfig(errorType), ...customConfig } : 
          this.getRetryConfig(errorType);

        // Check if we should retry
        if (attempt >= config.maxAttempts) {
          console.error(`❌ ${operationName} failed after ${attempt} attempts: ${error.message}`);
          break;
        }

        const delay = this.calculateDelay(attempt, config);
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms: ${error.message}`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.metrics.failedRecoveries++;
    return {
      success: false,
      error: lastError!,
      attemptsUsed: 10,
      totalTime: Date.now() - startTime,
      recovered: false
    };
  }

  // 🎯 FALLBACK EXECUTION
  public async executeWithFallbacks<T>(
    primaryOperation: () => Promise<T>,
    fallbacks: FallbackStrategy<T>[],
    operationName: string = 'Unknown Operation'
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();

    // Try primary operation first
    try {
      console.log(`🎯 Executing primary operation: ${operationName}`);
      const result = await this.executeWithRetry(primaryOperation, operationName);
      
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ Primary operation failed: ${operationName}`);
    }

    // Sort fallbacks by priority
    const sortedFallbacks = fallbacks.sort((a, b) => a.priority - b.priority);

    // Try each fallback
    for (const fallback of sortedFallbacks) {
      try {
        console.log(`🔄 Trying fallback: ${fallback.name}`);
        const result = await this.executeWithRetry(fallback.execute, `${operationName} - ${fallback.name}`);
        
        if (result.success) {
          console.log(`✅ Fallback succeeded: ${fallback.name}`);
          return {
            ...result,
            recovered: true,
            totalTime: Date.now() - startTime
          };
        }
      } catch (error) {
        console.warn(`⚠️ Fallback failed: ${fallback.name} - ${error}`);
      }
    }

    return {
      success: false,
      error: new Error(`All operations failed for: ${operationName}`),
      attemptsUsed: 1 + fallbacks.length,
      totalTime: Date.now() - startTime,
      recovered: false
    };
  }

  // 📊 METRICS
  public getMetrics() {
    const total = this.metrics.successfulRecoveries + this.metrics.failedRecoveries;
    return {
      ...this.metrics,
      recoveryRate: total > 0 ? (this.metrics.successfulRecoveries / total) * 100 : 0
    };
  }

  public resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      byErrorType: Object.keys(ErrorType).reduce((acc, key) => {
        acc[key as ErrorType] = 0;
        return acc;
      }, {} as Record<ErrorType, number>)
    };
  }
}

// 🎯 EXPORTED INSTANCE
export const errorRecovery = ErrorRecoveryManager.getInstance();

// 🚀 CONVENIENCE FUNCTIONS

/**
 * Execute operation with automatic retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName?: string,
  config?: Partial<RetryConfig>
): Promise<T> {
  const result = await errorRecovery.executeWithRetry(operation, operationName, config);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data!;
}

/**
 * Execute operation with fallback strategies
 */
export async function withFallbacks<T>(
  primaryOperation: () => Promise<T>,
  fallbacks: FallbackStrategy<T>[],
  operationName?: string
): Promise<T> {
  const result = await errorRecovery.executeWithFallbacks(
    primaryOperation,
    fallbacks,
    operationName
  );
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data!;
}

/**
 * Create a fallback strategy
 */
export function createFallback<T>(
  name: string,
  execute: () => Promise<T>,
  priority: number = 1
): FallbackStrategy<T> {
  return { name, execute, priority };
}

// 🎯 SPECIALIZED RECOVERY FUNCTIONS FOR OUR USE CASES

/**
 * YouTube API with fallbacks
 */
export async function youtubeWithFallbacks<T>(
  primaryMethod: () => Promise<T>,
  fallbackMethods: Array<{ name: string; method: () => Promise<T> }>
): Promise<T> {
  const fallbacks = fallbackMethods.map((fb, index) => 
    createFallback(fb.name, fb.method, index + 1)
  );

  return withFallbacks(primaryMethod, fallbacks, 'YouTube API Operation');
}

/**
 * Database operation with retry
 */
export async function dbWithRetry<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  return withRetry(operation, `Database: ${operationName}`, {
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 5000
  });
}

/**
 * AI/OpenAI operation with retry
 */
export async function aiWithRetry<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  return withRetry(operation, `AI: ${operationName}`, {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 10000
  });
}

/**
 * External API with comprehensive recovery
 */
export async function externalApiWithRecovery<T>(
  operation: () => Promise<T>,
  fallbackData?: T,
  operationName?: string
): Promise<T> {
  try {
    return await withRetry(operation, operationName);
  } catch (error) {
    if (fallbackData !== undefined) {
      console.warn(`🔄 Using fallback data for: ${operationName}`);
      return fallbackData;
    }
    throw error;
  }
}

// 📊 EXPORT METRICS
export function getErrorRecoveryMetrics() {
  return errorRecovery.getMetrics();
} 