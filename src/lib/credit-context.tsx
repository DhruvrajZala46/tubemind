// 🔥 CREDIT CONTEXT - Global State Management for Credits
// Ensures consistent credit display across all components

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

interface CreditState {
  creditsUsed: number;
  creditsLimit: number;
  tier: string;
  status: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

interface CreditContextType {
  creditState: CreditState;
  refreshCredits: () => Promise<void>;
  triggerRefresh: () => void;
  markVideoProcessed: (creditsConsumed: number) => void;
}

const CreditContext = createContext<CreditContextType | null>(null);

export const useCreditContext = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCreditContext must be used within a CreditProvider');
  }
  return context;
};

interface CreditProviderProps {
  children: React.ReactNode;
}

export const CreditProvider: React.FC<CreditProviderProps> = ({ children }) => {
  const { user, isLoaded } = useUser();
  
  const [creditState, setCreditState] = useState<CreditState>({
    creditsUsed: 0,
    creditsLimit: 60,
    tier: 'free',
    status: 'active',
    isLoading: true,
    error: null,
    lastUpdated: 0
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isRefreshing = useRef(false);
  const lastFetchTime = useRef(0);

  // 🔄 Fetch credits with proper error handling
  const refreshCredits = useCallback(async () => {
    if (!user || isRefreshing.current) return;

    // Prevent excessive API calls
    const now = Date.now();
    if (now - lastFetchTime.current < 1000) {
      console.log('🚫 Credit fetch throttled');
      return;
    }

    try {
      isRefreshing.current = true;
      lastFetchTime.current = now;

      console.log('🔄 Fetching credits via context...');
      
      setCreditState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/usage', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ Credit data received:', data);

      setCreditState({
        creditsUsed: Math.max(0, Number(data.usage || data.creditsUsed || 0)),
        creditsLimit: Math.max(1, Number(data.limit || data.creditsLimit || 60)),
        tier: data.plan || data.tier || 'free',
        status: data.status || 'active',
        isLoading: false,
        error: null,
        lastUpdated: now
      });

    } catch (error) {
      console.error('❌ Credit fetch error:', error);
      
      setCreditState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch credits'
      }));

    } finally {
      isRefreshing.current = false;
    }
  }, [user]);

  // 🎯 Initial load when user is ready
  useEffect(() => {
    if (isLoaded && user) {
      refreshCredits();
    } else if (isLoaded && !user) {
      setCreditState(prev => ({
        ...prev,
        isLoading: false,
        error: 'User not authenticated'
      }));
    }
  }, [isLoaded, user, refreshCredits]);

  // 🔄 Auto-refresh every 5 seconds if no errors
  useEffect(() => {
    if (!user || creditState.error) return;

    const interval = setInterval(() => {
      if (!isRefreshing.current) {
        refreshCredits();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, creditState.error, refreshCredits]);

  // 🎯 Trigger refresh function for external use
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    refreshCredits();
  }, [refreshCredits]);

  // 🔥 Optimistically update credits when video processing is complete
  const markVideoProcessed = useCallback((creditsConsumed: number) => {
    console.log(`🎯 Marking ${creditsConsumed} credits as consumed`);
    
    setCreditState(prev => ({
      ...prev,
      creditsUsed: Math.min(prev.creditsLimit, prev.creditsUsed + creditsConsumed),
      lastUpdated: Date.now()
    }));

    // Refresh immediately and then again after a short delay for confirmation
    refreshCredits();
    
    setTimeout(() => {
      refreshCredits();
    }, 2000);
  }, [refreshCredits]);

  const contextValue: CreditContextType = {
    creditState,
    refreshCredits,
    triggerRefresh,
    markVideoProcessed
  };

  return (
    <CreditContext.Provider value={contextValue}>
      {children}
    </CreditContext.Provider>
  );
}; 
