// 🎨 THEMED ERROR COMPONENTS
// Error components that follow the project's dark theme and styling

'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { ElegantLoader } from './elegant-loader';

interface ThemedErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  isRetrying?: boolean;
  className?: string;
  compact?: boolean;
}

export const ThemedError: React.FC<ThemedErrorProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an issue. Please try again.',
  onRetry,
  onGoBack,
  isRetrying = false,
  className,
  compact = false
}) => {
  if (compact) {
    return (
      <div className={cn(
        "bg-[#161B22] border border-[#30363D] rounded-lg p-4 text-center",
        className
      )}>
        <div className="text-2xl mb-2">😬</div>
        <h3 className="text-[#F0F6FC] font-medium text-sm mb-2">{title}</h3>
        <p className="text-[#8B949E] text-xs mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="bg-[#FF0033] hover:bg-[#FF3366] text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
          >
            {isRetrying ? (
              <>
                <ElegantLoader size="sm" />
                <span>Retrying...</span>
              </>
            ) : (
              'Try Again'
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-[#161B22] border border-[#30363D] rounded-xl p-8 text-center max-w-md mx-auto",
      className
    )}>
      <div className="text-4xl mb-4">😬</div>
      <h2 className="text-[#F0F6FC] font-semibold text-xl mb-3">{title}</h2>
      <p className="text-[#8B949E] text-base mb-6">{message}</p>
      
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="bg-[#FF0033] hover:bg-[#FF3366] text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <>
                <ElegantLoader size="sm" />
                <span>Retrying...</span>
              </>
            ) : (
              'Try Again'
            )}
          </button>
        )}
        
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] font-semibold px-6 py-3 rounded-lg border border-[#30363D] transition-colors"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
};

// Rate limit specific error
export const RateLimitError: React.FC<{
  retryAfter?: number;
  onRetry?: () => void;
  className?: string;
}> = ({ retryAfter, onRetry, className }) => {
  const [countdown, setCountdown] = React.useState(retryAfter || 60);

  React.useEffect(() => {
    if (!retryAfter) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfter]);

  return (
    <ThemedError
      title="Rate limit exceeded"
      message={`You're processing videos too quickly. Please wait ${countdown > 0 ? `${countdown} seconds` : 'a moment'} before trying again.`}
      onRetry={countdown === 0 ? onRetry : undefined}
      className={className}
    />
  );
};

// Network error
export const NetworkError: React.FC<{
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}> = ({ onRetry, isRetrying, className }) => {
  return (
    <ThemedError
      title="Connection issue"
      message="Unable to connect to our servers. Please check your internet connection and try again."
      onRetry={onRetry}
      isRetrying={isRetrying}
      className={className}
    />
  );
};

// Subscription error
export const SubscriptionError: React.FC<{
  message?: string;
  onUpgrade?: () => void;
  className?: string;
}> = ({ message, onUpgrade, className }) => {
  return (
    <div className={cn(
      "bg-[#161B22] border border-[#30363D] rounded-xl p-8 text-center max-w-md mx-auto",
      className
    )}>
      <div className="text-4xl mb-4">💳</div>
      <h2 className="text-[#F0F6FC] font-semibold text-xl mb-3">Subscription limit reached</h2>
      <p className="text-[#8B949E] text-base mb-6">
        {message || "You've used all your available credits for this month. Upgrade your plan to continue."}
      </p>
      
      <div className="flex gap-3 justify-center">
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="bg-[#FF0033] hover:bg-[#FF3366] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Upgrade Plan
          </button>
        )}
        
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] font-semibold px-6 py-3 rounded-lg border border-[#30363D] transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

// Toast notification for errors
export const ErrorToast: React.FC<{
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}> = ({ message, onClose, autoClose = true, duration = 5000 }) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-[#161B22] border border-[#FF0033] rounded-lg p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="text-lg">⚠️</div>
          <div className="flex-1">
            <p className="text-[#F0F6FC] text-sm font-medium">{message}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 