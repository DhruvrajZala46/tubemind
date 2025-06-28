"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Separator } from '../ui/separator';
import VideoInfoCard from './VideoInfoCard';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import { LoadingState } from '../ui/loading-states';
import { useMainLoading } from '../../lib/main-loading-context.tsx';
import { ElegantLoader } from '../ui/elegant-loader';
import { CircularProgressWithLoader } from '../ui/CircularProgressWithLoader';

// ChatGPT-style markdown renderer with typewriter effect
function ChatGPTMarkdown({ 
  markdown, 
  typewriterSpeed = 0.5, // Super fast typewriter speed
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
          components={{
            h1: ({node, ...props}) => <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 lg:mb-8 mt-4 sm:mt-5 lg:mt-6" {...props} />,
            h2: ({node, ...props}) => (
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4 lg:mb-5 mt-6 sm:mt-8 lg:mt-10 border-b border-[var(--border-color)] pb-2" {...props} />
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
          }}
        >
          {displayed}
        </ReactMarkdown>
      </Suspense>

      <style jsx global>{`
        .chatgpt-markdown {
          font-family: var(--font-sans);
          font-size: 1rem; /* Updated base font size */
          line-height: 1.6;
          color: var(--text-primary);
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0.5rem 0;
          margin: 0 auto;
          width: 100%;
          max-width: 100%;
          overflow-wrap: break-word;
        }
        
        /* Mobile-first responsive text sizing */
        @media (max-width: 767px) {
          .chatgpt-markdown {
            font-size: 16px; /* Better mobile readability */
            line-height: 1.6;
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
            font-size: 1.05rem;
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
          margin-bottom: 1.1em; /* Improved spacing */
          letter-spacing: 0.01em;
        }
        
        /* Desktop paragraph spacing */
        @media (min-width: 768px) {
          .chatgpt-markdown p {
            margin-bottom: 1.1em;
          }
        }
        
        @media (min-width: 1024px) {
          .chatgpt-markdown p {
            margin-bottom: 1.2em;
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
  queued: 10,
  transcribing: 40,
  summarizing: 80,
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

  const isProcessing = (status: string) => ['processing', 'queued', 'transcribing', 'summarizing'].includes(status);
  const isFailed = (status: string) => status === 'failed';
  const isComplete = (status: string) => {
    const result = status === 'completed';
    console.log('🔍 DEBUG: isComplete function - status:', `"${status}"`, 'result:', result, 'status type:', typeof status);
    return result;
  };

  const [displayedProgress, setDisplayedProgress] = useState(statusToProgress[initialSummary.processing_status] || 10);
  const [targetProgress, setTargetProgress] = useState(statusToProgress[initialSummary.processing_status] || 10);
  const progressAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // When backend status changes, update targetProgress
  useEffect(() => {
    setTargetProgress(statusToProgress[initialSummary.processing_status] || 10);
  }, [initialSummary.processing_status]);

  // Animate displayedProgress toward targetProgress
  useEffect(() => {
    if (displayedProgress === targetProgress) return;
    if (progressAnimationRef.current) clearInterval(progressAnimationRef.current);
    // Fast at first, then slow as it approaches target
    progressAnimationRef.current = setInterval(() => {
      setDisplayedProgress(prev => {
        if (prev === targetProgress) {
          if (progressAnimationRef.current) clearInterval(progressAnimationRef.current);
          return prev;
        }
        // Move faster if far, slower if close
        const diff = Math.abs(targetProgress - prev);
        const step = diff > 20 ? 3 : diff > 10 ? 2 : 1;
        if (prev < targetProgress) {
          return Math.min(prev + step, targetProgress);
        } else {
          return Math.max(prev - step, targetProgress);
        }
      });
    }, 30);
    return () => {
      if (progressAnimationRef.current) clearInterval(progressAnimationRef.current);
    };
  }, [targetProgress, displayedProgress]);

  useEffect(() => {
    // Only show the main page loader on the initial load, not on navigation
    if (!previousSummary.current || previousSummary.current.raw_ai_output !== initialSummary.raw_ai_output) {
      if (isProcessing(initialSummary.processing_status)) {
        showMainLoading('Loading summary...');
      } else {
        hideMainLoading();
      }
    }
    
    setSummary(initialSummary);
    setError(null);
    
    // Clear any previous polling interval when the summary changes
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    // If the new summary is processing, start polling
    if (summaryId && isProcessing(initialSummary.processing_status)) {
      const pollStatus = async () => {
        try {
          const response = await fetch(`/api/summaries/${summaryId}/status`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          if (!isProcessing(data.processing_status)) {
            // Stop polling
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
              pollingInterval.current = null;
            }
            // Reload the page to get the final, complete summary data
            // This is the most reliable way to ensure all data is fresh
            window.location.reload(); 
          } else {
            // While processing, just update the status message
            setSummary(prev => ({ ...prev, ...data }));
          }

        } catch (err) {
          console.error('Failed to fetch summary status:', err);
          setError('Could not retrieve status.');
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
        }
      };

      pollStatus(); // Initial check
      pollingInterval.current = setInterval(pollStatus, 3000); // Poll every 3 seconds
    }

    // Update the previous summary ref
    previousSummary.current = initialSummary;

    // Cleanup function
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      hideMainLoading(); // Ensure loader is hidden on unmount
    };
  }, [initialSummary, summaryId, showMainLoading, hideMainLoading]);

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
