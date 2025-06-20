"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Separator } from '../ui/separator';
import VideoInfoCard from './VideoInfoCard';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import { LoadingState } from '../ui/loading-states';
import { useMainLoading } from '../../lib/main-loading-context.tsx';
import { ElegantLoader } from '../ui/elegant-loader';

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
      const viewedSummaries = JSON.parse(localStorage.getItem('tubegpt_viewed_summaries') || '[]');
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
          const viewedSummaries = JSON.parse(localStorage.getItem('tubegpt_viewed_summaries') || '[]');
          if (!viewedSummaries.includes(summaryId)) {
            viewedSummaries.push(summaryId);
            localStorage.setItem('tubegpt_viewed_summaries', JSON.stringify(viewedSummaries));
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
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4 lg:mb-5 mt-6 sm:mt-8 lg:mt-10 border-b border-gray-700 pb-2" {...props} />
            ),
            h3: ({node, ...props}) => <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-2 mt-4 sm:mt-5 lg:mt-6" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 my-4" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-2 my-4" {...props} />,
            li: ({node, ...props}) => <li className="leading-relaxed my-1 pl-2" {...props} />,
            p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
            em: ({node, ...props}) => <em className="italic text-gray-400" {...props} />,
            code: ({node, ...props}) => <code className="bg-[#23272F] px-1 py-0.5 rounded" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 text-gray-300 bg-opacity-10 bg-blue-900 rounded-r" {...props} />,
            hr: ({node, ...props}) => <hr className="my-6 border-t border-gray-700" {...props} />,
          }}
        >
          {displayed}
        </ReactMarkdown>
      </Suspense>

      <style jsx global>{`
        .chatgpt-markdown {
          font-family: var(--font-sans);
          font-size: 0.875rem; /* Mobile-first smaller text */
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
          font-size: 1.5rem; /* Mobile-first smaller heading */
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        
        .chatgpt-markdown h2 {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 0.5rem;
          letter-spacing: -0.01em;
          font-size: 1.25rem; /* Mobile-first smaller heading */
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
          margin-bottom: 1em; /* Tighter spacing on mobile */
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
          color: #ffffff;
          font-weight: 600;
        }
        
        .chatgpt-markdown em {
          color: #8B949E;
          font-style: italic;
        }
        
        .chatgpt-markdown a {
          color: var(--chatgpt-link);
          text-decoration: none;
        }
        
        .chatgpt-markdown a:hover {
          text-decoration: underline;
        }
        
        .chatgpt-markdown pre {
          background: #23272F;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        .chatgpt-markdown blockquote {
          border-left-color: #2A8AF6;
          background-color: rgba(42, 138, 246, 0.1);
          padding: 0.75rem 1rem;
          border-radius: 0 0.375rem 0.375rem 0;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

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
  summaryId?: number;
}

export default function VideoSummary({ summary: initialSummary, videoId, summaryId }: VideoSummaryProps) {
  const { showMainLoading, hideMainLoading } = useMainLoading();
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Keep track of the previous summary to avoid flicker
  const previousSummary = useRef(initialSummary);

  const isProcessing = (status: string) => ['processing', 'queued', 'transcribing', 'summarizing'].includes(status);
  const isFailed = (status: string) => status === 'failed';
  const isComplete = (status: string) => status === 'complete';

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
    if (isProcessing(summary.processing_status)) {
      let message = "Your summary is being generated...";
      if (summary.processing_status === 'transcribing') {
        message = "Step 1/2: Transcribing audio from video...";
      } else if (summary.processing_status === 'summarizing') {
        message = "Step 2/2: Generating insights with AI...";
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-4">
           <ElegantLoader size="lg" />
           <p className="text-lg font-semibold mt-6 text-white">Processing Video</p>
           <p className="text-gray-400 mt-2">{message}</p>
         </div>
      );
    }

    if (isFailed(summary.processing_status)) {
      return (
        <div className="text-center text-red-400 bg-red-900/20 p-8 rounded-lg">
          <h3 className="text-xl font-bold mb-2">Processing Failed</h3>
          <p className="mb-4">The video processing encountered an error. This could be due to video length, content restrictions, or temporary service issues.</p>
          <p className="mt-4 text-sm font-mono bg-red-900/30 p-4 rounded-md text-left whitespace-pre-wrap">
            <strong>Error Details:</strong>
            <br />
            {summary.overall_summary || 'No specific error message was provided.'}
          </p>
        </div>
      );
    }
    
    if (isComplete(summary.processing_status)) {
      if (!raw_ai_output) {
        return <div className="text-center text-gray-400">The summary is in an unknown state.</div>;
      }
      return <ChatGPTMarkdown markdown={raw_ai_output || ''} summaryId={String(summaryId)} />;
    }

    // Default case for any other status
    return <div className="text-center text-gray-400">The summary is in an unknown state.</div>;
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
      
      <Separator className="my-8 bg-gray-700" />
      
      <div className="mt-8">
        {renderContent()}
      </div>
    </div>
  );
} 