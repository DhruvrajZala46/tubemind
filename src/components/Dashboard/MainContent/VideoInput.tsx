"use client";
import React, { useState } from "react";
import { useRouter } from 'next/navigation';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)?)([\w-]{11})/);
  return match ? match[1] : null;
}

export default function DashboardVideoInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const videoId = extractYouTubeId(url);
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

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
    <div className="w-full max-w-3xl mx-auto mb-8">
      <form className="flex flex-col items-center w-full" autoComplete="off" onSubmit={handleSubmit}>
        <div className="flex w-full">
          <input
            type="text"
            value={url}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="Enter YouTube video URL to summarize..."
            className="w-full bg-[#303030] border border-[#3A3A3A] rounded-[8px] px-4 py-3 text-[#FFFFFF] placeholder-[#C4C4C4] focus:border-[#58A6FF] focus:ring-2 focus:ring-[#58A6FF]/30 transition-colors text-[16px] font-normal font-sans outline-none"
          />
          <button
            type="submit"
            className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white px-6 py-2 rounded-lg ml-3 transition-colors font-medium text-[14px] font-sans border-none"
            disabled={!!error || !url.trim() || isSubmitting}
          >
            {isSubmitting ? 'Starting...' : 'Summarize'}
          </button>
        </div>
        {error && touched && (
          <div className="text-[#DC143C] font-medium text-xs mt-2 min-h-[20px] w-full text-left px-1 font-sans">
            {error}
          </div>
        )}
      </form>
      {thumbnail && !error && (
        <div className="mt-4 p-4 bg-[#303030] rounded-[8px] border border-[#3A3A3A] flex flex-col items-center">
          <img src={thumbnail} alt="Video thumbnail" className="w-80 h-44 rounded-lg object-cover mb-2" />
        </div>
      )}
    </div>
  );
} 
