// 🟠 PHASE 3.5: RETRY MECHANISMS
// Intelligent retry systems for failed operations

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

// 🎯 Retry Strategy Configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
}

// 🎯 Default Retry Configurations for Different Operations
export const RETRY_CONFIGS = {
  network: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('fetch') ||
             message.includes('502') ||
             message.includes('503') ||
             message.includes('504');
    }
  },
  
  api: {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase();
      return message.includes('rate limit') || 
             message.includes('500') ||
             message.includes('503') ||
             message.includes('timeout');
    }
  },
  
  processing: {
    maxAttempts: 2,
    baseDelay: 3000,
    maxDelay: 15000,
    backoffMultiplier: 2.5,
    jitter: true,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase();
      return !message.includes('invalid') && 
             !message.includes('unauthorized') &&
             !message.includes('forbidden');
    }
  },
  
  upload: {
    maxAttempts: 3,
    baseDelay: 1500,
    maxDelay: 12000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') ||
             message.includes('interrupted');
    }
  }
};

// 🎯 Retry State
interface RetryState {
  attempt: number;
  isRetrying: boolean;
  lastError: Error | null;
  nextRetryIn: number; // milliseconds
  hasGivenUp: boolean;
}

// 🎯 Calculate Retry Delay with Exponential Backoff
const calculateRetryDelay = (attempt: number, config: RetryConfig): number => {
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  
  // Apply maximum delay limit
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter to prevent thundering herd
  if (config.jitter) {
    delay = delay + (Math.random() * delay * 0.1);
  }
  
  return Math.round(delay);
};

// 🎯 Retry Hook
export const useRetry = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  config: RetryConfig = RETRY_CONFIGS.network
) => {
  const [retryState, setRetryState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    lastError: null,
    nextRetryIn: 0,
    hasGivenUp: false
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(async (...args: T): Promise<R> => {
         // Clear any existing timeouts
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     if (countdownRef.current) clearInterval(countdownRef.current);

    const attemptOperation = async (attemptNumber: number): Promise<R> => {
      setRetryState(prev => ({
        ...prev,
        attempt: attemptNumber,
        isRetrying: attemptNumber > 1,
        lastError: null,
        nextRetryIn: 0
      }));

      try {
        const result = await operation(...args);
        
        // Success - reset state
        setRetryState({
          attempt: 0,
          isRetrying: false,
          lastError: null,
          nextRetryIn: 0,
          hasGivenUp: false
        });
        
        return result;
      } catch (error) {
        const err = error as Error;
        
        // Check if we should retry
        const shouldRetry = attemptNumber < config.maxAttempts &&
                           (!config.retryCondition || config.retryCondition(err));

        if (shouldRetry) {
          const delay = calculateRetryDelay(attemptNumber, config);
          
          setRetryState(prev => ({
            ...prev,
            lastError: err,
            nextRetryIn: delay,
            isRetrying: true
          }));

          // Start countdown
          let remainingTime = delay;
          countdownRef.current = setInterval(() => {
            remainingTime -= 100;
            setRetryState(prev => ({
              ...prev,
              nextRetryIn: Math.max(0, remainingTime)
            }));
            
            if (remainingTime <= 0) {
              clearInterval(countdownRef.current!);
            }
          }, 100);

          // Schedule retry
          return new Promise<R>((resolve, reject) => {
            timeoutRef.current = setTimeout(async () => {
              try {
                const result = await attemptOperation(attemptNumber + 1);
                resolve(result);
              } catch (retryError) {
                reject(retryError);
              }
            }, delay);
          });
        } else {
          // Give up
          setRetryState(prev => ({
            ...prev,
            lastError: err,
            isRetrying: false,
            hasGivenUp: true
          }));
          
          throw err;
        }
      }
    };

    return attemptOperation(1);
  }, [operation, config]);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setRetryState({
      attempt: 0,
      isRetrying: false,
      lastError: null,
      nextRetryIn: 0,
      hasGivenUp: false
    });
  }, []);

  const retry = useCallback((...args: T) => {
    reset();
    return execute(...args);
  }, [execute, reset]);

  return {
    execute,
    retry,
    reset,
    ...retryState
  };
};

// 🎯 Retry Button Component
interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
  disabled?: boolean;
  countdown?: number;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  isRetrying = false,
  disabled = false,
  countdown = 0,
  variant = 'primary',
  size = 'md',
  className,
  children
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const isDisabled = disabled || isRetrying || countdown > 0;

  const getButtonText = () => {
    if (countdown > 0) {
      return `Retry in ${Math.ceil(countdown / 1000)}s`;
    }
    if (isRetrying) {
      return 'Retrying...';
    }
    return children || 'Try Again';
  };

  return (
    <button
      onClick={onRetry}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <RefreshCw 
        size={16} 
        className={cn(
          'mr-2',
          isRetrying && 'animate-spin'
        )} 
      />
      {getButtonText()}
    </button>
  );
};

