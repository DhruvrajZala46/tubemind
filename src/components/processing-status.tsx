'use client';

import React from 'react';
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

  return (
    <PerplexityLoader
      className="w-full max-w-4xl mx-auto"
      currentStage={mapStageToPerplexityStage(stage)}
      progress={progress}
      showProgress={true}
      showAnimatedText={true}
      accentColor="#DC143C"
      onComplete={stage === 'complete' ? () => console.log('Processing completed') : undefined}
    />
  );
}
