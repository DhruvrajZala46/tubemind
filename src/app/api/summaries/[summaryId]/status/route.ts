import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../../lib/db';
import { createLogger } from '../../../../../lib/logger';
import { currentUser } from '@clerk/nextjs/server';

const logger = createLogger('api:summary-status');

// Processing stages and their estimated progress ranges
const PROCESSING_STAGES = {
  pending: { min: 0, max: 10, increment: 0.2 },
  queued: { min: 5, max: 15, increment: 0.3 },
  transcribing: { min: 15, max: 40, increment: 0.5 },
  summarizing: { min: 40, max: 85, increment: 0.4 },
  finalizing: { min: 85, max: 98, increment: 0.7 },
  completed: { min: 100, max: 100, increment: 0 }
};

// Cache for progress tracking per summary
const progressCache = new Map<string, {
  lastProgress: number;
  lastUpdated: number;
  stage: string;
}>();

// Get progress for a specific status with consistent increments
function getProgressForStatus(status: string, summaryId: string): number {
  const normalizedStatus = status.toLowerCase();
  let stageKey: keyof typeof PROCESSING_STAGES = 'pending';
  
  // Map status to stage key
  if (normalizedStatus.includes('complet')) stageKey = 'completed';
  else if (normalizedStatus.includes('fail')) return 0;
  else if (normalizedStatus.includes('finaliz')) stageKey = 'finalizing';
  else if (normalizedStatus.includes('summari') || normalizedStatus.includes('analyz')) stageKey = 'summarizing';
  else if (normalizedStatus.includes('transcrib')) stageKey = 'transcribing';
  else if (normalizedStatus.includes('queue')) stageKey = 'queued';
  
  const stageConfig = PROCESSING_STAGES[stageKey];
  
  // Get cached progress or initialize
  const now = Date.now();
  const cached = progressCache.get(summaryId);
  
  // If completed, always return 100%
  if (stageKey === 'completed') {
    progressCache.delete(summaryId); // Clean up cache
    return 100;
  }
  
  // If stage changed or no cache, initialize with min value for this stage
  if (!cached || cached.stage !== stageKey) {
    const newProgress = stageConfig.min;
    progressCache.set(summaryId, {
      lastProgress: newProgress,
      lastUpdated: now,
      stage: stageKey
    });
    return newProgress;
  }
  
  // Calculate time-based increment
  const elapsedSeconds = (now - cached.lastUpdated) / 1000;
  const increment = Math.min(
    stageConfig.increment * elapsedSeconds,
    (stageConfig.max - cached.lastProgress) / 2 // Slow down as we approach max
  );
  
  // Update progress with increment, but don't exceed max for this stage
  const newProgress = Math.min(
    stageConfig.max,
    cached.lastProgress + increment
  );
  
  // Update cache
  progressCache.set(summaryId, {
    lastProgress: newProgress,
    lastUpdated: now,
    stage: stageKey
  });
  
  return Math.round(newProgress * 10) / 10; // Round to 1 decimal place
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ summaryId: string }> }
) {
  try {
    const params = await context.params;
    const { summaryId } = params;

    if (!summaryId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get current timestamp for unique response
    const timestamp = Date.now();

    const result = await executeQuery<{ 
      processing_status: string, 
      overall_summary: string, 
      main_title: string,
      video_duration_seconds: number,
      created_at: string
    }[]>(async (sql: any) => 
      await sql`
        SELECT 
          vs.processing_status, 
          vs.overall_summary, 
          vs.main_title,
          vs.video_duration_seconds,
          vs.created_at
        FROM video_summaries vs
        JOIN videos v ON vs.video_id = v.id
        WHERE vs.id = ${summaryId} AND v.user_id = ${user.id}
      `
    );

    if (result.length === 0) {
      logger.warn('Summary not found or access denied', { summaryId, userId: user.id });
      return NextResponse.json({ error: 'Summary not found or you do not have permission to view it.' }, { status: 404 });
    }

    const status = result[0].processing_status;
    const summary = status === 'completed' ? result[0].overall_summary : null;
    const title = result[0].main_title;
    const videoDuration = result[0].video_duration_seconds || 0;
    const createdAt = result[0].created_at ? new Date(result[0].created_at).getTime() : 0;
    
    // Calculate time elapsed since creation
    const elapsedMs = createdAt ? timestamp - createdAt : 0;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Calculate estimated progress based on status and time elapsed
    const progress = getProgressForStatus(status, summaryId);
    
    // If completed, always 100%
    const finalProgress = status === 'completed' ? 100 : progress;

    // Generate a detailed status message
    let detailedMessage = '';
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('transcrib')) {
      detailedMessage = `Converting video to text (${Math.min(100, Math.floor(finalProgress))}% complete)`;
    } else if (normalizedStatus.includes('summari') || normalizedStatus.includes('analyz')) {
      detailedMessage = `Analyzing content and extracting insights (${Math.min(100, Math.floor(finalProgress))}% complete)`;
    } else if (normalizedStatus.includes('finaliz')) {
      detailedMessage = `Organizing and polishing results (${Math.min(100, Math.floor(finalProgress))}% complete)`;
    } else if (normalizedStatus.includes('complet')) {
      detailedMessage = 'Summary ready to view!';
    } else {
      detailedMessage = 'Processing your video...';
    }

    logger.info(`Summary status check`, { summaryId, userId: user.id, status, progress: finalProgress });

    return NextResponse.json({ 
        status: status,  // Keep for compatibility with ProcessingStatusPoller
        processing_status: status,  // Add for VideoSummary and ProcessingStatusDisplay
        processing_stage: status,   // Add for stage mapping
        processing_progress: finalProgress,
        elapsed_seconds: elapsedSeconds,
        video_duration: videoDuration,
        detailed_message: detailedMessage,
        timestamp: timestamp, // Add timestamp to prevent caching
        summary,
        overall_summary: summary, // Add for VideoSummary compatibility
        main_title: title,
        title
     });

  } catch (error: any) {
    logger.error('Error fetching summary status', { error: error.message });
    return NextResponse.json({ error: 'Failed to fetch summary status.' }, { status: 500 });
  }
} 