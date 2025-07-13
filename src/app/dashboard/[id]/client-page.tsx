'use client';

import { useState, useEffect, useRef } from 'react';
import VideoSummary from '../../../components/Dashboard/VideoSummary';
import { PremiumLoader, ProcessingStage } from '@/components/ui/premium-loader';

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

// Get estimated progress range for a stage
function getProgressRangeForStage(stage: ProcessingStage): { min: number; max: number } {
  switch (stage) {
    case 'pending': return { min: 0, max: 15 };
    case 'transcribing': return { min: 15, max: 45 };
    case 'summarizing': return { min: 45, max: 80 };
    case 'finalizing': return { min: 80, max: 95 };
    case 'completed': return { min: 100, max: 100 };
    case 'failed': return { min: 0, max: 0 };
    default: return { min: 0, max: 100 };
  }
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
  const pollerState = useRef({
    isMounted: true,
    pollCount: 0,
    currentStage: 'pending' as ProcessingStage,
    lastRealProgress: 0,
    simulatedProgress: 0,
    pollTimeoutId: null as NodeJS.Timeout | null,
    simulationIntervalId: null as NodeJS.Timeout | null,
  });

  useEffect(() => {
    const state = pollerState.current;

    const simulateProgress = () => {
      const stageRange = getProgressRangeForStage(state.currentStage);
      // Increment a small amount each interval
      // The rate can be dynamic based on stage
      let increment = 0.25; // default increment
      if(state.currentStage === 'summarizing') increment = 0.15; // Slower for summarizing
      if(state.currentStage === 'finalizing') increment = 0.5; // Faster for finalizing

      let newProgress = state.simulatedProgress + increment;

      // Don't let simulation go beyond the current stage's max
      newProgress = Math.min(newProgress, stageRange.max - 0.5);
      
      if (newProgress > state.simulatedProgress) {
        state.simulatedProgress = newProgress;
        onUpdate({
          status: state.currentStage,
          processing_progress: state.simulatedProgress,
          simulated: true,
        });
      }
    };

    const pollStatus = async () => {
      if (!state.isMounted) return;

      try {
        state.pollCount++;
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        
        if (state.isMounted) {
          const newStage = mapApiStatusToProcessingStage(data.status);
          if (newStage !== state.currentStage) {
            state.currentStage = newStage;
          }

          if (typeof data.processing_progress === 'number') {
            state.lastRealProgress = data.processing_progress;
            // Ensure simulated progress doesn't fall behind real progress
            state.simulatedProgress = Math.max(state.simulatedProgress, state.lastRealProgress);
          }
          
          onUpdate(data);

          if (data.status === 'completed' || data.status === 'failed') {
            onComplete(data);
          } else {
            const pollInterval = state.currentStage === 'summarizing' ? 2000 : 1500;
            state.pollTimeoutId = setTimeout(pollStatus, pollInterval);
          }
        }
      } catch (err) {
        if (state.isMounted) {
          console.error("Polling error:", err);
          if (state.pollCount < 5) {
            state.pollTimeoutId = setTimeout(pollStatus, 3000);
          } else {
            setIsFatalError(true);
            onComplete({ status: 'failed', error: 'Failed to get status.' });
          }
        }
      }
    };

    // Start polling and simulation
    pollStatus();
    state.simulationIntervalId = setInterval(simulateProgress, 400);

    return () => {
      state.isMounted = false;
      if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);
      if (state.simulationIntervalId) clearInterval(state.simulationIntervalId);
    };
  }, [summaryId, isFatalError, onUpdate, onComplete]);

  return null;
}

// Main client component
export default function VideoSummaryClientPage({ initialSummary, videoId, summaryId }: VideoSummaryClientPageProps) {
  const [summaryData, setSummaryData] = useState(initialSummary);
  const [processingStatus, setProcessingStatus] = useState(
    initialSummary?.processing_status || 'pending'
  );
  const [progress, setProgress] = useState(initialSummary?.processing_progress || 0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const processingStageRef = useRef<ProcessingStage>('pending');

  const handlePollUpdate = (data: any) => {
    if (data.status) {
      setProcessingStatus(data.status);
      processingStageRef.current = mapApiStatusToProcessingStage(data.status);
    }
    
    if (typeof data.processing_progress === 'number') {
      // Ensure progress never decreases
      setProgress((prev: number) => Math.max(prev, data.processing_progress));
    }
  };

  const handlePollComplete = async (data: any) => {
    setProcessingStatus(data.status);
    
    if (data.status === 'completed') {
      // Ensure progress shows 100% when completed
      setProgress(100);
      
      setIsLoadingSummary(true);
      // Fetch the latest summary data from the API
      try {
        const response = await fetch(`/api/summaries/${summaryId}`);
        if (response.ok) {
          const summary = await response.json();
          setSummaryData(summary);
        }
      } catch (err) {
        console.error('Failed to fetch completed summary:', err);
      } finally {
        setIsLoadingSummary(false);
      }
    } else if (typeof data.processing_progress === 'number') {
      setProgress(data.processing_progress);
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
            <PremiumLoader 
              currentStage={mapApiStatusToProcessingStage(processingStatus)}
              progress={progress}
              showProgress={true}
              showAnimatedText={true}
            />
          </div>
        ) : processingStatus === 'failed' ? (
          <div className="text-center text-red-500">
            <h2>Processing Failed</h2>
            <p>Something went wrong while processing your video. Please try again.</p>
          </div>
        ) : isLoadingSummary ? (
          <div className="text-center text-lg text-[var(--text-secondary)]">Loading summary...</div>
        ) : (
          <VideoSummary summary={summaryData} videoId={videoId} summaryId={summaryId} />
        )}
      </div>
    </main>
  );
} 