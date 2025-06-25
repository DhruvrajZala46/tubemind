'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { ElegantLoader } from './elegant-loader';
import { Progress } from './progress';
import { CheckCircle, Loader2 } from 'lucide-react';

export type ProcessingStage = 
  | 'pending'
  | 'transcribing' 
  | 'summarizing'
  | 'finalizing'
  | 'completed'
  | 'failed';

interface PerplexityLoaderProps {
  className?: string;
  currentStage: ProcessingStage;
  progress?: number;
  showProgress?: boolean;
  showAnimatedText?: boolean;
  accentColor?: string;
  onComplete?: () => void;
}

const STAGES: Array<{
  id: ProcessingStage;
  label: string;
  description: string;
}> = [
  {
    id: 'pending',
    label: 'Preparing',
    description: 'Getting everything ready...'
  },
  {
    id: 'transcribing',
    label: 'Transcribing',
    description: 'Converting video to text...'
  },
  {
    id: 'summarizing',
    label: 'Summarizing',
    description: 'Analyzing content and generating insights...'
  },
  {
    id: 'finalizing',
    label: 'Finalizing',
    description: 'Polishing and organizing results...'
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your summary is ready!'
  }
];

export function PerplexityLoader({
  className,
  currentStage,
  progress = 0,
  showProgress = true,
  showAnimatedText = true,
  accentColor = '#DC143C',
  onComplete
}: PerplexityLoaderProps) {
  const [animatedDots, setAnimatedDots] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);

  // Animated dots effect (...)
  useEffect(() => {
    if (!showAnimatedText || currentStage === 'completed' || currentStage === 'failed') return;
    
    const interval = setInterval(() => {
      setAnimatedDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [showAnimatedText, currentStage]);

  // Calculate overall progress based on current stage
  useEffect(() => {
    const stageIndex = STAGES.findIndex(stage => stage.id === currentStage);
    if (stageIndex === -1) {
      setOverallProgress(0);
      return;
    }
    
    // Each stage represents a portion of the overall progress
    const baseProgress = (stageIndex / (STAGES.length - 1)) * 100;
    
    // Current stage progress (weighted by stage position)
    const stageProgress = (progress / 100) * (100 / (STAGES.length - 1));
    
    // Calculate total progress, capped at 99% until completed
    const totalProgress = currentStage === 'completed' 
      ? 100 
      : Math.min(99, baseProgress + stageProgress);
    
    setOverallProgress(totalProgress);
    
    // Trigger onComplete callback when done
    if (currentStage === 'completed' && onComplete) {
      onComplete();
    }
  }, [currentStage, progress, onComplete]);

  // Get current stage info
  const currentStageInfo = STAGES.find(stage => stage.id === currentStage) || STAGES[0];
  const currentStageIndex = STAGES.findIndex(stage => stage.id === currentStage);

  // Handle pending or failed states
  if (currentStage === 'pending') {
    return (
      <div className={cn(
        "w-full max-w-3xl mx-auto rounded-xl p-6 bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-white/10",
        className
      )}>
        <div className="flex flex-col items-center justify-center gap-3">
          <ElegantLoader size="sm" color={accentColor} />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Preparing your video{animatedDots}
          </p>
          {showProgress && (
            <div className="w-full mt-4">
              <Progress value={10} className="h-1" />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  10% complete
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  1/5
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentStage === 'failed') {
    return (
      <div className={cn(
        "w-full max-w-3xl mx-auto rounded-xl p-6 bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-red-500/20",
        className
      )}>
        <div className="flex items-center justify-center gap-3 text-red-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">
            Processing failed. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full max-w-3xl mx-auto rounded-xl p-6 bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-white/10",
      className
    )}>
      {/* Overall progress bar */}
      {showProgress && (
        <div className="mb-6">
          <Progress value={overallProgress} className="h-1" />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(overallProgress)}% complete
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentStageIndex + 1}/{STAGES.length - 1}
            </p>
          </div>
        </div>
      )}

      {/* Processing steps */}
      <div className="space-y-4">
        {STAGES.filter(stage => stage.id !== 'completed' && stage.id !== 'pending').map((stage, index) => {
          const isActive = stage.id === currentStage;
          const isCompleted = STAGES.findIndex(s => s.id === currentStage) > index + 1; // +1 to account for pending
          
          return (
            <div 
              key={stage.id}
              className={cn(
                "flex items-start gap-3 py-3 px-4 rounded-lg transition-all duration-300 border",
                isActive ? "bg-black/5 dark:bg-white/5 border-[#DC143C]/30" : 
                isCompleted ? "border-transparent" : "opacity-40 border-transparent"
              )}
              style={{
                borderLeftColor: isActive ? accentColor : 'transparent',
                borderLeftWidth: isActive ? '2px' : '1px'
              }}
            >
              {/* Status icon */}
              <div className="mt-0.5">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-[#DC143C]" />
                ) : isActive ? (
                  <div className="h-5 w-5 flex items-center justify-center">
                    <ElegantLoader size="sm" color={accentColor} />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className={cn(
                  "text-sm font-medium",
                  isActive ? "text-[#DC143C]" : 
                  isCompleted ? "text-gray-700 dark:text-gray-300" : 
                  "text-gray-500 dark:text-gray-500"
                )}>
                  {stage.label}
                  {isActive && showAnimatedText && <span className="inline-block w-6">{animatedDots}</span>}
                </h3>
                
                {isActive && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Completed state */}
      {currentStage === 'completed' && (
        <div className="flex items-center justify-center gap-3 mt-6 py-3 px-4 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/20">
          <CheckCircle className="h-5 w-5 text-[#DC143C]" />
          <p className="text-sm font-medium text-[#DC143C]">
            Your summary is ready!
          </p>
        </div>
      )}
    </div>
  );
} 