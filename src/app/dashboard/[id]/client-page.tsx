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
  const lastPollTimeRef = useRef<number>(Date.now());
  const pollCountRef = useRef<number>(0);
  const simulatedProgressRef = useRef<number>(0);
  const currentStageRef = useRef<ProcessingStage>('pending');
  const lastProgressRef = useRef<number>(0);
  const progressRateRef = useRef<number>(0.2); // Progress points per second

  // Function to simulate continuous progress between polls
  const simulateProgress = () => {
    if (!lastPollTimeRef.current) return;
    
    const now = Date.now();
    const timeSinceLastPoll = (now - lastPollTimeRef.current) / 1000; // in seconds
    const stageRange = getProgressRangeForStage(currentStageRef.current);
    
    // Calculate how much progress to add based on time elapsed and current stage
    let newProgress = lastProgressRef.current;
    
    // Increase progress based on time elapsed and stage-specific rate
    // Slow down as we approach the upper bound of the stage
    const remainingInStage = stageRange.max - newProgress;
    const progressIncrement = Math.min(
      remainingInStage * 0.1, // Don't move more than 10% of remaining progress at once
      timeSinceLastPoll * progressRateRef.current
    );
    
    newProgress += progressIncrement;
    
    // Ensure progress stays within stage bounds
    newProgress = Math.min(newProgress, stageRange.max - 1); // -1 to leave room for actual completion
    
    // Update the simulated progress
    simulatedProgressRef.current = newProgress;
    
    // Send update to parent component
    onUpdate({ 
      status: currentStageRef.current,
      processing_progress: newProgress,
      simulated: true
    });
  };

  useEffect(() => {
    if (!summaryId || isFatalError) return;

    let pollTimeoutId: NodeJS.Timeout | null = null;
    let simulationIntervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Start simulating progress immediately
    simulationIntervalId = setInterval(() => {
      if (isMounted) {
        simulateProgress();
      }
    }, 500); // Update simulation every 500ms for smooth progress

    const pollStatus = async () => {
      if (!isMounted) return;
      
      try {
        lastPollTimeRef.current = Date.now();
        pollCountRef.current += 1;
        
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted) {
          // Update the current stage reference for simulation
          if (data.status) {
            const newStage = mapApiStatusToProcessingStage(data.status);
            
            // If stage changed, adjust progress rate based on new stage
            if (newStage !== currentStageRef.current) {
              currentStageRef.current = newStage;
              
              // Adjust progress rate based on stage
              switch (newStage) {
                case 'transcribing': progressRateRef.current = 3; break; // Faster for transcribing
                case 'summarizing': progressRateRef.current = 2; break; // Medium for summarizing
                case 'finalizing': progressRateRef.current = 5; break; // Faster for finalizing
                default: progressRateRef.current = 2;
              }
            }
          }
          
          // Use the real progress if provided, otherwise keep simulating
          if (typeof data.processing_progress === 'number') {
            lastProgressRef.current = data.processing_progress;
            simulatedProgressRef.current = data.processing_progress;
          }
          
          // Send update to parent with real data
          onUpdate(data);

          if (data.status === 'completed' || data.status === 'failed') {
            onComplete(data);
          } else {
            // Adaptive polling: poll more frequently during active stages
            const pollInterval = 
              currentStageRef.current === 'summarizing' ? 1500 : // Poll faster during summarizing
              currentStageRef.current === 'finalizing' ? 800 : // Poll even faster during finalizing
              2000; // Default poll interval
            
            pollTimeoutId = setTimeout(pollStatus, pollInterval);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Polling error:", err);
          
          // Don't fail immediately, retry a few times
          if (pollCountRef.current < 5) {
            pollTimeoutId = setTimeout(pollStatus, 1000);
          } else {
            setIsFatalError(true);
            onComplete({ status: 'failed', error: 'Failed to get status.' });
          }
        }
      }
    };
    
    // Start polling immediately
    pollStatus();
    
    return () => {
      isMounted = false;
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
      if (simulationIntervalId) clearInterval(simulationIntervalId);
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
  const [progress, setProgress] = useState(initialSummary?.processing_progress || 0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const processingStageRef = useRef<ProcessingStage>('pending');

  const handlePollUpdate = (data: any) => {
    setLastUpdateTime(Date.now());
    
    if (data.status) {
      setProcessingStatus(data.status);
      processingStageRef.current = mapApiStatusToProcessingStage(data.status);
    }
    
    if (typeof data.processing_progress === 'number') {
      // Ensure progress never decreases (unless we're starting a new summary)
      setProgress((prev: number) => Math.max(prev, data.processing_progress));
    }
  };

  const handlePollComplete = async (data: any) => {
    setProcessingStatus(data.status);
    
    if (typeof data.processing_progress === 'number') {
      setProgress(data.processing_progress);
    }
    
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