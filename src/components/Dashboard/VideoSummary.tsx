"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Separator } from '../ui/separator';
import VideoInfoCard from './VideoInfoCard';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import { LoadingState } from '../ui/loading-states';
import { useMainLoading } from '../../lib/main-loading-context.tsx';
import { ElegantLoader } from '../ui/elegant-loader';
import { CircularProgressWithLoader } from '../ui/CircularProgressWithLoader';
import Link from 'next/link';
import remarkGfm from 'remark-gfm';

// ChatGPT-style markdown renderer with typewriter effect
function ChatGPTMarkdown({ 
  markdown, 
  typewriterSpeed = 0.1, // ULTRA-FAST typewriter speed for instant reading
  enableTypewriter = true,
  className = "",
  summaryId = "" // Add summaryId to track if this summary has been viewed
}: { 
  markdown: string; 
  typewriterSpeed?: number;
  enableTypewriter?: boolean;
  className?: string;
  summaryId?: string;
}) {
  const [displayed, setDisplayed] = useState<string>('');
  const [animationComplete, setAnimationComplete] = useState(false);
  const isAnimating = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const cleanedMarkdown = useRef<string>('');
  
  // Check if this summary has been viewed before
  const hasBeenViewed = useRef(false);
  
  useEffect(() => {
    if (summaryId) {
      const viewedSummaries = JSON.parse(localStorage.getItem('tubemind_viewed_summaries') || '[]');
      hasBeenViewed.current = viewedSummaries.includes(summaryId);
    }
  }, [summaryId]);
  
  useEffect(() => {
    if (!markdown) return;
    
    // Clean markdown content only once
    const segments = markdown.split('---').filter(segment => segment.trim() !== '');
    const uniqueSegments = Array.from(new Set(segments));
    cleanedMarkdown.current = uniqueSegments.join('---');
  }, [markdown]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // If no markdown content, show nothing
    if (!cleanedMarkdown.current) {
      setDisplayed('');
      setAnimationComplete(false);
      return;
    }
    
    // If typewriter is disabled, animation already complete, or summary has been viewed before, show immediately
    if (!enableTypewriter || hasBeenViewed.current || isAnimating.current) {
      setDisplayed(cleanedMarkdown.current);
      setAnimationComplete(true);
      return;
    }

    // Start typewriter animation only if this is the first time viewing this summary
    setDisplayed('');
    setAnimationComplete(false);
    isAnimating.current = true;
    
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < cleanedMarkdown.current.length) {
        setDisplayed(cleanedMarkdown.current.substring(0, i + 1));
        i++;
      } else {
        // Animation complete
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setAnimationComplete(true);
        isAnimating.current = false;
        
        // Mark this summary as viewed
        if (summaryId) {
          const viewedSummaries = JSON.parse(localStorage.getItem('tubemind_viewed_summaries') || '[]');
          if (!viewedSummaries.includes(summaryId)) {
            viewedSummaries.push(summaryId);
            localStorage.setItem('tubemind_viewed_summaries', JSON.stringify(viewedSummaries));
          }
        }
      }
    }, typewriterSpeed);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cleanedMarkdown.current, typewriterSpeed, enableTypewriter, summaryId]);

  return (
    <div className={`chatgpt-markdown mobile-text-optimize ${className}`}>
      <Suspense fallback={<div>Loading...</div>}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3 lg:mb-4 mt-2 sm:mt-3 lg:mt-4 lightning-heading" {...props} />,
            h2: ({node, ...props}) => (
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 sm:mb-3 lg:mb-4 mt-3 sm:mt-4 lg:mt-5 border-b border-[var(--border-color)] pb-1 lightning-heading" {...props} />
            ),
            h3: ({node, ...props}) => <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-2 mt-4 sm:mt-5 lg:mt-6" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 my-4" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-2 my-4" {...props} />,
            li: ({node, ...props}) => <li className="leading-relaxed my-1 pl-2" {...props} />,
            p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold text-[var(--text-primary)]" {...props} />,
            em: ({node, ...props}) => <em className="italic text-[var(--text-secondary)]" {...props} />,
            code: ({node, ...props}) => <code className="bg-[var(--bg-input)] px-1 py-0.5 rounded" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[var(--border-color)] pl-4 py-1 my-4 text-[var(--text-primary)] bg-white/5 rounded-r" {...props} />,
            hr: ({node, ...props}) => <hr className="my-6 border-t border-[var(--border-color)]" {...props} />,
            table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="w-full text-left border-collapse" {...props} /></div>,
            thead: ({node, ...props}) => <thead className="bg-white/10" {...props} />,
            tbody: ({node, ...props}) => <tbody {...props} />,
            tr: ({node, ...props}) => <tr className="border-b border-white/10" {...props} />,
            th: ({node, ...props}) => <th className="p-3 font-semibold" {...props} />,
            td: ({node, ...props}) => <td className="p-3" {...props} />,
          }}
        >
          {displayed}
        </ReactMarkdown>
      </Suspense>

      <style jsx global>{`
        .chatgpt-markdown {
          font-family: var(--font-sans);
          font-size: 1rem; /* Updated base font size */
          line-height: 1.5; /* OPTIMIZED: Tighter line height for faster reading */
          color: #e6e6e6;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0.5rem 0;
          margin: 0 auto;
          width: 100%;
          max-width: 100%;
          overflow-wrap: break-word;
        }
        
        /* ⚡ LIGHTNING READING OPTIMIZATIONS */
        .lightning-heading {
          letter-spacing: -0.02em;
          font-weight: 700 !important;
          color: #f8f9fa !important;
        }
        
        .lightning-section {
          margin: 1rem 0 !important;
        }
        
        /* KEY TAKEAWAYS special styling */
        .key-takeaways-container {
          background-color: #121212; /* Match sidebar background color */
          border-radius: 12px 12px 0 0;
          padding: 1.5rem 1.5rem 0.5rem;
          margin: 2rem 0 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
          border-left: 4px solid #4f46e5; /* Indigo accent */
        }
        
        .key-takeaways-container h2 {
          margin-top: 0 !important;
          border-bottom-color: rgba(255, 255, 255, 0.2) !important;
          color: #f3f3f3;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        
        .key-takeaways-list {
          background-color: #121212;
          border-radius: 0 0 12px 12px;
          padding: 0.5rem 1.5rem 1.5rem !important;
          margin-top: 0 !important;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
          border-left: 4px solid #4f46e5; /* Indigo accent */
        }
        
        .key-takeaways-list li {
          margin-bottom: 0.75rem;
          color: #f3f3f3;
          position: relative;
        }
        
        .key-takeaways-list li::before {
          content: "•";
          color: #4f46e5; /* Indigo bullet points */
          font-weight: bold;
          display: inline-block;
          width: 1em;
          margin-left: -1em;
        }
        
        /* BIG PICTURE special styling */
        .big-picture-container {
          background-color: #121212; /* Match sidebar background color */
          border-radius: 12px;
          padding: 1.5rem;
          margin: 2rem 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
          border-left: 4px solid #10b981; /* Emerald accent */
        }
        
        .big-picture-container h2 {
          margin-top: 0 !important;
          border-bottom-color: rgba(255, 255, 255, 0.2) !important;
          color: #f3f3f3;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        
        .big-picture-text {
          color: #f3f3f3;
          font-size: 1.1em;
          line-height: 1.6;
          font-weight: 500;
          padding: 0.5rem 0;
        }
        
        /* Mobile responsiveness for special sections */
        @media (max-width: 767px) {
          .key-takeaways-container,
          .big-picture-container {
            padding: 1.25rem 1.25rem 0.5rem;
            border-radius: 10px 10px 0 0;
          }
          
          .key-takeaways-list {
            padding: 0.5rem 1.25rem 1.25rem !important;
            border-radius: 0 0 10px 10px;
          }
          
          .big-picture-text {
            font-size: 1.05em;
          }
        }
        
        /* Mobile-first responsive text sizing */
        @media (max-width: 767px) {
          .chatgpt-markdown {
            font-size: 16px; /* Better mobile readability */
            line-height: 1.6;
            font-family: var(--font-sans);
          }
          
          .chatgpt-markdown h1 {
            font-size: 1.6rem;
            margin-bottom: 1rem;
          }
          
          .chatgpt-markdown h2 {
            font-size: 1.35rem;
            margin-bottom: 0.75rem;
          }
          
          .chatgpt-markdown h3 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
          }
          
          .chatgpt-markdown p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 1rem;
          }
          .chatgpt-markdown strong, .chatgpt-markdown b {
            font-family: 'Poppins', sans-serif !important;
            font-weight: bold;
            letter-spacing: 0.01em;
          }
        }
        
        /* Desktop text sizes */
        @media (min-width: 768px) {
          .chatgpt-markdown {
            font-size: 1rem;
            line-height: 1.7;
          }
        }
        
        @media (min-width: 1024px) {
          .chatgpt-markdown {
            font-size: 1.15rem;
            line-height: 1.8;
          }
          .chatgpt-markdown strong, .chatgpt-markdown b {
            font-family: 'Poppins', sans-serif !important;
            font-weight: bold;
            letter-spacing: 0.01em;
          }
        }
        
        .chatgpt-markdown h1 {
          font-size: 1.75rem; /* Updated for desktop */
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        
        .chatgpt-markdown h2 {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 0.5rem;
          letter-spacing: -0.01em;
          font-size: 1.4rem; /* Updated for desktop */
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        
        /* Desktop heading sizes */
        @media (min-width: 768px) {
          .chatgpt-markdown h1 {
            font-size: 1.75rem;
            margin-top: 2rem;
            margin-bottom: 1.25rem;
          }
          
          .chatgpt-markdown h2 {
            font-size: 1.4rem;
            margin-top: 1.75rem;
            margin-bottom: 1rem;
          }
        }
        
        @media (min-width: 1024px) {
          .chatgpt-markdown h1 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
          }
          
          .chatgpt-markdown h2 {
            font-size: 1.5rem;
            margin-top: 2rem;
          }
        }
        
        .chatgpt-markdown p {
          margin-bottom: 0.8em; /* OPTIMIZED: Tighter spacing for faster reading */
          letter-spacing: 0.01em;
          line-height: 1.5; /* Consistent tight line height */
        }
        
        /* Desktop paragraph spacing - OPTIMIZED */
        @media (min-width: 768px) {
          .chatgpt-markdown p {
            margin-bottom: 0.9em; /* Slightly more space on larger screens */
          }
        }
        
        @media (min-width: 1024px) {
          .chatgpt-markdown p {
            margin-bottom: 1em; /* Balanced spacing for desktop */
          }
        }
        
        .chatgpt-markdown code {
          color: var(--text-primary);
        }
        
        .chatgpt-markdown strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        
        .chatgpt-markdown em {
          color: var(--text-secondary);
          font-style: italic;
        }
        
        .chatgpt-markdown a {
          color: var(--text-primary);
          text-decoration: underline;
        }
        
        .chatgpt-markdown a:hover {
          text-decoration: underline;
        }
        
        .chatgpt-markdown pre {
          background: var(--bg-input);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        .chatgpt-markdown blockquote {
          border-left-color: var(--border-color);
          background-color: rgba(255, 255, 255, 0.05);
          padding: 0.75rem 1rem;
          border-radius: 0 0.375rem 0.375rem 0;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

export { ChatGPTMarkdown };

interface VideoSummaryProps {
  summary: {
    title: string;
    description: string;
    thumbnail_url: string;
    channel_title: string;
    duration: number;
    view_count: number;
    publish_date: string;
    main_title: string;
    overall_summary: string;
    raw_ai_output: string;
    processing_status: string;
    segments: any[];
    key_takeaways: any[];
    final_thought: string;
    processing_progress?: number;
    processing_stage?: string;
  };
  videoId?: string;
  summaryId?: string | number;
}

// Utility to unescape all escaped characters
function unescapeString(str: string) {
  // First, remove outer quotes if the string is wrapped in them
  let cleanStr = str;
  if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
    cleanStr = cleanStr.slice(1, -1);
  }
  
  // Then unescape all escaped characters
  return cleanStr
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

// Map status to progress
const statusToProgress: Record<string, number> = {
  queued: 5,
  transcribing: 30,
  summarizing: 70,
  finalizing: 90,
  completed: 100,
};

export default function VideoSummary({ summary: initialSummary, videoId, summaryId }: VideoSummaryProps) {
  console.log('VideoSummary summary prop:', initialSummary);
  const { showMainLoading, hideMainLoading } = useMainLoading();
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Keep track of the previous summary to avoid flicker
  const previousSummary = useRef(initialSummary);

  const isProcessing = (status: string) => ['processing', 'queued', 'transcribing', 'summarizing', 'finalizing'].includes(status);
  const isFailed = (status: string) => status === 'failed';
  const isComplete = (status: string) => {
    const result = status === 'completed';
    console.log('🔍 DEBUG: isComplete function - status:', `"${status}"`, 'result:', result, 'status type:', typeof status);
    return result;
  };

  // OPTIMIZED: Use real progress instead of fake progress animations
  const [displayedProgress, setDisplayedProgress] = useState(initialSummary.processing_progress || statusToProgress[initialSummary.processing_status] || 5);

  // OPTIMIZED: Update progress immediately when backend status changes
  useEffect(() => {
    const newProgress = summary.processing_progress || statusToProgress[summary.processing_status] || 5;
    setDisplayedProgress(newProgress);
  }, [summary.processing_status, summary.processing_progress]);

  // OPTIMIZED: More frequent and responsive polling during processing
  useEffect(() => {
    // CRITICAL: Clear any existing polling interval first
    if (pollingInterval.current) {
      console.log('🧹 VideoSummary: Clearing existing polling interval before setup');
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    if (!isProcessing(summary.processing_status)) {
      console.log('🔍 VideoSummary: Not processing, skipping polling setup. Status:', summary.processing_status);
      return;
    }

    // CRITICAL: Check if this is a client-side page that already has ProcessingStatusPoller
    // If so, let that handle the polling instead to avoid duplication
    if (typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/')) {
      console.log('🔍 VideoSummary: On dashboard page - ProcessingStatusPoller will handle polling');
      return;
    }

    console.log('🔍 VideoSummary: Setting up polling for processing status:', summary.processing_status);

    // CRITICAL FIX: Create AbortController for proper cleanup
    let abortController = new AbortController();
    let isComponentMounted = true;

    const pollSummaryStatus = async () => {
      // CRITICAL: Skip if component is unmounted
      if (!isComponentMounted) {
        console.log('🚫 VideoSummary: Component unmounted, skipping poll');
        return;
      }

      try {
        console.log('🔄 VideoSummary: Polling summary status for summaryId:', summaryId);
        
        // CRITICAL FIX: Use AbortController for proper cancellation
        const response = await fetch(`/api/summaries/${summaryId}/status`, {
          signal: abortController.signal,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        // CRITICAL: Check if component is still mounted before processing response
        if (!isComponentMounted) {
          console.log('🚫 VideoSummary: Component unmounted during fetch, ignoring response');
          return;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 VideoSummary: Summary status data:', data);

        // CRITICAL: Double-check component is still mounted before state updates
        if (!isComponentMounted) {
          console.log('🚫 VideoSummary: Component unmounted before state update, skipping');
          return;
        }

        // OPTIMIZED: Use actual progress from backend
        const updatedSummary = {
          ...summary,
          processing_status: data.processing_status,
          processing_stage: data.processing_stage || data.processing_status,
          processing_progress: data.processing_progress || statusToProgress[data.processing_status] || summary.processing_progress,
          main_title: data.main_title || summary.main_title,
          overall_summary: data.overall_summary || summary.overall_summary,
          raw_ai_output: data.raw_ai_output || summary.raw_ai_output,
        };

        setSummary(updatedSummary);
        previousSummary.current = updatedSummary;

        // CRITICAL: Stop polling immediately when completed or failed
        if (!isProcessing(data.processing_status)) {
          console.log('✅ VideoSummary: Processing finished, stopping polling. Final status:', data.processing_status);
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
          return; // Exit polling function
        }

      } catch (error) {
        // CRITICAL FIX: Silently handle all abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('🔇 VideoSummary: Fetch aborted (component cleanup) - this is normal');
          return;
        }
        
        // CRITICAL: Only log other errors if component is still mounted
        if (!isComponentMounted) {
          console.log('🔇 VideoSummary: Component unmounted, ignoring error');
          return;
        }
        
        console.error('❌ VideoSummary: Error polling summary status:', error);
        
        // CRITICAL FIX: Better error classification
        const isNetworkError = error instanceof Error && 
          (error.message.includes('network') || 
           error.message.includes('connection') ||
           error.message.includes('502') ||
           error.message.includes('503') ||
           error.message.includes('504') ||
           error.message.includes('timeout'));
        
        // Only show error and stop polling for persistent non-network issues
        if (!isNetworkError) {
          setError('Failed to check processing status');
          
          // CRITICAL: Stop polling on persistent errors
          if (pollingInterval.current) {
            console.log('🛑 VideoSummary: Stopping polling due to error');
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
          return;
        } else {
          // For network errors, just continue silently
          console.log('⏳ VideoSummary: Network error, continuing...');
        }
      }
    };

    // OPTIMIZED: Dynamic polling frequency based on processing stage
    const getPollingInterval = (status: string) => {
      switch (status) {
        case 'queued':
          return 3000; // 3 seconds for queued items
        case 'transcribing':
        case 'summarizing':
          return 1000; // 1 second during active processing
        case 'finalizing':
          return 1500; // 1.5 seconds during finalizing
        default:
          return 2000; // 2 seconds default
      }
    };

    // Start immediate poll
    pollSummaryStatus();

    // Set up interval with dynamic frequency
    const interval = getPollingInterval(summary.processing_status);
    console.log(`🔄 VideoSummary: Setting up polling interval: ${interval}ms for status: ${summary.processing_status}`);
    pollingInterval.current = setInterval(pollSummaryStatus, interval);

    // CRITICAL: Cleanup function that always runs
    return () => {
      console.log('🧹 VideoSummary useEffect cleanup - clearing polling interval and aborting requests');
      isComponentMounted = false;
      
      // Abort any ongoing fetch requests
      if (abortController) {
        abortController.abort();
      }
      
      // Clear polling interval
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [summaryId]); // FIXED: Only depend on summaryId, not processing status to avoid re-creating intervals

  // CRITICAL: Separate effect to handle status changes without recreating polling
  useEffect(() => {
    // If status changes to non-processing, stop polling
    if (!isProcessing(summary.processing_status) && pollingInterval.current) {
      console.log('🛑 Status changed to non-processing, stopping polling. Status:', summary.processing_status);
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, [summary.processing_status]);

  // CRITICAL: Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('🧹 VideoSummary component unmounting - final cleanup');
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, []);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
          <div className="text-[var(--text-secondary)] mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[var(--btn-dashboard-bg)] text-[var(--btn-primary-text)] rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show failed state
  if (isFailed(summary.processing_status)) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">❌ Processing Failed</div>
          <div className="text-[var(--text-secondary)] mb-4">
            Sorry, we couldn't process your video. Please try again.
          </div>
          <Link href="/dashboard/new" className="px-4 py-2 bg-[var(--btn-dashboard-bg)] text-[var(--btn-primary-text)] rounded-lg">
            Try Another Video
          </Link>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Real-time processing state with accurate progress
  if (isProcessing(summary.processing_status)) {
    console.log('🔍 DEBUG: Taking processing path');
    
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center p-8 max-w-md w-full">
          <div className="text-2xl mb-4">🎬 Processing Video</div>
          
          {/* OPTIMIZED: Real progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 mb-6">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${displayedProgress}%` }}
            />
          </div>
          
          {/* OPTIMIZED: Accurate progress percentage and stage */}
          <div className="text-lg font-medium mb-2">
            {displayedProgress}% Complete
          </div>
          
          {/* OPTIMIZED: Clear stage messaging */}
          <div className="text-[var(--text-secondary)] mb-4">
            {summary.processing_stage === 'transcribing' && 'Extracting video transcript...'}
            {summary.processing_stage === 'summarizing' && 'Analyzing content with AI...'}
            {summary.processing_stage === 'finalizing' && 'Finalizing your summary...'}
            {!summary.processing_stage && 'Preparing to process video...'}
          </div>
          
          <div className="text-sm text-[var(--text-secondary)]">
            This usually takes 1-2 minutes
          </div>
        </div>
      </div>
    );
  }

  const {
    title,
    description,
    channel_title,
    duration,
    view_count,
    publish_date,
    main_title,
    overall_summary,
    raw_ai_output,
    processing_status,
    segments,
    key_takeaways,
    final_thought,
  } = summary;

  const renderContent = () => {
    console.log('🔍 DEBUG: renderContent called');
    console.log('🔍 DEBUG: processing_status:', summary.processing_status);
    console.log('🔍 DEBUG: isComplete result:', isComplete(summary.processing_status));
    console.log('🔍 DEBUG: raw_ai_output exists:', !!summary.raw_ai_output);
    
    if (isProcessing(summary.processing_status)) {
      console.log('🔍 DEBUG: Taking processing path');
      // Animate progress up to 80% while processing, 100% on completion
      const [fakeProgress, setFakeProgress] = useState(10);
      const [target, setTarget] = useState(80);

      useEffect(() => {
        if (summary.processing_status === 'queued') setTarget(30);
        else if (summary.processing_status === 'transcribing') setTarget(60);
        else if (summary.processing_status === 'summarizing') setTarget(80);
        else if (summary.processing_status === 'completed') setTarget(100);
      }, [summary.processing_status]);

      useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (fakeProgress < target) {
          interval = setInterval(() => {
            setFakeProgress(prev => {
              if (summary.processing_status === 'completed') return 100;
              if (prev < target) {
                // Dynamic step: fast at first, slower as it approaches target
                const diff = target - prev;
                let step = 1;
                if (diff > 40) step = 3;
                else if (diff > 20) step = 2;
                else if (diff > 10) step = 1.5;
                else if (diff > 5) step = 1;
                else step = 0.5;
                return Math.min(prev + step, target);
              }
              if (interval) clearInterval(interval);
              return prev;
            });
          }, 50);
        }
        if (summary.processing_status === 'completed') setFakeProgress(100);
        return () => { if (interval) clearInterval(interval); };
      }, [target, summary.processing_status]);

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-4">
          <div className="mb-6">
            <CircularProgressWithLoader progress={fakeProgress} size={64} />
          </div>
          <p className="text-lg font-semibold mt-6 text-[var(--text-primary)]">Processing Video</p>
          <p className="text-[var(--text-secondary)] mt-2">Please wait while we process your summary.</p>
        </div>
      );
    }

    if (isFailed(summary.processing_status)) {
      return (
        <div className="text-center text-[var(--text-primary)] bg-white/5 p-8 rounded-lg">
          <h3 className="text-xl font-bold mb-2">Processing Failed</h3>
          <p className="mb-4">The video processing encountered an error. This could be due to video length, content restrictions, or temporary service issues.</p>
          <p className="mt-4 text-sm font-mono bg-black/20 p-4 rounded-md text-left whitespace-pre-wrap">
            <strong>Error Details:</strong>
            <br />
            {summary.overall_summary || 'No specific error message was provided.'}
          </p>
        </div>
      );
    }
    
    if (isComplete(summary.processing_status)) {
      let cleanOutput = raw_ai_output;
      
      // Add detailed debugging
      console.log('🔍 DEBUG: raw_ai_output type:', typeof raw_ai_output);
      console.log('🔍 DEBUG: raw_ai_output first 100 chars:', raw_ai_output?.substring(0, 100));
      console.log('🔍 DEBUG: starts with quote?', raw_ai_output?.startsWith('"'));
      console.log('🔍 DEBUG: ends with quote?', raw_ai_output?.endsWith('"'));
      
      try {
        if (typeof cleanOutput === 'string') {
          cleanOutput = unescapeString(cleanOutput);
          console.log('🔍 DEBUG: after unescaping first 100 chars:', cleanOutput?.substring(0, 100));
        }
      } catch (e) {
        console.log('🔍 DEBUG: unescaping failed:', e);
        cleanOutput = raw_ai_output;
      }
      
      console.log('🔍 DEBUG: final cleanOutput first 100 chars:', cleanOutput?.substring(0, 100));
      console.log('🔍 DEBUG: cleanOutput truthy?', !!cleanOutput);
      
      if (!cleanOutput) {
        return <div className="text-center text-[var(--text-secondary)]">The summary is in an unknown state.</div>;
      }
      return <ChatGPTMarkdown markdown={cleanOutput} summaryId={String(summaryId)} />;
    }

    // Default case for any other status
    return <div className="text-center text-[var(--text-secondary)]">The summary is in an unknown state.</div>;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <VideoInfoCard
        title={title}
        description={description}
        channelTitle={channel_title}
        viewCount={view_count}
        publishDate={publish_date}
        duration={duration}
        thumbnailUrl={summary.thumbnail_url}
      />
      
      <Separator className="my-8 bg-[var(--border-color)]" />
      
      <div className="mt-8">
        {renderContent()}
      </div>
    </div>
  );
} 
