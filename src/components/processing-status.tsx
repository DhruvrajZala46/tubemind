'use client';

import React from 'react';
import { Progress } from './ui/progress';
import { CheckCircle, Clock, FileText, Wand2, Loader2 } from 'lucide-react';
import { ElegantLoader } from "./ui/elegant-loader";
import { cn } from '../lib/utils';

interface ProcessingStatusProps {
  stage: 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message?: string;
  error?: string;
  onRetry?: () => void;
}

export default function ProcessingStatus({ stage, progress, message, error, onRetry }: ProcessingStatusProps) {
  // Define processing steps
  const steps = [
    { id: 'fetching', label: 'Fetching Video', icon: Clock, description: 'Retrieving video data...', color: '#DC143C' },
    { id: 'transcribing', label: 'Transcribing', icon: FileText, description: 'Converting speech to text...', color: '#E34234' },
    { id: 'analyzing', label: 'Analyzing', icon: Wand2, description: 'Extracting key insights...', color: '#FF6347' },
  ];

  // Calculate current step index
  const currentStepIndex = steps.findIndex(step => step.id === stage);
  
  // Calculate more accurate progress
  const getStepProgress = () => {
    if (stage === 'complete') return 100;
    if (stage === 'error') return progress;
    
    // Each step represents ~33% of total progress
    const baseProgress = currentStepIndex * 33;
    // Current step progress (max 33%)
    const currentProgress = Math.min(33, (progress / 100) * 33);
    
    return Math.min(99, baseProgress + currentProgress);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-xl p-6 shadow-lg border border-white/10 relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#DC143C]/5 to-transparent animate-pulse-slow pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex items-center gap-3">
          {stage !== 'error' && stage !== 'complete' && (
            <ElegantLoader size="sm" />
          )}
          <h3 className="text-lg font-medium text-[#F0F6FC] flex items-center">
            {stage === 'error' ? 'Processing Error' : 
             stage === 'complete' ? 'Processing Complete' : 'Processing Video'}
            {stage !== 'error' && stage !== 'complete' && (
              <span className="ml-2 text-sm font-normal text-[#DC143C] animate-pulse">Live</span>
            )}
          </h3>
        </div>
        {stage === 'error' && onRetry && (
          <button 
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-[#DC143C] hover:bg-[#DC143C]/90 text-white rounded-md transition-colors flex items-center gap-1"
          >
            <Loader2 className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
      
      {/* Progress bar */}
      <div className="mb-8 relative">
        <Progress 
          value={getStepProgress()} 
          className="h-3 mb-3"
        />
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8B949E] font-medium flex items-center gap-2">
            {stage === 'error' ? error || 'An error occurred during processing' : 
             message || `${Math.round(getStepProgress())}% complete`}
          </p>
          <span className="text-xs font-mono text-[#DC143C]/80">
            {stage !== 'complete' && stage !== 'error' && `Stage ${currentStepIndex + 1}/3`}
          </span>
        </div>
      </div>
      
      {/* Processing steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = step.id === stage;
          const isCompleted = 
            stage === 'complete' || 
            currentStepIndex > index || 
            (currentStepIndex === index && progress === 100);
          
          return (
            <div 
              key={step.id} 
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg transition-all duration-300",
                isActive && !isCompleted && "bg-[#21262D] shadow-lg border border-[#30363D]/50",
                isCompleted && "text-[#58A6FF] bg-[#121620]",
                !isActive && !isCompleted && "opacity-60"
              )}
              style={{
                borderLeft: isActive ? `3px solid ${step.color}` : undefined
              }}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : isActive ? (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <ElegantLoader size="sm" color={step.color} />
                  </div>
                ) : (
                  <div className="w-5 h-5 flex items-center justify-center opacity-40">
                    <step.icon className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <p className={cn(
                  "text-sm font-medium",
                  !isActive && !isCompleted && "text-[#8B949E]"
                )}>
                  {step.label}
                </p>
                {isActive && !isCompleted && (
                  <p className="text-xs text-[#8B949E] mt-1">{step.description}</p>
                )}
              </div>
              {isActive && !isCompleted && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-16 h-1 bg-[#21262D] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#DC143C]/60 to-[#DC143C] animate-progress-indeterminate"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {/* Complete step */}
        {stage === 'complete' && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-[#0D1117]/60 border border-[#30363D] shadow-lg transform transition-all duration-500">
            <div className="flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-[#32D74B]" />
            </div>
            <div>
              <p className="text-sm font-medium">Complete</p>
              <p className="text-xs text-[#8B949E] mt-1">Your summary is ready!</p>
            </div>
            <div className="ml-auto">
              <div className="px-2 py-1 bg-[#32D74B]/10 text-[#32D74B] text-xs rounded-md">
                100%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
