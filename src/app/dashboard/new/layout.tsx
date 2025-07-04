"use client";
import React, { useContext } from "react";
import { SidebarMenuContext } from "../layout";

export default function NewDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useContext(SidebarMenuContext);
  return (
    <div className="relative flex h-screen w-full bg-[#000000] font-sans">
      {/* Mobile Top Nav Bar - Perplexity-style left-aligned */}
      <div
        className="fixed top-0 left-0 w-full h-14 border-b border-[#22292F] flex items-center px-4 z-30 sm:hidden"
        style={{
          fontFamily: 'Roboto, system-ui, sans-serif',
          boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #22292F',
        }}
      >
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-transparent border border-[#22292F] text-white mr-3"
          aria-label="Open sidebar"
          style={{ padding: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <img src="/logo.svg" alt="TubeMind Logo" className="w-7 h-7 mr-2" style={{ display: 'inline-block' }} />
        <span className="text-[18px] font-semibold text-white tracking-tight" style={{ fontFamily: 'Roboto, system-ui, sans-serif', letterSpacing: '-0.01em' }}>TubeMind</span>
      </div>
      {/* Main content area for mobile: add padding for nav and input */}
      <main className="w-full flex flex-col items-center justify-center min-h-screen pt-12 pb-20 sm:pt-0 sm:pb-0">
        {React.cloneElement(children as React.ReactElement<any>, { isMobileMenuOpen, setIsMobileMenuOpen })}
      </main>
    </div>
  );
} 
