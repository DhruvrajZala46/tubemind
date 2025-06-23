"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = exports.formatDuration = exports.formatCompactNumber = exports.formatTime = void 0;
exports.cn = cn;
exports.isValidYouTubeUrl = isValidYouTubeUrl;
exports.randomInt = randomInt;
exports.timeToSeconds = timeToSeconds;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=.+/,
        /^https?:\/\/youtu\.be\/.+/
    ];
    return patterns.some(pattern => pattern.test(url));
}
// Utility functions
const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
exports.formatTime = formatTime;
// Format number in compact form (e.g., 1.2K, 3.4M)
const formatCompactNumber = (num) => {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
};
exports.formatCompactNumber = formatCompactNumber;
// Format duration from seconds to MM:SS or HH:MM:SS
const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
exports.formatDuration = formatDuration;
// Format date string to readable format
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};
exports.formatDate = formatDate;
function randomInt(min, max) {
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
function timeToSeconds(time) {
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
