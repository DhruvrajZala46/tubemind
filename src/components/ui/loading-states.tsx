// 🟠 PHASE 3.1: COMPREHENSIVE LOADING STATES
// Beautiful, informative loading indicators for better UX

import React from 'react';
import { cn } from '../../lib/utils';

// 🎯 Loading State Types
export type LoadingType = 
  | 'video-processing' 
  | 'transcript-extraction' 
  | 'ai-analysis' 
  | 'subscription-check'
  | 'saving-data'
  | 'generic';

interface LoadingStateProps {
  type: LoadingType;
  message?: string;
  progress?: number; // 0-100
  className?: string;
  showProgress?: boolean;
  animated?: boolean;
}

// 🎨 Loading Messages for Each Type
const LOADING_MESSAGES = {
  'video-processing': {
    primary: 'Processing Video',
    secondary: 'Analyzing video metadata and preparing for extraction...',
    icon: '🎬'
  },
  'transcript-extraction': {
    primary: 'Extracting Transcript',
    secondary: 'Fetching video transcript using multiple extraction methods...',
    icon: '📝'
  },
  'ai-analysis': {
    primary: 'AI Analysis in Progress',
    secondary: 'Generating intelligent insights and summaries...',
    icon: '🤖'
  },
  'subscription-check': {
    primary: 'Checking Subscription',
    secondary: 'Verifying your account and available credits...',
    icon: '👤'
  },
  'saving-data': {
    primary: 'Saving Results',
    secondary: 'Storing your analysis securely...',
    icon: '💾'
  },
  'generic': {
    primary: 'Loading',
    secondary: 'Please wait while we process your request...',
    icon: '⏳'
  }
};

// 🌟 Animated Progress Bar Component
const ProgressBar: React.FC<{ progress: number; animated?: boolean }> = ({ 
  progress, 
  animated = true 
}) => (
  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
    <div 
      className={cn(
        "h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out",
        animated && "animate-pulse"
      )}
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

// 🎯 Spinner Component
const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn(
      "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
      sizeClasses[size]
    )} />
  );
};

// 🎨 Pulsing Dots Animation
const PulsingDots: React.FC = () => (
  <div className="flex space-x-1">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </div>
);

// 🎯 Main Loading State Component
export const LoadingState: React.FC<LoadingStateProps> = ({
  type,
  message,
  progress,
  className,
  showProgress = false,
  animated = true
}) => {
  const config = LOADING_MESSAGES[type];
  const displayMessage = message || config.secondary;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700",
      className
    )}>
      {/* Icon and Spinner */}
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-2xl">{config.icon}</span>
        <Spinner size="lg" />
      </div>
      
      {/* Primary Message */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {config.primary}
      </h3>
      
      {/* Secondary Message */}
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 max-w-md">
        {displayMessage}
      </p>
      
      {/* Progress Bar */}
      {showProgress && typeof progress === 'number' && (
        <div className="w-full max-w-md mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <ProgressBar progress={progress} animated={animated} />
        </div>
      )}
      
      {/* Pulsing Dots */}
      {!showProgress && <PulsingDots />}
      
      {/* Helpful Tip */}
      <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
        <span className="font-medium">💡 Tip:</span> This usually takes 10-30 seconds
      </div>
    </div>
  );
};

// 🎯 Inline Loading Component (for smaller spaces)
export const InlineLoading: React.FC<{
  type: LoadingType;
  size?: 'sm' | 'md';
  showText?: boolean;
}> = ({ type, size = 'sm', showText = true }) => {
  const config = LOADING_MESSAGES[type];
  
  return (
    <div className="flex items-center space-x-2">
      <Spinner size={size} />
      {showText && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {config.primary}...
        </span>
      )}
    </div>
  );
};

// 🎯 Full Page Loading Overlay
export const LoadingOverlay: React.FC<LoadingStateProps & {
  visible: boolean;
}> = ({ visible, ...props }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4">
        <LoadingState {...props} />
      </div>
    </div>
  );
};

// 🎯 Loading Card Component (for dashboard)
export const LoadingCard: React.FC<{
  title: string;
  description: string;
  type: LoadingType;
  progress?: number;
}> = ({ title, description, type, progress }) => {
  const config = LOADING_MESSAGES[type];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{config.icon}</span>
            <Spinner size="sm" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
          
          {typeof progress === 'number' && (
            <div className="mt-3">
              <ProgressBar progress={progress} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 🎯 Step-by-Step Loading Component
interface LoadingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export const StepLoadingIndicator: React.FC<{
  steps: LoadingStep[];
  className?: string;
}> = ({ steps, className }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step) => {
        const isActive = step.status === 'active';
        const isCompleted = step.status === 'completed';
        const isError = step.status === 'error';
        
        return (
          <div key={step.id} className="flex items-start space-x-3">
            {/* Step Indicator */}
            <div className="flex-shrink-0 mt-1">
              {isCompleted && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
              {isError && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white text-xs">×</span>
                </div>
              )}
              {isActive && <Spinner size="sm" />}
              {step.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
            </div>
            
            {/* Step Content */}
            <div className="flex-1">
              <h4 className={cn(
                "text-sm font-medium",
                isCompleted && "text-green-600 dark:text-green-400",
                isError && "text-red-600 dark:text-red-400",
                isActive && "text-blue-600 dark:text-blue-400",
                step.status === 'pending' && "text-gray-500 dark:text-gray-400"
              )}>
                {step.title}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 🎯 Export hook for managing loading states
export const useLoadingState = (initialType: LoadingType = 'generic') => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingType, setLoadingType] = React.useState<LoadingType>(initialType);
  const [loadingMessage, setLoadingMessage] = React.useState<string>('');
  const [progress, setProgress] = React.useState<number>(0);

  const startLoading = (type: LoadingType, message?: string) => {
    setLoadingType(type);
    setLoadingMessage(message || '');
    setProgress(0);
    setIsLoading(true);
  };

  const updateProgress = (newProgress: number) => {
    setProgress(Math.min(100, Math.max(0, newProgress)));
  };

  const stopLoading = () => {
    setIsLoading(false);
    setProgress(0);
  };

  return {
    isLoading,
    loadingType,
    loadingMessage,
    progress,
    startLoading,
    updateProgress,
    stopLoading
  };
}; 