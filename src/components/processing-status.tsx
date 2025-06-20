'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { ElegantLoader } from "./ui/elegant-loader";

interface ProcessingStatusProps {
  stage: 'fetching' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export default function ProcessingStatus({ stage, progress, message }: ProcessingStatusProps) {
  const getIcon = () => {
    switch (stage) {
      case 'complete':
        return <CheckCircle className="w-8 h-8 text-primary animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-[#FF0033] animate-shake" />;
      default:
        return <ElegantLoader size="lg" />;
    }
  };

  return (
    <div className="glass-card w-full max-w-2xl mx-auto p-8 flex flex-col items-center gap-6 shadow-2xl border-none">
      <div className="flex flex-col items-center gap-2">
        {getIcon()}
        <span className="text-lg font-bold text-primary tracking-wide animate-fade-in">{stage === 'error' ? 'Error' : stage === 'complete' ? 'Done!' : 'Processing Video...'}</span>
      </div>
      <div className="w-full flex flex-col gap-4">
        <Progress value={progress} className="w-full h-3 rounded-full bg-[var(--yt-dark-pill)] light:bg-[var(--yt-light-pill)]" />
        <p className="text-base text-muted text-center animate-fade-in-slow">{message}</p>
        {stage !== 'complete' && stage !== 'error' && (
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-4 w-full rounded bg-[var(--yt-dark-pill)] light:bg-[var(--yt-light-pill)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--yt-dark-pill)] light:bg-[var(--yt-light-pill)]" />
            <div className="h-4 w-1/2 rounded bg-[var(--yt-dark-pill)] light:bg-[var(--yt-light-pill)]" />
          </div>
        )}
      </div>
    </div>
  );
}
