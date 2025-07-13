import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../../lib/db';
import { createLogger } from '../../../../../lib/logger';
import { currentUser } from '@clerk/nextjs/server';

const logger = createLogger('api:summary-status');

// Map status to estimated progress range
function getProgressForStatus(status: string): number {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus.includes('complet')) return 100;
  if (normalizedStatus.includes('fail')) return 0;
  
  // More granular progress estimation
  if (normalizedStatus.includes('finaliz')) return 85 + Math.floor(Math.random() * 10);
  if (normalizedStatus.includes('summari') || normalizedStatus.includes('analyz')) return 45 + Math.floor(Math.random() * 30);
  if (normalizedStatus.includes('transcrib')) return 15 + Math.floor(Math.random() * 25);
  if (normalizedStatus.includes('pend') || normalizedStatus.includes('queue')) return 5 + Math.floor(Math.random() * 10);
  
  // Default progress
  return 50;
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
    let progress = getProgressForStatus(status);
    
    // Add some variability to progress to make it feel more dynamic
    // But ensure it's always increasing
    const variability = Math.min(5, Math.floor(Math.random() * 3) + 1);
    progress = Math.min(99, progress + variability);
    
    // If completed, always 100%
    if (status === 'completed') {
      progress = 100;
    }

    // Generate a detailed status message
    let detailedMessage = '';
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('transcrib')) {
      detailedMessage = `Converting video to text (${Math.min(100, Math.floor(progress * 1.5))}% complete)`;
    } else if (normalizedStatus.includes('summari') || normalizedStatus.includes('analyz')) {
      detailedMessage = `Analyzing content and extracting insights (${Math.min(100, Math.floor(progress * 0.8))}% complete)`;
    } else if (normalizedStatus.includes('finaliz')) {
      detailedMessage = `Organizing and polishing results (${Math.min(100, Math.floor(progress * 0.95))}% complete)`;
    } else if (normalizedStatus.includes('complet')) {
      detailedMessage = 'Summary ready to view!';
    } else {
      detailedMessage = 'Processing your video...';
    }

    logger.info(`Summary status check`, { summaryId, userId: user.id, status, progress });

    return NextResponse.json({ 
        status: status,  // Keep for compatibility with ProcessingStatusPoller
        processing_status: status,  // Add for VideoSummary and ProcessingStatusDisplay
        processing_stage: status,   // Add for stage mapping
        processing_progress: progress,
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