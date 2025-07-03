'use client';

import React, { useEffect, useRef } from 'react';
import { PerplexityLoader, ProcessingStage } from './ui/perplexity-loader';

interface ProcessingStatusProps {
  stage: 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message?: string;
  error?: string;
  onRetry?: () => void;
}

export default function ProcessingStatus({ stage, progress, message, error, onRetry }: ProcessingStatusProps) {
  // Map our existing stages to the new PerplexityLoader stages
  const mapStageToPerplexityStage = (stage: string): ProcessingStage => {
    switch (stage) {
      case 'fetching': return 'pending';
      case 'transcribing': return 'transcribing';
      case 'analyzing': return 'summarizing';
      case 'complete': return 'completed';
      case 'error': return 'failed';
      default: return 'pending';
    }
  };
  
  // Track previous progress to prevent flickering
  const prevProgressRef = useRef(progress);
  
  // Ensure progress never goes backwards for smoother UX
  useEffect(() => {
    if (progress < prevProgressRef.current && stage !== 'error' && stage !== 'complete') {
      console.log('Preventing progress regression:', progress, 'previous:', prevProgressRef.current);
      // Don't update prevProgressRef in this case
    } else {
      prevProgressRef.current = progress;
    }
  }, [progress, stage]);

  // Use the higher value between current and previous progress
  const displayProgress = Math.max(progress, prevProgressRef.current);

  return (
    <PerplexityLoader
      className="w-full max-w-4xl mx-auto"
      currentStage={mapStageToPerplexityStage(stage)}
      progress={displayProgress}
      showProgress={true}
      showAnimatedText={true}
      accentColor="#DC143C"
      fastAnimation={true} // OPTIMIZED: Enable faster animations
      onComplete={stage === 'complete' ? () => console.log('Processing completed') : undefined}
    />
  );
}
