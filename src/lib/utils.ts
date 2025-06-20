import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/, 
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=.+/, 
    /^https?:\/\/youtu\.be\/.+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

// Utility functions
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Format number in compact form (e.g., 1.2K, 3.4M)
export const formatCompactNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Format duration from seconds to MM:SS or HH:MM:SS
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Format date string to readable format
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export function randomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error("Min must be less than or equal to max");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Converts a time string (e.g., "MM:SS" or "HH:MM:SS") to seconds.
 * @param time The time string.
 * @returns The total number of seconds.
 */
export function timeToSeconds(time: string): number {
  if (!time || typeof time !== 'string' || !time.includes(':')) {
    return 0;
  }

  const parts = time.split(':').map(part => parseInt(part, 10));

  if (parts.some(isNaN)) {
    return 0; // Handle cases where parsing fails, e.g., "12:ab"
  }
  
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0; // Default fallback for invalid formats
}
