import { notFound, redirect } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import { currentUser } from '@clerk/nextjs/server';
import VideoSummary from '../../../components/Dashboard/VideoSummary';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!);

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

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
  video_id: string;
  processing_status: string;
  summary_id: string;
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
    if (isUUID(id)) {
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

// Helper function to parse raw Gemini output into segments
function parseGeminiOutput(rawOutput: string) {
  // Only log if there's an issue
  if (!rawOutput) {
    console.log('Warning: Empty raw AI output received');
    return { segments: [], keyTakeaways: [], finalThought: '' };
  }
  
  const segments: VideoSummaryData['segments'] = [];
  // Split the raw output by the segment delimiter (e.g., '---')
  const rawSegments = rawOutput.split('---').filter(segment => segment.trim() !== '');

  rawSegments.forEach((rawSegment, index) => {
    const lines = rawSegment.trim().split('\n').filter(line => line.trim() !== ''); // Split into non-empty lines

    if (lines.length >= 2) {
      const titleLine = lines.shift(); // First line is potential title
      const timestampLine = lines.shift(); // Second line is potential timestamp
      const contentLines = lines; // Remaining lines are content

      // Regex to match the title format (looking for ### followed by anything for the title)
      const titleMatch = titleLine?.match(/###\s*(.*)/);
      // Regex to match the timestamp format (looking for (Time: ...) and capturing the content inside)
      const timestampMatch = timestampLine?.match(/\(Time:\s*(.*?)\)/);

      if (titleMatch && titleMatch[1] && timestampMatch && timestampMatch[1]) {
        const title = titleMatch[1].trim();
        const timestamp = timestampMatch[1].trim();
        const content = contentLines.join('\n').trim();

        segments.push({
          title,
          timestamp,
          content,
        });
      }
    }
  });

  let keyTakeaways: string[] = [];
  let finalThought = '';

  // Logic to extract Key Takeaways and Final Thought from the last segment
  if (rawSegments.length > 0) {
    const lastSegment = rawSegments[rawSegments.length - 1];
    const lines = lastSegment.trim().split('\n').filter(line => line.trim() !== '');

    let inTakeawaysSection = false;
    let inFinalThoughtSection = false;

    for (const line of lines) {
      if (line.includes('## 🚀 Final Takeaway Summary')) {
        // Found the start of the takeaway section, skip the header
        inTakeawaysSection = true;
        inFinalThoughtSection = false; // Ensure not in final thought yet
        continue; // Skip the header line
      } else if (line.includes('**Main Lessons from the Video (Chronological):**')) {
        // Found the subheading for takeaways, start collecting points
        continue; // Skip the subheading line
      } else if (line.includes('**Final Thought:**')) {
        // Found the start of the final thought section
        inTakeawaysSection = false;
        inFinalThoughtSection = true;
        // Capture text on the same line if it exists after the heading
        const finalThoughtText = line.substring(line.indexOf('**Final Thought:**') + '**Final Thought:**'.length).trim();
        if (finalThoughtText) {
          finalThought += finalThoughtText + ' ';
        }
        // Continue to the next line to collect remaining content
        continue; // Skip the heading line itself after processing
      }

      if (inTakeawaysSection && line.startsWith('- ')) {
        // This is a key takeaway bullet point
        keyTakeaways.push(line.substring(2).trim()); // Remove '- ' prefix
      } else if (inFinalThoughtSection) {
        // This is part of the final thought
        finalThought += line.trim() + ' '; // Concatenate lines into final thought
      }
    }
    finalThought = finalThought.trim(); // Trim trailing space
  }

  return { segments, keyTakeaways, finalThought };
}

// Helper function to check if an ID is a UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to get the correct UUID for a video
async function getVideoUUID(id: string, userId: string): Promise<string | null> {
  try {
    // If it's already a UUID, return it
    if (isUUID(id)) {
      return id;
    }

    // Otherwise, look up by YouTube video ID
    const result = await sql`
      SELECT id FROM videos 
      WHERE video_id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;

    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting video UUID:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await currentUser();
  if (!user) return { title: 'Video Summary' };

  const { id: videoId } = await params;
  const summary = await getVideoSummary(videoId, user.id);
  if (!summary) return { title: 'Video Summary' };

  return {
    title: `${summary.title} - Summary`,
    description: summary.description,
  };
}

export default async function VideoSummaryPage({ params }: PageProps) {
  const user = await currentUser();
  const { id: videoId } = await params;
  
  console.log('🎬 Dashboard page loading for video:', videoId);
  
  if (!user) {
    notFound();
  }

  // If the ID is not a UUID, try to find the correct UUID and redirect
  if (!isUUID(videoId)) {
    const correctUUID = await getVideoUUID(videoId, user.id);
    if (correctUUID) {
      redirect(`/dashboard/${correctUUID}`);
    }
    // If no UUID found, continue to show not found
  }

  // Fetch the summary data
  const summary = await getVideoSummary(videoId, user.id);

  // If summary data is available, render the actual summary component
  if (!summary) { // Keep the notFound check here in case data is genuinely not found after loading
    notFound();
  }

  console.log('📊 Summary data loaded:', {
    videoId,
    summaryVideoId: summary.video_id,
    hasRawOutput: !!summary.raw_ai_output,
    rawOutputLength: summary.raw_ai_output?.length || 0,
    mainTitle: summary.main_title,
    overallSummary: summary.overall_summary
  });

  // Use the UUID for polling (current page ID), not the YouTube video_id
  // The API route can handle both UUID and YouTube video ID
  const pollingId = videoId; // Use the page ID for polling

  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      <div className="container mx-auto px-4 py-8">
        <VideoSummary summary={summary} videoId={pollingId} summaryId={String(summary.summary_id)} />
      </div>
    </main>
  );
} 