import React from 'react';
import Image from 'next/image';
import { Progress } from '../ui/progress';

interface VideoInfoCardProps {
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration: number;
  viewCount: number;
  publishDate: string;
}

export default function VideoInfoCard({
  title,
  description,
  thumbnailUrl,
  channelTitle,
  duration,
  viewCount,
  publishDate
}: VideoInfoCardProps) {
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format view count
  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
  };

  // Format publish date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:p-6">
        {/* Thumbnail - Mobile optimized */}
        <div className="w-full lg:w-1/2 relative aspect-video">
          <Image
            src={thumbnailUrl || '/placeholder-thumbnail.jpg'}
            alt={title}
            fill
            className="object-cover rounded-lg"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>
        
        {/* Content - Mobile optimized */}
        <div className="w-full lg:w-1/2 space-y-3 lg:space-y-4">
          {/* Title - Responsive sizing */}
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--text-primary)] leading-tight">{title}</h1>
          
          {/* Meta info - Mobile responsive */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-sm lg:text-base text-[var(--text-secondary)]">
            <span className="font-medium">{channelTitle}</span>
            <span className="hidden sm:inline">•</span>
            <span>{formatViewCount(viewCount)}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-xs lg:text-sm">{formatDate(publishDate)}</span>
          </div>
          
          {/* Duration progress - Mobile optimized */}
          <div className="flex items-center gap-3">
            <Progress value={100} className="flex-1 h-2" />
            <span className="text-sm text-[var(--text-secondary)] font-mono">{formatDuration(duration)}</span>
          </div>
          
          {/* Description - Mobile responsive */}
          <p className="text-sm lg:text-base text-[var(--text-primary)] line-clamp-2 lg:line-clamp-3 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
} 
