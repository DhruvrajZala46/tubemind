// 🟠 PHASE 3.3: COMPREHENSIVE ERROR MESSAGES
// User-friendly, actionable error messages for better UX

import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, RefreshCw, HelpCircle, ExternalLink, Mail } from 'lucide-react';

// 🎯 Error Types and Classifications
export type ErrorType = 
  | 'network'
  | 'authentication' 
  | 'permission'
  | 'validation'
  | 'youtube-api'
  | 'openai-api'
  | 'subscription'
  | 'rate-limit'
  | 'server-error'
  | 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  description: string;
  userMessage: string;
  suggestedActions: string[];
  helpLinks?: { text: string; url: string; }[];
  canRetry: boolean;
  supportContactNeeded: boolean;
  icon: string;
}

// 🎯 Comprehensive Error Configuration
const ERROR_CONFIGURATIONS: Record<ErrorType, ErrorInfo> = {
  network: {
    type: 'network',
    severity: 'warning',
    title: 'Connection Issue',
    description: 'Unable to connect to our servers',
    userMessage: 'It looks like there\'s a temporary connection issue. This usually resolves itself quickly.',
    suggestedActions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a few moments and try again'
    ],
    canRetry: true,
    supportContactNeeded: false,
    icon: '🌐'
  },

  authentication: {
    type: 'authentication',
    severity: 'error',
    title: 'Authentication Required',
    description: 'You need to sign in to access this feature',
    userMessage: 'Please sign in to your account to continue processing videos.',
    suggestedActions: [
      'Sign in to your account',
      'Create a new account if you don\'t have one',
      'Contact support if you\'re having trouble signing in'
    ],
    canRetry: false,
    supportContactNeeded: false,
    icon: '🔐'
  },

  permission: {
    type: 'permission',
    severity: 'error',
    title: 'Access Denied',
    description: 'You don\'t have permission to perform this action',
    userMessage: 'Your current subscription doesn\'t include access to this feature.',
    suggestedActions: [
      'Check your subscription status',
      'Upgrade your plan for more features',
      'Contact support if you believe this is an error'
    ],
    helpLinks: [
      { text: 'View Subscription Plans', url: '/pricing' },
      { text: 'Manage Subscription', url: '/dashboard/subscription' }
    ],
    canRetry: false,
    supportContactNeeded: false,
    icon: '🚫'
  },

  validation: {
    type: 'validation',
    severity: 'warning',
    title: 'Invalid Input',
    description: 'The information provided is not valid',
    userMessage: 'Please check your input and try again.',
    suggestedActions: [
      'Verify the YouTube URL is correct',
      'Make sure the video is public and accessible',
      'Try copying the URL directly from YouTube'
    ],
    canRetry: true,
    supportContactNeeded: false,
    icon: '⚠️'
  },

  'youtube-api': {
    type: 'youtube-api',
    severity: 'error',
    title: 'YouTube Access Issue',
    description: 'Unable to access the YouTube video',
    userMessage: 'We couldn\'t access this YouTube video. This might be because it\'s private, deleted, or restricted in your region.',
    suggestedActions: [
      'Verify the video exists and is public',
      'Try a different YouTube video',
      'Check if the video has restrictions',
      'Make sure the URL is complete and correct'
    ],
    helpLinks: [
      { text: 'Supported Video Types', url: '/help/supported-videos' }
    ],
    canRetry: true,
    supportContactNeeded: false,
    icon: '📺'
  },

  'openai-api': {
    type: 'openai-api',
    severity: 'error',
    title: 'AI Processing Issue',
    description: 'Our AI service is temporarily unavailable',
    userMessage: 'We\'re experiencing high demand on our AI service. Please try again in a few moments.',
    suggestedActions: [
      'Wait 1-2 minutes and try again',
      'Try processing a shorter video first',
      'Contact support if the issue persists'
    ],
    canRetry: true,
    supportContactNeeded: true,
    icon: '🤖'
  },

  subscription: {
    type: 'subscription',
    severity: 'warning',
    title: 'Subscription Limit Reached',
    description: 'You\'ve reached your plan\'s usage limit',
    userMessage: 'You\'ve used all your available credits for this month. Upgrade your plan or wait until next month to continue.',
    suggestedActions: [
      'Upgrade to a higher plan',
      'Wait until next month for credits to reset',
      'Check your usage dashboard'
    ],
    helpLinks: [
      { text: 'Upgrade Plan', url: '/pricing' },
      { text: 'View Usage', url: '/dashboard/usage' }
    ],
    canRetry: false,
    supportContactNeeded: false,
    icon: '💳'
  },

  'rate-limit': {
    type: 'rate-limit',
    severity: 'warning',
    title: 'Too Many Requests',
    description: 'You\'re making requests too quickly',
    userMessage: 'You\'re processing videos too quickly. Please wait a moment before trying again.',
    suggestedActions: [
      'Wait 1-2 minutes before trying again',
      'Process one video at a time',
      'Avoid rapid clicking'
    ],
    canRetry: true,
    supportContactNeeded: false,
    icon: '🚦'
  },

  'server-error': {
    type: 'server-error',
    severity: 'error',
    title: 'Server Error',
    description: 'Something went wrong on our end',
    userMessage: 'We\'re experiencing a temporary issue with our servers. Our team has been notified and is working on a fix.',
    suggestedActions: [
      'Try again in a few minutes',
      'Contact support if the issue persists',
      'Check our status page for updates'
    ],
    helpLinks: [
      { text: 'System Status', url: '/status' }
    ],
    canRetry: true,
    supportContactNeeded: true,
    icon: '🔧'
  },

  unknown: {
    type: 'unknown',
    severity: 'error',
    title: 'Unexpected Error',
    description: 'An unexpected error occurred',
    userMessage: 'Something unexpected happened. Our team has been notified and will investigate.',
    suggestedActions: [
      'Try refreshing the page',
      'Try again in a few minutes',
      'Contact support with details about what you were doing'
    ],
    canRetry: true,
    supportContactNeeded: true,
    icon: '❓'
  }
};

