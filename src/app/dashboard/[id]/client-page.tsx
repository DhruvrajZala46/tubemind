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

  useEffect(() => {
    if (!summaryId) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true; // Track if component is still mounted

    const pollStatus = async () => {
      // Don't poll if component has been unmounted
      if (!isMounted) {
        console.log('🛑 ProcessingStatusPoller: Component unmounted, stopping poll');
        return;
      }

      try {
        console.log('🔄 ProcessingStatusPoller: Polling status for summaryId:', summaryId);
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        
        // Only update state if component is still mounted
        if (isMounted) {
          setData(data);
          setIsLoading(false);
          
          // CRITICAL: Only continue polling if still processing AND component is mounted
          if (data.processing_status !== 'completed' && data.processing_status !== 'failed') {
            console.log('🔄 ProcessingStatusPoller: Scheduling next poll in 2s, status:', data.processing_status);
            timeoutId = setTimeout(pollStatus, 2000);
          } else {
            console.log('✅ ProcessingStatusPoller: Processing complete, stopping polls. Status:', data.processing_status);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ ProcessingStatusPoller: Error polling status:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsLoading(false);
        }
      }
    };

    // Start initial poll
    pollStatus();
    
    // CRITICAL: Cleanup function
    return () => {
      console.log('🧹 ProcessingStatusPoller: Cleaning up - clearing timeout and marking unmounted');
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [summaryId]);

  if (error) {
    return <div className="text-[var(--text-primary)]">Error loading status: {error.message}</div>;
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