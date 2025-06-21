import axios from 'axios';
import { TRANSCRIPT_CONFIG } from './transcript-config';
import { createLogger } from './logger';
import { getCacheManager } from './cache';
const logger = createLogger('youtube');
const cacheManager = getCacheManager();

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: string;
  thumbnailUrl: string;
  channelTitle: string;
  viewCount: string;
  publishDate: string;
}

export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)?)([\w-]{11})/);
  return match ? match[1] : null;
}

export function extractVideoId(url: string): string | null {
  // Handle all YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export async function getVideoMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    logger.info('Fetching video metadata from YouTube Data API...');
    
    // First try to get metadata from YouTube Data API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`
      );

      if (response.data.items && response.data.items.length > 0) {
        const video = response.data.items[0];
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;
        const statistics = video.statistics;

        // Convert ISO 8601 duration to readable format
        const duration = contentDetails.duration
          .replace('PT', '')
          .replace('H', ':')
          .replace('M', ':')
          .replace('S', '')
          .split(':')
          .map((part: string) => part.padStart(2, '0'))
          .join(':');

        return {
          videoId,
          title: snippet.title,
          description: snippet.description,
          duration,
          thumbnailUrl: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url,
          channelTitle: snippet.channelTitle,
          viewCount: statistics.viewCount,
          publishDate: new Date(snippet.publishedAt).toLocaleDateString()
        };
      }
    }

    // Fallback to scraping if API key is not available
    logger.info('Falling back to scraping metadata...');
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
    const html = response.data;
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Title';
    
    // Extract description
    const descMatch = html.match(/"description":{"simpleText":"([^"]+)"/);
    const description = descMatch ? descMatch[1] : 'No description available';
    
    // Extract channel name
    const channelMatch = html.match(/"channelName":"([^"]+)"/);
    const channelTitle = channelMatch ? channelMatch[1] : 'Unknown Channel';

    return {
      videoId,
      title,
      description,
      duration: 'Unknown',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelTitle,
      viewCount: 'Unknown',
      publishDate: 'Unknown'
    };
  } catch (error) {
    logger.error('Error fetching video metadata:', { data: { error } });
    throw new Error('Failed to fetch video metadata');
  }
}

// Helper function to sleep for a given duration
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to calculate retry delay with exponential backoff
function getRetryDelay(attempt: number): number {
  const delay = TRANSCRIPT_CONFIG.initialRetryDelay * Math.pow(2, attempt);
  return Math.min(delay, TRANSCRIPT_CONFIG.maxRetryDelay);
}

// After fetching transcript items, ensure all have valid numeric start
const fixTranscript = (items: TranscriptItem[]): TranscriptItem[] =>
  items.map((item, index) => {
    // Preserve original start time if it's valid, otherwise estimate based on index
    let start = typeof item.start === 'number' && !isNaN(item.start) ? item.start : 0;
    
    // If start is 0 but this isn't the first item, estimate based on previous items
    if (start === 0 && index > 0) {
      // Estimate 3 seconds per transcript segment if start time is missing
      start = index * 3;
    }
    
    return {
      ...item,
      start: start
    };
  });

// Helper to construct full YouTube URL from videoId
function getYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Helper to check if error is an AxiosError
function isAxiosError(error: any): error is { message: string; response?: { status: number; data: any } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof error.message === 'string' &&
    (error.response === undefined || typeof error.response === 'object')
  );
}

