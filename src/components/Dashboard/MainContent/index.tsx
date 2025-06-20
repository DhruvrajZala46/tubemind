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

type ProcessingStage = 'idle' | 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';

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
      
      // Show success toast
      toast.success("Video submitted successfully! Redirecting...");

      // Redirect to the summary page
      if (data.data.redirectUrl) {
          router.push(data.data.redirectUrl);
      } else {
          router.push('/dashboard'); // fallback route if no redirectUrl
      }
    }
    catch (err: any) {
      setError(err.message || 'An error occurred');
      setProcessingStage('error');
      stopSubmitting();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full px-4 py-8 md:py-12 max-w-6xl mx-auto">
      {/* Main Header with Title */}
      <MainHeader />
      
      {/* Main Content Area */}
      <div className="w-full max-w-3xl mx-auto mt-6 mb-8">
        {/* Video Input Section - Clean and minimal */}
        <div className="w-full bg-[#161B22] rounded-xl p-6 border border-[#30363D] shadow-lg">
          {/* Video URL Input */}
          <form className="flex flex-col items-center w-full" autoComplete="off" onSubmit={(e) => {
            e.preventDefault();
            if (input && !error) handleProcess(input);
          }}>
            <div className="flex w-full">
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
                className="w-full bg-[#21262D] border border-[#30363D] rounded-[8px] px-4 py-3 text-[#F0F6FC] placeholder-[#8B949E] focus:border-[#58A6FF] focus:ring-2 focus:ring-[#58A6FF]/30 transition-colors text-[16px] font-normal font-sans outline-none"
              />
              <button
                type="submit"
                className="bg-[#FF0033] hover:bg-[#FF0033]/90 text-white px-6 py-2 rounded-lg ml-3 transition-colors font-medium text-[14px] font-sans border-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                disabled={!!error || !input.trim() || isSubmitting}
              >
                {isSubmitting ? <ElegantLoader size="sm" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>
            {error && touched && (
              <div className="text-[#FF0033] font-medium text-xs mt-2 min-h-[20px] w-full text-left px-1 font-sans">
                {error}
              </div>
            )}
          </form>
          
          {/* Video Thumbnail Preview */}
          {thumbnailUrl && !error && (
            <div className="mt-4 p-4 bg-[#21262D] rounded-[8px] border border-[#30363D] flex flex-col items-center">
              <img src={thumbnailUrl} alt="Video thumbnail" className="w-80 h-44 rounded-lg object-cover mb-2" />
            </div>
          )}
        </div>
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
        <div className="w-full max-w-3xl mx-auto mt-6">
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