'use client';

import React, { useEffect, useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle } from 'lucide-react';

export type ProcessingStage = 
  | 'pending'
  | 'transcribing' 
  | 'summarizing'
  | 'finalizing'
  | 'completed'
  | 'failed';

interface PremiumLoaderProps {
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
  baseProgress: number;
  icon: string;
}> = [
  {
    id: 'pending',
    label: 'Preparing',
    description: 'Getting everything ready...',
    baseProgress: 0,
    icon: '🚀'
  },
  {
    id: 'transcribing',
    label: 'Transcribing',
    description: 'Converting video to text...',
    baseProgress: 20,
    icon: '🎙️'
  },
  {
    id: 'summarizing',
    label: 'Summarizing', 
    description: 'Analyzing content and generating insights...',
    baseProgress: 60,
    icon: '🧠'
  },
  {
    id: 'finalizing',
    label: 'Finalizing',
    description: 'Polishing and organizing results...',
    baseProgress: 90,
    icon: '✨'
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your summary is ready!',
    baseProgress: 100,
    icon: '✅'
  }
];

export function PremiumLoader({
  className,
  currentStage,
  progress = 0,
  showProgress = true,
  showAnimatedText = true,
  accentColor = '#DC143C',
  onComplete,
}: PremiumLoaderProps) {
  const [animatedDots, setAnimatedDots] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Animated dots effect (...)
  useEffect(() => {
    if (!showAnimatedText || currentStage === 'completed' || currentStage === 'failed') return;
    
    const interval = setInterval(() => {
      setAnimatedDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 400);
    
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
        return prev + diff * 0.1;
      });
    }, 16); // 60fps for smooth animation
    
    return () => clearInterval(interval);
  }, [overallProgress]);

  // Animation for entrance
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Get current stage info
  const currentStageInfo = STAGES.find(stage => stage.id === currentStage) || STAGES[0];
  const currentStageIndex = STAGES.findIndex(stage => stage.id === currentStage);

  // Handle failed state
  if (currentStage === 'failed') {
    return (
      <div className={cn(
        "w-full max-w-4xl mx-auto rounded-xl p-6 backdrop-blur-lg border border-red-500/30",
        "bg-gradient-to-b from-black/40 to-black/60 shadow-xl",
        "transition-all duration-500 ease-out transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}>
        <div className="flex items-center justify-center gap-3 text-red-400">
          <div className="relative w-6 h-6 animate-pulse">
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full bg-red-500/40"></div>
          </div>
          <p className="text-sm font-medium">
            Processing failed. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full max-w-4xl mx-auto rounded-xl p-6 backdrop-blur-lg",
      "bg-gradient-to-b from-black/30 to-black/50",
      "border border-white/10 shadow-xl",
      "transition-all duration-500 ease-out transform",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      "min-h-[300px] sm:min-h-[350px]",
      "mx-4 sm:mx-auto",
      className
    )}>
      {/* Overall progress bar */}
      {showProgress && (
        <div className="mb-8 relative">
          <div className="h-2 sm:h-3 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              ref={progressBarRef}
              className="h-full rounded-full bg-gradient-to-r from-[#DC143C]/80 to-[#DC143C] transition-all duration-300 ease-out"
              style={{ 
                width: `${smoothProgress}%`,
                boxShadow: `0 0 10px ${accentColor}80, 0 0 5px ${accentColor}`
              }}
            >
              {/* Animated particles inside progress bar */}
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/2 right-0 w-1 h-1 bg-white rounded-full animate-pulse-fast" 
                     style={{ transform: 'translateY(-50%)' }}></div>
                <div className="absolute top-1/2 right-[20%] w-1 h-1 bg-white/70 rounded-full animate-pulse-slow" 
                     style={{ transform: 'translateY(-50%)' }}></div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-3">
            <p className="text-xs sm:text-sm text-white/70 font-medium">
              {Math.round(smoothProgress)}% complete
            </p>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#DC143C] animate-pulse"></span>
              <p className="text-xs sm:text-sm text-white/70 font-medium">
                {Math.max(1, currentStageIndex + 1)}/{STAGES.length - 1}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing steps */}
      <div className="space-y-4 sm:space-y-5">
        {STAGES.filter(stage => stage.id !== 'completed' && stage.id !== 'pending').map((stage, index) => {
          const isActive = stage.id === currentStage;
          const isCompleted = currentStageIndex > index + 1; // +1 to account for pending
          const isPending = currentStageIndex < index + 1;
          
          return (
            <div 
              key={stage.id}
              className={cn(
                "flex items-start gap-4 py-4 px-5 rounded-xl transition-all duration-500 border backdrop-blur-md",
                "text-sm sm:text-base transform",
                isActive ? 
                  "bg-white/10 border-[#DC143C]/40 shadow-lg scale-[1.02] translate-x-1" : 
                isCompleted ? 
                  "bg-white/5 border-white/10" : 
                  "opacity-50 border-transparent"
              )}
              style={{
                borderLeftColor: isActive ? accentColor : 'transparent',
                borderLeftWidth: isActive ? '3px' : '1px'
              }}
            >
              {/* Status icon with animation */}
              <div className={cn(
                "mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                isActive ? "bg-[#DC143C]/20" : isCompleted ? "bg-white/10" : "bg-white/5",
                "transition-all duration-500"
              )}>
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-[#DC143C] animate-scale-in" />
                ) : isActive ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-[#DC143C]/20 animate-ping opacity-75"></div>
                    <span className="relative text-lg animate-float">{stage.icon}</span>
                  </div>
                ) : (
                  <span className="text-lg opacity-50">{stage.icon}</span>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "font-medium text-sm sm:text-base",
                  isActive ? "text-[#DC143C]" : 
                  isCompleted ? "text-white/90" : 
                  "text-white/50"
                )}>
                  {stage.label}
                  {isActive && showAnimatedText && (
                    <span className="inline-block w-6 text-[#DC143C]">{animatedDots}</span>
                  )}
                </h3>
                
                {/* Description with animated gradient on active */}
                <p className={cn(
                  "text-xs sm:text-sm mt-1",
                  isActive ? "text-white/80" : 
                  isCompleted ? "text-white/60" :
                  "text-white/40"
                )}>
                  {stage.description}
                </p>
                
                {/* Animated indicator for active state */}
                {isActive && (
                  <div className="mt-2 flex space-x-1">
                    <div className="w-1 h-1 rounded-full bg-[#DC143C] animate-bounce-delay-1"></div>
                    <div className="w-1 h-1 rounded-full bg-[#DC143C] animate-bounce-delay-2"></div>
                    <div className="w-1 h-1 rounded-full bg-[#DC143C] animate-bounce-delay-3"></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Completed animation */}
      {currentStage === 'completed' && (
        <div className="mt-6 flex flex-col items-center justify-center animate-fade-in">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full bg-[#DC143C]/20 animate-ping opacity-50"></div>
            <div className="absolute inset-0 rounded-full bg-[#DC143C]/10 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-[#DC143C] animate-scale-in" />
            </div>
          </div>
          <h3 className="text-xl font-medium text-white animate-slide-up">Summary Complete!</h3>
          <p className="text-white/70 text-sm mt-1 animate-slide-up-delay">Your video summary is ready to view</p>
        </div>
      )}
    </div>
  );
} 