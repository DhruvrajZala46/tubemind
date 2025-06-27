// 🟠 PHASE 3.2: PROGRESS TRACKING SYSTEM
// Real-time progress feedback for long operations

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

// 🎯 Progress Stage Definition
export interface ProgressStage {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number; // in seconds
  weight: number; // 0-100, how much of total progress this stage represents
}

// 🎯 Default Processing Stages
export const VIDEO_PROCESSING_STAGES: ProgressStage[] = [
  {
    id: 'validation',
    name: 'Validating Video',
    description: 'Checking video accessibility and extracting metadata',
    estimatedDuration: 3,
    weight: 10
  },
  {
    id: 'transcript',
    name: 'Extracting Transcript',
    description: 'Fetching video transcript using multiple methods',
    estimatedDuration: 8,
    weight: 30
  },
  {
    id: 'ai-analysis',
    name: 'AI Analysis',
    description: 'Generating intelligent insights and summaries',
    estimatedDuration: 15,
    weight: 50
  },
  {
    id: 'saving',
    name: 'Saving Results',
    description: 'Storing your analysis securely',
    estimatedDuration: 2,
    weight: 10
  }
];

// 🎯 Progress State
interface ProgressState {
  currentStage: string;
  currentStageProgress: number; // 0-100
  overallProgress: number; // 0-100
  timeElapsed: number; // in seconds
  timeRemaining: number; // in seconds
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
}

interface ProgressTrackerProps {
  stages: ProgressStage[];
  currentState: ProgressState;
  className?: string;
  showTimeRemaining?: boolean;
  showDetailedSteps?: boolean;
  compact?: boolean;
}

// 🕐 Time Formatter
const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

