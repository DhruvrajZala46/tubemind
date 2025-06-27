// 🎯 MAIN LOADING CONTEXT
// Manages loading state for main content area

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MainLoadingContextType {
  isLoading: boolean;
  loadingText: string;
  showMainLoading: (text?: string) => void;
  hideMainLoading: () => void;
}

const MainLoadingContext = createContext<MainLoadingContextType | null>(null);

export const useMainLoading = () => {
  const context = useContext(MainLoadingContext);
  if (!context) {
    throw new Error('useMainLoading must be used within MainLoadingProvider');
  }
  return context;
};

interface MainLoadingProviderProps {
  children: React.ReactNode;
}

export const MainLoadingProvider: React.FC<MainLoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');

  const showMainLoading = useCallback((text = 'Loading...') => {
    setLoadingText(text);
    setIsLoading(true);
  }, []);

  const hideMainLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingText('Loading...');
  }, []);

  const value = {
    isLoading,
    loadingText,
    showMainLoading,
    hideMainLoading
  };

  return (
    <MainLoadingContext.Provider value={value}>
      {children}
    </MainLoadingContext.Provider>
  );
}; 
