"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoJob = processVideoJob;
const openai_1 = require("./openai");
const youtube_1 = require("./youtube");
const db_1 = require("./db");
const subscription_1 = require("./subscription");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('video-processor');
async function processVideoJob(data) {
    const { videoId, userId, metadata, creditsNeeded, summaryDbId, totalDurationSeconds } = data;
    try {
        logger.info(`🔄 Starting video processing for: ${videoId}`, { data });
        // 1. Get transcript
        logger.info('📝 Fetching transcript...', { videoId });
        const transcript = await (0, youtube_1.getVideoTranscript)(videoId);
        const totalDuration = metadata.totalDurationSeconds || totalDurationSeconds || 0;
        // 2. Process via OpenAI
        logger.info('🤖 Processing with OpenAI...', { videoId });
        const aiResult = await (0, openai_1.extractKnowledgeWithOpenAI)(transcript, metadata.title, totalDuration);
        // 3. Update the database with the real summary
        logger.info('💾 Updating database with results...', { videoId, summaryDbId });
        await (0, db_1.executeQuery)(async (sql) => {
            // Update the existing summary entry with real data
            await sql `
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
        await (0, subscription_1.consumeCredits)(userId, creditsNeeded);
        logger.info('Credits consumed successfully.', { userId, creditsNeeded });
        logger.info(`✅ Video processing completed for: ${videoId}`);
        return {
            status: 'completed',
            summary: aiResult.overallSummary,
            title: aiResult.mainTitle
        };
    }
    catch (error) {
        logger.error('❌ Video processing failed', { videoId, error: error.message });
        // Update database to mark as failed
        try {
            await (0, db_1.executeQuery)(async (sql) => {
                await sql `
          UPDATE video_summaries 
          SET 
            processing_status = 'failed',
            overall_summary = 'Processing failed. Please try again or contact support.',
            raw_ai_output = ${error.message || 'Processing failed'},
            updated_at = NOW()
          WHERE id = ${summaryDbId}
        `;
            });
        }
        catch (dbError) {
            logger.error('Failed to update database with error status', { videoId, summaryDbId, error: dbError.message });
        }
        // We don't release credits here, because the job failed after processing started.
        // The credits were for the attempt. Re-throwing the error will let BullMQ handle the retry logic.
        throw error;
    }
}