// 🎯 Retry Status Indicator
interface RetryStatusProps {
  retryState: RetryState;
  config: RetryConfig;
  className?: string;
  showDetails?: boolean;
}

export const RetryStatus: React.FC<RetryStatusProps> = ({
  retryState,
  config,
  className,
  showDetails = true
}) => {
  const { attempt, isRetrying, lastError, nextRetryIn, hasGivenUp } = retryState;

  if (!lastError && !isRetrying && !hasGivenUp) return null;

  const getStatusIcon = () => {
    if (hasGivenUp) return <AlertCircle className="text-red-500" size={16} />;
    if (isRetrying) return <RefreshCw className="text-blue-500 animate-spin" size={16} />;
    return <Clock className="text-yellow-500" size={16} />;
  };

  const getStatusMessage = () => {
    if (hasGivenUp) {
      return `Failed after ${attempt} attempts`;
    }
    if (isRetrying && nextRetryIn > 0) {
      return `Retrying in ${Math.ceil(nextRetryIn / 1000)}s (Attempt ${attempt}/${config.maxAttempts})`;
    }
    if (isRetrying) {
      return `Retrying... (Attempt ${attempt}/${config.maxAttempts})`;
    }
    return `Attempt ${attempt}/${config.maxAttempts}`;
  };

  return (
    <div className={cn(
      "flex items-start space-x-2 p-3 rounded-lg border",
      hasGivenUp 
        ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
        : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
      className
    )}>
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          hasGivenUp 
            ? "text-red-800 dark:text-red-200"
            : "text-blue-800 dark:text-blue-200"
        )}>
          {getStatusMessage()}
        </p>
        
        {showDetails && lastError && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {lastError.message}
          </p>
        )}
        
        {isRetrying && nextRetryIn > 0 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-100 ease-linear"
                style={{ 
                  width: `${100 - ((nextRetryIn / calculateRetryDelay(attempt, config)) * 100)}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🎯 Auto-Retry Wrapper Component
interface AutoRetryProps {
  children: (retryProps: {
    execute: (...args: any[]) => Promise<any>;
    isRetrying: boolean;
    lastError: Error | null;
    hasGivenUp: boolean;
    retry: (...args: any[]) => Promise<any>;
  }) => React.ReactNode;
  operation: (...args: any[]) => Promise<any>;
  config?: RetryConfig;
  autoExecute?: boolean;
  args?: any[];
}

export const AutoRetry: React.FC<AutoRetryProps> = ({
  children,
  operation,
  config = RETRY_CONFIGS.network,
  autoExecute = false,
  args = []
}) => {
  const retryHook = useRetry(operation, config);

  React.useEffect(() => {
    if (autoExecute) {
      retryHook.execute(...args);
    }
  }, [autoExecute, args]);

  return (
    <>
      {children({
        execute: retryHook.execute,
        isRetrying: retryHook.isRetrying,
        lastError: retryHook.lastError,
        hasGivenUp: retryHook.hasGivenUp,
        retry: retryHook.retry
      })}
    </>
  );
};

// 🎯 Retry Toast Notification
interface RetryToastProps {
  isVisible: boolean;
  retryState: RetryState;
  onRetry: () => void;
  onDismiss: () => void;
  config: RetryConfig;
}

export const RetryToast: React.FC<RetryToastProps> = ({
  isVisible,
  retryState,
  onRetry,
  onDismiss,
  config
}) => {
  if (!isVisible || (!retryState.lastError && !retryState.isRetrying)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {retryState.hasGivenUp ? (
              <AlertCircle className="text-red-500" size={20} />
            ) : (
              <RefreshCw 
                className={cn(
                  "text-blue-500",
                  retryState.isRetrying && "animate-spin"
                )} 
                size={20} 
              />
            )}
          </div>
          
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {retryState.hasGivenUp ? 'Operation Failed' : 'Retrying Operation'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {retryState.hasGivenUp 
                ? `Failed after ${retryState.attempt} attempts`
                : `Attempt ${retryState.attempt}/${config.maxAttempts}`
              }
            </p>
            
            {retryState.nextRetryIn > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Next retry in {Math.ceil(retryState.nextRetryIn / 1000)}s
              </p>
            )}
          </div>
          
          <div className="flex-shrink-0 space-x-2">
            {retryState.hasGivenUp && (
              <button
                onClick={onRetry}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                Retry
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 🎯 Smart Retry Wrapper for API Calls
export const withRetry = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig = RETRY_CONFIGS.api
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        const shouldRetry = attempt < config.maxAttempts &&
                           (!config.retryCondition || config.retryCondition(lastError));
        
        if (shouldRetry) {
          const delay = calculateRetryDelay(attempt, config);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
    
    throw lastError!;
  };
}; 
