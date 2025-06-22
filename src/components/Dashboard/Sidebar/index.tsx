"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth, useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { ElegantLoader } from "../../ui/elegant-loader";
import { PlanTextSkeleton } from '../../../components/ui/skeleton';
import { LucideGrid, LucideTrash2, LucideMenu, LucidePlus, LucideMoreVertical, LucideLoader2, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useCreditContext } from '../../../lib/credit-context';
import { formatCreditsTime } from '../../../lib/credit-utils';
import { useMainLoading } from "../../../lib/main-loading-context.tsx";

// Define the type for summary data
interface SummaryItem {
  id: string;
  title: string;
  main_title: string | null;
  created_at: string; // Dates are typically strings from API, will format later if needed
}

// Define the props for the Sidebar component
interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

// Define the fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Sidebar({ onCollapseChange, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  // 🔥 NEW: Use global credit context
  const { creditState, refreshCredits, triggerRefresh } = useCreditContext();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [planInfo, setPlanInfo] = useState<{ plan: string; status: string } | null>(null);
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const [detailedPlanInfo, setDetailedPlanInfo] = useState<any>(null);
  const creditPopupRef = useRef<HTMLDivElement>(null);
  const [hasAutoShownForSession, setHasAutoShownForSession] = useState(false);
  const [isClosingPopup, setIsClosingPopup] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  // 🎯 Main loading context for navigation feedback
  const { showMainLoading, hideMainLoading } = useMainLoading();
  
  // 🔥 CRITICAL FIX: Auto-hide loading state after navigation
  useEffect(() => {
    const handleRouteChange = () => {
      // Hide loading after route change with a small delay to ensure page loads
      const timer = setTimeout(() => {
        hideMainLoading();
      }, 300); // Reduced delay for faster UX
      
      return () => clearTimeout(timer);
    };

    // Hide loading when pathname changes
    const cleanup = handleRouteChange();
    
    return cleanup;
  }, [pathname, hideMainLoading]);

  // 🔥 ADDITIONAL FIX: Cleanup loading on component unmount and visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When page becomes visible again, clear any stuck loading states
        setTimeout(() => hideMainLoading(), 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      hideMainLoading();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hideMainLoading]);

  // Enhanced navigation function with better loading state management
  const navigateWithLoading = (href: string, loadingText: string) => {
    showMainLoading(loadingText);
    
    // Set a failsafe timeout to hide loading in case navigation fails
    const failsafeTimer = setTimeout(() => {
      hideMainLoading();
    }, 5000); // 5 second failsafe
    
    // Navigate
    router.push(href);
    
    // Clear failsafe on successful navigation (pathname change will trigger cleanup)
    return () => clearTimeout(failsafeTimer);
  };

  // Fetch user summaries using useSWR
  const { data, error } = useSWR<{
    data: SummaryItem[]
  }>(isSignedIn ? '/api/summaries' : null, fetcher);

  const summaries = data?.data;
  const isLoading = !data && !error && isSignedIn;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
      // Close credit popup when clicking outside
      if (creditPopupRef.current && !creditPopupRef.current.contains(event.target as Node)) {
        handleClosePopup();
      }
    };

    if (activeMenu || showCreditPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [activeMenu, showCreditPopup]);

  // Notify parent component when collapse state changes
  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  // 🔥 UPDATED: Use credit context for plan info
  useEffect(() => {
    if (isSignedIn && !creditState.isLoading) {
      setPlanInfo({ plan: creditState.tier, status: creditState.status });
      setIsLoadingPlan(false); // Set loading to false when we have data
      
      // Use credit context data for popup logic
      if (!hasAutoShownForSession) {
        const mockData = {
          plan: creditState.tier,
          usage: creditState.creditsUsed,
          limit: creditState.creditsLimit,
          status: creditState.status
        };
        setDetailedPlanInfo(mockData);
        if (shouldAutoShowPopup(mockData)) {
          setShowCreditPopup(true);
          setHasAutoShownForSession(true);
        }
      }
    } else if (isSignedIn && creditState.isLoading) {
      setIsLoadingPlan(true); // Keep loading while credit state is loading
    } else if (!isSignedIn) {
      setIsLoadingPlan(false); // Not signed in, no need to load
    }
  }, [isSignedIn, creditState, hasAutoShownForSession]);

  // 🔥 UPDATED: Use credit context for detailed plan info
  const fetchDetailedPlanInfo = async (checkAutoShow = false) => {
    if (!isSignedIn) return;
    
    // Trigger a fresh fetch from the context
    await refreshCredits();
    
    const data = {
      plan: creditState.tier,
      usage: creditState.creditsUsed,
      limit: creditState.creditsLimit,
      status: creditState.status,
      remaining: creditState.creditsLimit - creditState.creditsUsed
    };
    
    setDetailedPlanInfo(data);
    
    // Check if popup should auto-show
    if (checkAutoShow && shouldAutoShowPopup(data)) {
      setShowCreditPopup(true);
      setHasAutoShownForSession(true);
    }
  };

  // Handle profile click to show credit popup
  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!showCreditPopup) {
      fetchDetailedPlanInfo(false);
    }
    setShowCreditPopup(!showCreditPopup);
  };

  // Enhanced close popup function
  const handleClosePopup = () => {
    setIsClosingPopup(true);
    setTimeout(() => {
      setShowCreditPopup(false);
      setIsClosingPopup(false);
      setHasAutoShownForSession(true);
    }, 200); // Match the animation duration
  };

  // Function to handle deleting a summary
  const handleDeleteSummary = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent multiple clicks
    if (deletingId) return;

    // Check if we're currently viewing the deleted summary
    const currentSummaryId = pathname.split('/dashboard/')[1];
    const isViewingDeletedSummary = currentSummaryId === id;

    setDeletingId(id);

    try {
      const response = await fetch(`/api/summaries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }

      // Show success message first
      toast.success('Summary deleted successfully');

      // Optimistically update the UI
      mutate('/api/summaries', {
        data: summaries?.filter(s => s.id !== id)
      }, false);

      // Close any open menu
      setActiveMenu(null);

      // Redirect to /dashboard/new if user was viewing the deleted summary
      if (isViewingDeletedSummary) {
        // Show loading toast for smooth UX
        toast.loading('Redirecting...', { id: 'redirect-toast' });
        
        // Add a small delay for smooth transition
        setTimeout(() => {
          toast.dismiss('redirect-toast');
          router.push('/dashboard/new');
        }, 500);
      }

    } catch (error) {
      console.error('Error deleting summary:', error);
      toast.error('Failed to delete summary');
    } finally {
      // Keep loading state a bit longer for better UX
      setTimeout(() => {
        setDeletingId(null);
      }, isViewingDeletedSummary ? 800 : 300);
    }
  };

  // Toggle dropdown menu for a summary
  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  // Toggle sidebar collapse state - desktop only now, mobile handled in layout
  const toggleCollapse = () => {
    // On mobile, close the menu
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen?.(false);
    } else {
      // On desktop, toggle collapse state
      setIsCollapsed(!isCollapsed);
    }
  };

  // 🔥 FIXED: Utility function to format minutes to hours/minutes with precision
  const formatTime = (minutes: number): string => {
    if (!minutes || isNaN(minutes) || minutes <= 0) return "0m";
    
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    
    if (remainingMins === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMins}m`;
  };

  // Check if popup should auto-show
  const shouldAutoShowPopup = (planData: any): boolean => {
    if (!planData || hasAutoShownForSession) return false;

    const usagePercent = Math.round((planData.usage / planData.limit) * 100);
    
    // Auto-show conditions:
    // 1. Pro/Basic plans on first load
    if ((planData.plan === 'pro' || planData.plan === 'basic') && !hasAutoShownForSession) {
      return true;
    }
    
    // 2. When credits are 50% or more used
    if (usagePercent >= 50) {
      return true;
    }
    
    // 3. When credits are finished/near limit
    if (usagePercent >= 90) {
      return true;
    }
    
    // 4. First time login check (if no usage history)
    const isFirstTime = localStorage.getItem('tubemind_seen_credits') === null;
    if (isFirstTime) {
      localStorage.setItem('tubemind_seen_credits', 'true');
      return true;
    }
    
    return false;
  };

  if (!isLoaded) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-[#1a1a1a] text-[#ABB2BF]">
        <ElegantLoader size="lg" />
      </div>
    );
  }

  return (
    <div 
        className={cn(
          "flex flex-col h-full relative bg-[#1a1a1a] text-[#ABB2BF] transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-full"
        )}
        style={{
          overflow: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {/* Sidebar Header - Claude Style */}
        <div className="flex items-center px-4 py-3 border-b border-[#30363D] justify-between flex-shrink-0">
          {!isCollapsed && (
            <Link href="/" className="text-[#F0F6FC] text-xl font-bold font-sans truncate hover:text-white transition-colors cursor-pointer">TubeMind</Link>
          )}
          <button 
            onClick={toggleCollapse}
            className="text-[#ABB2BF] hover:text-white transition-colors p-1 flex-shrink-0 cursor-pointer"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={20} />
          </button>
        </div>

      {/* New Summary Button */}
      <div className={cn("px-4 py-3 flex-shrink-0", isCollapsed && "flex justify-center")}>
        <button 
          onClick={() => {
            showMainLoading('Loading...');
            
            // Set a failsafe timeout to hide loading
            const failsafeTimer = setTimeout(() => {
              hideMainLoading();
            }, 3000);
            
            router.push('/dashboard/new');
            
            // Cleanup failsafe when component unmounts or navigation completes
            return () => clearTimeout(failsafeTimer);
          }}
          className={cn(
            "flex items-center justify-center bg-[#DC143C] text-white rounded-lg hover:bg-[#DC143C]/90 text-sm font-medium btn-instant instant-feedback cursor-pointer",
            isCollapsed ? "w-10 h-10 p-0" : "w-full px-4 py-2"
          )}
        >
          <LucidePlus size={isCollapsed ? 20 : 16} className={isCollapsed ? "" : "mr-2"} />
          {!isCollapsed && "New Summary"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        
        {isLoading && !isCollapsed && (
          <div className="px-4 py-2 space-y-1">
            <h3 className="text-[#8B949E] text-xs font-semibold uppercase mb-2">Loading...</h3>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg">
                <div className="h-4 bg-[#21262D] rounded w-3/4 animate-pulse"></div>
                <div className="h-4 w-4 bg-[#21262D] rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        )}
        {error && !isCollapsed && <div className="text-red-500 text-sm px-4 py-2">Failed to load summaries.</div>}

        {!isLoading && !error && summaries && summaries.length > 0 && !isCollapsed ? (
          <div className="px-4 py-2 space-y-1">
            <h3 className="text-[#8B949E] text-xs font-semibold uppercase mb-2">Recents</h3>
            {summaries.map((summary) => (
              <div key={summary.id} className="relative">
                {deletingId === summary.id ? (
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 cursor-not-allowed group",
                    "bg-[#21262D] opacity-60"
                  )}>
                    <span className="truncate text-sm flex items-center min-w-0">
                      <LucideLoader2 size={14} className="mr-2 animate-spin text-red-400 flex-shrink-0" />
                      <span className="truncate">{summary.main_title || summary.title}</span>
                    </span>
                    <button
                      onClick={(e) => toggleMenu(summary.id, e)}
                      disabled={true}
                      className="text-[#8B949E] opacity-50 cursor-not-allowed transition-colors flex-shrink-0"
                      aria-label="More options"
                    >
                      <LucideMoreVertical size={16} />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => {
                      navigateWithLoading(`/dashboard/${summary.id}`, 'Loading summary...');
                    }}
                    className="flex items-center justify-between px-3 py-2 text-[#ABB2BF] hover:bg-[#21262D] rounded-lg cursor-pointer group instant-transition instant-feedback"
                  >
                    <span className="truncate text-sm min-w-0">
                      {summary.main_title || summary.title}
                    </span>
                    <button
                      onClick={(e) => toggleMenu(summary.id, e)}
                      className="text-[#8B949E] hover:text-white transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex-shrink-0"
                      aria-label="More options"
                    >
                      <LucideMoreVertical size={16} />
                    </button>
                  </div>
                )}
                {/* Dropdown menu */}
                {activeMenu === summary.id && (
                  <div 
                    ref={menuRef}
                    className="absolute right-2 top-8 w-32 bg-[#1F1F1F] border border-[#404040] rounded-lg shadow-xl z-50 py-1"
                    style={{
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 2px 8px 0 rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <button
                      onClick={(e) => handleDeleteSummary(summary.id, e)}
                      disabled={deletingId === summary.id}
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm transition-all duration-200 first:rounded-t-lg last:rounded-b-lg",
                        deletingId === summary.id 
                          ? "bg-[#2A2A2A] cursor-not-allowed opacity-70" 
                          : "text-[#F0F6FC] hover:bg-[#2A2A2A]"
                      )}
                    >
                      {deletingId === summary.id ? (
                        <>
                          <LucideLoader2 size={14} className="mr-3 text-red-400 animate-spin" />
                          <span className="text-red-400">Deleting...</span>
                        </>
                      ) : (
                        <>
                          <LucideTrash2 size={14} className="mr-3 text-red-400" />
                          <span className="text-red-400">Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !isLoading && !error && !isCollapsed && (
          <div className="p-4 text-center text-[#8B949E] text-sm space-y-3">
            <p>No summaries yet.</p>
            <p>Analyze your first video to get started!</p>
          </div>
        )}
      </div>
      
      {/* User Profile / Sign Up / Sign In Section */}
      <div className={cn(
        "px-6 py-4 border-t border-[#30363D] flex items-center bg-[#161B22] flex-shrink-0 relative",
        isCollapsed ? "justify-center px-3" : "justify-between gap-2"
      )}>
        {isSignedIn ? (
          isCollapsed ? (
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
          ) : (
            <div className="flex items-center gap-3 min-w-0 w-full">
              <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
              <div 
                className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleProfileClick}
              >
                <div className="text-[#F0F6FC] font-medium text-[14px] leading-tight font-sans truncate">{user?.firstName} {user?.lastName}</div>
                {isLoadingPlan ? (
                  <div className="h-3 w-16 bg-[#21262D] rounded animate-pulse mt-1"></div>
                ) : (
                  <div className="text-[#8B949E] text-xs font-normal leading-tight font-sans capitalize">
                    {planInfo?.plan || 'Free'} plan
                  </div>
                )}
              </div>
            </div>
          )
        ) : !isCollapsed && (
          <div className="flex gap-2 w-full">
            <SignUpButton mode="modal">
              <div className="w-full">
                <button className="flex items-center gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] hover:text-white border border-[#30363D] hover:border-[#404040] font-medium transition-all text-sm px-4 py-1.5 rounded-lg justify-center w-full">
                  Sign up
                </button>
              </div>
            </SignUpButton>
            <SignInButton mode="modal">
              <div className="w-full">
                <button className="flex items-center gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] hover:text-white border border-[#30363D] hover:border-[#404040] font-medium transition-all text-sm px-4 py-1.5 rounded-lg justify-center w-full">
                  Sign in
                </button>
              </div>
            </SignInButton>
          </div>
        )}

        {/* Credit/Plan Popup */}
        {showCreditPopup && !isCollapsed && detailedPlanInfo && (
          <div 
            ref={creditPopupRef}
            className={`absolute bottom-full left-4 right-4 mb-2 bg-[#161B22] border border-[#30363D] rounded-xl px-6 py-4 shadow-xl z-50 ${
              isClosingPopup ? 'animate-slide-out-down' : 'animate-slide-in-up'
            }`}
            style={{
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 2px 8px 0 rgba(0, 0, 0, 0.2)',
              transformOrigin: 'bottom center'
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClosePopup}
              className="absolute top-2 right-2 text-[#8B949E] hover:text-[#F0F6FC] transition-colors duration-200 p-1 rounded-md hover:bg-[#21262D]"
              aria-label="Close popup"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#F0F6FC] font-semibold text-base capitalize">{detailedPlanInfo.plan} plan</span>
                <span className="text-xs text-[#8B949E]">({detailedPlanInfo.status})</span>
              </div>
              <div className="w-full flex flex-col items-center">
                <div className="w-full flex justify-between text-xs text-[#8B949E] mb-1">
                  <span>{formatCreditsTime(detailedPlanInfo.usage)} used</span>
                  <span>{formatCreditsTime(detailedPlanInfo.remaining || (detailedPlanInfo.limit - detailedPlanInfo.usage))} left</span>
                </div>
                <div className="w-full h-3 bg-[#21262D] rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: `${Math.min(100, Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100))}%` }} 
                    className="h-full bg-[#DC143C] transition-all duration-500 ease-out"
                  ></div>
                </div>
                {Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100) >= 90 && (
                  <div className="text-xs text-[#DC143C] mt-1 font-medium animate-pulse">
                    You are near your monthly limit. <a href="/pricing" className="underline hover:text-[#DC143C] transition-colors">Upgrade now</a>
                  </div>
                )}
                {Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100) >= 100 && (
                  <div className="text-xs text-[#DC143C] mt-1 font-medium animate-pulse">
                    You have reached your monthly limit. <a href="/pricing" className="underline hover:text-[#DC143C] transition-colors">Upgrade to continue</a>
                  </div>
                )}
                {Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100) >= 50 && Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100) < 90 && (
                  <div className="text-xs text-[#FFA500] mt-1 font-medium">
                    You've used {Math.round((detailedPlanInfo.usage / detailedPlanInfo.limit) * 100)}% of your monthly limit.
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-[#30363D] w-full text-center">
                <div className="text-xs text-[#8B949E]">
                  <span className="capitalize text-[#F0F6FC] font-medium">{detailedPlanInfo.plan} Plan</span>
                  <span className="mx-1">•</span>
                  {detailedPlanInfo.plan === 'free' ? (
                    <a href="/#pricing" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline transition-colors">
                      Upgrade
                    </a>
                  ) : (
                    <a href="/api/subscription/manage" target="_blank" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline transition-colors">
                      Manage
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 