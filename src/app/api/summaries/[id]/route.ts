import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { deleteVideoSummary } from '../../../../lib/db-actions';
import { revalidatePath } from 'next/cache';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface VideoSummaryData {
  title: string;
  description: string;
  thumbnail_url: string;
  channel_title: string;
  duration: number;
  view_count: number;
  publish_date: string;
  main_title: string;
  overall_summary: string;
  raw_ai_output: string;
  segments: {
    title: string;
    timestamp: string;
    content: string;
  }[];
  key_takeaways: string[];
  final_thought: string;
}

async function getVideoSummary(id: string, userId: string): Promise<VideoSummaryData | null> {
  try {
    let result: (VideoSummaryData & { id: string; video_id: string; processing_status: string; summary_id: string })[] = [];
    
    // Check if the ID is a UUID format first
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      // Try to find by UUID (primary key)
      result = await sql`
        SELECT 
          v.id,
          v.video_id,
          v.title,
          v.description,
          v.thumbnail_url,
          v.channel_title,
          v.duration,
          v.view_count,
          v.publish_date,
          vs.main_title,
          vs.overall_summary,
          vs.raw_ai_output,
          vs.processing_status,
          vs.id as summary_id
        FROM videos v
        LEFT JOIN video_summaries vs ON v.id = vs.video_id
        WHERE v.id = ${id}
        AND v.user_id = ${userId}
      ` as unknown as (VideoSummaryData & { id: string; video_id: string; processing_status: string; summary_id: string })[];
    }

    // If not found by UUID or ID is not UUID format, try to find by YouTube video ID
    if (!result || result.length === 0) {
      result = await sql`
        SELECT 
          v.id,
          v.video_id,
          v.title,
          v.description,
          v.thumbnail_url,
          v.channel_title,
          v.duration,
          v.view_count,
          v.publish_date,
          vs.main_title,
          vs.overall_summary,
          vs.raw_ai_output,
          vs.processing_status,
          vs.id as summary_id
        FROM videos v
        LEFT JOIN video_summaries vs ON v.id = vs.video_id
        WHERE v.video_id = ${id}
        AND v.user_id = ${userId}
      ` as unknown as (VideoSummaryData & { id: string; video_id: string; processing_status: string; summary_id: string })[];
    }

    if (!result || result.length === 0) {
      return null;
    }

    const summaryRow = result[0];

    return {
      ...summaryRow,
      segments: [], // Add empty segments for now
      key_takeaways: [], // Add empty takeaways for now  
      final_thought: '', // Add empty final thought for now
    };
  } catch (error) {
    console.error('Error fetching video summary:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const user = await currentUser();
    if (!user) {
      console.log('❌ Unauthorized request to summary API');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { id } = params;
    console.log(`🔍 API: Fetching summary for ID: ${id}, User: ${user.id}`);

    const summary = await getVideoSummary(id, user.id);

    if (!summary) {
      console.log(`❌ API: Summary not found for ID: ${id}`);
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      );
    }

    console.log(`✅ API: Summary found for ID: ${id}`, {
      hasRawOutput: !!summary.raw_ai_output,
      rawOutputLength: summary.raw_ai_output?.length || 0,
      mainTitle: summary.main_title
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('API Error in GET /api/summaries/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { id: summaryId } = resolvedParams;

  try {
    await deleteVideoSummary(summaryId, user.id);
    
    // Revalidate relevant paths
    revalidatePath('/dashboard');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete summary' },
      { status: 500 }
    );
  }
} 