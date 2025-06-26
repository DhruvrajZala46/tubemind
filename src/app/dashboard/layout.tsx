"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../../components/Dashboard/Sidebar";
import { cn } from "../../lib/utils";
import { MainLoadingOverlay } from "../../components/ui/main-loading-overlay.tsx";
import { MainLoadingProvider, useMainLoading } from "../../lib/main-loading-context.tsx";

const DashboardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { isLoading: isMainLoading, loadingText } = useMainLoading();
  const prevPathnameRef = useRef(pathname);

  // Auto-sync user data on dashboard load
  useEffect(() => {
    const syncUser = async () => {
      try {
        console.log('🔄 Syncing user data...');
        const response = await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        console.log('✅ User sync result:', result);
      } catch (error) {
        console.error('❌ User sync failed:', error);
      }
    };
    syncUser();
  }, []);

  // Auto-close mobile sidebar after navigation
  useEffect(() => {
    if (isMobileMenuOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      if (prevPathnameRef.current !== pathname) {
        setIsMobileMenuOpen(false);
        prevPathnameRef.current = pathname;
      }
    }
  }, [pathname, isMobileMenuOpen]);
  
  // Allow scrolling on all routes for better mobile UX
  const isNewRoute = false; // Changed: always allow scrolling

  // Function to handle sidebar collapse state changes from the Sidebar component
  const handleSidebarCollapseChange = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  // Close mobile menu when clicking main content area
  const handleMainContentClick = () => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0D1117] overflow-hidden font-sans">
      {/* Desktop Sidebar - Only visible on lg+ screens */}
      <aside
        className={cn(
          "hidden lg:flex h-full bg-[#161B22] border-r border-[#30363D] flex-shrink-0 overflow-y-auto z-40 transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-[280px]"
        )}
      >
        <Sidebar 
          onCollapseChange={handleSidebarCollapseChange} 
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </aside>

      {/* Mobile Sidebar Overlay - Premium Native Animation */}
      {isMobileMenuOpen && (
        <aside 
          className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] h-full bg-[#161B22] border-r border-[#30363D] overflow-y-auto shadow-2xl"
          style={{
            transform: 'translateX(0)',
            transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15), 2px 0 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Sidebar 
            onCollapseChange={handleSidebarCollapseChange} 
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
        </aside>
      )}

      {/* Mobile Floating Toggle Button - Claude Style PanelLeft */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => {
            console.log('Mobile menu button clicked!');
            setIsMobileMenuOpen(true);
          }}
          className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#161B22] hover:bg-[#21262D] text-[#F0F6FC] rounded-lg shadow-lg border border-[#30363D] backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
            WebkitBackdropFilter: 'blur(8px)',
            backdropFilter: 'blur(8px)',
          }}
          aria-label="Open sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
        </button>
      )}

      {/* Mobile Backdrop - Premium Subtle Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/15 backdrop-blur-md transition-all duration-400 ease-out"
          style={{
            backdropFilter: 'blur(8px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
          }}
          onClick={() => {
            console.log('Backdrop clicked, closing sidebar');
            setIsMobileMenuOpen(false);
          }}
        />
      )}

      {/* Main Content - Full width on mobile, with desktop margin */}
      <main 
        className={cn(
          "flex-1 h-screen bg-[#0D1117] transition-all duration-300 ease-in-out relative",
          isNewRoute ? "flex items-center justify-center overflow-hidden" : "overflow-y-auto",
          // Mobile: Full width always, Desktop: Respect sidebar collapse
          "w-full",
          // Desktop sidebar margins
          isSidebarCollapsed ? "lg:ml-16 lg:w-[calc(100%-4rem)]" : "lg:ml-0 lg:w-full"
        )}
        onClick={handleMainContentClick}
      >
        {children}
        <MainLoadingOverlay isVisible={isMainLoading} text={loadingText} />
      </main>
    </div>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLoadingProvider>
      <DashboardContent>{children}</DashboardContent>
    </MainLoadingProvider>
  );
} 