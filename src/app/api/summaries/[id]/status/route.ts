import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { executeQuery } from '../../../../../lib/db';
import { createLogger } from '../../../../../lib/logger';

const logger = createLogger('api:summary-status');

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: summaryId } = context.params;
    if (!summaryId) {
      return NextResponse.json({ error: 'Valid Summary ID is required' }, { status: 400 });
    }

    // Try to get new columns first, fallback if they don't exist
    let summaries;
    try {
      summaries = await executeQuery(async (sql) => {
        return await sql`
          SELECT 
            vs.processing_status, 
            vs.overall_summary,
            COALESCE(vs.processing_progress, 0) as processing_progress,
            COALESCE(vs.processing_stage, vs.processing_status) as processing_stage
          FROM video_summaries vs
          INNER JOIN videos v ON vs.video_id = v.id
          WHERE vs.id = ${summaryId} AND v.user_id = ${user.id}
        `;
      });
    } catch (columnError) {
      // If columns don't exist, fallback to basic query
      logger.warn('New progress columns not found, using fallback query', { error: columnError instanceof Error ? columnError.message : 'Unknown error' });
      summaries = await executeQuery(async (sql) => {
        return await sql`
          SELECT 
            vs.processing_status, 
            vs.overall_summary
          FROM video_summaries vs
          INNER JOIN videos v ON vs.video_id = v.id
          WHERE vs.id = ${summaryId} AND v.user_id = ${user.id}
        `;
      });
    }

    if (summaries.length === 0) {
      logger.warn(`Summary not found or access denied`, { summaryId, userId: user.id });
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const summary = summaries[0];
    logger.info(`Status check successful`, { summaryId, userId: user.id, status: summary.processing_status });
    
    // Map database processing_status to frontend-friendly values
    let stage: string = summary.processing_stage || summary.processing_status;
    
    // Convert legacy status values to new stage format if needed
    if (stage === 'transcribing' || stage === 'extracting') {
      stage = 'transcribing';
    } else if (stage === 'summarizing' || stage === 'analyzing') {
      stage = 'summarizing';
    } else if (stage === 'completed' || stage === 'complete') {
      stage = 'completed';
    } else if (stage === 'failed' || stage === 'error') {
      stage = 'failed';
    } else if (stage === 'pending' || stage === 'queued') {
      stage = 'pending';
    } else if (!['finalizing'].includes(stage)) {
      // Default fallback for any other status
      stage = 'pending';
    }
    
    // Calculate realistic progress if not available from database
    let progress = summary.processing_progress || 0;
    if (!summary.processing_progress) {
      // Provide realistic fallback progress based on status
      switch (summary.processing_status) {
        case 'queued':
        case 'pending':
          progress = 10;
          break;
        case 'transcribing':
        case 'extracting':
          progress = 45;
          break;
        case 'summarizing':
        case 'analyzing':
          progress = 75;
          break;
        case 'finalizing':
          progress = 90;
          break;
        case 'completed':
        case 'complete':
          progress = 100;
          break;
        case 'failed':
        case 'error':
          progress = 0;
          break;
        default:
          progress = 10;
      }
    }
    
    return NextResponse.json({
      processing_status: summary.processing_status,
      processing_stage: stage,
      processing_progress: progress,
      overall_summary: summary.overall_summary,
    });

  } catch (error) {
    logger.error('Error fetching summary status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}