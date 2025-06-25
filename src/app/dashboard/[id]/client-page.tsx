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
  // Direct mapping for known statuses
  if (status === 'transcribing' || status === 'extracting') return 'transcribing';
  if (status === 'summarizing' || status === 'analyzing') return 'summarizing';
  if (status === 'finalizing') return 'finalizing';
  if (status === 'completed' || status === 'complete') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  
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
    return <div className="text-red-500">Error loading status: {error.message}</div>;
  }

  if (!isLoading && (!data || data.processing_status === 'completed')) {
    return null;
  }

  return (
    <div className="mt-8 mb-12">
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

// Main client component
export default function VideoSummaryClientPage({ summary, pollingId, summaryId }: VideoSummaryClientPageProps) {
  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      <div className="container mx-auto px-4 py-8">
        <VideoSummary summary={summary} videoId={pollingId} summaryId={summaryId} />
        <ProcessingStatusPoller summaryId={summaryId} />
      </div>
    </main>
  );
} 