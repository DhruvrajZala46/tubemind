'use client';

import { useState, useEffect } from 'react';
import VideoSummary from '../../../components/Dashboard/VideoSummary';
import { PerplexityLoader, ProcessingStage } from '@/components/ui/perplexity-loader';

interface VideoSummaryClientPageProps {
  initialSummary: any; // Can be null if processing is not complete
  videoId: string;
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
function ProcessingStatusPoller({ 
    summaryId, 
    onUpdate,
    onComplete,
}: { 
    summaryId: string;
    onUpdate: (data: any) => void;
    onComplete: (data: any) => void;
}) {
  const [isFatalError, setIsFatalError] = useState(false);

  useEffect(() => {
    if (!summaryId || isFatalError) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pollStatus = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        if (!response.ok) {
            // Handle non-OK responses, maybe retry a few times
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted) {
            onUpdate(data);

            if (data.status === 'completed' || data.status === 'failed') {
                onComplete(data);
            } else {
                timeoutId = setTimeout(pollStatus, 3000); // Poll every 3 seconds
         }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Polling error:", err);
          setIsFatalError(true); // Stop polling on error
          onComplete({ status: 'failed', error: 'Failed to get status.' });
        }
      }
    };
    
    pollStatus();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [summaryId, isFatalError, onUpdate, onComplete]);

  return null; // This component does not render anything itself
}

// Main client component
export default function VideoSummaryClientPage({ initialSummary, videoId, summaryId }: VideoSummaryClientPageProps) {
  const [summaryData, setSummaryData] = useState(initialSummary);
  const [processingStatus, setProcessingStatus] = useState(
    initialSummary?.processing_status || 'pending'
  );

  const handlePollUpdate = (data: any) => {
    if (data.status) {
        setProcessingStatus(data.status);
    }
  };

  const handlePollComplete = (data: any) => {
    setProcessingStatus(data.status);
    if (data.status === 'completed') {
        // Instead of setting partial data, refresh the page to get full summary
        window.location.reload();
    }
  };

  const isProcessing = processingStatus !== 'completed' && processingStatus !== 'failed';
  const shouldPoll = isProcessing && summaryId;

  return (
    <main className="min-h-screen bg-[var(--bg-dashboard)] text-[var(--text-primary)] w-full">
        {shouldPoll && (
            <ProcessingStatusPoller 
                summaryId={summaryId}
                onUpdate={handlePollUpdate}
                onComplete={handlePollComplete}
            />
        )}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-6xl">
        {isProcessing ? (
            <div className="mt-6 sm:mt-8 mb-8 sm:mb-12 px-2 sm:px-0">
                <PerplexityLoader 
                  currentStage={mapApiStatusToProcessingStage(processingStatus)}
                  showAnimatedText={true}
                />
            </div>
        ) : processingStatus === 'failed' ? (
            <div className="text-center text-red-500">
                <h2>Processing Failed</h2>
                <p>Something went wrong while processing your video. Please try again.</p>
            </div>
        ) : (
            <VideoSummary summary={summaryData} videoId={videoId} summaryId={summaryId} />
        )}
      </div>
    </main>
  );
} 