// 🎯 Progress Bar Component
const ProgressBar: React.FC<{
  progress: number;
  variant?: 'default' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
}> = ({ 
  progress, 
  variant = 'default', 
  size = 'md',
  showPercentage = false 
}) => {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    default: 'from-blue-500 to-purple-600',
    success: 'from-green-500 to-emerald-600',
    error: 'from-red-500 to-orange-600'
  };

  return (
    <div className="w-full">
      <div className={cn(
        "w-full bg-gray-200 rounded-full dark:bg-gray-700 overflow-hidden",
        sizeClasses[size]
      )}>
        <div 
          className={cn(
            "rounded-full transition-all duration-700 ease-out bg-gradient-to-r",
            variantClasses[variant],
            sizeClasses[size]
          )}
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            transition: 'width 0.7s ease-out'
          }}
        />
      </div>
      {showPercentage && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

// 🎯 Stage Indicator Component
const StageIndicator: React.FC<{
  stage: ProgressStage;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
  compact?: boolean;
}> = ({ stage, status, progress = 0, compact = false }) => {
  const getIcon = () => {
    switch (status) {
      case 'completed':
        return <span className="text-green-500 text-sm">✓</span>;
      case 'error':
        return <span className="text-red-500 text-sm">✕</span>;
      case 'active':
        return (
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        );
      default:
        return <div className="w-3 h-3 rounded-full border-2 border-gray-300" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {getIcon()}
        <span className={cn(
          "text-sm",
          status === 'active' && "text-blue-600 font-medium",
          status === 'completed' && "text-green-600",
          status === 'error' && "text-red-600",
          status === 'pending' && "text-gray-500"
        )}>
          {stage.name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3 py-2">
      <div className="flex-shrink-0 mt-1">
        {getIcon()}
      </div>
      <div className="flex-1">
        <h4 className={cn(
          "text-sm font-medium",
          status === 'active' && "text-blue-600 dark:text-blue-400",
          status === 'completed' && "text-green-600 dark:text-green-400",
          status === 'error' && "text-red-600 dark:text-red-400",
          status === 'pending' && "text-gray-500 dark:text-gray-400"
        )}>
          {stage.name}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {stage.description}
        </p>
        
        {status === 'active' && progress > 0 && (
          <div className="mt-2">
            <ProgressBar progress={progress} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
};

// 🎯 Main Progress Tracker Component
export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  stages,
  currentState,
  className,
  showTimeRemaining = true,
  showDetailedSteps = true,
  compact = false
}) => {
  const currentStageIndex = stages.findIndex(s => s.id === currentState.currentStage);
  
  const getStageStatus = (stageIndex: number) => {
    if (currentState.hasError && stageIndex === currentStageIndex) {
      return 'error';
    }
    if (stageIndex < currentStageIndex) {
      return 'completed';
    }
    if (stageIndex === currentStageIndex) {
      return 'active';
    }
    return 'pending';
  };

  const variant = currentState.hasError ? 'error' : 
                 currentState.isComplete ? 'success' : 'default';

  return (
    <div className={cn(
      "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentState.isComplete ? 'Processing Complete!' : 
             currentState.hasError ? 'Processing Error' : 'Processing Video'}
          </h3>
          {showTimeRemaining && !currentState.isComplete && !currentState.hasError && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ~{formatTime(currentState.timeRemaining)} remaining
            </span>
          )}
        </div>
        
        {/* Overall Progress Bar */}
        <ProgressBar 
          progress={currentState.overallProgress} 
          variant={variant}
          size="lg"
          showPercentage={true}
        />
        
        {/* Time Information */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span>Elapsed: {formatTime(currentState.timeElapsed)}</span>
          {currentState.isComplete && (
            <span className="text-green-600">Completed successfully!</span>
          )}
          {currentState.hasError && (
            <span className="text-red-600">Error occurred</span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {currentState.hasError && currentState.errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-red-500 text-sm">⚠️</span>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Processing Failed
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                {currentState.errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Steps */}
      {showDetailedSteps && (
        <div className="space-y-1">
          {stages.map((stage, index) => (
            <StageIndicator
              key={stage.id}
              stage={stage}
              status={getStageStatus(index)}
              progress={index === currentStageIndex ? currentState.currentStageProgress : 0}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Current Stage Info (if not showing detailed steps) */}
      {!showDetailedSteps && !currentState.isComplete && !currentState.hasError && (
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {stages[currentStageIndex]?.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stages[currentStageIndex]?.description}
          </p>
        </div>
      )}
    </div>
  );
};

// 🎯 Compact Progress Tracker (for inline use)
export const CompactProgressTracker: React.FC<{
  currentState: ProgressState;
  className?: string;
}> = ({ currentState, className }) => {
  const variant = currentState.hasError ? 'error' : 
                 currentState.isComplete ? 'success' : 'default';

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300">
          {currentState.isComplete ? 'Complete' : 
           currentState.hasError ? 'Error' : 'Processing...'}
        </span>
        <span className="text-gray-500">
          {Math.round(currentState.overallProgress)}%
        </span>
      </div>
      <ProgressBar 
        progress={currentState.overallProgress} 
        variant={variant}
        size="sm"
      />
      {!currentState.isComplete && !currentState.hasError && (
        <div className="text-xs text-gray-500 text-center">
          ~{formatTime(currentState.timeRemaining)} remaining
        </div>
      )}
    </div>
  );
};

// 🎯 Hook for Managing Progress State
export const useProgressTracker = (stages: ProgressStage[]) => {
  const [progressState, setProgressState] = useState<ProgressState>({
    currentStage: stages[0]?.id || '',
    currentStageProgress: 0,
    overallProgress: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    isComplete: false,
    hasError: false
  });

  const [startTime] = useState(Date.now());

  // Calculate total estimated duration
  const totalEstimatedDuration = stages.reduce((total, stage) => total + stage.estimatedDuration, 0);

  // Update time elapsed
  useEffect(() => {
    if (progressState.isComplete || progressState.hasError) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, totalEstimatedDuration - elapsed);
      
      setProgressState(prev => ({
        ...prev,
        timeElapsed: elapsed,
        timeRemaining: remaining
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [progressState.isComplete, progressState.hasError, startTime, totalEstimatedDuration]);

  const updateStage = (stageId: string, stageProgress: number = 0) => {
    const stageIndex = stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) return;

    // Calculate overall progress
    let overallProgress = 0;
    
    // Add progress from completed stages
    for (let i = 0; i < stageIndex; i++) {
      overallProgress += stages[i].weight;
    }
    
    // Add progress from current stage
    overallProgress += (stages[stageIndex].weight * stageProgress) / 100;

    setProgressState(prev => ({
      ...prev,
      currentStage: stageId,
      currentStageProgress: stageProgress,
      overallProgress: Math.min(100, overallProgress)
    }));
  };

  const completeProcessing = () => {
    setProgressState(prev => ({
      ...prev,
      currentStageProgress: 100,
      overallProgress: 100,
      isComplete: true
    }));
  };

  const setError = (errorMessage: string) => {
    setProgressState(prev => ({
      ...prev,
      hasError: true,
      errorMessage
    }));
  };

  const reset = () => {
    setProgressState({
      currentStage: stages[0]?.id || '',
      currentStageProgress: 0,
      overallProgress: 0,
      timeElapsed: 0,
      timeRemaining: totalEstimatedDuration,
      isComplete: false,
      hasError: false
    });
  };

  return {
    progressState,
    updateStage,
    completeProcessing,
    setError,
    reset
  };
}; 
