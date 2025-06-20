import { extractKnowledgeWithOpenAI } from './openai';
import { getVideoTranscript } from './youtube';
import { executeQuery } from './db';
import { VideoJob } from './job-queue';
import { consumeCredits } from './subscription';

export async function processVideoJob(data: VideoJob) {
  const { videoId, userId, metadata, creditsNeeded, summaryDbId, totalDurationSeconds } = data;

  try {
    console.log(`🔄 Starting video processing for: ${videoId}`);
    
    // 1. Get transcript
    console.log('📝 Fetching transcript...');
    const transcript = await getVideoTranscript(videoId);
    const totalDuration = metadata.totalDurationSeconds || totalDurationSeconds || 0;

    // 2. Process via OpenAI
    console.log('🤖 Processing with OpenAI...');
    const aiResult = await extractKnowledgeWithOpenAI(transcript, metadata.title, totalDuration);

    // 3. Update the database with the real summary
    console.log('💾 Updating database with results...');
    await executeQuery(async (sql) => {
      // Update the existing summary entry with real data
      await sql`
        UPDATE video_summaries 
        SET 
          main_title = ${aiResult.mainTitle},
          overall_summary = ${aiResult.overallSummary},
          raw_ai_output = ${aiResult.rawOpenAIOutput || aiResult.overallSummary},
          transcript_sent = ${JSON.stringify(transcript)},
          prompt_tokens = ${aiResult.promptTokens || 0},
          completion_tokens = ${aiResult.completionTokens || 0},
          total_tokens = ${aiResult.totalTokens || 0},
          input_cost = ${aiResult.inputCost || 0.0},
          output_cost = ${aiResult.outputCost || 0.0},
          total_cost = ${aiResult.totalCost || 0.0},
          updated_at = NOW()
        WHERE video_id = (
          SELECT id FROM videos WHERE video_id = ${videoId} AND user_id = ${userId}
        )
      `;
    });

    console.log(`✅ Video processing completed for: ${videoId}`);
    return { 
      status: 'completed',
      summary: aiResult.overallSummary,
      title: aiResult.mainTitle
    };
  } catch (error: any) {
    console.error('❌ Video processing failed:', error);
    
    // Update database to mark as failed
    try {
      await executeQuery(async (sql) => {
        await sql`
          UPDATE video_summaries 
          SET 
            overall_summary = 'Processing failed',
            raw_ai_output = ${error.message || 'Processing failed'},
            updated_at = NOW()
          WHERE video_id = (
            SELECT id FROM videos WHERE video_id = ${videoId} AND user_id = ${userId}
          )
        `;
      });
    } catch (dbError) {
      console.error('Failed to update database with error status:', dbError);
    }
    
    throw error;
  }
} 