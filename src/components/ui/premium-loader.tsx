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
  expectedDuration: number; // Expected duration in seconds for this stage
  simulationSpeed: number; // How fast to simulate progress (points per second)
}> = [
  {
    id: 'pending',
    label: 'Preparing',
    description: 'Getting everything ready...',
    baseProgress: 0,
    icon: '🚀',
    expectedDuration: 5,
    simulationSpeed: 1.5 // Much slower, more realistic
  },
  {
    id: 'transcribing',
    label: 'Transcribing',
    description: 'Converting video to text...',
    baseProgress: 20,
    icon: '🎙️',
    expectedDuration: 25,
    simulationSpeed: 0.8 // Slower, realistic transcribing speed
  },
  {
    id: 'summarizing',
    label: 'Summarizing', 
    description: 'Analyzing content and generating insights...',
    baseProgress: 60,
    icon: '🧠',
    expectedDuration: 30,
    simulationSpeed: 0.6 // Much slower analysis, more realistic
  },
  {
    id: 'finalizing',
    label: 'Finalizing',
    description: 'Polishing and organizing results...',
    baseProgress: 90,
    icon: '✨',
    expectedDuration: 8,
    simulationSpeed: 1.0 // Moderate finishing speed
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Your summary is ready!',
    baseProgress: 100,
    icon: '✅',
    expectedDuration: 0,
    simulationSpeed: 0
  }
];

