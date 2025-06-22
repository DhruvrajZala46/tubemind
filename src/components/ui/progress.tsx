"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from '../../lib/utils'

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { value?: number }) {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  // Smooth transition for progress value with faster animation
  React.useEffect(() => {
    // If value is undefined or null, use 0
    const targetValue = value ?? 0;
    
    // If the change is small, update immediately
    if (Math.abs(targetValue - displayValue) < 5) {
      setDisplayValue(targetValue);
      return;
    }
    
    // For larger changes, animate smoothly but faster
    const interval = setInterval(() => {
      setDisplayValue(current => {
        const diff = targetValue - current;
        const increment = Math.max(1.5, Math.abs(diff) * 0.1); // Increased speed
        
        if (Math.abs(diff) < 0.5) return targetValue;
        return current + (diff > 0 ? increment : -increment);
      });
    }, 12); // Faster refresh rate (~83fps)
    
    return () => clearInterval(interval);
  }, [value, displayValue]);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 flex items-center justify-start">
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full flex-1 rounded-r-full bg-gradient-to-r from-[#DC143C]/80 to-[#DC143C] transition-all duration-200 ease-out"
          style={{ width: `${displayValue}%` }}
        >
          {/* Pulsing glow at the leading edge */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-6 animate-pulse-glow"
            style={{
              background: 'radial-gradient(circle at right, rgba(220, 20, 60, 0.9) 0%, transparent 80%)',
            }}
          />
          
          {/* Animated particles inside the progress bar */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-white/30 rounded-full animate-twinkle-fast" />
            <div className="absolute top-1/2 left-2/3 w-1 h-1 bg-white/20 rounded-full animate-twinkle" />
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white/40 rounded-full animate-twinkle-fast" 
                 style={{ animationDelay: '0.5s' }} />
          </div>
        </ProgressPrimitive.Indicator>
      </div>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
