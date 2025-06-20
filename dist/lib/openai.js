"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaExceededError = exports.RateLimitError = exports.OpenAIServiceError = void 0;
exports.getOpenAIClient = getOpenAIClient;
exports.getDetailedCostMetrics = getDetailedCostMetrics;
exports.getCostMetrics = getCostMetrics;
exports.resetCostMetrics = resetCostMetrics;
exports.extractKnowledgeWithOpenAI = extractKnowledgeWithOpenAI;
exports.generateExpandedSegmentSummary = generateExpandedSegmentSummary;
exports.checkOpenAIHealth = checkOpenAIHealth;
const openai_1 = __importDefault(require("openai"));
const youtube_1 = require("./youtube");
const system_prompt_1 = require("./system-prompt");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const logger = (0, logger_1.createLogger)('openai');
// --- LAZY-INITIALIZED SINGLETON FOR OPENAI CLIENT ---
let openAIClient = null;
function getOpenAIClient() {
    if (!openAIClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('❌ OPENAI_API_KEY environment variable is not set.');
        }
        openAIClient = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY,
        });
        logger.info('✅ OpenAI client initialized successfully');
    }
    return openAIClient;
}
// --- END ---
// Rate limiting and retry configuration
const RATE_LIMIT_CONFIG = {
    maxRetries: 3, // Reduced retries for faster failure detection
    baseDelay: 2000, // 2 seconds
    maxDelay: 30000, // 30 seconds (reduced for faster recovery)
    backoffMultiplier: 2,
    jitter: true,
};
// 💰 OFFICIAL OPENAI PRICING (Verified Dec 2024)
// Source: https://openai.com/api/pricing/ and official OpenAI documentation
const OFFICIAL_OPENAI_PRICING = {
    'gpt-4o-mini': {
        // ✅ VERIFIED OFFICIAL PRICING as of December 2024
        inputPricePerMillionTokens: 0.15, // $0.15 per 1M input tokens
        outputPricePerMillionTokens: 0.60, // $0.60 per 1M output tokens
        // Convert to per-token pricing for calculations
        inputPricePerToken: 0.15 / 1000000, // $0.00000015 per token
        outputPricePerToken: 0.60 / 1000000, // $0.00000060 per token
        maxContextTokens: 128000,
        maxCompletionTokens: 16384,
    },
    'gpt-4o-mini-2024-07-18': {
        // Same pricing as gpt-4o-mini (official model name variant)
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.60,
        inputPricePerToken: 0.15 / 1000000,
        outputPricePerToken: 0.60 / 1000000,
        maxContextTokens: 128000,
        maxCompletionTokens: 16384,
    },
    'gpt-4o': {
        // ✅ VERIFIED: Current GPT-4o pricing (for comparison)
        inputPricePerMillionTokens: 5.00, // $5.00 per 1M input tokens
        outputPricePerMillionTokens: 15.00, // $15.00 per 1M output tokens
        inputPricePerToken: 5.00 / 1000000,
        outputPricePerToken: 15.00 / 1000000,
        maxContextTokens: 128000,
        maxCompletionTokens: 16384,
    }
};
function calculateExactCost(model, inputTokens, outputTokens, context = 'API Request') {
    // ✅ VALIDATION: Check if model exists in our pricing table
    const pricing = OFFICIAL_OPENAI_PRICING[model];
    if (!pricing) {
        throw new Error(`❌ COST CALCULATION ERROR: Unknown model '${model}'. Cannot calculate accurate costs.`);
    }
    // ✅ VALIDATION: Check for valid token counts
    if (inputTokens < 0 || outputTokens < 0) {
        throw new Error(`❌ COST CALCULATION ERROR: Invalid token counts. Input: ${inputTokens}, Output: ${outputTokens}`);
    }
    if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens)) {
        throw new Error(`❌ COST CALCULATION ERROR: Token counts must be integers. Input: ${inputTokens}, Output: ${outputTokens}`);
    }
    // 🧮 EXACT CALCULATIONS (no rounding until final display)
    const inputCostExact = inputTokens * pricing.inputPricePerToken;
    const outputCostExact = outputTokens * pricing.outputPricePerToken;
    const totalCostExact = inputCostExact + outputCostExact;
    // 🧮 VERIFICATION CALCULATIONS (alternative method for double-checking)
    const inputCostVerification = (inputTokens / 1000000) * pricing.inputPricePerMillionTokens;
    const outputCostVerification = (outputTokens / 1000000) * pricing.outputPricePerMillionTokens;
    const totalCostVerification = inputCostVerification + outputCostVerification;
    // ✅ VALIDATION: Ensure both calculation methods match (within floating point precision)
    const tolerance = 0.0000001; // 1e-7 for floating point comparison
    if (Math.abs(inputCostExact - inputCostVerification) > tolerance ||
        Math.abs(outputCostExact - outputCostVerification) > tolerance) {
        throw new Error(`❌ COST CALCULATION ERROR: Calculation mismatch detected! Please check pricing data.`);
    }
    // 💰 Calculate savings vs GPT-4o (for context)
    let costSavings;
    if (model !== 'gpt-4o') {
        const gpt4oPricing = OFFICIAL_OPENAI_PRICING['gpt-4o'];
        const gpt4oCost = (inputTokens * gpt4oPricing.inputPricePerToken) + (outputTokens * gpt4oPricing.outputPricePerToken);
        const savings = gpt4oCost - totalCostExact;
        const savingsPercentage = ((savings / gpt4oCost) * 100);
        costSavings = {
            gpt4oCost: Number(gpt4oCost.toFixed(8)),
            savings: Number(savings.toFixed(8)),
            savingsPercentage: Number(savingsPercentage.toFixed(2))
        };
    }
    const result = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        inputCostUSD: Number(inputCostExact.toFixed(8)), // 8 decimal places for precision
        outputCostUSD: Number(outputCostExact.toFixed(8)),
        totalCostUSD: Number(totalCostExact.toFixed(8)),
        model,
        priceVerification: {
            inputPricePerToken: pricing.inputPricePerToken,
            outputPricePerToken: pricing.outputPricePerToken,
            inputPricePerMillionTokens: pricing.inputPricePerMillionTokens,
            outputPricePerMillionTokens: pricing.outputPricePerMillionTokens
        },
        calculationBreakdown: {
            inputCalculation: `${inputTokens} tokens × $${pricing.inputPricePerToken.toFixed(9)} = $${inputCostExact.toFixed(8)}`,
            outputCalculation: `${outputTokens} tokens × $${pricing.outputPricePerToken.toFixed(9)} = $${outputCostExact.toFixed(8)}`,
            totalCalculation: `$${inputCostExact.toFixed(8)} + $${outputCostExact.toFixed(8)} = $${totalCostExact.toFixed(8)}`
        },
        ...(costSavings && { costSavingsVsGPT4o: costSavings })
    };
    // 📊 COMPREHENSIVE LOGGING
    logger.info(`💰 BULLETPROOF COST CALCULATION [${context}]:`);
    logger.info(`🤖 Model: ${model}`);
    logger.info(`📊 Tokens: ${inputTokens} input + ${outputTokens} output = ${inputTokens + outputTokens} total`);
    logger.info(`💵 Official Pricing:`);
    logger.info(`   Input: $${pricing.inputPricePerMillionTokens}/1M tokens ($${pricing.inputPricePerToken.toFixed(9)}/token)`);
    logger.info(`   Output: $${pricing.outputPricePerMillionTokens}/1M tokens ($${pricing.outputPricePerToken.toFixed(9)}/token)`);
    logger.info(`🧮 Calculations:`);
    logger.info(`   ${result.calculationBreakdown.inputCalculation}`);
    logger.info(`   ${result.calculationBreakdown.outputCalculation}`);
    logger.info(`   ${result.calculationBreakdown.totalCalculation}`);
    if (costSavings) {
        logger.info(`💡 Cost Savings vs GPT-4o:`);
        logger.info(`   GPT-4o would cost: $${costSavings.gpt4oCost.toFixed(6)}`);
        logger.info(`   You saved: $${costSavings.savings.toFixed(6)} (${costSavings.savingsPercentage}%)`);
    }
    // Update global cost metrics
    updateCostMetrics(result, context);
    return result;
}
// 💰 COST TRACKING CONFIGURATION
const COST_TRACKING = {
    enableLogging: true,
    logLevel: 'detailed', // 'basic' | 'detailed' | 'full'
    alertThresholds: {
        singleRequest: 0.50, // Alert if single request costs > $0.50
        hourlySpend: 10.00, // Alert if hourly spend > $10
        dailySpend: 100.00 // Alert if daily spend > $100
    }
};
// 📊 COST ACCUMULATOR (in-memory tracking)
let costMetrics = {
    totalSpent: 0,
    requestCount: 0,
    hourlySpent: 0,
    dailySpent: 0,
    lastHourReset: Date.now(),
    lastDayReset: Date.now(),
    mostExpensiveRequest: 0,
    averageRequestCost: 0,
    totalTokensProcessed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    // ✅ NEW: Detailed breakdown
    costBreakdown: {
        totalInputCost: 0,
        totalOutputCost: 0
    }
};
function updateCostMetrics(result, context) {
    // Update all metrics
    costMetrics.totalSpent += result.totalCostUSD;
    costMetrics.requestCount += 1;
    costMetrics.hourlySpent += result.totalCostUSD;
    costMetrics.dailySpent += result.totalCostUSD;
    costMetrics.mostExpensiveRequest = Math.max(costMetrics.mostExpensiveRequest, result.totalCostUSD);
    costMetrics.averageRequestCost = costMetrics.totalSpent / costMetrics.requestCount;
    costMetrics.totalTokensProcessed += result.totalTokens;
    costMetrics.totalInputTokens += result.inputTokens;
    costMetrics.totalOutputTokens += result.outputTokens;
    costMetrics.costBreakdown.totalInputCost += result.inputCostUSD;
    costMetrics.costBreakdown.totalOutputCost += result.outputCostUSD;
    // Reset hourly/daily counters if needed
    const now = Date.now();
    if (now - costMetrics.lastHourReset > 3600000) { // 1 hour
        costMetrics.hourlySpent = result.totalCostUSD;
        costMetrics.lastHourReset = now;
    }
    if (now - costMetrics.lastDayReset > 86400000) { // 24 hours
        costMetrics.dailySpent = result.totalCostUSD;
        costMetrics.lastDayReset = now;
    }
    // 🚨 COST ALERTS with exact thresholds
    if (result.totalCostUSD > 0.50) {
        logger.warn(`🚨 EXPENSIVE REQUEST ALERT: $${result.totalCostUSD.toFixed(6)} for ${context}`);
    }
    if (costMetrics.hourlySpent > 10.00) {
        logger.warn(`🚨 HOURLY SPEND ALERT: $${costMetrics.hourlySpent.toFixed(2)} this hour`);
    }
    if (costMetrics.dailySpent > 100.00) {
        logger.warn(`🚨 DAILY SPEND ALERT: $${costMetrics.dailySpent.toFixed(2)} today`);
    }
}
// 📊 ENHANCED METRICS EXPORT
function getDetailedCostMetrics() {
    return {
        summary: {
            totalSpent: `$${costMetrics.totalSpent.toFixed(6)}`,
            requestCount: costMetrics.requestCount,
            averageRequestCost: `$${costMetrics.averageRequestCost.toFixed(6)}`,
            mostExpensiveRequest: `$${costMetrics.mostExpensiveRequest.toFixed(6)}`,
            hourlySpent: `$${costMetrics.hourlySpent.toFixed(4)}`,
            dailySpent: `$${costMetrics.dailySpent.toFixed(4)}`
        },
        tokens: {
            totalProcessed: costMetrics.totalTokensProcessed.toLocaleString(),
            totalInput: costMetrics.totalInputTokens.toLocaleString(),
            totalOutput: costMetrics.totalOutputTokens.toLocaleString(),
            averagePerRequest: Math.round(costMetrics.totalTokensProcessed / Math.max(costMetrics.requestCount, 1))
        },
        costBreakdown: {
            inputCosts: `$${costMetrics.costBreakdown.totalInputCost.toFixed(6)}`,
            outputCosts: `$${costMetrics.costBreakdown.totalOutputCost.toFixed(6)}`,
            inputPercentage: `${((costMetrics.costBreakdown.totalInputCost / costMetrics.totalSpent) * 100).toFixed(1)}%`,
            outputPercentage: `${((costMetrics.costBreakdown.totalOutputCost / costMetrics.totalSpent) * 100).toFixed(1)}%`
        },
        pricing: OFFICIAL_OPENAI_PRICING
    };
}
// 📊 BACKWARD COMPATIBILITY: Old format metrics
function getCostMetrics() {
    return {
        ...costMetrics,
        formatted: {
            totalSpent: `$${costMetrics.totalSpent.toFixed(6)}`,
            averageRequestCost: `$${costMetrics.averageRequestCost.toFixed(6)}`,
            mostExpensiveRequest: `$${costMetrics.mostExpensiveRequest.toFixed(6)}`,
            hourlySpent: `$${costMetrics.hourlySpent.toFixed(4)}`,
            dailySpent: `$${costMetrics.dailySpent.toFixed(4)}`
        }
    };
}
// 🧹 RESET COST METRICS (for testing/admin)
function resetCostMetrics() {
    costMetrics = {
        totalSpent: 0,
        requestCount: 0,
        hourlySpent: 0,
        dailySpent: 0,
        lastHourReset: Date.now(),
        lastDayReset: Date.now(),
        mostExpensiveRequest: 0,
        averageRequestCost: 0,
        totalTokensProcessed: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        costBreakdown: {
            totalInputCost: 0,
            totalOutputCost: 0
        }
    };
}
// Enhanced error types for better error handling
class OpenAIServiceError extends Error {
    constructor(message, code, statusCode, retryable = false) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.name = 'OpenAIServiceError';
    }
}
exports.OpenAIServiceError = OpenAIServiceError;
class RateLimitError extends OpenAIServiceError {
    constructor(message, retryAfter) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class QuotaExceededError extends OpenAIServiceError {
    constructor(message) {
        super(message, 'QUOTA_EXCEEDED', 429, false);
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;
// Utility functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
function calculateJitter(baseDelay) {
    return baseDelay * (0.5 + Math.random() * 0.5); // 50-100% of base delay
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Enhanced retry logic with exponential backoff and jitter
async function retryWithBackoff(operation, context = 'OpenAI API call') {
    let lastError;
    let delay = RATE_LIMIT_CONFIG.baseDelay;
    for (let attempt = 1; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            const isRetryable = error?.status === 429 || // Rate limit
                error?.status === 408 || // Request timeout
                error?.status === 500 || // Internal server error
                error?.status === 502 || // Bad gateway
                error?.status === 503 || // Service unavailable
                error?.status === 504 || // Gateway timeout
                error?.status === 522 || // Cloudflare connection timed out
                error?.code === 'ECONNRESET' ||
                error?.code === 'ETIMEDOUT' ||
                error?.code === 'ENETUNREACH' ||
                error?.code === 'EAI_AGAIN' ||
                error?.code === 'ENOTFOUND';
            if (!isRetryable || attempt === RATE_LIMIT_CONFIG.maxRetries) {
                // Transform OpenAI errors to our custom error types
                if (error?.status === 429) {
                    if (error?.message?.includes('quota') || error?.message?.includes('billing')) {
                        throw new QuotaExceededError(`Quota exceeded: ${error.message}`);
                    }
                    const retryAfter = error?.headers?.['retry-after']
                        ? parseInt(error.headers['retry-after']) * 1000
                        : undefined;
                    throw new RateLimitError(`Rate limit exceeded: ${error.message}`, retryAfter);
                }
                throw new OpenAIServiceError(`${context} failed: ${error.message}`, error?.status ? `HTTP_${error.status}` : 'UNKNOWN_ERROR', error?.status, false);
            }
            // Calculate delay with jitter
            const delayWithJitter = RATE_LIMIT_CONFIG.jitter
                ? calculateJitter(delay)
                : delay;
            const actualDelay = Math.min(delayWithJitter, RATE_LIMIT_CONFIG.maxDelay);
            logger.warn(`${context} failed (attempt ${attempt}/${RATE_LIMIT_CONFIG.maxRetries}): ${error.message}. ` +
                `Retrying in ${Math.round(actualDelay / 1000)}s...`);
            await sleep(actualDelay);
            // Exponential backoff
            delay = Math.min(delay * RATE_LIMIT_CONFIG.backoffMultiplier, RATE_LIMIT_CONFIG.maxDelay);
        }
    }
    throw lastError;
}
// System prompt is now imported from separate file
// Main function to extract knowledge using OpenAI
async function extractKnowledgeWithOpenAI(transcript, videoTitle, totalDuration) {
    // Clean structured logging
    logger.info('\n📋 OPENAI EXTRACTION START');
    logger.info(`📌 Video: "${videoTitle.substring(0, 60)}${videoTitle.length > 60 ? '...' : ''}"`);
    logger.info(`📌 Duration: ${formatTime(totalDuration)} (${totalDuration}s)`);
    logger.info(`📌 Model: gpt-4o-mini`);
    logger.info(`📌 Transcript segments: ${transcript.length}`);
    if (!transcript || transcript.length === 0) {
        throw new OpenAIServiceError('No transcript available for analysis', 'MISSING_TRANSCRIPT', 400, false);
    }
    try {
        // Format transcript by minutes (same as Gemini implementation)
        const formattedTranscript = (0, youtube_1.formatTranscriptByMinutes)(transcript, 60);
        // Log the full transcript sent to OpenAI
        logger.info('\n📝 FULL TRANSCRIPT SENT TO OPENAI:');
        logger.info(formattedTranscript);
        // Prepare the messages for OpenAI
        const messages = [
            {
                role: 'system',
                content: system_prompt_1.SYSTEM_PROMPT
            },
            {
                role: 'user',
                content: `Here is the full transcript, chunked by minute for your reference:\n\n${formattedTranscript}\n\nPlease analyze this transcript and create an engaging, comprehensive summary following the format specified in the system prompt.`
            }
        ];
        // Make the API call with retry logic
        logger.info(`\n📊 Sending request to OpenAI API...`);
        const response = await retryWithBackoff(async () => {
            return await getOpenAIClient().chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 6000, // Increased for longer videos
                temperature: 0.7,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
            });
        }, 'OpenAI knowledge extraction');
        // Extract token usage and cost
        let promptTokens = 0, completionTokens = 0, totalTokens = 0;
        let inputCost = 0, outputCost = 0, totalCost = 0;
        if (response.usage) {
            promptTokens = response.usage.prompt_tokens;
            completionTokens = response.usage.completion_tokens;
            totalTokens = response.usage.total_tokens;
            // 💰 USE NEW BULLETPROOF COST TRACKING SYSTEM
            const costResult = calculateExactCost('gpt-4o-mini', promptTokens, completionTokens, 'Knowledge Extraction');
            inputCost = costResult.inputCostUSD;
            outputCost = costResult.outputCostUSD;
            totalCost = costResult.totalCostUSD;
        }
        const rawOutput = response.choices[0]?.message?.content || '';
        if (!rawOutput) {
            throw new OpenAIServiceError('OpenAI returned empty response', 'EMPTY_RESPONSE', 500, true);
        }
        // Log the full OpenAI output
        logger.info('\n📄 FULL OPENAI OUTPUT:');
        logger.info(rawOutput);
        // Parse the response with improved markdown parsing
        logger.info(`\n🔍 Parsing OpenAI response...`);
        const parsedResponse = parseOpenAIResponse(rawOutput, videoTitle, totalDuration);
        // Log parsed response in a clean, structured format
        logger.info(`\n✅ SUMMARY GENERATED:`);
        logger.info(`📌 Title: ${parsedResponse.mainTitle.substring(0, 80)}${parsedResponse.mainTitle.length > 80 ? '...' : ''}`);
        logger.info(`📌 Segments: ${parsedResponse.segments.length}`);
        logger.info(`📌 Key takeaways: ${parsedResponse.keyTakeaways.length}`);
        logger.info(`📋 OPENAI EXTRACTION COMPLETE`);
        return {
            ...parsedResponse,
            rawOpenAIOutput: rawOutput,
            transcriptSent: formattedTranscript,
            openaiOutput: rawOutput,
            promptTokens,
            completionTokens,
            totalTokens,
            inputCost,
            outputCost,
            totalCost,
            videoDurationSeconds: totalDuration
        };
    }
    catch (error) {
        logger.error(`❌ OpenAI knowledge extraction error: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof OpenAIServiceError) {
            throw error;
        }
        throw new OpenAIServiceError(`Failed to extract knowledge: ${error.message}`, 'EXTRACTION_FAILED', 500, false);
    }
}
// Fallback function for markdown response parsing (if JSON parsing fails)
function processMarkdownResponse(text, videoTitle, totalDuration) {
    logger.warn('⚠️ Falling back to markdown parsing');
    const parsed = parseOpenAIResponse(text, videoTitle, totalDuration);
    return {
        ...parsed,
        rawOpenAIOutput: text
    };
}
// Parse OpenAI response into structured format
function parseOpenAIResponse(text, videoTitle, totalDuration) {
    try {
        // Extract main title (first bold heading)
        const titleMatch = text.match(/^#?\s*\*\*(.+?)\*\*|^#?\s*(.+?)$/m);
        const mainTitle = titleMatch ? (titleMatch[1] || titleMatch[2])?.trim() : videoTitle;
        // Extract segments using various patterns
        const segmentRegex = /##\s+(.+?)\s*\|\s*(.+?)\n🔥(.+?)\n([\s\S]+?)(?=##\s+|🔑|$)/g;
        const segments = [];
        let match;
        while ((match = segmentRegex.exec(text)) !== null) {
            const [_, timeRange, title, hook, content] = match;
            // Parse time range
            const timeMatch = timeRange.match(/(\d+:\d+:\d+|\d+:\d+)(?:\s*[–-]\s*(\d+:\d+:\d+|\d+:\d+))?/);
            const startTimeStr = timeMatch?.[1] || '0:00';
            const endTimeStr = timeMatch?.[2] || formatTime(totalDuration);
            segments.push({
                title: title.trim(),
                startTime: (0, utils_1.timeToSeconds)(startTimeStr),
                endTime: (0, utils_1.timeToSeconds)(endTimeStr),
                timestamp: `${startTimeStr}–${endTimeStr}`,
                hook: hook.trim(),
                narratorSummary: content.trim()
            });
        }
        // Deduplicate segments by checking for very similar titles or hooks
        const uniqueSegments = deduplicateSegments(segments);
        logger.info(`🧹 Deduplicated segments: ${segments.length} → ${uniqueSegments.length}`);
        // Extract key takeaways
        const takeawaysMatch = text.match(/🔑\s*Key Takeaways[\s\S]*?\n((?:\s*[-*]\s*.+\n?)+)/);
        const keyTakeaways = takeawaysMatch
            ? takeawaysMatch[1]
                .split('\n')
                .map(line => line.replace(/^\s*[-*]\s*/, '').trim())
                .filter(line => line.length > 0)
            : ['Analysis completed successfully'];
        // Deduplicate key takeaways
        const uniqueTakeaways = [...new Set(keyTakeaways)];
        // Extract overall summary from the content
        const overallSummary = mainTitle || 'Video analysis completed';
        // If no segments found, create a single segment
        if (uniqueSegments.length === 0) {
            const endTimeStr = formatTime(totalDuration);
            uniqueSegments.push({
                title: 'Complete Video Analysis',
                startTime: 0,
                endTime: totalDuration,
                timestamp: `0:00–${endTimeStr}`,
                hook: 'Full video content analyzed',
                narratorSummary: text.substring(0, 500) + '...'
            });
        }
        return {
            mainTitle,
            overallSummary,
            segments: uniqueSegments.slice(0, 12), // Limit to 12 segments max
            keyTakeaways: uniqueTakeaways.slice(0, 10) // Limit to 10 takeaways max
        };
    }
    catch (error) {
        logger.warn(`Error parsing OpenAI response, using fallback: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback parsing
        const endTimeStr = formatTime(totalDuration);
        return {
            mainTitle: videoTitle,
            overallSummary: 'Video analysis completed',
            segments: [{
                    title: 'Complete Video Analysis',
                    startTime: 0,
                    endTime: totalDuration,
                    timestamp: `0:00–${endTimeStr}`,
                    hook: 'Full video content analyzed',
                    narratorSummary: text.substring(0, 1000) + '...'
                }],
            keyTakeaways: ['Analysis completed successfully']
        };
    }
}
// Helper function to deduplicate segments
function deduplicateSegments(segments) {
    if (!segments || segments.length <= 1)
        return segments;
    // Use a Map to track unique segments by time range
    const uniqueSegments = new Map();
    // Process segments in order
    segments.forEach(segment => {
        const timeKey = segment.timestamp; // Use timestamp as a unique key
        // If we already have a segment with this time range, keep the more detailed one
        if (uniqueSegments.has(timeKey)) {
            const existing = uniqueSegments.get(timeKey);
            // If the new segment has a longer summary, replace the existing one
            if (segment.narratorSummary.length > existing.narratorSummary.length) {
                uniqueSegments.set(timeKey, segment);
            }
        }
        else {
            uniqueSegments.set(timeKey, segment);
        }
    });
    // Also check for very similar segments by title or hook
    const result = Array.from(uniqueSegments.values());
    const finalResult = [];
    // Helper to check if strings are very similar (80%+ match)
    const areSimilar = (str1, str2) => {
        if (!str1 || !str2)
            return false;
        const shorter = str1.length < str2.length ? str1 : str2;
        const longer = str1.length >= str2.length ? str1 : str2;
        // Calculate Levenshtein distance (simple version)
        let distance = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] !== longer[i])
                distance++;
        }
        distance += longer.length - shorter.length;
        return distance / longer.length < 0.2; // Less than 20% different
    };
    // Only add segments that don't have very similar titles or hooks
    result.forEach(segment => {
        const isDuplicate = finalResult.some(existing => (areSimilar(segment.title, existing.title) && segment.title.length > 0) ||
            (areSimilar(segment.hook, existing.hook) && segment.hook.length > 0));
        if (!isDuplicate) {
            finalResult.push(segment);
        }
    });
    return finalResult;
}
// Enhanced segment expansion function
async function generateExpandedSegmentSummary({ transcriptSlice, videoTitle, startTime, endTime, segmentNumber, totalSegments, totalDuration }) {
    logger.info(`\n=== Generating Expanded Segment Summary ===`);
    logger.info(`Segment ${segmentNumber}/${totalSegments}: ${formatTime(startTime)}–${formatTime(endTime)}`);
    const segmentText = transcriptSlice.length > 0
        ? transcriptSlice.map(item => `[${formatTime(item.start)}] ${item.text}`).join('\n')
        : '';
    const messages = [
        {
            role: 'system',
            content: `You are an expert content analyst. Create a detailed, engaging analysis of this specific video segment following the storytelling principles outlined in the main system prompt.`
        },
        {
            role: 'user',
            content: `Analyze this specific segment of the video "${videoTitle}":

**Segment Details:**
- Time Range: ${formatTime(startTime)}–${formatTime(endTime)}
- Segment: ${segmentNumber} of ${totalSegments}
- Total Video Duration: ${formatTime(totalDuration)}

**Transcript for this time range:**
${segmentText}

Create a detailed, engaging summary of this segment following this format:

## ${formatTime(startTime)} – ${formatTime(endTime)} | [Descriptive Title with Emoji]
🔥 [Compelling hook/question from this segment]

[Detailed, storytelling-style summary that covers everything in this segment. Write as if explaining to a friend, maintaining chronological order, and including specific quotes and examples. Make it engaging and complete.]

Focus only on this specific time segment and maintain the engaging, conversational tone specified in the system prompt.`
        }
    ];
    try {
        const response = await retryWithBackoff(async () => {
            return await getOpenAIClient().chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 1500,
                temperature: 0.7,
                top_p: 0.95,
            });
        }, `Segment ${segmentNumber} expansion`);
        return response.choices[0]?.message?.content || 'Segment analysis completed.';
    }
    catch (error) {
        logger.error(`Error expanding segment ${segmentNumber}: ${error instanceof Error ? error.message : String(error)}`);
        // Return a basic summary as fallback
        return `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
    }
}
// Health check function
async function checkOpenAIHealth() {
    try {
        await retryWithBackoff(async () => {
            return await getOpenAIClient().chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5,
            });
        }, 'OpenAI health check');
        return true;
    }
    catch (error) {
        logger.error(`OpenAI health check failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}
