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
            className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
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
            className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// IMPROVED Subscription error - matches your theme better
interface SubscriptionErrorProps {
  requiredCredits?: number;
  availableCredits?: number;
  videoMinutes?: number;
  onUpgrade?: () => void;
  className?: string;
  message?: string;
}

export const SubscriptionError: React.FC<SubscriptionErrorProps> = ({
  requiredCredits,
  availableCredits,
  videoMinutes,
  onUpgrade,
  className,
  message
}) => {
  // Generate clear, informative message
  const getMessage = () => {
    if (message) return message;
    
    if (requiredCredits && availableCredits !== undefined && videoMinutes) {
      return `This ${videoMinutes}-minute video requires ${requiredCredits} credits to process, but you only have ${availableCredits} credits remaining. We charge based on video length to ensure fair usage.`;
    }
    
    if (requiredCredits && availableCredits !== undefined) {
      return `You need ${requiredCredits} credits to process this content, but you only have ${availableCredits} credits available.`;
    }
    
    return "You've reached your monthly credit limit. Upgrade your plan to continue processing videos.";
  };

  return (
    <div className={cn(
      "bg-[#161B22] border border-[#30363D] rounded-xl p-6 max-w-lg mx-auto",
      className
    )}>
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-[#F0F6FC] font-medium text-lg mb-2">
          Credit limit exceeded
        </h3>
        <p className="text-[#8B949E] text-sm leading-relaxed">
          {getMessage()}
        </p>
      </div>

      {/* Credit breakdown if available */}
      {requiredCredits && availableCredits !== undefined && (
        <div className="bg-[#21262D]/50 rounded-md p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#8B949E]">Required credits:</span>
            <span className="text-[#F0F6FC] font-medium">{requiredCredits}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8B949E]">Available credits:</span>
            <span className="text-[#F0F6FC] font-medium">{availableCredits}</span>
          </div>
          <div className="border-t border-[#30363D] pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#8B949E]">Shortage:</span>
              <span className="text-[#DC143C] font-medium">
                {requiredCredits - availableCredits} credits
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onUpgrade || (() => window.location.href = '/#pricing')}
          className="w-full bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Upgrade Plan
        </button>
        
        <button
          onClick={() => window.location.href = '/#pricing'}
          className="w-full text-[#8B949E] hover:text-[#F0F6FC] text-sm transition-colors"
        >
          View pricing details
        </button>
      </div>
    </div>
  );
};

// Compact version for smaller spaces
export const CompactSubscriptionError: React.FC<SubscriptionErrorProps> = ({
  requiredCredits,
  availableCredits,
  onUpgrade,
  className,
  message
}) => {
  const getShortMessage = () => {
    if (message) return message;
    
    if (requiredCredits && availableCredits !== undefined) {
      return `Need ${requiredCredits} credits, have ${availableCredits}`;
    }
    
    return "Credit limit exceeded";
  };

  return (
    <div className={cn(
      "bg-[#161B22] border border-[#30363D] rounded-lg p-4 text-center",
      className
    )}>
      <p className="text-[#8B949E] text-sm mb-3">
        {getShortMessage()}
      </p>
      
      <button
        onClick={onUpgrade || (() => window.location.href = '/#pricing')}
        className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
      >
        Upgrade Plan
      </button>
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
      <div className="bg-[#161B22] border border-[#DC143C] rounded-lg p-4 shadow-xl">
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