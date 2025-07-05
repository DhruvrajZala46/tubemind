'use client';

import React, { Suspense } from 'react';
import { KnowledgeExtraction } from '../lib/openai';
import { Clock } from 'lucide-react';
const ReactMarkdown = React.lazy(() => import('react-markdown'));
import { ChatGPTMarkdown } from './Dashboard/VideoSummary';

interface KnowledgeDisplayProps {
  data: KnowledgeExtraction;
  videoTitle: string;
  thumbnailUrl: string;
  rawAIOutput?: string;
}

export default function KnowledgeDisplay({ data, videoTitle, thumbnailUrl, rawAIOutput }: KnowledgeDisplayProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Video Header */}
      <div className="flex gap-4 items-center bg-[#303030] border border-[#3A3A3A] rounded-lg p-6">
        <img 
          src={thumbnailUrl} 
          alt={videoTitle}
          className="w-28 h-20 object-cover rounded-lg border border-[#3A3A3A]"
        />
        <div className="flex-1">
          <h1 className="text-xl font-medium text-[#FFFFFF] mb-1 font-sans">{data.mainTitle}</h1>
          <p className="text-sm text-[#C4C4C4] font-sans mb-2">{data.overallSummary}</p>
          <span className="inline-flex items-center gap-1 text-xs text-[#C4C4C4] bg-[#2D2D2D] border border-[#3A3A3A] rounded-full px-3 py-1 font-medium">
            <Clock className="w-4 h-4 mr-1" />
            {/* Segments count removed as it's not needed for raw summary */}
          </span>
        </div>
      </div>
      {/* Raw AI Output as Main Summary */}
      {rawAIOutput && (
        <div className="bg-[#303030] border border-[#3A3A3A] text-[#FFFFFF] rounded-lg p-6 w-full text-sm">
          <ChatGPTMarkdown markdown={rawAIOutput} />
        </div>
      )}
    </div>
  );
}

// Add a new component for processing status with PerplexityLoader
'use client';

import { useState, useEffect } from 'react';
import { PerplexityLoader, ProcessingStage } from './ui/perplexity-loader';

interface ProcessingStatusDisplayProps {
  videoId: string;
  summaryId: string;
  initialStatus?: string;
}

export function ProcessingStatusDisplay({ videoId, summaryId, initialStatus }: ProcessingStatusDisplayProps) {
  const [status, setStatus] = useState<string>(initialStatus || 'pending');
  const [stage, setStage] = useState<string>(initialStatus || 'pending');
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!summaryId) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true; // Track if component is still mounted

    const pollStatus = async () => {
      // Don't poll if component has been unmounted
      if (!isMounted) {
        console.log('🛑 ProcessingStatusDisplay: Component unmounted, stopping poll');
        return;
      }

      try {
        console.log('🔄 ProcessingStatusDisplay: Polling status for summaryId:', summaryId);
        const response = await fetch(`/api/summaries/${summaryId}/status`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        
        const data = await response.json();
        
        // Only update state if component is still mounted
        if (isMounted) {
          setStatus(data.processing_status);
          setStage(data.processing_stage || data.processing_status);
          setProgress(data.processing_progress || 0);
          setIsLoading(false);
          
          // CRITICAL: Only continue polling if still processing AND component is mounted
          if (data.processing_status !== 'completed' && data.processing_status !== 'failed') {
            console.log('🔄 ProcessingStatusDisplay: Scheduling next poll in 2s, status:', data.processing_status);
            timeoutId = setTimeout(pollStatus, 2000);
          } else {
            console.log('✅ ProcessingStatusDisplay: Processing complete, stopping polls. Status:', data.processing_status);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ ProcessingStatusDisplay: Error polling status:', err);
          
          // CRITICAL FIX: Don't show errors for abort/timeout issues
          const isAbortError = err instanceof Error && 
            (err.name === 'AbortError' || 
             err.message.includes('aborted') || 
             err.message.includes('timeout') ||
             err.message.includes('fetch'));
          
          if (!isAbortError) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsLoading(false);
          } else {
            // For abort errors, just continue polling silently
            console.log('⏳ ProcessingStatusDisplay: Fetch aborted, continuing...');
            timeoutId = setTimeout(pollStatus, 2000);
          }
        }
      }
    };

    // Start initial poll
    pollStatus();

    // CRITICAL: Cleanup function
    return () => {
      console.log('🧹 ProcessingStatusDisplay: Cleaning up - clearing timeout and marking unmounted');
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [summaryId]);

  // Map API status to component status
  function mapApiStatusToComponentStage(status: string): ProcessingStage {
    // Direct mapping for known statuses
    if (status === 'transcribing' || status === 'extracting') return 'transcribing';
    if (status === 'summarizing' || status === 'analyzing') return 'summarizing';
    if (status === 'finalizing') return 'finalizing';
    if (status === 'completed' || status === 'complete') return 'completed';
    if (status === 'failed' || status === 'error') return 'failed';
    
    // Default to pending for any other status
    return 'pending';
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-300">Error: {error}</p>
      </div>
    );
  }

  // Show the loader while processing
  if (isLoading || status !== 'completed') {
    return (
      <PerplexityLoader 
        currentStage={mapApiStatusToComponentStage(stage)}
        progress={progress}
        showProgress={true}
        showAnimatedText={true}
      />
    );
  }

  // If completed, the parent component should render the actual content
  return null;
}
