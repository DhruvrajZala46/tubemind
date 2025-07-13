"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import MainHeader from "./Header";
import { PremiumLoader } from '../../ui/premium-loader';
import { useUser } from "@clerk/nextjs";
import { extractYouTubeId } from '../../../lib/youtube';
import { ElegantLoader } from "../../ui/elegant-loader";
import { ThemedError, RateLimitError, NetworkError, SubscriptionError } from '../../ui/themed-error';
import { ArrowUp } from 'lucide-react';
import styles from './MainContent.module.css';
import { useCreditContext } from '../../../lib/credit-context';
import { toast } from 'sonner';
import { useInstantLoading } from '../../ui/instant-loading';
import { useMainLoading } from "../../../lib/main-loading-context.tsx";

type ProcessingStage = 'idle' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error' | 'pending' | 'summarizing' | 'finalizing' | 'failed' | 'queued' | 'extracting' | 'completed';

export default function MainContent({ isMobileMenuOpen = false, setIsMobileMenuOpen }: { isMobileMenuOpen?: boolean, setIsMobileMenuOpen?: (open: boolean) => void }) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🔥 NEW: Add credit context to trigger refresh after processing
  const { creditState, triggerRefresh, markVideoProcessed } = useCreditContext();
  
  // 🚀 Instant loading for form submission
  const { isLoading: isSubmitting, startLoading: startSubmitting, stopLoading: stopSubmitting } = useInstantLoading();
  
  // 🎯 Main loading context to hide loading when component loads
  const { hideMainLoading } = useMainLoading();
  
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<'general' | 'rate-limit' | 'network' | 'subscription' | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const videoId = extractYouTubeId(input);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  // 🔥 CRITICAL FIX: Hide main loading when component mounts and cleanup on unmount
  useEffect(() => {
    // Hide any lingering loading state when component mounts
    const timer = setTimeout(() => {
      hideMainLoading();
    }, 100);

    return () => {
      // Cleanup: Hide loading state when component unmounts
      clearTimeout(timer);
      hideMainLoading();
    };
  }, [hideMainLoading]);

  // Check for videoUrl in query params on load
  useEffect(() => {
    const videoUrlFromQuery = searchParams.get('videoUrl');
    if (videoUrlFromQuery && isSignedIn) {
      setInput(videoUrlFromQuery);
      handleProcess(videoUrlFromQuery, true);
      // Optionally remove the query parameter after processing
      const params = new URLSearchParams(searchParams.toString());
      params.delete('videoUrl');
      router.replace(`${window.location.pathname}?${params.toString()}`);
    }
  }, [isSignedIn, searchParams, router]);

  // Show thumbnail when a valid YouTube URL is entered
  useEffect(() => {
    if (videoId) {
      setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    } else {
      setThumbnail(null);
    }
  }, [videoId]);

  const handleProcess = async (url: string, fromQuery = false) => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Start instant loading immediately
    startSubmitting('Processing video...');
    
    setError("");
    setErrorType(null);
    setIsProcessing(true);
    setProcessingStage("fetching");
    setProgress(0);
    setStatusMessage("Fetching video metadata...");

    try {
      // OPTIMIZED: Use AbortController for timeout management with much longer timeout for long video processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout for long videos
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Priority': 'high' // Add priority header
        },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to process video';
        
        // Classify error type based on status code and message
        let type: 'general' | 'rate-limit' | 'network' | 'subscription' = 'general';
        
        if (response.status === 429) {
          type = 'rate-limit';
        } else if (response.status === 402 || response.status === 403 || errorMessage.toLowerCase().includes('limit') || errorMessage.toLowerCase().includes('credit')) {
          type = 'subscription';
        } else if (response.status >= 500 || errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
          type = 'network';
        }
        
        setErrorType(type);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Stop the submission loading indicator
      stopSubmitting();
      
      console.log('📦 Extract API response data:', data);
      
      // Don't redirect immediately - show progress first
      setProcessingStage("transcribing");
      setProgress(10);
      setStatusMessage("Video submitted successfully! Starting processing...");
      
      // Show success toast
      toast.success("Video submitted successfully! Processing...");

      // Start polling for progress and redirect when complete
      const summaryId = data.summaryId;
      const redirectUrl = `/dashboard/${data.summaryId}`;
      
      console.log('🔍 Polling setup:', { summaryId, redirectUrl });
      
      if (summaryId && redirectUrl) {
        console.log('✅ Starting polling with valid IDs');
        await pollProgressAndRedirect(summaryId, redirectUrl);
      } else {
        console.log('❌ Missing polling data, using fallback redirect');
        // Fallback: redirect after 2 seconds if no polling data
        setTimeout(() => {
          router.push(redirectUrl || '/dashboard');
        }, 2000);
      }
    }
    catch (err: any) {
      // CRITICAL FIX: Handle AbortError (timeout) specifically
      const isAbortError = err instanceof Error && 
        (err.name === 'AbortError' || 
         err.message.includes('aborted') || 
         err.message.includes('timeout'));
      
      if (isAbortError) {
        // Timeout occurred - but processing continues in background
        console.log('⏳ Request timed out but processing continues in background');
        setProcessingStage("transcribing");
        setProgress(10);
        setStatusMessage("Processing is taking longer than expected, but continues in the background...");
        
        // Show informative toast
        toast.success("Video submitted successfully! Processing continues - check your dashboard in a few minutes.");
        
        // Redirect to dashboard where they can see their processing videos
        setTimeout(() => {
          router.push('/dashboard');
        }, 4000);
        
        stopSubmitting();
        return;
      }
      
      // Real error - show error message
      setError(err.message || 'An error occurred');
      setProcessingStage('error');
      stopSubmitting();
    }
  }

  // New function to poll progress and redirect when complete
  const pollProgressAndRedirect = async (summaryId: string, redirectUrl: string) => {
    let pollCount = 0;
    const maxPolls = 300; // Increased to 10 minutes of polling with faster frequency
    let isMounted = true; // Track component mount state
    
    // OPTIMIZED: Cleanup function to prevent memory leaks and stale polling
    const cleanup = () => {
      isMounted = false;
    };
    
    const poll = async () => {
      if (!isMounted) return; // Skip if component unmounted
      
      pollCount++;
      console.log(`🔄 Poll attempt ${pollCount}/${maxPolls} for summaryId:`, summaryId);
      
      try {
        // OPTIMIZED: Use AbortController for timeout management
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`/api/summaries/${summaryId}/status`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Priority': 'high'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📡 Status API response:`, response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📊 Status data received:`, data);
        
        // OPTIMIZED: Use actual progress from backend instead of fake progress
        const stage = data.processing_stage || data.processing_status || 'pending';
        let progress = data.processing_progress || 0;
        
        // OPTIMIZED: More responsive progress mapping with smoother transitions
        if (progress === 0) {
          switch (stage) {
            case 'pending':
            case 'queued':
              progress = 5;
              break;
            case 'transcribing':
            case 'extracting':
              progress = 15;
              break;
            case 'summarizing':
            case 'analyzing':
              progress = 35;
              break;
            case 'finalizing':
              progress = 85;
              break;
            case 'completed':
              progress = 100;
              break;
            default:
              progress = 2;
          }
        }
        
        // OPTIMIZED: Ensure smooth progress transitions without artificial caps
        switch (stage) {
          case 'transcribing':
          case 'extracting':
            progress = Math.max(5, Math.min(progress, 100));
            break;
          case 'summarizing':
          case 'analyzing':
            progress = Math.max(15, Math.min(progress, 100));
            break;
          case 'finalizing':
            progress = Math.max(60, Math.min(progress, 100));
            break;
          case 'completed':
            progress = 100;
            break;
        }
        
        if (!isMounted) return; // Skip UI updates if unmounted
        
        console.log(`🎯 Updating UI - Stage: ${stage}, Progress: ${progress}%`);
        
        setProcessingStage(stage as ProcessingStage);
        setProgress(progress);
        setStatusMessage(getStatusMessage(stage, progress));
        
        // Check if complete
        if (data.processing_status === 'completed' || progress >= 100) {
          console.log('✅ Processing completed! Redirecting to:', redirectUrl);
          setProcessingStage('complete');
          setProgress(100);
          setStatusMessage("Processing complete! Redirecting...");
          
          // OPTIMIZED: Faster redirect on completion
          setTimeout(() => {
            if (isMounted) {
              router.push(redirectUrl);
            }
          }, 800);
          return;
        }
        
        // Check if failed
        if (data.processing_status === 'failed') {
          console.log('❌ Processing failed');
          setProcessingStage('error');
          setStatusMessage("Processing failed. Please try again.");
          setIsProcessing(false);
          return;
        }
        
        // OPTIMIZED: Dynamic polling frequency based on progress stage
        let nextPollDelay = 500; // Default 0.5 second for active processing
        
        // Adjust polling frequency based on stage
        switch (stage) {
          case 'pending':
          case 'queued':
            nextPollDelay = 800; // 0.8 second for queued items
            break;
          case 'transcribing':
            nextPollDelay = 600; // 0.6 second during transcribing
            break;
          case 'summarizing':
          case 'analyzing':
            nextPollDelay = 800; // 0.8 second during summarizing
            break;
          case 'finalizing':
            nextPollDelay = 500; // 0.5 second during finalizing (faster)
            break;
          default:
            nextPollDelay = 700; // 0.7 seconds default
        }
        
        // Continue polling if not complete and under max polls
        if (pollCount < maxPolls && isMounted) {
          console.log(`⏳ Scheduling next poll in ${nextPollDelay}ms (attempt ${pollCount + 1})`);
          setTimeout(poll, nextPollDelay);
        } else if (isMounted) {
          // Max polls reached - redirect anyway
          console.log('⏰ Max polls reached, redirecting anyway');
          setStatusMessage("Taking longer than expected. Redirecting...");
          setTimeout(() => {
            router.push(redirectUrl);
          }, 2000);
        }
        
      } catch (error) {
        console.error('❌ Polling error:', error);
        
        if (!isMounted) return; // Skip error handling if unmounted
        
        // CRITICAL FIX: Distinguish between abort errors and real errors
        const isAbortError = error instanceof Error && 
          (error.name === 'AbortError' || 
           error.message.includes('aborted') || 
           error.message.includes('timeout') ||
           error.message.includes('fetch'));
        
        if (isAbortError) {
          // Abort errors are temporary - just retry with backoff
          console.log('⏳ Fetch aborted (timeout), retrying...');
          const retryDelay = Math.min(500 * Math.pow(1.2, pollCount % 5), 2000);
          
          if (pollCount < maxPolls && isMounted) {
            console.log(`🔄 Retrying poll in ${retryDelay}ms due to abort`);
            setTimeout(poll, retryDelay);
          } else if (isMounted) {
            // After many aborts, redirect anyway
            setStatusMessage("Still processing... Redirecting shortly...");
            setTimeout(() => {
              router.push(redirectUrl);
            }, 3000);
          }
        } else {
          // Real error - use exponential backoff
          const retryDelay = Math.min(800 * Math.pow(1.3, pollCount % 5), 3000);
          
          if (pollCount < maxPolls && isMounted) {
            console.log(`🔄 Retrying poll in ${retryDelay}ms due to error`);
            setTimeout(poll, retryDelay);
          } else if (isMounted) {
            // Final fallback - redirect anyway
            setStatusMessage("Checking status... Redirecting shortly...");
            setTimeout(() => {
              router.push(redirectUrl);
            }, 3000);
          }
        }
      }
    };
    
    // OPTIMIZED: Start polling immediately with no delay
    console.log('🚀 Starting immediate poll');
    poll();
    
    // Return cleanup function to prevent memory leaks
    return cleanup;
  };

  // Helper function to get status message
  const getStatusMessage = (stage: string, progress: number): string => {
    switch (stage) {
      case 'transcribing':
        return `Extracting transcript... ${progress}%`;
      case 'summarizing':
        return `Analyzing content... ${progress}%`;
      case 'finalizing':
        return `Finalizing summary... ${progress}%`;
      case 'completed':
        return "Processing complete!";
      default:
        return `Processing video... ${progress}%`;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen px-4 py-4 sm:py-8 md:py-12 max-w-6xl mx-auto relative">
      {/* Main Header with Title - hide on mobile, show only message below */}
      <div className="hidden sm:block w-full">
        <MainHeader />
      </div>
      
      {/* Mobile: Centered message only - REDUCED HEIGHT for better spacing */}
      <div className="flex-1 flex flex-col items-center justify-center w-full sm:hidden" style={{ minHeight: 'calc(100vh - 10rem)' }}>
        <h1
          className="text-[2.1rem] font-extrabold text-white text-center mb-2"
          style={{
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.01em',
            lineHeight: 1.13,
            marginTop: '0.5rem',
            marginBottom: '0.5rem',
            padding: '0 0.5rem',
          }}
        >
          Watch Less, Learn More
        </h1>
      </div>
      
      {/* Video Thumbnail Preview - MOBILE FRIENDLY VERSION */}
      {thumbnailUrl && !error && !isProcessing && (
        <div className="mt-4 mb-4 p-3 bg-[var(--bg-input)] rounded-[8px] border border-[var(--border-color)] flex flex-col items-center sm:hidden">
          <img src={thumbnailUrl} alt="Video thumbnail" className="w-full h-auto max-h-44 rounded-lg object-cover" />
        </div>
      )}
      
      {/* Desktop: Main content area as before */}
      <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-6 mb-4 sm:mb-8 hidden sm:block">
        {/* Video Input Section - Claude AI style */}
        <form className="flex flex-col items-center w-full" autoComplete="off" onSubmit={(e) => {
          e.preventDefault();
          if (input && !error) handleProcess(input);
        }}>
          <div className="w-full flex items-center justify-center">
            <div className="flex w-full items-center bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-white/10 transition-all px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setTouched(true);
                  if (!e.target.value) {
                    setError("");
                    return;
                  }
                  if (!extractYouTubeId(e.target.value)) {
                    setError("Please enter a valid YouTube URL");
                  } else {
                    setError("");
                  }
                }}
                onBlur={() => setTouched(true)}
                placeholder="Enter YouTube video URL to summarize..."
                className="flex-1 bg-transparent border-none outline-none px-6 py-5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-[17px] font-normal font-sans rounded-2xl focus:ring-0 focus:outline-none"
                style={{ minWidth: 0 }}
              />
              <button
                type="submit"
                className="ml-2 flex items-center justify-center h-12 px-6 rounded-2xl bg-[var(--btn-dashboard-bg)] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:shadow-lg border-none"
                disabled={!!error || !input.trim() || isSubmitting || isProcessing}
                style={{ minWidth: 0 }}
              >
                {(isSubmitting || isProcessing) ? <ElegantLoader size="sm" /> : <ArrowUp className="w-5 h-5 text-[var(--btn-primary-text)]" />}
              </button>
            </div>
          </div>
          {error && touched && (
            <div className="text-[var(--text-primary)] font-medium text-xs mt-2 min-h-[20px] w-full text-left px-1 font-sans">
              {error}
            </div>
          )}
        </form>
        
        {/* Video Thumbnail Preview - DESKTOP ONLY */}
        {thumbnailUrl && !error && !isProcessing && (
          <div className="mt-4 p-4 bg-[var(--bg-input)] rounded-[8px] border border-[var(--border-color)] flex flex-col items-center">
            <img src={thumbnailUrl} alt="Video thumbnail" className="w-80 h-44 rounded-lg object-cover mb-2" />
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {errorType && (
        <div className="w-full max-w-3xl mx-auto mt-4">
          {errorType === 'rate-limit' && <RateLimitError />}
          {errorType === 'network' && <NetworkError />}
          {errorType === 'subscription' && <SubscriptionError />}
          {errorType === 'general' && <ThemedError message={error} />}
        </div>
      )}
      
      {/* Processing Status - IMPROVED MOBILE POSITIONING */}
      {isProcessing && processingStage !== 'idle' && (
        <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-6 px-2 sm:px-0 pb-28 sm:pb-0">
          <PremiumLoader
            currentStage={
              ({
                'fetching': 'pending',
                'pending': 'pending',
                'queued': 'pending',
                'transcribing': 'transcribing',
                'extracting': 'transcribing',
                'summarizing': 'summarizing',
                'analyzing': 'summarizing',
                'finalizing': 'finalizing',
                'complete': 'completed',
                'completed': 'completed',
                'error': 'failed',
                'failed': 'failed',
              } as const)[processingStage] || 'pending'
            }
            progress={progress}
          />
        </div>
      )}
      
      {/* Mobile: Fixed bottom input bar - IMPROVED POSITIONING */}
      <div
        className={`fixed bottom-0 left-0 w-full z-50 border-t border-[#22292F] sm:hidden transition-all duration-300`}
        style={{
          background: 'rgba(0,0,0,0.85)', // Slightly darker for better contrast
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid #22292F',
          padding: '0.9rem 1.2rem calc(env(safe-area-inset-bottom) + 0.9rem) 1.2rem',
          boxSizing: 'border-box',
        }}
      >
        {/* Blur overlay when sidebar is open */}
        {isMobileMenuOpen && (
          <div
            className="absolute inset-0 w-full h-full z-50 backdrop-blur-md bg-black/60 pointer-events-auto transition-all duration-300"
            style={{ borderRadius: '1.25rem' }}
          />
        )}
        <form
          className="flex items-center w-full max-w-lg mx-auto relative"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (input && !error) handleProcess(input);
          }}
        >
          <div
            className="flex w-full items-center border border-[var(--border-color)] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-white/10 transition-all"
            style={{
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '0.5rem 1rem',
              margin: 0,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setTouched(true);
                if (!e.target.value) {
                  setError("");
                  return;
                }
                if (!extractYouTubeId(e.target.value)) {
                  setError("Please enter a valid YouTube URL");
                } else {
                  setError("");
                }
              }}
              onBlur={() => setTouched(true)}
              placeholder="Enter YouTube video URL to summarize..."
              className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-[16px] font-normal font-sans rounded-2xl focus:ring-0 focus:outline-none"
              style={{
                minWidth: 0,
                padding: '0.8rem 0.5rem',
                fontSize: 16,
                marginRight: 8,
                background: 'transparent',
              }}
              disabled={isMobileMenuOpen}
            />
            <button
              type="submit"
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-[var(--btn-dashboard-bg)] hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:shadow-lg border-none"
              disabled={!!error || !input.trim() || isSubmitting || isProcessing || isMobileMenuOpen}
              style={{ minWidth: 0 }}
            >
              {(isSubmitting || isProcessing) ? <ElegantLoader size="sm" /> : <ArrowUp className="w-4 h-4 text-[var(--btn-primary-text)]" />}
            </button>
          </div>
        </form>
        {error && touched && (
          <div className="text-[var(--text-primary)] font-medium text-xs mt-1 min-h-[16px] w-full text-left px-1 font-sans">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
