"use client";
import React, { useState } from "react";

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)?)([\w-]{11})/);
  return match ? match[1] : null;
}

export default function DashboardVideoInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
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

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <form className="flex flex-col items-center w-full" autoComplete="off" onSubmit={e => e.preventDefault()}>
        <div className="flex w-full">
          <input
            type="text"
            value={url}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="Enter YouTube video URL to summarize..."
            className="w-full bg-[#21262D] border border-[#30363D] rounded-[8px] px-4 py-3 text-[#F0F6FC] placeholder-[#8B949E] focus:border-[#58A6FF] focus:ring-2 focus:ring-[#58A6FF]/30 transition-colors text-[16px] font-normal font-sans outline-none"
          />
          <button
            type="submit"
            className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white px-6 py-2 rounded-lg ml-3 transition-colors font-medium text-[14px] font-sans border-none"
            disabled={!!error || !url.trim()}
          >
            Summarize
          </button>
        </div>
        {error && touched && (
          <div className="text-[#DC143C] font-medium text-xs mt-2 min-h-[20px] w-full text-left px-1 font-sans">
            {error}
          </div>
        )}
      </form>
      {thumbnail && !error && (
        <div className="mt-4 p-4 bg-[#21262D] rounded-[8px] border border-[#30363D] flex flex-col items-center">
          <img src={thumbnail} alt="Video thumbnail" className="w-80 h-44 rounded-lg object-cover mb-2" />
        </div>
      )}
    </div>
  );
} 