// Production-ready transcript fetching using SupaData.ai API
export async function getVideoTranscript(videoId: string): Promise<TranscriptItem[]> {
  logger.info(`[Transcript] Starting transcript fetch for video: ${videoId}`);
  if (!TRANSCRIPT_CONFIG.supadataApiKey) {
    throw new Error('SUPADATA_API_KEY is not configured in environment variables.');
  }

  // Check cache first using the central CacheManager
  if (TRANSCRIPT_CONFIG.cacheEnabled) {
    const cached = cacheManager.getCachedYouTubeTranscript(videoId);
    if (cached) {
      logger.info(`[Transcript] ✅ Central Cache hit for video: ${videoId}`);
      return fixTranscript(cached);
    }
  }

  let lastError: any = null;
  const youtubeUrl = getYouTubeUrl(videoId);
  const params = {
    url: youtubeUrl,
    text: true
  };
  const headers = {
    'x-api-key': TRANSCRIPT_CONFIG.supadataApiKey,
    'User-Agent': 'TubeGPT/1.0',
    'Accept': 'application/json',
  };
  const maskedKey = TRANSCRIPT_CONFIG.supadataApiKey ? TRANSCRIPT_CONFIG.supadataApiKey.slice(0, 2) + '***' + TRANSCRIPT_CONFIG.supadataApiKey.slice(-2) : undefined;
  const url = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(youtubeUrl)}&text=true`;

  for (let attempt = 0; attempt < TRANSCRIPT_CONFIG.maxRetries; attempt++) {
    try {
      logger.info(`[Transcript] SupaData.ai API attempt ${attempt + 1}/${TRANSCRIPT_CONFIG.maxRetries}`);
      logger.info('[Transcript] SupaData.ai request details', {
        endpoint: 'https://api.supadata.ai/v1/youtube/transcript',
        params,
        headers: { ...headers, 'x-api-key': maskedKey },
        videoId,
        youtubeUrl
      });
      logger.info('[Transcript] SupaData.ai full request URL', { url });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), TRANSCRIPT_CONFIG.timeoutMs)
      );
      const fetchPromise = axios.get('https://api.supadata.ai/v1/youtube/transcript', {
        params,
        headers,
        timeout: TRANSCRIPT_CONFIG.timeoutMs,
      });
      let response;
      try {
        response = await Promise.race([fetchPromise, timeoutPromise]) as any;
      } catch (err) {
        logger.error('[Transcript] SupaData.ai request error', {
          error: isAxiosError(err) ? err.message : String(err),
          data: isAxiosError(err) ? err.response?.data : undefined,
          request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl }
        });
        throw err;
      }
      logger.info('[Transcript] SupaData.ai response', { status: response.status, data: response.data, request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl } });
      if (response.data && typeof response.data.content === 'string' && response.data.content.length > 0) {
        logger.info(`[Transcript] ✅ SUCCESS with SupaData.ai API on attempt ${attempt + 1}`);
        // Split transcript into segments by line or sentence for downstream compatibility
        const transcript: TranscriptItem[] = response.data.content
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .map((text: string, idx: number) => ({
            text: text.trim(),
            start: idx * 3, // Estimate 3s per segment (no timing info in plain text)
            duration: 3
          }));
        // Cache the result using the central CacheManager
        if (TRANSCRIPT_CONFIG.cacheEnabled) {
          cacheManager.cacheYouTubeTranscript(videoId, transcript);
        }
        return fixTranscript(transcript);
      }
      lastError = new Error(response.data?.error || 'No transcript returned from SupaData.ai service');
      logger.error('[Transcript] SupaData.ai API error response', { status: response.status, data: response.data, request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl } });
    } catch (error) {
      lastError = error;
      if (isAxiosError(error)) {
        logger.warn(`[Transcript] SupaData.ai API failed (attempt ${attempt + 1}):`, { error: error.message, request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl } });
        if (error.response) {
          logger.error('[Transcript] SupaData.ai error response', { status: error.response.status, data: error.response.data, request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl } });
        }
      } else {
        logger.warn(`[Transcript] SupaData.ai API failed (attempt ${attempt + 1}):`, { error: String(error), request: { url, params, headers: { ...headers, 'x-api-key': maskedKey }, videoId, youtubeUrl } });
      }
      if (attempt < TRANSCRIPT_CONFIG.maxRetries - 1) {
        const delay = getRetryDelay(attempt);
        logger.info(`[Transcript] Retrying in ${delay}ms...`, { delay });
        await sleep(delay);
      }
    }
  }
  // If all attempts fail, provide a clear error message
  const errorMessage = `Failed to fetch video transcript after ${TRANSCRIPT_CONFIG.maxRetries} attempts. Error: ${lastError?.message || 'Unknown error'}`;
  logger.error('[Transcript] Complete failure:', { data: { errorMessage } });
  throw new Error(errorMessage);
}

export function formatTranscriptByMinutes(transcript: TranscriptItem[], chunkDuration: number = 60): string {
  if (!transcript || transcript.length === 0) return '';

  logger.debug(`[Transcript] Formatting ${transcript.length} segments into ${chunkDuration}s chunks`);
  logger.debug(`[Transcript] First few segments: ${JSON.stringify(transcript.slice(0, 3).map(item => `[${item.start}s] ${item.text.substring(0, 50)}...`))}`);

  // Group transcript text by chunk intervals (default: 60s)
  const chunks: Record<number, string[]> = {};
  for (const item of transcript) {
    const start = typeof item.start === 'number' && !isNaN(item.start) ? item.start : 0;
    const chunkIndex = Math.floor(start / chunkDuration);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(item.text.trim());
  }

  logger.debug(`[Transcript] Created ${Object.keys(chunks).length} chunks: ${JSON.stringify(Object.keys(chunks).map(key => `chunk ${key}: ${chunks[parseInt(key)].length} segments`))}`);

  // Format and print each chunk nicely
  const formattedBlocks = Object.entries(chunks)
    .map(([index, texts]) => {
      const startMin = parseInt(index, 10);
      const endMin = startMin + 1;
      return `=== Transcript from ${startMin} to ${endMin} minutes ===\n${texts.join(' ')}`;
    })
    .sort((a, b) => {
      // Sort by the numeric chunk index
      const aIdx = parseInt(a.match(/from (\d+) to/)?.[1] || '0', 10);
      const bIdx = parseInt(b.match(/from (\d+) to/)?.[1] || '0', 10);
      return aIdx - bIdx;
    });

  logger.debug(`[Transcript] Final formatted blocks: ${formattedBlocks.length} chunks`);
  return formattedBlocks.join('\n\n');
}