// Dynamic messages for each stage to show variety
const STAGE_MESSAGES = {
  pending: [
    'Initializing process...',
    'Setting up the environment...',
    'Preparing for analysis...',
    'Getting things ready...'
  ],
  transcribing: [
    'Converting speech to text...',
    'Processing audio content...',
    'Extracting spoken words...',
    'Capturing every word...',
    'Analyzing audio patterns...',
    'Decoding speech segments...'
  ],
  summarizing: [
    'Analyzing key concepts...',
    'Identifying main points...',
    'Finding important insights...',
    'Connecting ideas together...',
    'Extracting core messages...',
    'Detecting key arguments...',
    'Understanding context...',
    'Mapping content structure...'
  ],
  finalizing: [
    'Organizing content structure...',
    'Adding finishing touches...',
    'Preparing final output...',
    'Making it perfect...',
    'Formatting results...',
    'Optimizing readability...'
  ]
};

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
  const [dynamicMessage, setDynamicMessage] = useState('');
  const [particleCount, setParticleCount] = useState(3);
  const lastProgressUpdateRef = useRef<number>(Date.now());
  const progressSpeedRef = useRef<number>(1);
  const [progressActivity, setProgressActivity] = useState<'slow' | 'normal' | 'fast'>('normal');
  
  // New refs for continuous progress simulation
  const simulatedProgressRef = useRef<number>(0);
  const lastSimulationTimeRef = useRef<number>(Date.now());
  const backendProgressRef = useRef<number>(progress);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animated dots effect (...)
  useEffect(() => {
    if (!showAnimatedText || currentStage === 'completed' || currentStage === 'failed') return;
    
    const interval = setInterval(() => {
      setAnimatedDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 300); // Faster animation
    
    return () => clearInterval(interval);
  }, [showAnimatedText, currentStage]);

  // Dynamic messages for each stage
  useEffect(() => {
    if (currentStage === 'completed' || currentStage === 'failed') return;
    
    // Get messages for current stage
    const messages = STAGE_MESSAGES[currentStage as keyof typeof STAGE_MESSAGES] || [];
    if (messages.length === 0) return;
    
    // Rotate through messages
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * messages.length);
      setDynamicMessage(messages[randomIndex]);
    }, 3000);
    
    // Set initial message
    setDynamicMessage(messages[0]);
    
    return () => clearInterval(interval);
  }, [currentStage]);

  // Store the backend progress in a ref to use in simulation
  useEffect(() => {
    backendProgressRef.current = progress;
  }, [progress]);

  // Continuous progress simulation
  useEffect(() => {
    // Clear any existing interval
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    // Don't simulate for completed or failed states
    if (currentStage === 'completed' || currentStage === 'failed') {
      simulatedProgressRef.current = currentStage === 'completed' ? 100 : 0;
      setOverallProgress(simulatedProgressRef.current);
      return;
    }

    // Initialize simulated progress when stage changes
    const stageInfo = STAGES.find(stage => stage.id === currentStage);
    if (!stageInfo) return;

    // Start with the higher of current simulation or backend progress
    simulatedProgressRef.current = Math.max(
      simulatedProgressRef.current, 
      backendProgressRef.current || stageInfo.baseProgress
    );

    // 🚀 CONTINUOUS MOVEMENT: Remove ceiling restrictions and ensure NEVER-STOPPING progress
    // Set up simulation interval (60fps for smooth animation)
    simulationIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastSimulationTimeRef.current;
      lastSimulationTimeRef.current = now;

      // Skip if no time has passed
      if (elapsed <= 0) return;

      // Calculate simulation speed based on current stage
      const baseSpeed = stageInfo.simulationSpeed;
      
      // 🔥 REALISTIC CONTINUOUS MOVEMENT: Maintain minimum movement but much slower
      const minimumSpeed = 0.01; // Much slower minimum - only 0.01% per second
      const currentProgress = simulatedProgressRef.current;
      
      // Realistic speed calculation - much slower but still moving
      let dynamicSpeed = baseSpeed;
      
      // Gradual slowdown that feels natural and realistic
      if (currentProgress > 85) {
        dynamicSpeed = Math.max(minimumSpeed, baseSpeed * 0.15); // Very slow near end
      } else if (currentProgress > 70) {
        dynamicSpeed = Math.max(minimumSpeed * 2, baseSpeed * 0.3); // Slower in later stages
      } else if (currentProgress > 50) {
        dynamicSpeed = Math.max(minimumSpeed * 3, baseSpeed * 0.6); // Moderate slowdown
      } else if (currentProgress > 30) {
        dynamicSpeed = Math.max(minimumSpeed * 4, baseSpeed * 0.8); // Slight slowdown
      } else {
        dynamicSpeed = Math.max(minimumSpeed * 5, baseSpeed); // Normal speed early on
      }
      
      // Add slight randomness for natural feel (±15% instead of ±20%)
      const randomFactor = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
      dynamicSpeed *= randomFactor;
      
      // Calculate progress increment - MUCH SMALLER for realism
      const increment = Math.max(0.0005, (dynamicSpeed * elapsed) / 1000); // Never less than 0.0005%
      
      // 🎯 REALISTIC UPDATE: Much slower progression, caps at 95% until backend completion
      if (currentProgress < 90) {
        simulatedProgressRef.current = Math.min(90, simulatedProgressRef.current + increment);
      } else if (currentProgress < 95) {
        // Very slow movement from 90-95%
        simulatedProgressRef.current = Math.min(95, simulatedProgressRef.current + (minimumSpeed * elapsed) / 2000);
      } else {
        // Extremely slow movement above 95%, waiting for real completion
        simulatedProgressRef.current = Math.min(98.5, simulatedProgressRef.current + (minimumSpeed * elapsed) / 5000);
      }

      // 🚀 REALISTIC HEARTBEAT: Much smaller nudges, less frequent
      const timeSinceLastUpdate = now - lastSimulationTimeRef.current;
      if (timeSinceLastUpdate > 5000 && currentProgress < 90) { // Every 5 seconds, smaller nudge
        simulatedProgressRef.current = Math.min(90, simulatedProgressRef.current + 0.05); // Tiny 0.05% nudge
      }

      // Use the higher of simulated or backend progress (backend can push us forward)
      const finalProgress = Math.max(
        simulatedProgressRef.current,
        backendProgressRef.current || 0
      );
      
      // If backend gives us higher progress, jump to it and continue from there
      if (backendProgressRef.current && backendProgressRef.current > simulatedProgressRef.current) {
        simulatedProgressRef.current = backendProgressRef.current;
        // If backend shows completion (100%), override our simulation
        if (backendProgressRef.current >= 100) {
          simulatedProgressRef.current = 100;
        }
      }
      
      // Update overall progress
      setOverallProgress(finalProgress);
      
      // Update progress activity indicator based on actual speed
      const effectiveSpeed = increment / (elapsed / 1000); // Progress points per second
      if (effectiveSpeed > 1.5) {
        setProgressActivity('fast');
      } else if (effectiveSpeed < 0.3) {
        setProgressActivity('slow');
      } else {
        setProgressActivity('normal');
      }
      
      // Update particle count based on speed for visual feedback
      setParticleCount(Math.max(2, Math.min(8, Math.floor(effectiveSpeed * 3))));
    }, 16); // 60fps for ultra-smooth animation

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [currentStage]);

  // Improved progress calculation with smooth transitions
  useEffect(() => {
    const stageInfo = STAGES.find(stage => stage.id === currentStage);
    if (!stageInfo) {
      setOverallProgress(0);
      return;
    }
    
    // For completed stage, always 100%
    if (currentStage === 'completed') {
      setOverallProgress(100);
    }
    
    // Calculate progress speed
    const now = Date.now();
    const timeDiff = now - lastProgressUpdateRef.current;
    if (timeDiff > 0 && lastProgressUpdateRef.current > 0) {
      const prevProgress = overallProgress;
      const progressDiff = overallProgress - prevProgress;
      if (progressDiff > 0) {
        // Points per second
        progressSpeedRef.current = (progressDiff / timeDiff) * 1000;
      }
    }
    lastProgressUpdateRef.current = now;
    
    // Trigger onComplete callback when done
    if (currentStage === 'completed' && onComplete) {
      onComplete();
    }
  }, [currentStage, overallProgress, onComplete]);

  // Smooth progress animation - REALISTIC for slower movement
  useEffect(() => {
    const interval = setInterval(() => {
      setSmoothProgress(prev => {
        const diff = overallProgress - prev;
        if (Math.abs(diff) < 0.02) return overallProgress; // Smaller threshold for smoother feel
        
        // 🎯 REALISTIC animation speed - not too fast, not too slow
        const speed = Math.min(0.3, Math.max(0.05, diff * 0.08)); // More moderate animation speed
        return prev + diff * speed;
      });
    }, 16); // Keep 60fps but with more realistic speed
    
    return () => clearInterval(interval);
  }, [overallProgress]);

  // Animation for entrance
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Get current stage info
  const currentStageInfo = STAGES.find(stage => stage.id === currentStage) || STAGES[0];
  const currentStageIndex = STAGES.findIndex(stage => stage.id === currentStage);

  // Generate particles for progress bar
  const renderParticles = () => {
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const position = 100 - (i * (100 / particleCount));
      particles.push(
        <div 
          key={i}
          className="absolute top-1/2 w-1 h-1 rounded-full bg-white/80 animate-pulse-fast" 
          style={{ 
            right: `${position}%`, 
            transform: 'translateY(-50%)',
            animationDelay: `${i * 0.2}s`,
            opacity: 0.7 - (i * 0.1)
          }}
        />
      );
    }
    return particles;
  };

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
      "w-full max-w-4xl mx-auto rounded-xl p-4 sm:p-6 backdrop-blur-lg",
      "bg-gradient-to-b from-black/30 to-black/50",
      "border border-white/10 shadow-xl",
      "transition-all duration-500 ease-out transform",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      "min-h-[260px] sm:min-h-[350px]", // Reduced minimum height on mobile
      "mx-0 sm:mx-auto", // Remove horizontal margin on mobile
      className
    )}>
      {/* Overall progress bar */}
      {showProgress && (
        <div className="mb-6 sm:mb-8 relative">
          <div className="h-2 sm:h-3 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              ref={progressBarRef}
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden",
                progressActivity === 'fast' ? "bg-gradient-to-r from-[#DC143C]/90 to-[#DC143C]" :
                progressActivity === 'slow' ? "bg-gradient-to-r from-[#DC143C]/70 to-[#DC143C]/90" :
                "bg-gradient-to-r from-[#DC143C]/80 to-[#DC143C]"
              )}
              style={{ 
                width: `${smoothProgress}%`,
                boxShadow: `0 0 10px ${accentColor}80, 0 0 5px ${accentColor}`
              }}
            >
              {/* 🚀 CONTINUOUS MOVEMENT: Animated shimmer effect to show constant activity */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-progress-shimmer"
              />
              
              {/* Animated particles inside progress bar */}
              <div className="absolute top-0 left-0 w-full h-full">
                {renderParticles()}
              </div>
            </div>
            
            {/* Pulse animation at the end of progress bar */}
            <div 
              className="absolute top-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#DC143C]/70 animate-ping" 
              style={{ 
                left: `${smoothProgress}%`, 
                transform: 'translate(-50%, -50%)',
                opacity: 0.7
              }}
            />
          </div>
          
          <div className="flex justify-between items-center mt-2 sm:mt-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <p className="text-xs text-white/70 font-medium">
                {Math.round(smoothProgress)}% complete
              </p>
              <div className={cn(
                "text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full",
                progressActivity === 'fast' ? "bg-green-500/20 text-green-400" :
                progressActivity === 'slow' ? "bg-yellow-500/20 text-yellow-400" :
                "bg-blue-500/20 text-blue-400"
              )}>
                {progressActivity === 'fast' ? 'Fast' : 
                 progressActivity === 'slow' ? 'Processing' : 'Active'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#DC143C] animate-pulse"></span>
              <p className="text-xs text-white/70 font-medium">
                {Math.max(1, currentStageIndex + 1)}/{STAGES.length - 1}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing steps */}
      <div className="space-y-3 sm:space-y-5">
        {STAGES.filter(stage => stage.id !== 'completed' && stage.id !== 'pending').map((stage, index) => {
          const isActive = stage.id === currentStage;
          const isCompleted = currentStageIndex > index + 1; // +1 to account for pending
          const isPending = currentStageIndex < index + 1;
          
          return (
            <div 
              key={stage.id}
              className={cn(
                "flex items-start gap-3 sm:gap-4 py-3 sm:py-4 px-3 sm:px-5 rounded-xl transition-all duration-500 border backdrop-blur-md",
                "text-sm transform",
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
                "mt-0.5 flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center",
                isActive ? "bg-[#DC143C]/20" : isCompleted ? "bg-white/10" : "bg-white/5",
                "transition-all duration-500"
              )}>
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-[#DC143C] animate-scale-in" />
                ) : isActive ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-[#DC143C]/20 animate-ping opacity-75"></div>
                    <span className="relative text-base sm:text-lg animate-float">{stage.icon}</span>
                  </div>
                ) : (
                  <span className="text-base sm:text-lg opacity-50">{stage.icon}</span>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "font-medium text-sm",
                  isActive ? "text-[#DC143C]" : 
                  isCompleted ? "text-white/90" : 
                  "text-white/50"
                )}>
                  {stage.label}
                  {isActive && showAnimatedText && (
                    <span className="inline-block w-6 text-[#DC143C]">{animatedDots}</span>
                  )}
                </h3>
                
                {/* Dynamic description with animated gradient on active */}
                <p className={cn(
                  "text-[11px] sm:text-xs mt-0.5 sm:mt-1",
                  isActive ? "text-white/80" : 
                  isCompleted ? "text-white/60" :
                  "text-white/40"
                )}>
                  {isActive && dynamicMessage ? dynamicMessage : stage.description}
                </p>
                
                {/* Animated indicator for active state */}
                {isActive && (
                  <div className="mt-1 sm:mt-2 flex space-x-1">
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
        <div className="mt-4 sm:mt-6 flex flex-col items-center justify-center animate-fade-in">
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4">
            <div className="absolute inset-0 rounded-full bg-[#DC143C]/20 animate-ping opacity-50"></div>
            <div className="absolute inset-0 rounded-full bg-[#DC143C]/10 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-[#DC143C] animate-scale-in" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl font-medium text-white animate-slide-up">Summary Complete!</h3>
          <p className="text-white/70 text-xs sm:text-sm mt-1 animate-slide-up-delay">Your video summary is ready to view</p>
        </div>
      )}
    </div>
  );
} 