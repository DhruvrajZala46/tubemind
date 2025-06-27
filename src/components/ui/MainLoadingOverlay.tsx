// 🎯 MAIN CONTENT LOADING OVERLAY
// Shows elegant spinner over main content area during navigation

'use client';

import React from 'react';
import { ElegantLoader } from './elegant-loader';

interface MainLoadingOverlayProps {
  isVisible: boolean;
  text?: string;
}

export const MainLoadingOverlay: React.FC<MainLoadingOverlayProps> = ({ 
  isVisible, 
  text = 'Loading...' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-[#000000] border border-[#DC143C] rounded-xl px-8 py-6 shadow-2xl flex flex-col items-center gap-4">
        <ElegantLoader size="lg" />
        <span className="text-[#FFFFFF] font-medium text-lg">{text}</span>
      </div>
    </div>
  );
}; 
