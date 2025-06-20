import { extractKnowledgeWithOpenAI } from './openai';
import { getVideoTranscript } from './youtube';
import { executeQuery } from './db';
import { JobData } from './job-queue';
import { consumeCredits } from './subscription';
import { createLogger } from './logger';

const logger = createLogger('video-processor');

export async function processVideoJob(data: JobData) {
  const { videoId, userId, metadata, creditsNeeded, summaryDbId, totalDurationSeconds } = data;

  try {
    logger.info(`🔄 Starting video processing for: ${videoId}`, { data });
    
    // 1. Get transcript
    logger.info('📝 Fetching transcript...', { videoId });
    const transcript = await getVideoTranscript(videoId);
    const totalDuration = metadata.totalDurationSeconds || totalDurationSeconds || 0;

    // 2. Process via OpenAI
    logger.info('🤖 Processing with OpenAI...', { videoId });
    const aiResult = await extractKnowledgeWithOpenAI(transcript, metadata.title, totalDuration);

    // 3. Update the database with the real summary
    logger.info('💾 Updating database with results...', { videoId, summaryDbId });
    await executeQuery(async (sql) => {
      // Update the existing summary entry with real data
      await sql`
        UPDATE video_summaries 
        SET 
          main_title = ${aiResult.mainTitle},
          overall_summary = ${aiResult.overallSummary},
          raw_ai_output = ${JSON.stringify(aiResult.rawOpenAIOutput) || '{}'},
          transcript_sent = ${JSON.stringify(transcript)},
          prompt_tokens = ${aiResult.promptTokens || 0},
          completion_tokens = ${aiResult.completionTokens || 0},
          total_tokens = ${aiResult.totalTokens || 0},
          input_cost = ${aiResult.inputCost || 0.0},
          output_cost = ${aiResult.outputCost || 0.0},
          total_cost = ${aiResult.totalCost || 0.0},
          processing_status = 'completed',
          updated_at = NOW()
        WHERE id = ${summaryDbId}
      `;
    });
    
    // 4. Consume the user's credits
    await consumeCredits(userId, creditsNeeded);
    logger.info('Credits consumed successfully.', { userId, creditsNeeded });

    logger.info(`✅ Video processing completed for: ${videoId}`);
    return { 
      status: 'completed',
      summary: aiResult.overallSummary,
      title: aiResult.mainTitle
    };
  } catch (error: any) {
    logger.error('❌ Video processing failed', { videoId, error: error.message });
    
    // Update database to mark as failed
    try {
      await executeQuery(async (sql) => {
        await sql`
          UPDATE video_summaries 
          SET 
            processing_status = 'failed',
            overall_summary = 'Processing failed. Please try again or contact support.',
            raw_ai_output = ${error.message || 'Processing failed'},
            updated_at = NOW()
          WHERE id = ${summaryDbId}
        `;
      });
    } catch (dbError: any) {
      logger.error('Failed to update database with error status', { videoId, summaryDbId, error: dbError.message });
    }
    
    // We don't release credits here, because the job failed after processing started.
    // The credits were for the attempt. Re-throwing the error will let BullMQ handle the retry logic.
    throw error;
  }
} 