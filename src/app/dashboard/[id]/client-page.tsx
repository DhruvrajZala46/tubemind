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

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        setData(data);
        setIsLoading(false);
        
        // If still processing, continue polling
        if (data.processing_status !== 'completed' && data.processing_status !== 'failed') {
          setTimeout(pollStatus, 2000); // Poll every 2 seconds
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    };

    pollStatus();
    
    return () => {
      // Cleanup if needed
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