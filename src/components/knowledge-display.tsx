'use client';

import React, { Suspense } from 'react';
import { KnowledgeExtraction } from '../lib/openai';
import { Clock } from 'lucide-react';
const ReactMarkdown = React.lazy(() => import('react-markdown'));

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
      <div className="flex gap-4 items-center bg-[#21262D] border border-[#30363D] rounded-lg p-6">
        <img 
          src={thumbnailUrl} 
          alt={videoTitle}
          className="w-28 h-20 object-cover rounded-lg border border-[#30363D]"
        />
        <div className="flex-1">
          <h1 className="text-xl font-medium text-[#F0F6FC] mb-1 font-sans">{data.mainTitle}</h1>
          <p className="text-sm text-[#8B949E] font-sans mb-2">{data.overallSummary}</p>
          <span className="inline-flex items-center gap-1 text-xs text-[#8B949E] bg-[#161B22] border border-[#30363D] rounded-full px-3 py-1 font-medium">
            <Clock className="w-4 h-4 mr-1" />
            {/* Segments count removed as it's not needed for raw summary */}
          </span>
        </div>
      </div>
      {/* Raw AI Output as Main Summary */}
      {rawAIOutput && (
        <div className="bg-[#21262D] border border-[#30363D] text-[#F0F6FC] rounded-lg p-6 w-full text-sm">
          <Suspense fallback={<div>Loading...</div>}>
            <ReactMarkdown>{rawAIOutput}</ReactMarkdown>
          </Suspense>
        </div>
      )}
    </div>
  );
}
