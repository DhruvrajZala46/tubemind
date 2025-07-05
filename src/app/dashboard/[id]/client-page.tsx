'use client';

import { useState, useEffect } from 'react';
import VideoSummary from '../../../components/Dashboard/VideoSummary';
import { PerplexityLoader, ProcessingStage } from '@/components/ui/perplexity-loader';

interface VideoSummaryClientPageProps {
  summary: any;
  pollingId: string;
  summaryId: string;
}

// Function to map API status to component status
function mapApiStatusToProcessingStage(status: string): ProcessingStage {
  // Normalize status to lowercase for consistent mapping
  const normalizedStatus = status?.toLowerCase() || '';
  
  // Direct mapping for known statuses
  if (normalizedStatus.includes('transcrib') || normalizedStatus.includes('extract')) return 'transcribing';
  if (normalizedStatus.includes('summari') || normalizedStatus.includes('analyz')) return 'summarizing';
  if (normalizedStatus.includes('finaliz') || normalizedStatus.includes('polish')) return 'finalizing';
  if (normalizedStatus.includes('complet') || normalizedStatus.includes('finish')) return 'completed';
  if (normalizedStatus.includes('fail') || normalizedStatus.includes('error')) return 'failed';
  if (normalizedStatus.includes('queue') || normalizedStatus.includes('pending')) return 'pending';
  
  // Default to transcribing if we have any processing status
  if (normalizedStatus.includes('process')) return 'transcribing';
  
  // Default to pending for any other status
  return 'pending';
}

// Client component for status polling
function ProcessingStatusPoller({ summaryId }: { summaryId: string }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pollStart, setPollStart] = useState<number | null>(null);
  const [errorSince, setErrorSince] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isFatalError, setIsFatalError] = useState(false);

  useEffect(() => {
    if (!summaryId) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true; // Track if component is still mounted
    if (!pollStart) setPollStart(Date.now());

    const pollStatus = async () => {
      if (!isMounted) return;
      try {
        const controller = new AbortController();
        const fetchTimeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`/api/summaries/${summaryId}/status`, {
          signal: controller.signal
        });
        
        clearTimeout(fetchTimeoutId);
        
        if (!response.ok) {
          // Server returned an error status
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted) {
          setData(data);
          setIsLoading(false);
          setError(null);
          setErrorSince(null);
          setRetryCount(0);
          setIsFatalError(false);
          
          // If processing is not complete, continue polling
          if (data.processing_status !== 'completed' && data.processing_status !== 'failed') {
            timeoutId = setTimeout(pollStatus, 2000);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        
        // Determine if this is a network abort or a real error
        const isAbort = err instanceof Error && 
          (err.name === 'AbortError' || err.message.includes('aborted'));
        
        // Only consider it a fatal error if:
        // 1. It's not an abort error AND
        // 2. We've had consistent errors for over 3 minutes
        const now = Date.now();
        const isConsistentError = errorSince && (now - errorSince > 3 * 60 * 1000);
        
        if (!isAbort && isConsistentError) {
          setIsFatalError(true);
        }
        
        setIsLoading(false);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        if (!errorSince) setErrorSince(now);
        
        // Exponential backoff for retries
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        
        // Calculate backoff time: 1s, 2s, 4s, 8s, max 10s
        const backoffTime = Math.min(1000 * Math.pow(2, nextRetryCount - 1), 10000);
        
        // Keep polling unless we've determined it's a fatal error
        if (!isFatalError && pollStart && now - pollStart < 5 * 60 * 1000) {
          timeoutId = setTimeout(pollStatus, backoffTime);
        }
      }
    };
    
    pollStatus();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [summaryId, isFatalError]);

  // If error but not fatal, show 'Still processing...'
  if (error && !isFatalError) {
    return (
      <div className="mt-6 sm:mt-8 mb-8 sm:mb-12 px-2 sm:px-0 text-center text-[var(--text-primary)]">
        <PerplexityLoader currentStage={data?.processing_stage ? mapApiStatusToProcessingStage(data.processing_stage) : 'pending'} progress={data?.processing_progress || 0} showProgress={true} showAnimatedText={true} />
        <div className="mt-2 text-sm text-gray-400">Still processing, please wait...</div>
      </div>
    );
  }

  // If fatal error, show real error
  if (isFatalError) {
    return <div className="text-[var(--text-primary)]">Processing failed. Please try again.</div>;
  }

  // Show loader while loading or while processing (not completed/failed)
  if (isLoading || (data && data.processing_status !== 'completed' && data.processing_status !== 'failed')) {
    return (
      <div className="mt-6 sm:mt-8 mb-8 sm:mb-12 px-2 sm:px-0">
        <PerplexityLoader 
          currentStage={data?.processing_stage ? 
            mapApiStatusToProcessingStage(data.processing_stage) : 
            'pending'
          }
          progress={data?.processing_progress || 0}
          showProgress={true}
          showAnimatedText={true}
        />
      </div>
    );
  }

  // Hide loader when completed or failed
  return null;
}

// Main client component
export default function VideoSummaryClientPage({ summary, pollingId, summaryId }: VideoSummaryClientPageProps) {
  return (
    <main className="min-h-screen bg-[var(--bg-dashboard)] text-[var(--text-primary)] w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-6xl">
        <VideoSummary summary={summary} videoId={pollingId} summaryId={summaryId} />
        <ProcessingStatusPoller summaryId={summaryId} />
      </div>
    </main>
  );
} 