// 🎯 Error Classification Helper
export const classifyError = (error: Error | string): ErrorType => {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'network';
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
    return 'authentication';
  }
  if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission')) {
    return 'permission';
  }
  if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) {
    return 'validation';
  }
  if (lowerMessage.includes('youtube') || lowerMessage.includes('video not found')) {
    return 'youtube-api';
  }
  if (lowerMessage.includes('openai') || lowerMessage.includes('ai') || lowerMessage.includes('gpt')) {
    return 'openai-api';
  }
  if (lowerMessage.includes('subscription') || lowerMessage.includes('credits') || lowerMessage.includes('limit')) {
    return 'subscription';
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return 'rate-limit';
  }
  if (lowerMessage.includes('500') || lowerMessage.includes('server error')) {
    return 'server-error';
  }

  return 'unknown';
};

// 🎯 Main Error Message Component
interface ErrorMessageProps {
  error?: Error | string;
  type?: ErrorType;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  className?: string;
  compact?: boolean;
  showContactSupport?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  type,
  title,
  description,
  onRetry,
  onContactSupport,
  className,
  compact = false,
  showContactSupport = true
}) => {
  // Determine error type and configuration
  const errorType = type || (error ? classifyError(error) : 'unknown');
  const config = ERROR_CONFIGURATIONS[errorType];

  // Use provided props or fallback to configuration
  const errorTitle = title || config.title;
  const errorDescription = description || config.userMessage;

  const getSeverityClasses = () => {
    switch (config.severity) {
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'critical':
        return 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const getTextClasses = () => {
    switch (config.severity) {
      case 'info':
        return 'text-blue-800 dark:text-blue-200';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'critical':
        return 'text-red-900 dark:text-red-100';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center space-x-3 p-4 rounded-lg border",
        getSeverityClasses(),
        className
      )}>
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1">
          <p className={cn("text-sm font-medium", getTextClasses())}>
            {errorTitle}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {errorDescription}
          </p>
        </div>
        {config.canRetry && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-1"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "p-6 rounded-lg border",
      getSeverityClasses(),
      className
    )}>
      {/* Header */}
      <div className="flex items-start space-x-3 mb-4">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <h3 className={cn("text-lg font-semibold", getTextClasses())}>
            {errorTitle}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {errorDescription}
          </p>
        </div>
      </div>

      {/* Suggested Actions */}
      {config.suggestedActions.length > 0 && (
        <div className="mb-4">
          <h4 className={cn("text-sm font-medium mb-2", getTextClasses())}>
            What you can do:
          </h4>
          <ul className="space-y-1">
            {config.suggestedActions.map((action, index) => (
              <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Help Links */}
      {config.helpLinks && config.helpLinks.length > 0 && (
        <div className="mb-4">
          <h4 className={cn("text-sm font-medium mb-2", getTextClasses())}>
            Helpful resources:
          </h4>
          <div className="space-y-1">
            {config.helpLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{link.text}</span>
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        {config.canRetry && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        )}

        {showContactSupport && config.supportContactNeeded && (
          <button
            onClick={onContactSupport || (() => window.open('mailto:support@tubemind.com', '_blank'))}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Mail size={16} />
            <span>Contact Support</span>
          </button>
        )}

        <button
          onClick={() => window.open('/help', '_blank')}
          className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <HelpCircle size={16} />
          <span>Get Help</span>
        </button>
      </div>

      {/* Technical Details (for debugging) */}
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs">
          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 font-medium">
            Technical Details (Debug)
          </summary>
          <pre className="mt-2 text-gray-500 dark:text-gray-500 whitespace-pre-wrap">
            {typeof error === 'string' ? error : error.message}
            {typeof error !== 'string' && error.stack && (
              <>
                {'\n\nStack trace:\n'}
                {error.stack}
              </>
            )}
          </pre>
        </details>
      )}
    </div>
  );
};

// 🎯 Toast Error Component (for notifications)
export const ErrorToast: React.FC<{
  error?: Error | string;
  type?: ErrorType;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}> = ({ 
  error, 
  type, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}) => {
  const errorType = type || (error ? classifyError(error) : 'unknown');
  const config = ERROR_CONFIGURATIONS[errorType];

  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={cn(
        "p-4 rounded-lg shadow-lg border",
        config.severity === 'error' || config.severity === 'critical' 
          ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
          : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
      )}>
        <div className="flex items-start space-x-3">
          <span className="text-lg">{config.icon}</span>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {config.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {config.userMessage}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 🎯 Hook for Error Handling
export const useErrorHandler = () => {
  const [currentError, setCurrentError] = React.useState<{
    error: Error | string;
    type?: ErrorType;
  } | null>(null);

  const handleError = (error: Error | string, type?: ErrorType) => {
    console.error('Error occurred:', error);
    setCurrentError({ error, type });
  };

  const clearError = () => {
    setCurrentError(null);
  };

  const retryOperation = (operation: () => void | Promise<void>) => {
    clearError();
    try {
      const result = operation();
      if (result instanceof Promise) {
        result.catch(error => handleError(error));
      }
    } catch (error) {
      handleError(error as Error);
    }
  };

  return {
    currentError,
    handleError,
    clearError,
    retryOperation
  };
}; 
