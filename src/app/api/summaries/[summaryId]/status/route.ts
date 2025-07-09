import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../../lib/db';
import { createLogger } from '../../../../../lib/logger';
import { currentUser } from '@clerk/nextjs/server';

const logger = createLogger('api:summary-status');

export async function GET(
  request: NextRequest,
  { params }: { params: { summaryId: string } }
) {
  const { summaryId } = params;

  if (!summaryId) {
    return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
  }

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await executeQuery<{ processing_status: string, overall_summary: string, main_title: string }[]>(async (sql: any) => 
      await sql`
        SELECT processing_status, overall_summary, main_title
        FROM video_summaries 
        WHERE id = ${summaryId} AND user_id = ${user.id}
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
        status,
        summary,
        title
     });

  } catch (error: any) {
    logger.error('Error fetching summary status', { summaryId, error: error.message });
    return NextResponse.json({ error: 'Failed to fetch summary status.' }, { status: 500 });
  }
} 