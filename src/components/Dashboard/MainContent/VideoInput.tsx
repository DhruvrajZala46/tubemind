"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)?)([\w-]{11})/);
  return match ? match[1] : null;
}

export default function DashboardVideoInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const videoId = extractYouTubeId(url);
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  // Entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
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
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (error || !url.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unexpected error occurred.');
      }

      // On success (202 Accepted), the API returns a summaryId.
      // We redirect the user to the summary page where it will poll for the result.
      if (result.summaryId) {
        router.push(`/dashboard/${result.summaryId}`);
      } else {
        // This case might happen if the video was already processed.
        // The API might return a different structure. Let's handle it.
        if (result.videoId) {
           router.push(`/dashboard/${result.videoId}`);
        } else {
           throw new Error('Could not retrieve summary ID.');
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn(
      "w-full max-w-3xl mx-auto mb-8 transition-all duration-500 transform",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <form className="flex flex-col items-center w-full" autoComplete="off" onSubmit={handleSubmit}>
        <div className="flex w-full relative">
          <input
            type="text"
            value={url}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="Enter YouTube video URL to summarize..."
            className={cn(
              "w-full bg-[#303030]/80 backdrop-blur-md border border-[#3A3A3A] rounded-[8px]",
              "px-4 py-3 text-[#FFFFFF] placeholder-[#C4C4C4]",
              "focus:border-[#58A6FF] focus:ring-2 focus:ring-[#58A6FF]/30",
              "transition-all duration-300 text-[16px] font-normal font-sans outline-none",
              "hover:bg-[#303030] hover:border-[#4A4A4A]",
              "shadow-inner shadow-black/10"
            )}
          />
          <button
            type="submit"
            className={cn(
              "bg-gradient-to-r from-[#DC143C] to-[#DC143C]/90 text-white",
              "px-6 py-2 rounded-lg ml-3 font-medium text-[14px] font-sans border-none",
              "transition-all duration-300 hover:shadow-lg hover:shadow-[#DC143C]/20",
              "hover:scale-[1.02] active:scale-[0.98]",
              "disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed",
              isSubmitting && "relative overflow-hidden"
            )}
            disabled={!!error || !url.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="opacity-0">Summarize</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce-delay-1"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce-delay-2"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce-delay-3"></div>
                  </div>
                </div>
              </>
            ) : 'Summarize'}
          </button>
        </div>
        {error && touched && (
          <div className="text-[#DC143C] font-medium text-xs mt-2 min-h-[20px] w-full text-left px-1 font-sans animate-fade-in">
            {error}
          </div>
        )}
      </form>
      {thumbnail && !error && (
        <div className={cn(
          "mt-4 p-4 bg-[#303030]/80 backdrop-blur-md rounded-[8px]",
          "border border-[#3A3A3A] flex flex-col items-center",
          "transition-all duration-500 transform hover:shadow-lg",
          "hover:border-[#4A4A4A]",
          "animate-fade-in"
        )}>
          <div className="relative w-80 h-44 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10"></div>
            <img 
              src={thumbnail} 
              alt="Video thumbnail" 
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
            />
            <div className="absolute bottom-2 left-2 z-20 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-medium">
              Preview
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
