import React from 'react';
import { cn } from '../../lib/utils';

interface ElegantLoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ElegantLoader({ className, size = 'md' }: ElegantLoaderProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* Main star with morphing animation */}
      <div className="absolute inset-0 animate-morph">
        <span className="text-[#FF0033] text-2xl transform-gpu animate-pulse-slow">✴</span>
      </div>
      
      {/* Orbiting particles */}
      <div className="absolute inset-0 animate-orbit">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF0033]/30 rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF0033]/30 rounded-full" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#FF0033]/30 rounded-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#FF0033]/30 rounded-full" />
      </div>
    </div>
  );
}

// Add these animations to your globals.css
const styles = `
@keyframes morph {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.1) rotate(180deg);
  }
}

@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(0.95);
  }
}

@keyframes orbit {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.animate-morph {
  animation: morph 3s ease-in-out infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}

.animate-orbit {
  animation: orbit 4s linear infinite;
}
`; 