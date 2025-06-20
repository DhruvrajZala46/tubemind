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

    const summaries = await executeQuery(async (sql) => {
      return await sql`
        SELECT 
          vs.processing_status, 
          vs.overall_summary 
        FROM video_summaries vs
        INNER JOIN videos v ON vs.video_id = v.id
        WHERE vs.id = ${summaryId} AND v.user_id = ${user.id}
      `;
    });

    if (summaries.length === 0) {
      logger.warn(`Summary not found or access denied`, { summaryId, userId: user.id });
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    const summary = summaries[0];
    logger.info(`Status check successful`, { summaryId, userId: user.id, status: summary.processing_status });
    
    return NextResponse.json({
      processing_status: summary.processing_status,
      overall_summary: summary.overall_summary,
    });

  } catch (error) {
    logger.error('Error fetching summary status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}