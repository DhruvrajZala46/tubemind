'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Add entrance animation after component mounts
    setIsLoaded(true);
  }, []);

  return (
    <div className="flex min-h-screen w-screen bg-[#111112] overflow-hidden">
      {/* Sidebar with entrance animation */}
      <aside 
        className={cn(
          "w-[320px] min-w-[320px] max-w-[320px] h-screen overflow-y-auto",
          "bg-[#000000] border-r border-[#232323]", 
          "shadow-[2px_0_8px_0_rgba(0,0,0,0.08)] z-10 text-white",
          "transition-all duration-500 ease-out transform",
          isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
        )}
      />
      
      {/* Main content with entrance animation */}
      <main 
        className={cn(
          "flex-1 min-w-0 bg-[#18181b] p-0 flex flex-col h-screen overflow-y-auto",
          "transition-all duration-500 ease-out transform",
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Content wrapper with glass morphism effect */}
        <div className="relative w-full h-full">
          {/* Subtle animated gradient background */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-[#111112] to-[#18181b] opacity-50"
            style={{
              backgroundSize: '200% 200%',
              animation: 'gradient-shift 15s ease infinite'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 h-full">
        {children}
          </div>
        </div>
      </main>
    </div>
  );
} 
