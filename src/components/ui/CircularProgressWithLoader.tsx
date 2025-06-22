import React, { useState, useEffect } from 'react';
import { ElegantLoader } from './elegant-loader';
import { cn } from '../../lib/utils';

interface CircularProgressWithLoaderProps {
  progress: number;
  size?: number;
  thickness?: number;
  className?: string;
  showPercentage?: boolean;
  color?: string;
  uniqueId?: string;
}

export function CircularProgressWithLoader({ 
  progress, 
  size = 80, 
  thickness = 3,
  className,
  showPercentage = false,
  color = "#DC143C",
  uniqueId = "progressGradient"
}: CircularProgressWithLoaderProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  
  // Smooth progress animation
  useEffect(() => {
    // If the change is small, update immediately
    if (Math.abs(progress - displayProgress) < 2) {
      setDisplayProgress(progress);
      return;
    }
    
    const interval = setInterval(() => {
      setDisplayProgress(current => {
        const diff = progress - current;
        const increment = Math.max(0.5, Math.abs(diff) * 0.05);
        
        if (Math.abs(diff) < 0.5) return progress;
        return current + (diff > 0 ? increment : -increment);
      });
    }, 16);
    
    return () => clearInterval(interval);
  }, [progress, displayProgress]);

  const strokeWidth = thickness;
  const radius = (size / 2) - (strokeWidth * 2);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayProgress / 100) * circumference;
  
  // Calculate gradient coordinates based on progress
  const gradientRotation = (displayProgress / 100) * 360;
  const gradientId = `progressGradient-${uniqueId}`;

  return (
    <div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Background track */}
      <svg 
        width={size} 
        height={size} 
        className="absolute left-0 top-0 -rotate-90 transform"
      >
        <defs>
          <linearGradient id={gradientId} gradientTransform={`rotate(${gradientRotation})`}>
            <stop offset="0%" stopColor={`${color}CC`} />
            <stop offset="100%" stopColor={`${color}`} />
          </linearGradient>
        </defs>
        
        {/* Track circle */}
        <circle
          stroke="rgba(255,255,255,0.1)"
          fill="none"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="transition-all duration-300"
        />
        
        {/* Progress circle */}
        <circle
          stroke={`url(#${gradientId})`}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
          style={{
            filter: `drop-shadow(0 0 3px ${color}66)`,
          }}
        />
        
        {/* Leading edge glow */}
        <circle 
          cx={size/2 + Math.cos((displayProgress/100 * 2 * Math.PI) - Math.PI/2) * radius}
          cy={size/2 + Math.sin((displayProgress/100 * 2 * Math.PI) - Math.PI/2) * radius}
          r={strokeWidth * 1.5}
          fill={color}
          className="animate-pulse-glow"
          style={{
            filter: `blur(${strokeWidth}px) drop-shadow(0 0 2px ${color})`,
            opacity: 0.8
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="relative flex items-center justify-center" style={{ width: size - 16, height: size - 16 }}>
        {showPercentage ? (
          <div className="flex flex-col items-center justify-center">
            <span className="text-lg font-medium" style={{ color }}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        ) : (
          <ElegantLoader size="md" />
        )}
      </div>
    </div>
  );
} 