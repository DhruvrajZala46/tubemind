import axios from 'axios';
import { TRANSCRIPT_CONFIG } from './transcript-config';
import { createLogger } from './logger';
import { getCacheManager } from './cache';
import { parseISO8601Duration, formatDuration } from './utils';
const logger = createLogger('youtube');
const cacheManager = getCacheManager();

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: string;
  durationInSeconds: number;
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
        const durationInSeconds = parseISO8601Duration(contentDetails.duration);
        const duration = formatDuration(durationInSeconds);

        return {
          videoId,
          title: snippet.title,
          description: snippet.description,
          duration,
          durationInSeconds,
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
      durationInSeconds: 0,
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
const fixTranscript = (items: TranscriptItem[], totalDurationSeconds?: number): TranscriptItem[] =>
  items.map((item, index) => {
    // Preserve original start time if it's valid, otherwise estimate based on index
    let start = typeof item.start === 'number' && !isNaN(item.start) ? item.start : 0;
    
    // If start is 0 but this isn't the first item, estimate based on position in transcript
    if (start === 0 && index > 0) {
      if (totalDurationSeconds && items.length > 0) {
        // Distribute segments evenly across actual video duration
        start = Math.floor((index / items.length) * totalDurationSeconds);
      } else {
        // Fallback: Estimate 3 seconds per transcript segment if no duration info
        start = index * 3;
      }
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
export async function getVideoTranscript(videoId: string, totalDurationSeconds?: number): Promise<TranscriptItem[]> {
  logger.info(`[Transcript] Starting transcript fetch for video: ${videoId}`);
  if (!TRANSCRIPT_CONFIG.supadataApiKey) {
    throw new Error('SUPADATA_API_KEY is not configured in environment variables.');
  }

  // Check cache first using the central CacheManager
  if (TRANSCRIPT_CONFIG.cacheEnabled) {
    const cached = cacheManager.getCachedYouTubeTranscript(videoId);
    if (cached) {
      logger.info(`[Transcript] ✅ Central Cache hit for video: ${videoId}`);
      return fixTranscript(cached, totalDurationSeconds);
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
            'User-Agent': 'TubeMind/1.0',
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
        
        // Calculate the number of segments needed to cover the video duration
        const targetSegments = totalDurationSeconds ? Math.max(Math.ceil(totalDurationSeconds / 3), 50) : 50;
        
        // Split transcript more intelligently to ensure full coverage
        let textSegments: string[];
        const content = response.data.content;
        
        // First try splitting by sentences
        const sentenceSplit = content.split(/(?<=[.!?])\s+/).filter(Boolean);
        
        if (sentenceSplit.length >= targetSegments) {
          // We have enough sentences
          textSegments = sentenceSplit;
        } else {
          // Not enough sentences, split by words to get more segments
          const words = content.split(/\s+/).filter(Boolean);
          const wordsPerSegment = Math.max(Math.floor(words.length / targetSegments), 10);
          
          textSegments = [];
          for (let i = 0; i < words.length; i += wordsPerSegment) {
            const segment = words.slice(i, i + wordsPerSegment).join(' ');
            if (segment.trim()) {
              textSegments.push(segment.trim());
            }
          }
        }
        
        logger.info(`[Transcript] Created ${textSegments.length} segments for ${totalDurationSeconds}s video (target: ${targetSegments})`);
        
        // Create transcript items with proper timing
        const transcript: TranscriptItem[] = textSegments.map((text: string, idx: number) => ({
          text: text.trim(),
          start: totalDurationSeconds ? Math.floor((idx / textSegments.length) * totalDurationSeconds) : idx * 3,
          duration: totalDurationSeconds ? Math.floor(totalDurationSeconds / textSegments.length) : 3
        }));
        
        // Cache the result using the central CacheManager
        if (TRANSCRIPT_CONFIG.cacheEnabled) {
          cacheManager.cacheYouTubeTranscript(videoId, transcript);
        }
        return fixTranscript(transcript, totalDurationSeconds);
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

export function formatTranscriptByMinutes(transcript: TranscriptItem[], chunkDuration: number = 60, totalDurationSeconds?: number): string {
  if (!transcript || transcript.length === 0) return '';

  logger.debug(`[Transcript] Formatting ${transcript.length} segments into ${chunkDuration}s chunks`);
  logger.debug(`[Transcript] Video duration: ${totalDurationSeconds ? `${totalDurationSeconds}s` : 'unknown'}`);
  logger.debug(`[Transcript] First few segments: ${JSON.stringify(transcript.slice(0, 3).map(item => `[${item.start}s] ${item.text.substring(0, 50)}...`))}`);
  logger.debug(`[Transcript] Last few segments: ${JSON.stringify(transcript.slice(-3).map(item => `[${item.start}s] ${item.text.substring(0, 50)}...`))}`);

  // If we have total duration, fix transcript timestamps to not exceed video length
  let processedTranscript = transcript;
  if (totalDurationSeconds && transcript.length > 0) {
    // Calculate proper time distribution
    const maxTimestamp = Math.max(...transcript.map(item => item.start || 0));
    
    // If timestamps exceed video duration, redistribute them proportionally
    if (maxTimestamp > totalDurationSeconds) {
      logger.warn(`[Transcript] Timestamps exceed video duration (${maxTimestamp}s > ${totalDurationSeconds}s). Redistributing...`);
      
      processedTranscript = transcript.map((item, index) => {
        // Distribute segments evenly across actual video duration
        const normalizedTime = (index / transcript.length) * totalDurationSeconds;
        return {
          ...item,
          start: Math.floor(normalizedTime)
        };
      });
      
      logger.debug(`[Transcript] Fixed timestamps to fit within ${totalDurationSeconds}s duration`);
    }
    
    // Ensure the last segment is properly placed near the end of the video
    if (processedTranscript.length > 0) {
      const lastItem = processedTranscript[processedTranscript.length - 1];
      if (lastItem.start < totalDurationSeconds - 60) {
        logger.warn(`[Transcript] Last segment timestamp (${lastItem.start}s) is far from video end (${totalDurationSeconds}s). Adjusting...`);
        processedTranscript[processedTranscript.length - 1] = {
          ...lastItem,
          start: Math.max(totalDurationSeconds - 30, 0) // Place last segment 30 seconds before end
        };
      }
    }
  }

  // Group transcript text by chunk intervals (default: 60s)
  const chunks: Record<number, string[]> = {};
  for (const item of processedTranscript) {
    const start = typeof item.start === 'number' && !isNaN(item.start) ? item.start : 0;
    const chunkIndex = Math.floor(start / chunkDuration);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(item.text.trim());
  }

  logger.debug(`[Transcript] Created ${Object.keys(chunks).length} chunks: ${JSON.stringify(Object.keys(chunks).map(key => `chunk ${key}: ${chunks[parseInt(key)].length} segments`))}`);

  // Calculate max chunk index based on actual video duration
  const maxChunkIndex = totalDurationSeconds ? Math.ceil(totalDurationSeconds / chunkDuration) - 1 : undefined;
  
  // If we're missing the last chunk but have video duration, add an empty chunk for the last minute
  if (totalDurationSeconds && maxChunkIndex !== undefined) {
    const lastChunkIndex = Math.max(...Object.keys(chunks).map(k => parseInt(k, 10)));
    if (lastChunkIndex < maxChunkIndex) {
      logger.warn(`[Transcript] Missing final chunks. Adding placeholder for complete coverage up to ${totalDurationSeconds}s`);
      for (let i = lastChunkIndex + 1; i <= maxChunkIndex; i++) {
        if (!chunks[i]) {
          chunks[i] = ["[End of video content]"];
        }
      }
    }
  }

  // Format and print each chunk nicely
  const formattedBlocks = Object.entries(chunks)
    .map(([index, texts]) => {
      const startMin = parseInt(index, 10);
      const endMin = startMin + 1;
      
      // If we have total duration, ensure we don't exceed it in the display
      const actualEndMin = totalDurationSeconds ? 
        Math.min(endMin, Math.ceil(totalDurationSeconds / 60)) : 
        endMin;
      
      return `=== Transcript from ${startMin} to ${actualEndMin} minutes ===\n${texts.join(' ')}`;
    })
    .filter(block => block !== undefined)
    .sort((a, b) => {
      // Sort by the numeric chunk index
      const aIdx = parseInt(a.match(/from (\d+) to/)?.[1] || '0', 10);
      const bIdx = parseInt(b.match(/from (\d+) to/)?.[1] || '0', 10);
      return aIdx - bIdx;
    });

  logger.debug(`[Transcript] Final formatted blocks: ${formattedBlocks.length} chunks`);
  
  // Verify we have all chunks up to the video duration
  if (totalDurationSeconds) {
    const expectedChunks = Math.ceil(totalDurationSeconds / 60);
    const actualChunks = formattedBlocks.length;
    if (actualChunks < expectedChunks) {
      logger.warn(`[Transcript] Missing chunks: expected ${expectedChunks}, got ${actualChunks}. This may cause incomplete summaries.`);
    }
  }
  
  return formattedBlocks.join('\n\n');
}
