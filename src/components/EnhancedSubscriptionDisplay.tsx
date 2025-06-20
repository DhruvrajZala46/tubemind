// 🛠️ ENHANCED SUBSCRIPTION DISPLAY
// Fixed loading states and precise credit display with hours/minutes

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { cn } from '../lib/utils';
import { PLAN_LIMITS, PlanTier } from '../config/plans';
import { LoadingState, InlineLoading } from './ui/loading-states';
import { ErrorMessage } from './ui/error-messages';
import { useRetry, RETRY_CONFIGS } from './ui/retry-mechanisms';
import { calculateVideoCredits, formatCreditsTime } from '../lib/credit-utils';
import { useCreditContext } from '../lib/credit-context';
import { 
  getCreditStatus, 
  formatPlanName,
  getPlanLimits 
} from '../lib/credit-utils';

interface UserSubscription {
  tier: string;
  status: string;
  creditsUsed: number;
  creditsLimit: number;
  billingCycle: string;
  nextBillingDate?: string;
  // 🔥 NEW: Formatted display values from API
  display?: {
    planName?: string;
    creditsUsedFormatted?: string;
    creditsRemainingFormatted?: string;
    creditsLimitFormatted?: string;
    isNearLimit?: boolean;
    isOverLimit?: boolean;
  };
}

interface SubscriptionDisplayProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
  // 🔥 NEW: Add refresh trigger for real-time updates
  refreshTrigger?: number;
  onDataLoaded?: (data: UserSubscription) => void;
}

