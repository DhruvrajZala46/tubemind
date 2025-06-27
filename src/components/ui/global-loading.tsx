// 🌟 GLOBAL LOADING OVERLAY - Instant Navigation Feedback
'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { ElegantLoader } from './elegant-loader';
import { useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';

interface GlobalLoadingContextType {
  isLoading: boolean;
  loadingText: string;
  showLoading: (text?: string) => void;
  hideLoading: () => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextType | null>(null);

export const useGlobalLoading = () => {
  const context = useContext(GlobalLoadingContext);
  if (!context) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }
  return context;
};

interface GlobalLoadingProviderProps {
  children: React.ReactNode;
}

export const GlobalLoadingProvider: React.FC<GlobalLoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const showLoading = (text = 'Loading...') => {
    setLoadingText(text);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
    setLoadingText('');
  };

  return (
    <GlobalLoadingContext.Provider value={{ isLoading, loadingText, showLoading, hideLoading }}>
      {children}
      {isLoading && <GlobalLoadingOverlay text={loadingText} />}
    </GlobalLoadingContext.Provider>
  );
};

interface GlobalLoadingOverlayProps {
  text: string;
}

const GlobalLoadingOverlay: React.FC<GlobalLoadingOverlayProps> = ({ text }) => {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-[#2D2D2D] border border-[#3A3A3A] rounded-xl px-6 py-4 shadow-2xl flex items-center gap-3">
        <ElegantLoader size="sm" />
        <span className="text-[#FFFFFF] font-medium">{text}</span>
      </div>
    </div>
  );
};

// Hook for automatic navigation loading
export const useNavigationLoading = () => {
  const { showLoading, hideLoading } = useGlobalLoading();
  const router = useRouter();

  const navigateWithLoading = (href: string, text = 'Loading...') => {
    showLoading(text);
    
    // Use setTimeout to ensure loading state shows immediately
    setTimeout(() => {
      router.push(href);
      // Hide loading after navigation (with fallback timeout)
      setTimeout(hideLoading, 1000);
    }, 0);
  };

  return { navigateWithLoading };
}; 
