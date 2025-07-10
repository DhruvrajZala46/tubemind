import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../../lib/db';
import { createLogger } from '../../../../../lib/logger';
import { currentUser } from '@clerk/nextjs/server';

const logger = createLogger('api:summary-status');

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

    const result = await executeQuery<{ processing_status: string, overall_summary: string, main_title: string }[]>(async (sql: any) => 
      await sql`
        SELECT vs.processing_status, vs.overall_summary, vs.main_title
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

    logger.info(`Summary status check`, { summaryId, userId: user.id, status });

    return NextResponse.json({ 
        status: status,  // Keep for compatibility with ProcessingStatusPoller
        processing_status: status,  // Add for VideoSummary and ProcessingStatusDisplay
        processing_stage: status,   // Add for stage mapping
        processing_progress: status === 'completed' ? 100 : (status === 'failed' ? 0 : 50), // Add progress
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