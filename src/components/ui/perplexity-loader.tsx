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
  baseProgress: number; // Base progress for each stage
}> = [
  {
    id: 'pending',
    label: 'Preparing',
    description: 'Getting everything ready...',
    baseProgress: 0
  },
  {
    id: 'transcribing',
    label: 'Transcribing',
    description: 'Converting video to text...',
    baseProgress: 20
  },
  {
    id: 'summarizing',
    label: 'Summarizing', 
    description: 'Analyzing content and generating insights...',
    baseProgress: 60
  },
  {
    id: 'finalizing',
    label: 'Finalizing',
    description: 'Polishing and organizing results...',
    baseProgress: 90
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your summary is ready!',
    baseProgress: 100
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
  const [smoothProgress, setSmoothProgress] = useState(0);

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

  // Improved progress calculation with smooth transitions
  useEffect(() => {
    const stageInfo = STAGES.find(stage => stage.id === currentStage);
    if (!stageInfo) {
      setOverallProgress(0);
      return;
    }
    
    let calculatedProgress = stageInfo.baseProgress;
    
    // If we have backend progress, use it within the stage bounds
    if (progress > 0) {
      // For pending stage, use backend progress directly (up to 20%)
      if (currentStage === 'pending') {
        calculatedProgress = Math.min(20, progress);
      }
      // For other stages, interpolate within their range
      else if (currentStage !== 'completed') {
        const nextStage = STAGES[STAGES.findIndex(s => s.id === currentStage) + 1];
        if (nextStage) {
          const stageRange = nextStage.baseProgress - stageInfo.baseProgress;
          const stageProgress = (progress / 100) * stageRange;
          calculatedProgress = stageInfo.baseProgress + stageProgress;
        }
      }
    }
    
    // For completed stage, always 100%
    if (currentStage === 'completed') {
      calculatedProgress = 100;
    }
    
    // Ensure progress never goes backwards
    setOverallProgress(prev => Math.max(prev, calculatedProgress));
    
    // Trigger onComplete callback when done
    if (currentStage === 'completed' && onComplete) {
      onComplete();
    }
  }, [currentStage, progress, onComplete]);

  // Smooth progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothProgress(prev => {
        const diff = overallProgress - prev;
        if (Math.abs(diff) < 0.1) return overallProgress;
        return prev + diff * 0.1; // Smooth animation
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [overallProgress]);

  // Get current stage info
  const currentStageInfo = STAGES.find(stage => stage.id === currentStage) || STAGES[0];
  const currentStageIndex = STAGES.findIndex(stage => stage.id === currentStage);

  // Handle failed state
  if (currentStage === 'failed') {
    return (
      <div className={cn(
        "w-full max-w-4xl mx-auto rounded-xl p-4 sm:p-6 bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-red-500/20",
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
      "w-full max-w-4xl mx-auto rounded-xl p-4 sm:p-6 bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-white/10",
      // Mobile-first responsive design
      "min-h-[300px] sm:min-h-[350px]",
      // Ensure proper viewport fit on mobile
      "mx-4 sm:mx-auto",
      className
    )}>
      {/* Overall progress bar */}
      {showProgress && (
        <div className="mb-6">
          <Progress value={smoothProgress} className="h-2 sm:h-3" />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {Math.round(smoothProgress)}% complete
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {Math.max(1, currentStageIndex + 1)}/{STAGES.length - 1}
            </p>
          </div>
        </div>
      )}

      {/* Processing steps */}
      <div className="space-y-3 sm:space-y-4">
        {STAGES.filter(stage => stage.id !== 'completed' && stage.id !== 'pending').map((stage, index) => {
          const isActive = stage.id === currentStage;
          const isCompleted = currentStageIndex > index + 1; // +1 to account for pending
          const isPending = currentStageIndex < index + 1;
          
          return (
            <div 
              key={stage.id}
              className={cn(
                "flex items-start gap-3 py-3 px-3 sm:px-4 rounded-lg transition-all duration-500 border",
                // Mobile responsive padding and spacing
                "text-sm sm:text-base",
                isActive ? "bg-black/10 dark:bg-white/10 border-[#DC143C]/40 shadow-lg" : 
                isCompleted ? "bg-black/5 dark:bg-white/5 border-transparent" : 
                "opacity-50 border-transparent"
              )}
              style={{
                borderLeftColor: isActive ? accentColor : 'transparent',
                borderLeftWidth: isActive ? '3px' : '1px'
              }}
            >
              {/* Status icon */}
              <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[#DC143C]" />
                ) : isActive ? (
                  <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
                    <ElegantLoader size="sm" color={accentColor} />
                  </div>
                ) : (
                  <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "font-medium text-sm sm:text-base",
                  isActive ? "text-[#DC143C]" : 
                  isCompleted ? "text-gray-700 dark:text-gray-300" : 
                  "text-gray-500 dark:text-gray-500"
                )}>
                  {stage.label}
                  {isActive && showAnimatedText && (
                    <span className="inline-block w-4 text-[#DC143C]">{animatedDots}</span>
                  )}
                </h3>
                
                {/* Always show description for better UX */}
                <p className={cn(
                  "text-xs sm:text-sm mt-1",
                  isActive ? "text-gray-600 dark:text-gray-300" : 
                  isCompleted ? "text-gray-500 dark:text-gray-400" :
                  "text-gray-400 dark:text-gray-500"
                )}>
                  {stage.description}
                </p>
                
                {/* Stage-specific progress for active stage */}
                {isActive && showProgress && (
                  <div className="mt-2 w-full">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-[#DC143C] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Pending state display */}
      {currentStage === 'pending' && (
        <div className="flex items-center justify-center gap-3 mt-6 py-4 px-4 rounded-lg bg-black/5 dark:bg-white/5 border border-white/10">
          <ElegantLoader size="sm" color={accentColor} />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Preparing your video{animatedDots}
          </p>
        </div>
      )}
      
      {/* Completed state */}
      {currentStage === 'completed' && (
        <div className="flex items-center justify-center gap-3 mt-6 py-4 px-4 rounded-lg bg-[#DC143C]/10 border border-[#DC143C]/20">
          <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[#DC143C]" />
          <p className="text-sm sm:text-base font-medium text-[#DC143C]">
            Your summary is ready!
          </p>
        </div>
      )}
    </div>
  );
} 