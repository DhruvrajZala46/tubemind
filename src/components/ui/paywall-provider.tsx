'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

interface PaywallContextType {
  showPaywall: boolean;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  paywallReason?: string;
}

const PaywallContext = createContext<PaywallContextType | undefined>(undefined);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string>();

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
    setPaywallReason(undefined);
  }, []);

  return (
    <PaywallContext.Provider value={{ showPaywall, openPaywall, closePaywall, paywallReason }}>
      {children}
      {showPaywall && <PaywallModal reason={paywallReason} onClose={closePaywall} />}
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error('usePaywall must be used within a PaywallProvider');
  }
  return context;
}

function PaywallModal({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const { user } = useUser();

  const handleUpgrade = () => {
    // Redirect to checkout
    window.location.href = '/api/checkout?plan=basic';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Continue</h2>
          
          <p className="text-gray-400 mb-6">
            {reason || "You've reached your free plan limit. Upgrade to unlock unlimited video summaries!"}
          </p>

          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="text-left space-y-3">
              <div className="flex items-center text-green-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited video summaries</span>
              </div>
              <div className="flex items-center text-green-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Priority processing</span>
              </div>
              <div className="flex items-center text-green-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Advanced AI insights</span>
              </div>
              <div className="flex items-center text-green-400">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Export summaries</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Upgrade to Basic - $9/month
            </button>
            
            <button
              onClick={onClose}
              className="w-full text-gray-400 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Maybe Later
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Cancel anytime. No hidden fees.
          </p>
        </div>
      </div>
    </div>
  );
} 