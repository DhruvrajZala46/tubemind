'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Youtube, CheckCircle, Download, ExternalLink } from 'lucide-react';

// 🎯 Phase 3 UI Components
import { 
  LoadingOverlay, 
  useLoadingState
} from './ui/loading-states';
import { 
  ProgressTracker, 
  useProgressTracker,
  VIDEO_PROCESSING_STAGES
} from './ui/progress-tracker';
import { 
  ErrorMessage, 
  useErrorHandler,
  classifyError 
} from './ui/error-messages';
import {
  ResponsiveContainer,
  MobileCard,
  MobileInput,
  MobileButton,
  useBreakpoint
} from './ui/mobile-responsive';
import { 
  useRetry, 
  RetryButton, 
  RetryStatus,
  RETRY_CONFIGS 
} from './ui/retry-mechanisms';

interface VideoExtractorProps {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const VideoExtractor: React.FC<VideoExtractorProps> = ({
  onSuccess,
  onError,
  className
}) => {
  // 🎯 State Management
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  
  // 🎯 Phase 3 Hooks
  const { isMobile } = useBreakpoint();
  const loadingState = useLoadingState('video-processing');
  const progressTracker = useProgressTracker(VIDEO_PROCESSING_STAGES);
  const errorHandler = useErrorHandler();
  
  // 🎯 Enhanced Retry Logic
  const retryHook = useRetry(
    async (videoUrl: string) => {
      // Simulate video processing with progress updates
      progressTracker.updateStage('validation', 0);
      loadingState.startLoading('video-processing', 'Validating video accessibility...');
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });
      
      progressTracker.updateStage('validation', 100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }
      
      progressTracker.updateStage('transcript', 50);
      loadingState.updateProgress(50);
      
      // Simulate transcript extraction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      progressTracker.updateStage('transcript', 100);
      progressTracker.updateStage('ai-analysis', 25);
      loadingState.updateProgress(75);
      
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      progressTracker.updateStage('ai-analysis', 100);
      progressTracker.updateStage('saving', 50);
      loadingState.updateProgress(95);
      
      const data = await response.json();
      
      progressTracker.updateStage('saving', 100);
      progressTracker.completeProcessing();
      loadingState.stopLoading();
      
      return data;
    },
    RETRY_CONFIGS.processing
  );

  // 🎯 Enhanced Submit Handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      errorHandler.handleError('Please enter a YouTube URL', 'validation');
      return;
    }

    try {
      errorHandler.clearError();
      progressTracker.reset();
      
      const data = await retryHook.execute(url.trim());
      
      setResult(data);
      if (onSuccess) onSuccess(data);
      
    } catch (error) {
      const err = error as Error;
      const errorType = classifyError(err);
      
      errorHandler.handleError(err, errorType);
      progressTracker.setError(err.message);
      
      if (onError) onError(err);
    }
  }, [url, retryHook, errorHandler, progressTracker, onSuccess, onError]);

  // 🎯 Mobile-First Layout
  if (isMobile) {
    return (
      <ResponsiveContainer maxWidth="full" padding="sm" className={className}>
        <MobileCard
          title="🎬 Video Extractor"
          subtitle="Extract insights from any YouTube video"
          className="w-full"
        >
          {/* URL Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <MobileInput
              type="url"
              placeholder="Paste YouTube URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              icon={<Youtube size={20} />}
              label="YouTube URL"
              error={errorHandler.currentError?.type === 'validation' ? 'Please enter a valid YouTube URL' : undefined}
            />
            
            <MobileButton
              type="submit"
              fullWidth
              loading={loadingState.isLoading}
              disabled={!url.trim() || loadingState.isLoading}
              size="lg"
            >
              {loadingState.isLoading ? 'Processing...' : 'Extract Video Insights'}
            </MobileButton>
          </form>
          
          {/* Error Display */}
          {errorHandler.currentError && (
            <div className="mt-4">
              <ErrorMessage
                error={errorHandler.currentError.error}
                type={errorHandler.currentError.type}
                onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                compact={true}
                className="w-full"
              />
            </div>
          )}
          
          {/* Progress Display */}
          {(loadingState.isLoading || progressTracker.progressState.overallProgress > 0) && (
            <div className="mt-4">
              <ProgressTracker
                stages={VIDEO_PROCESSING_STAGES}
                currentState={progressTracker.progressState}
                compact={true}
                showDetailedSteps={false}
              />
            </div>
          )}
          
          {/* Retry Status */}
          {retryHook.isRetrying && (
            <div className="mt-4">
              <RetryStatus
                retryState={{
                  attempt: retryHook.attempt,
                  isRetrying: retryHook.isRetrying,
                  lastError: retryHook.lastError,
                  nextRetryIn: retryHook.nextRetryIn,
                  hasGivenUp: retryHook.hasGivenUp
                }}
                config={RETRY_CONFIGS.processing}
                showDetails={false}
              />
            </div>
          )}
          
          {/* Results */}
          {result && (
            <div className="mt-6">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="text-green-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Processing Complete!
                </h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Title:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{result.video?.title}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Summary:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{result.summary?.summary}</p>
                </div>
                
                <div className="flex space-x-2 pt-3">
                  <MobileButton
                    variant="outline"
                    size="sm"
                    icon={<ExternalLink size={16} />}
                    onClick={() => window.open(`/dashboard/video/${result.video?.id}`, '_blank')}
                  >
                    View Details
                  </MobileButton>
                  
                  <MobileButton
                    variant="outline"
                    size="sm"
                    icon={<Download size={16} />}
                    onClick={() => {
                      // Implement download functionality
                    }}
                  >
                    Export
                  </MobileButton>
                </div>
              </div>
            </div>
          )}
        </MobileCard>
        
        {/* Loading Overlay for Processing */}
        <LoadingOverlay
          visible={loadingState.isLoading}
          type={loadingState.loadingType}
          showProgress={true}
          progress={progressTracker.progressState.overallProgress}
        />
      </ResponsiveContainer>
    );
  }

  // 🎯 Desktop Layout
  return (
    <ResponsiveContainer maxWidth="lg" className={className}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Youtube className="text-white" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-white">Video Extractor</h2>
              <p className="text-blue-100 text-sm">Extract insights from any YouTube video in seconds</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* URL Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                YouTube URL
              </label>
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Youtube className="text-gray-400" size={20} />
                  </div>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loadingState.isLoading}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!url.trim() || loadingState.isLoading}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingState.isLoading ? 'Processing...' : 'Extract'}
                </button>
              </div>
              
              {errorHandler.currentError?.type === 'validation' && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Please enter a valid YouTube URL
                </p>
              )}
            </div>
          </form>
          
          {/* Error Display */}
          {errorHandler.currentError && errorHandler.currentError.type !== 'validation' && (
            <ErrorMessage
              error={errorHandler.currentError.error}
              type={errorHandler.currentError.type}
              onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
              onContactSupport={() => window.open('mailto:support@tubemind.com', '_blank')}
            />
          )}
          
          {/* Progress Tracking */}
          {(loadingState.isLoading || progressTracker.progressState.overallProgress > 0) && (
            <ProgressTracker
              stages={VIDEO_PROCESSING_STAGES}
              currentState={progressTracker.progressState}
              showTimeRemaining={true}
              showDetailedSteps={true}
            />
          )}
          
          {/* Retry Status */}
          {retryHook.isRetrying && (
            <RetryStatus
              retryState={{
                attempt: retryHook.attempt,
                isRetrying: retryHook.isRetrying,
                lastError: retryHook.lastError,
                nextRetryIn: retryHook.nextRetryIn,
                hasGivenUp: retryHook.hasGivenUp
              }}
              config={RETRY_CONFIGS.processing}
              showDetails={true}
            />
          )}
          
          {/* Results Display */}
          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <CheckCircle className="text-green-500 flex-shrink-0 mt-1" size={24} />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
                    Video Processed Successfully! 🎉
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">Video Details</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Title:</span>
                          <p className="text-green-600 dark:text-green-400 mt-1">{result.video?.title}</p>
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span>
                          <span className="ml-2 text-green-600 dark:text-green-400">{result.video?.duration}</span>
                        </div>
                        <div>
                          <span className="font-medium">Channel:</span>
                          <span className="ml-2 text-green-600 dark:text-green-400">{result.video?.channelTitle}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">AI Summary</h4>
                      <p className="text-sm text-green-600 dark:text-green-400 line-clamp-4">
                        {result.summary?.summary}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={() => window.open(`/dashboard/video/${result.video?.id}`, '_blank')}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <ExternalLink size={16} />
                      <span>View Full Analysis</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        // Implement download functionality
                      }}
                      className="inline-flex items-center space-x-2 px-4 py-2 border border-green-600 text-green-600 text-sm font-medium rounded hover:bg-green-50 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <Download size={16} />
                      <span>Export Results</span>
                    </button>
                    
                    <RetryButton
                      onRetry={() => {
                        setResult(null);
                        setUrl('');
                        errorHandler.clearError();
                        progressTracker.reset();
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Process Another Video
                    </RetryButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveContainer>
  );
}; 