export const EnhancedSubscriptionDisplay: React.FC<SubscriptionDisplayProps> = ({
  showDetails = true,
  compact = false,
  className,
  refreshTrigger = 0,
  onDataLoaded
}) => {
  const { user, isLoaded: userLoaded } = useUser();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const isFirstLoad = useRef(true);
  const retryCount = useRef(0);

  // 🔄 Enhanced retry logic for subscription fetching
  const subscriptionRetry = useRetry(
    async () => {
      if (!user) throw new Error('User not authenticated');

      const response = await fetch('/api/usage', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    RETRY_CONFIGS.api
  );

  // 🎯 Fetch subscription with loading states and better error handling
  const fetchSubscription = useCallback(async (forceRefresh = false) => {
    // Prevent multiple concurrent calls
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < 2000) {
      console.log('🚫 Skipping fetch - too recent');
      return;
    }

    try {
      setLastFetchTime(now);
      if (isFirstLoad.current) {
        setIsLoading(true);
      }
      setError(null);
      
      console.log('🔄 Fetching subscription data...');
      const data = await subscriptionRetry.execute();
      
      console.log('🔍 Raw subscription data:', data);
      
      // 🛠️ FIXED: Handle both API response formats with validation
      const validatedSubscription: UserSubscription = {
        tier: data.plan || data.tier || 'free',  // 🔥 CRITICAL: Check 'plan' first
        status: data.status || 'active',
        creditsUsed: Math.max(0, Number(data.usage || data.creditsUsed || 0)),  // 🔥 Ensure number
        creditsLimit: Math.max(1, Number(data.limit || data.creditsLimit || 60)), // 🔥 Ensure number
        billingCycle: 'monthly', // Default value
        nextBillingDate: data.nextBillingDate,
        // 🔥 NEW: Use API formatted values for precise display
        display: data.display || {
          planName: formatPlanName(data.plan || data.tier || 'free'),
          creditsUsedFormatted: formatCreditsTime(Math.max(0, Number(data.usage || data.creditsUsed || 0))),
          creditsRemainingFormatted: formatCreditsTime(Math.max(0, Number(data.limit || data.creditsLimit || 60) - Number(data.usage || data.creditsUsed || 0))),
          creditsLimitFormatted: formatCreditsTime(Math.max(1, Number(data.limit || data.creditsLimit || 60))),
          isNearLimit: false,
          isOverLimit: false
        }
      };

      console.log('✅ Validated subscription:', validatedSubscription);
      
      setSubscription(validatedSubscription);
      retryCount.current = 0;
      
      // Notify parent component
      if (onDataLoaded) {
        onDataLoaded(validatedSubscription);
      }
      
    } catch (err) {
      console.error('❌ Subscription fetch error:', err);
      retryCount.current++;
      
      // Only set error if we've tried multiple times
      if (retryCount.current >= 3) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
        
        // 🛠️ Fallback to cached data or default free plan
        if (!subscription) {
          const fallbackSubscription: UserSubscription = {
            tier: 'free',
            status: 'active', 
            creditsUsed: 0,
            creditsLimit: 60,
            billingCycle: 'monthly',
            display: {
              planName: 'Free Plan',
              creditsUsedFormatted: '0m',
              creditsRemainingFormatted: '1h',
              creditsLimitFormatted: '1h',
              isNearLimit: false,
              isOverLimit: false
            }
          };
          setSubscription(fallbackSubscription);
        }
      } else {
        // Retry after a delay
        setTimeout(() => fetchSubscription(true), 1000 * retryCount.current);
      }
      
    } finally {
      if (isFirstLoad.current) {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, [user, subscriptionRetry, lastFetchTime, subscription, onDataLoaded]);

  // 🎯 Effect with proper loading sequence
  useEffect(() => {
    if (userLoaded && user) {
      fetchSubscription(true);
    } else if (userLoaded && !user) {
      setIsLoading(false);
      setError('Please sign in to view subscription');
    }
  }, [userLoaded, user, fetchSubscription]);

  // 🔥 NEW: Respond to refresh triggers (e.g., after video processing)
  useEffect(() => {
    if (refreshTrigger > 0 && user) {
      console.log('🔄 Refresh triggered:', refreshTrigger);
      fetchSubscription(true);
    }
  }, [refreshTrigger, user, fetchSubscription]);

  // 🔄 Auto-refresh subscription with exponential backoff
  useEffect(() => {
    if (!subscription || error || !user) return;

    const interval = setInterval(() => {
      fetchSubscription(false);
    }, 30000); // 30 second intervals

    return () => clearInterval(interval);
  }, [subscription, error, user, fetchSubscription]);

  // 🎨 Loading State
  if (isLoading || !userLoaded) {
    return compact ? (
      <InlineLoading type="subscription-check" size="sm" />
    ) : (
      <LoadingState 
        type="subscription-check" 
        message="Loading your subscription details..."
        className={className}
      />
    );
  }

  // 🚨 Error State
  if (error && !subscription) {
    return (
      <ErrorMessage
        error={error}
        type="subscription"
        onRetry={() => fetchSubscription(true)}
        compact={compact}
        className={className}
      />
    );
  }

  // 🚨 No subscription state  
  if (!subscription) {
    return (
      <div className={cn("text-center p-4", className)}>
        <p className="text-gray-500">No subscription found</p>
        <button 
          onClick={() => fetchSubscription(true)}
          className="text-blue-500 hover:text-blue-600 text-sm mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // 🎯 Use API formatted values for precise display
  const displayValues = subscription.display || {};
  
  // 🔥 FIXED: Use formatted values from API instead of calculating
  const creditDisplay = {
    used: displayValues.creditsUsedFormatted || formatCreditsTime(subscription.creditsUsed),
    remaining: displayValues.creditsRemainingFormatted || formatCreditsTime(Math.max(0, subscription.creditsLimit - subscription.creditsUsed)),
    total: displayValues.creditsLimitFormatted || formatCreditsTime(subscription.creditsLimit),
    percentage: Math.round((subscription.creditsUsed / subscription.creditsLimit) * 100),
    isNearLimit: displayValues.isNearLimit || (subscription.creditsUsed / subscription.creditsLimit) >= 0.9,
    isOverLimit: displayValues.isOverLimit || subscription.creditsUsed > subscription.creditsLimit
  };
  
  const creditStatus = getCreditStatus(subscription.creditsUsed, subscription.creditsLimit);
  const planLimits = getPlanLimits(subscription.tier);

  // 🎨 Compact Display
  if (compact) {
    return (
      <div className={cn("flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border", className)}>
        {/* Plan Badge */}
        <div className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          subscription.tier === 'free' && "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          subscription.tier === 'basic' && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", 
          subscription.tier === 'pro' && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
        )}>
          {formatPlanName(subscription.tier)}
        </div>

        {/* Credits Display */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {creditDisplay.remaining} remaining
          </div>
          <div className="text-xs text-gray-500">
            {creditDisplay.used} / {creditDisplay.total} used
          </div>
        </div>

        {/* Status Indicator */}
        <div className={cn(
          "w-3 h-3 rounded-full",
          creditStatus.color === 'green' && "bg-green-500",
          creditStatus.color === 'yellow' && "bg-yellow-500", 
          creditStatus.color === 'orange' && "bg-orange-500",
          creditStatus.color === 'red' && "bg-red-500"
        )} />
        
        {/* 🔄 Refresh button for debugging */}
        {process.env.NODE_ENV === 'development' && (
          <button 
            onClick={() => fetchSubscription(true)}
            className="text-xs text-blue-500 hover:text-blue-600"
            title="Refresh credits"
          >
            🔄
          </button>
        )}
      </div>
    );
  }

  // 🎨 Full Display
  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden", className)}>
      {/* Header */}
      <div className={cn(
        "px-6 py-4 border-b border-gray-200 dark:border-gray-700",
        subscription.tier === 'free' && "bg-gray-50 dark:bg-gray-800",
        subscription.tier === 'basic' && "bg-blue-50 dark:bg-blue-900/20",
        subscription.tier === 'pro' && "bg-purple-50 dark:bg-purple-900/20"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatPlanName(subscription.tier)}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {subscription.status === 'active' ? 'Active subscription' : subscription.status}
            </p>
          </div>
          
          {/* Plan Badge */}
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            subscription.tier === 'free' && "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
            subscription.tier === 'basic' && "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300",
            subscription.tier === 'pro' && "bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-300"
          )}>
            {subscription.tier.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Credits Section */}
      <div className="px-6 py-4">
        <div className="space-y-4">
          {/* Credit Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Video Processing Credits
              </span>
              <span className={cn(
                "text-sm font-medium",
                creditStatus.color === 'green' && "text-green-600 dark:text-green-400",
                creditStatus.color === 'yellow' && "text-yellow-600 dark:text-yellow-400",
                creditStatus.color === 'orange' && "text-orange-600 dark:text-orange-400", 
                creditStatus.color === 'red' && "text-red-600 dark:text-red-400"
              )}>
                {creditDisplay.used} / {creditDisplay.total}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  creditStatus.color === 'green' && "bg-green-500",
                  creditStatus.color === 'yellow' && "bg-yellow-500",
                  creditStatus.color === 'orange' && "bg-orange-500",
                  creditStatus.color === 'red' && "bg-red-500"
                )}
                style={{ width: `${Math.min(100, creditDisplay.percentage)}%` }}
              />
            </div>

            {/* Status Message */}
            <div className="flex items-center space-x-2 mt-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                creditStatus.color === 'green' && "bg-green-500",
                creditStatus.color === 'yellow' && "bg-yellow-500",
                creditStatus.color === 'orange' && "bg-orange-500",
                creditStatus.color === 'red' && "bg-red-500"
              )} />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {creditStatus.message}
              </span>
            </div>
          </div>

          {/* Detailed Stats */}
          {showDetails && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {creditDisplay.remaining}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Remaining
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {creditDisplay.used}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Used This Month
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {planLimits.videosPerDay}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Videos/Day
                </div>
              </div>
            </div>
          )}

          {/* Error indicator and refresh */}
          {error && subscription && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center justify-between">
              <span>Data may be outdated</span>
              <button 
                onClick={() => fetchSubscription(true)}
                className="text-blue-500 hover:text-blue-600"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 