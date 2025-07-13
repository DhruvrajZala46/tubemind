"use client";
import React, { useContext } from "react";
import { SidebarMenuContext } from "../layout";

export default function NewDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useContext(SidebarMenuContext);
  return (
    <div className="relative flex h-screen w-full bg-[var(--bg-dashboard)] font-sans">
      {/* Mobile Top Nav Bar - Perplexity-style left-aligned */}
      <div
        className="fixed top-0 left-0 w-full h-12 border-b border-[#22292F] flex items-center px-4 z-30 sm:hidden"
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
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border border-[#22292F] text-white mr-3"
          aria-label="Open sidebar"
          style={{ padding: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <img src="/logo.svg" alt="TubeMind Logo" className="w-6 h-6 mr-2" style={{ display: 'inline-block' }} />
        <span className="text-[16px] font-semibold text-white tracking-tight" style={{ fontFamily: 'Roboto, system-ui, sans-serif', letterSpacing: '-0.01em' }}>TubeMind</span>
      </div>
      {/* Main content area: removed justify-center and added overflow-y-auto for scrolling */}
      <main className="w-full flex flex-col min-h-screen pt-10 pb-16 sm:pt-0 sm:pb-0 overflow-y-auto">
        {React.cloneElement(children as React.ReactElement<any>, { isMobileMenuOpen, setIsMobileMenuOpen })}
      </main>
    </div>
  );
} 
