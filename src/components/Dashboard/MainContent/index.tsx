"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import MainHeader from "./Header";
import ProcessingStatus from "../../processing-status";
import KnowledgeDisplay from "../../knowledge-display";
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

type ProcessingStage = 'idle' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error' | 'pending';

export default function MainContent() {
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
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

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
      const summaryId = data.data.summaryId;
      const redirectUrl = data.data.redirectUrl;
      
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
      setError(err.message || 'An error occurred');
      setProcessingStage('error');
      stopSubmitting();
    }
  }

  // New function to poll progress and redirect when complete
  const pollProgressAndRedirect = async (summaryId: string, redirectUrl: string) => {
    console.log('🔄 Starting polling for summaryId:', summaryId);
    let pollCount = 0;
    const maxPolls = 120; // Increased to 6 minutes of polling (3 seconds * 120)
    
    const poll = async () => {
      pollCount++;
      console.log(`🔄 Poll attempt ${pollCount}/${maxPolls} for summaryId:`, summaryId);
      
      try {
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        console.log(`📡 Status API response:`, response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📊 Status data received:`, data);
        
        // Update progress UI with better mapping
        const stage = data.processing_stage || data.processing_status || 'pending';
        let progress = data.processing_progress || 0;
        
        // Ensure minimum progress for better UX and smooth transitions
        if (progress === 0 || progress < 5) {
          switch (stage) {
            case 'pending':
            case 'queued':
              progress = Math.max(10, progress);
              break;
            case 'transcribing':
            case 'extracting':
              progress = Math.max(25, progress);
              break;
            case 'summarizing':
            case 'analyzing':
              progress = Math.max(65, progress);
              break;
            case 'finalizing':
              progress = Math.max(90, progress);
              break;
            case 'completed':
              progress = 100;
              break;
            default:
              progress = Math.max(8, progress);
          }
        }
        
        // Ensure progress is reasonable for current stage
        switch (stage) {
          case 'transcribing':
          case 'extracting':
            progress = Math.min(Math.max(20, progress), 59);
            break;
          case 'summarizing':
          case 'analyzing':
            progress = Math.min(Math.max(60, progress), 89);
            break;
          case 'finalizing':
            progress = Math.min(Math.max(90, progress), 99);
            break;
          case 'completed':
            progress = 100;
            break;
        }
        
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
          
          // Redirect after showing completion
          setTimeout(() => {
            router.push(redirectUrl);
          }, 1500);
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
        
        // Continue polling if not complete and under max polls
        if (pollCount < maxPolls) {
          console.log(`⏳ Scheduling next poll in 2 seconds (attempt ${pollCount + 1})`);
          setTimeout(poll, 2000); // Poll every 2 seconds (more aggressive)
        } else {
          // Max polls reached - redirect anyway
          console.log('⏰ Max polls reached, redirecting anyway');
          setStatusMessage("Taking longer than expected. Redirecting...");
          setTimeout(() => {
            router.push(redirectUrl);
          }, 2000);
        }
        
      } catch (error) {
        console.error('❌ Polling error:', error);
        // On polling error, still try to redirect after a delay
        setStatusMessage("Checking status... Redirecting shortly...");
        setTimeout(() => {
          router.push(redirectUrl);
        }, 3000);
      }
    };
    
    // Start polling immediately (no delay)
    console.log('🚀 Starting immediate poll');
    poll();
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
    <div className="flex flex-col items-center justify-center w-full min-h-screen px-4 py-4 sm:py-8 md:py-12 max-w-6xl mx-auto">
      {/* Main Header with Title */}
      <MainHeader />
      
      {/* Main Content Area */}
      <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-6 mb-4 sm:mb-8">
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
        
        {/* Video Thumbnail Preview */}
        {thumbnailUrl && !error && (
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
      
      {/* Processing Status */}
      {isProcessing && processingStage !== 'idle' && (
        <div className="w-full max-w-4xl mx-auto mt-4 sm:mt-6 px-2 sm:px-0">
          <ProcessingStatus 
            stage={processingStage as 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error'}
            progress={progress}
            message={statusMessage}
          />
        </div>
      )}
    </div>
  );
}
