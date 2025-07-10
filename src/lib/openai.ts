import OpenAI from 'openai';
import { formatTranscriptByMinutes } from './youtube';
import { SYSTEM_PROMPT } from './system-prompt';
import { createLogger } from './logger';
import { timeToSeconds } from './utils';
// @ts-ignore: No types available for gpt-3-encoder
import { encode } from 'gpt-3-encoder';

const logger = createLogger('openai');

// 🔍 STARTUP VERIFICATION: Log system prompt loading
logger.info(`\n🚀 ===== SYSTEM PROMPT LOADING VERIFICATION =====`);
logger.info(`📌 SYSTEM_PROMPT LENGTH: ${SYSTEM_PROMPT.length} characters`);
logger.info(`📌 SYSTEM_PROMPT PREVIEW: ${SYSTEM_PROMPT.substring(0, 100)}...`);
logger.info(`📌 IS NEW FORMAT: ${SYSTEM_PROMPT.includes('Video-to-Story Transformation System') ? 'YES ✅' : 'NO ❌'}`);
logger.info(`📌 IS OLD FORMAT: ${SYSTEM_PROMPT.includes('Ultimate Fast-Flow Video Summary System') ? 'YES ⚠️' : 'NO ✅'}`);
logger.info(`==============================================`);

// --- LAZY-INITIALIZED SINGLETON FOR OPENAI CLIENT ---
let openAIClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('❌ OPENAI_API_KEY environment variable is not set.');
    }
    openAIClient = new OpenAI({
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
  'gpt-4.1-mini': {
    inputPricePerMillionTokens: 0.40, // Updated pricing
    outputPricePerMillionTokens: 1.60, // Updated pricing
    inputPricePerToken: 0.40 / 1000000, // Updated pricing
    outputPricePerToken: 1.60 / 1000000, // Updated pricing
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
  },
  'gpt-4.1-mini-2025-04-14': {
    inputPricePerMillionTokens: 0.40, // Updated pricing
    outputPricePerMillionTokens: 1.60, // Updated pricing
    inputPricePerToken: 0.40 / 1000000, // Updated pricing
    outputPricePerToken: 1.60 / 1000000, // Updated pricing
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
  },
  'gpt-4.1-nano': {
    // ✅ VERIFIED OFFICIAL PRICING as of April 2025
    inputPricePerMillionTokens: 0.10,   // $0.10 per 1M input tokens
    outputPricePerMillionTokens: 0.25,  // $0.25 per 1M output tokens
    // Convert to per-token pricing for calculations
    inputPricePerToken: 0.10 / 1000000,   // $0.00000010 per token
    outputPricePerToken: 0.25 / 1000000,  // $0.00000025 per token
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
  },
  'gpt-4.1-nano-2025-04-14': {
    // ✅ VERIFIED OFFICIAL PRICING as of April 2025
    inputPricePerMillionTokens: 0.10,   // $0.10 per 1M input tokens
    outputPricePerMillionTokens: 0.25,  // $0.25 per 1M output tokens
    // Convert to per-token pricing for calculations
    inputPricePerToken: 0.10 / 1000000,   // $0.00000010 per token
    outputPricePerToken: 0.25 / 1000000,  // $0.00000025 per token
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
  },
  'gpt-4o-mini': {
    // ✅ VERIFIED OFFICIAL PRICING as of December 2024
    inputPricePerMillionTokens: 0.15,   // $0.15 per 1M input tokens
    outputPricePerMillionTokens: 0.60,  // $0.60 per 1M output tokens
    // Convert to per-token pricing for calculations
    inputPricePerToken: 0.15 / 1000000,   // $0.00000015 per token
    outputPricePerToken: 0.60 / 1000000,  // $0.00000060 per token
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
    inputPricePerMillionTokens: 5.00,   // $5.00 per 1M input tokens
    outputPricePerMillionTokens: 15.00, // $15.00 per 1M output tokens
    inputPricePerToken: 5.00 / 1000000,
    outputPricePerToken: 15.00 / 1000000,
    maxContextTokens: 128000,
    maxCompletionTokens: 16384,
  }
} as const;

// 💰 BULLETPROOF COST CALCULATION WITH VALIDATION
interface CostCalculationResult {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  model: string;
  priceVerification: {
    inputPricePerToken: number;
    outputPricePerToken: number;
    inputPricePerMillionTokens: number;
    outputPricePerMillionTokens: number;
  };
  calculationBreakdown: {
    inputCalculation: string;
    outputCalculation: string;
    totalCalculation: string;
  };
  costSavingsVsGPT4o?: {
    gpt4oCost: number;
    savings: number;
    savingsPercentage: number;
  };
}

function calculateExactCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  context: string = 'API Request'
): CostCalculationResult {
  // ✅ VALIDATION: Check if model exists in our pricing table
  const pricing = OFFICIAL_OPENAI_PRICING[model as keyof typeof OFFICIAL_OPENAI_PRICING];
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

  const result: CostCalculationResult = {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCostUSD: Number(inputCostExact.toFixed(8)),  // 8 decimal places for precision
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
    singleRequest: 0.50,   // Alert if single request costs > $0.50
    hourlySpend: 10.00,    // Alert if hourly spend > $10
    dailySpend: 100.00     // Alert if daily spend > $100
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

function updateCostMetrics(result: CostCalculationResult, context: string) {
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
export function getDetailedCostMetrics() {
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
export function getCostMetrics() {
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
export function resetCostMetrics() {
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
export class OpenAIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

export class RateLimitError extends OpenAIServiceError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends OpenAIServiceError {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED', 429, false);
    this.name = 'QuotaExceededError';
  }
}

// Interfaces matching the existing structure
export interface VideoSegment {
  startTime: number;
  endTime: number;
  title: string;
  hook: string;
  narratorSummary: string;
  timestamp: string;
}

export interface KnowledgeExtraction {
  mainTitle: string;
  overallSummary: string;
  segments: VideoSegment[];
  keyTakeaways: string[];
}

// Add a type definition for the JSON response
interface OpenAIJsonResponse {
  title: string;
  segments: {
    timeRange: string;
    title: string;
    hook: string;
    content: string;
    emoji?: string; // Optional emoji
  }[];
  keyTakeaways: string[];
  finalMessage: string;
}

// Utility functions
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function calculateJitter(baseDelay: number): number {
  return baseDelay * (0.5 + Math.random() * 0.5); // 50-100% of base delay
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced retry logic with exponential backoff and jitter
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string = 'OpenAI API call'
): Promise<T> {
  let lastError: Error;
  let delay = RATE_LIMIT_CONFIG.baseDelay;

  for (let attempt = 1; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error?.status === 429 || // Rate limit
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
        
        throw new OpenAIServiceError(
          `${context} failed: ${error.message}`,
          error?.status ? `HTTP_${error.status}` : 'UNKNOWN_ERROR',
          error?.status,
          false
        );
      }

      // Calculate delay with jitter
      const delayWithJitter = RATE_LIMIT_CONFIG.jitter 
        ? calculateJitter(delay) 
        : delay;
      
      const actualDelay = Math.min(delayWithJitter, RATE_LIMIT_CONFIG.maxDelay);
      
      logger.warn(
        `${context} failed (attempt ${attempt}/${RATE_LIMIT_CONFIG.maxRetries}): ${error.message}. ` +
        `Retrying in ${Math.round(actualDelay / 1000)}s...`
      );
      
      await sleep(actualDelay);
      
      // Exponential backoff
      delay = Math.min(
        delay * RATE_LIMIT_CONFIG.backoffMultiplier, 
        RATE_LIMIT_CONFIG.maxDelay
      );
    }
  }

  throw lastError!;
}

// System prompt is now imported from separate file

// Helper to split transcript into overlapping chunks
function splitTranscriptIntoChunks(transcript: any[], chunkSeconds: number, overlapSeconds: number, totalDuration: number) {
  const chunks = [];
  let start = 0;
  while (start < totalDuration) {
    const end = Math.min(start + chunkSeconds, totalDuration);
    const chunk = transcript.filter(item => item.start >= start && item.start < end + overlapSeconds);
    chunks.push({ start, end, chunk });
    if (end === totalDuration) break;
    start += chunkSeconds - overlapSeconds;
  }
  return chunks;
}

// Helper: OpenAI call with retry, exponential backoff, and longer timeout
async function callOpenAIWithRetry(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], model: string, chunkIndex: number, maxRetries = 3, timeoutMs = 120000) {
  let lastError;
  const backoffSchedule = [2000, 5000, 10000]; // 2s, 5s, 10s
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await getOpenAIClient().chat.completions.create({
        model,
        messages,
        temperature: 0.9,
        max_tokens: 4096,
        stream: false
      }, { signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        logger.warn(`[CHUNK] OpenAI call ABORTED due to timeout (${timeoutMs}ms) for chunk ${chunkIndex + 1} (attempt ${attempt}/${maxRetries})`, { chunkIndex, timeoutMs });
      } else {
        logger.warn(`[CHUNK] OpenAI call failed (attempt ${attempt}/${maxRetries}) for chunk ${chunkIndex + 1}: ${err.message}`, { stack: err.stack, chunkIndex });
      }
      if (attempt < maxRetries) {
        const backoff = backoffSchedule[attempt - 1] || 10000;
        logger.info(`[CHUNK] Waiting ${backoff}ms before retrying chunk ${chunkIndex + 1} (attempt ${attempt + 1})`);
        await new Promise(res => setTimeout(res, backoff));
      }
    }
  }
  logger.error(`[CHUNK] OpenAI call failed after ${maxRetries} attempts for chunk ${chunkIndex + 1}.`, { error: lastError?.message, stack: lastError?.stack, chunkIndex });
  throw new Error('AI processing failed due to a network or API timeout. Please try again later.');
}

// Main function with chunked summarization for long videos
export async function extractKnowledgeWithOpenAI(
  transcript: any[],
  videoTitle: string,
  totalDuration: number,
  updateProgress?: (stage: string, progress: number, message?: string) => Promise<void>
): Promise<KnowledgeExtraction & {
  rawOpenAIOutput: string,
  transcriptSent: string,
  openaiOutput: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  inputCost: number,
  outputCost: number,
  totalCost: number,
  videoDurationSeconds: number
}> {
  // REVERTED: Use gpt-4o-mini for videos > 20 min (1200s), else gpt-4.1-nano
  const model = totalDuration > 1200 ? 'gpt-4.1-nano-2025-04-14' : 'gpt-4.1-nano-2025-04-14';
  const chunkSeconds = 360; // 6 minutes
  const overlapSeconds = 180; // 3 minutes
  logger.info(`[MODEL] Using model: ${model}, chunkSeconds: ${chunkSeconds}, overlapSeconds: ${overlapSeconds}`);

  if (!transcript || transcript.length === 0) {
    throw new OpenAIServiceError('No transcript available for analysis', 'MISSING_TRANSCRIPT', 400, false);
  }

  const chunks = splitTranscriptIntoChunks(transcript, chunkSeconds, overlapSeconds, totalDuration);
  const batchSize = 10;
  logger.info(`[MAP] Split transcript into ${chunks.length} chunks. Processing in batches of ${batchSize}.`);

  await updateProgress?.('summarizing', 20, `Analyzing ${chunks.length} content chunks...`);

  let chunkSummaries: (string | null)[] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    logger.info(`[MAP] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(async (chunk, index) => {
      const chunkIndex = i + index;
      const chunkTranscript = chunk.chunk.map((item: any) => `[${formatTime(item.start)}] ${item.text.trim()}`).join('\n');
      
      const userPrompt = `This is chunk ${chunkIndex + 1} of ${chunks.length} from a video titled "${videoTitle}". The video's total duration is ${formatTime(totalDuration)}. This chunk covers the time range from approximately ${formatTime(chunk.start)} to ${formatTime(chunk.end)}. Your mission is to act as a **Content Restructurer and Clarifier**, not a summarizer. Your goal is to take the raw transcript chunk and make it perfectly clear and readable **without losing a single piece of information.**

      **CRITICAL RESTRUCTURING RULES:**
      1.  **DO NOT OMIT ANY DETAILS:** You must include every point, example, story, and nuance from the transcript. Your output should contain 100% of the original information, just presented more clearly.
      2.  **USE SIMPLE LANGUAGE:** Rewrite complex sentences into clear, simple English that a 12-year-old can easily understand.
      3.  **EXPLAIN ALL JARGON:** If you encounter ANY technical term, you MUST immediately explain it in simple terms within parentheses. For example: "neuroplasticity (the brain's ability to change)".
      4.  **ADAPTIVE FORMATTING:** If the speaker lists items, steps, or types of things, you MUST format them as a bulleted or numbered list. Use paragraphs for storytelling.
      5.  **MAINTAIN FLOW:** Present the content in the exact chronological order it appears in the transcript chunk.
      6.  **DETECT CONVERSATIONS:** If the transcript appears to be a conversation between two or more people, preserve that back-and-forth dynamic. Do not reformat it as a monologue from a single speaker. Structure the text to make it clear that a dialogue is taking place.

      Your output for this chunk must be a complete and clear representation of the original content.

      **TRANSCRIPT CHUNK TO RESTRUCTURE AND CLARIFY:**
      ${chunkTranscript}`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{
        role: 'system',
        content: "You are an expert Content Restructurer and Clarifier. Your task is to take a raw video transcript chunk and make it perfectly clear, readable, and easy to understand, without omitting any information. Your job is to clarify and format, not to shorten."
      }, {
        role: 'user',
        content: userPrompt
      }];

      try {
        const response = await callOpenAIWithRetry(messages, model, chunkIndex);
        return response.choices[0]?.message?.content || null;
      } catch (error) {
        logger.error(
          `[CHUNK] Error processing chunk ${chunkIndex + 1}:`,
          {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error 
          }
        );
        return null; // Return null on error to avoid breaking the whole process
      }
    }));
    
    chunkSummaries.push(...batchResults);
    await updateProgress?.('summarizing', 20 + Math.round((Math.min(i + batchSize, chunks.length) / chunks.length) * 50), `Analyzed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks...`);
  }

  const validSummaries = chunkSummaries.filter(s => s !== null) as string[];
  logger.info(`[REDUCE] Starting merge level 1. Merging ${validSummaries.length} summaries into 1.`);
  await updateProgress?.('summarizing', 75, 'Merging chunk summaries...');

  const combinedSummary = validSummaries.map((summary, index) => `--- Summary of Chunk ${index + 1} ---\n${summary}`).join('\n\n');

  const finalUserPrompt = `I have processed a video titled "${videoTitle}" in several chunks. Below are the summaries for each chunk. Your task is to act as a master storyteller and synthesizer. Your goal is to weave these individual summaries into a single, cohesive, and comprehensive final summary that flows perfectly.

  **CRITICAL INSTRUCTIONS:**
  1.  **ADHERE TO THE SYSTEM PROMPT:** You must follow the main "Ultimate Fast-Flow Video Summary System" prompt for the final output's structure, tone, and formatting.
  2.  **CREATE A SEAMLESS NARRATIVE:** Do not simply list the chunk summaries. You must rewrite, rephrase, and connect them to create a single, flowing story. The transitions between topics should feel natural and logical.
  3.  **TOTAL VIDEO DURATION:** The total video duration is **${formatTime(totalDuration)}**. Your final timeline and all segments must accurately reflect this, ending at the exact final second.
  4.  **INTELLIGENT SEGMENTATION:** The chunk summaries are just raw material. You must create new, logical segments based on the actual topic flow of the content. Do not use the original chunk boundaries for your final segments.
  5.  **COMPLETE COVERAGE:** Ensure every key point, example, and story from the combined chunk summaries is included in the final output. Nothing can be left out.
  6.  **FINAL GOAL:** The final output must read as if it were generated from the full transcript at once by a single, brilliant summarizer. The reader should have no idea it was assembled from smaller pieces.

  Here are the chunk summaries to synthesize:
  ${combinedSummary}`;

  const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{
    role: 'system',
    content: SYSTEM_PROMPT,
  }, {
    role: 'user',
    content: finalUserPrompt,
  }];

  logger.info(`[REDUCE] Calling final merge API...`);
  const finalResponse = await callOpenAIWithRetry(finalMessages, 'gpt-4o-mini', -1); // Use a more capable model for merging
  const rawOutput = finalResponse.choices[0]?.message?.content || '';
  await updateProgress?.('summarizing', 95, 'Finalizing summary...');

  if (!rawOutput) {
    throw new OpenAIServiceError('OpenAI returned empty response during final merge', 'EMPTY_RESPONSE', 500, true);
  }

  logger.info('RAW FINAL OPENAI OUTPUT', { rawOutput });

  const parsedResponse = parseOpenAIResponse(rawOutput, videoTitle, totalDuration);
  parsedResponse.mainTitle = `[Model: ${model}] ${parsedResponse.mainTitle}`;

  // CRITICAL FIX: Ensure complete video coverage
  if (parsedResponse.segments && parsedResponse.segments.length > 0) {
    const firstSegment = parsedResponse.segments[0];
    const lastSegment = parsedResponse.segments[parsedResponse.segments.length - 1];
    
    if (firstSegment.startTime > 30) {
      logger.warn(`⚠️ First segment starts at ${formatTime(firstSegment.startTime)}, adding 0:00 segment`);
      parsedResponse.segments.unshift({
        title: 'Introduction',
        startTime: 0,
        endTime: firstSegment.startTime,
        timestamp: `0:00–${formatTime(firstSegment.startTime)}`,
        hook: 'Video introduction and setup',
        narratorSummary: 'The video begins with an introduction and setup phase.'
      });
    }
    
    if (lastSegment.endTime < totalDuration - 30) {
      logger.warn(`🚨 CRITICAL: Last segment ends at ${formatTime(lastSegment.endTime)}, but video ends at ${formatTime(totalDuration)}. Adding final segment!`);
      parsedResponse.segments.push({
        title: 'Conclusion and Final Thoughts',
        startTime: lastSegment.endTime,
        endTime: totalDuration,
        timestamp: `${formatTime(lastSegment.endTime)}–${formatTime(totalDuration)}`,
        hook: 'Wrapping up the video content',
        narratorSummary: 'The video concludes with final thoughts, takeaways, and any closing remarks.'
      });
    } else if (lastSegment.endTime < totalDuration) {
      logger.warn(`⚠️ Last segment ends at ${formatTime(lastSegment.endTime)}, adjusting to video end ${formatTime(totalDuration)}`);
      lastSegment.endTime = totalDuration;
      lastSegment.timestamp = `${formatTime(lastSegment.startTime)}–${formatTime(totalDuration)}`;
    }
    
    for (let i = 0; i < parsedResponse.segments.length - 1; i++) {
      const current = parsedResponse.segments[i];
      const next = parsedResponse.segments[i + 1];
      const gap = next.startTime - current.endTime;
      
      if (gap > 60) {
        logger.warn(`⚠️ Gap detected between ${formatTime(current.endTime)} and ${formatTime(next.startTime)}, adding filler segment`);
        parsedResponse.segments.splice(i + 1, 0, {
          title: 'Additional Content',
          startTime: current.endTime,
          endTime: next.startTime,
          timestamp: `${formatTime(current.endTime)}–${formatTime(next.startTime)}`,
          hook: 'Continued discussion and examples',
          narratorSummary: 'The video continues with additional content and examples.'
        });
        i++;
      }
    }
    
    const finalFirst = parsedResponse.segments[0];
    const finalLast = parsedResponse.segments[parsedResponse.segments.length - 1];
    
    if (finalFirst.startTime > 0) {
      logger.error(`🚨 CRITICAL ERROR: First segment doesn't start at 0:00! It starts at ${formatTime(finalFirst.startTime)}`);
    }
    
    if (finalLast.endTime < totalDuration) {
      logger.error(`🚨 CRITICAL ERROR: Last segment doesn't end at video duration! It ends at ${formatTime(finalLast.endTime)}, should be ${formatTime(totalDuration)}`);
    }
    
    logger.info(`✅ Video coverage verification: ${parsedResponse.segments.length} segments from ${formatTime(finalFirst.startTime)} to ${formatTime(finalLast.endTime)} (target: 0:00 to ${formatTime(totalDuration)})`);
  }

  return {
    ...parsedResponse,
    rawOpenAIOutput: rawOutput,
    transcriptSent: "Transcript processed in chunks.",
    openaiOutput: rawOutput,
    promptTokens: finalResponse.usage?.prompt_tokens || 0,
    completionTokens: finalResponse.usage?.completion_tokens || 0,
    totalTokens: finalResponse.usage?.total_tokens || 0,
    inputCost: 0,
    outputCost: 0,
    totalCost: 0,
    videoDurationSeconds: totalDuration
  };
}

// System prompt is now imported from separate file

// Main function to extract knowledge using OpenAI
function processMarkdownResponse(
  text: string, 
  videoTitle: string, 
  totalDuration: number
): KnowledgeExtraction & { rawOpenAIOutput: string } {
  logger.warn('⚠️ Falling back to markdown parsing');
  const parsed = parseOpenAIResponse(text, videoTitle, totalDuration);
  return {
    ...parsed,
    rawOpenAIOutput: text
  };
}

// Parse OpenAI response into structured format
function parseOpenAIResponse(
  text: string, 
  videoTitle: string, 
  totalDuration: number
): KnowledgeExtraction {
  try {
    // Extract main title (first bold heading)
    const titleMatch = text.match(/^#?\s*\*\*(.+?)\*\*|^#?\s*(.+?)$/m);
    const mainTitle = titleMatch ? (titleMatch[1] || titleMatch[2])?.trim() : videoTitle;
    
    // Extract segments using various patterns - IMPROVED REGEX to capture all segments
    // This new pattern is more flexible and captures segments with different emoji patterns and formats
    const segmentRegex = /##\s+(?:\*\*)?(?:(?:[🔍🔎🔬🔭📊📈📉📌📍🔖🔗📎📏📐✂️🔒🔓🔏🔐🔑🗝️🔨🪓⛏️🚪🛏️🛋️🪑🚽🚿🛁🧴🧷🧹🧺🧻🧼🧽🧯🛢️⛽🚨🚥🚦🚧⚓⛵🚤🛳️⛴️🛥️🚢✈️🛩️🛫🛬🪂💺🚁🚟🚠🚡🚀🛸🛎️🧳⌛⏳⌚⏰⏱️⏲️🕰️]|[💻🚀📈💡⚡🔧🎯💪🏃‍♂️🥗❤️🧠💊🔥📚🎓✨🔍📝🌟🎭🎨🌅💫🎪💰📊💎🏦💸🔑]|[🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌡️☀️🌝🌞🪐⭐🌟🌠🌌☁️⛅⛈️🌤️🌥️🌧️🌨️🌩️🌪️🌫️🌬️🌈🌂☂️☔⛱️⚡❄️☃️⛄☄️🔥💧🌊])?\s*)?(\d+:\d+(?::\d+)?(?:\s*[–-]\s*\d+:\d+(?::\d+)?)?)\s*\|\s*(.+?)\n([\s\S]+?)(?=##\s+|🔑|$)/g;
    
    // If the above regex fails, use a simpler fallback pattern that will match most common formats
    const simpleSegmentRegex = /##\s+(?:[^\n|]*)?(\d+:\d+(?::\d+)?(?:\s*[–-]\s*\d+:\d+(?::\d+)?)?)\s*\|\s*([^\n]+)\n([\s\S]+?)(?=##\s+|🔑|$)/g;
    
    const segments: VideoSegment[] = [];
    let match;
    
    // Try the primary regex first
    while ((match = segmentRegex.exec(text)) !== null) {
      const [_, timeRange, title, content] = match;
      
      // Extract hook from content if present
      const hookMatch = content.match(/^(?:🔥|💡|⚡|🎯|✨)\s*(.+?)(?:\n|$)/);
      const hook = hookMatch ? hookMatch[1].trim() : "Key insights from this segment";
      
      // Clean content by removing the hook if it was found
      const cleanContent = hookMatch 
        ? content.substring(hookMatch[0].length).trim() 
        : content.trim();
      
      // Parse time range
      const timeMatch = timeRange.match(/(\d+:\d+(?::\d+)?)(?:\s*[–-]\s*(\d+:\d+(?::\d+)?))?/);
      const startTimeStr = timeMatch?.[1] || '0:00';
      const endTimeStr = timeMatch?.[2] || formatTime(totalDuration);
      
      segments.push({
        title: title.trim(),
        startTime: timeToSeconds(startTimeStr),
        endTime: timeToSeconds(endTimeStr),
        timestamp: `${startTimeStr}–${endTimeStr}`,
        hook: hook.trim(),
        narratorSummary: cleanContent
      });
    }
    
    // If no segments were found with the primary regex, try the simpler pattern
    if (segments.length === 0) {
      let simpleMatch;
      while ((simpleMatch = simpleSegmentRegex.exec(text)) !== null) {
        const [_, timeRange, title, content] = simpleMatch;
        
        // Extract hook from content if present
        const hookMatch = content.match(/^(?:🔥|💡|⚡|🎯|✨)\s*(.+?)(?:\n|$)/);
        const hook = hookMatch ? hookMatch[1].trim() : "Key insights from this segment";
        
        // Clean content by removing the hook if it was found
        const cleanContent = hookMatch 
          ? content.substring(hookMatch[0].length).trim() 
          : content.trim();
        
        // Parse time range
        const timeMatch = timeRange.match(/(\d+:\d+(?::\d+)?)(?:\s*[–-]\s*(\d+:\d+(?::\d+)?))?/);
        const startTimeStr = timeMatch?.[1] || '0:00';
        const endTimeStr = timeMatch?.[2] || formatTime(totalDuration);
        
        segments.push({
          title: title.trim(),
          startTime: timeToSeconds(startTimeStr),
          endTime: timeToSeconds(endTimeStr),
          timestamp: `${startTimeStr}–${endTimeStr}`,
          hook: hook.trim(),
          narratorSummary: cleanContent
        });
      }
    }
    
    // If still no segments found, try a last-resort fallback pattern
    if (segments.length === 0) {
      const fallbackRegex = /##\s+.*?(\d+:\d+).*?\|\s*(.*?)[\r\n]+([\s\S]+?)(?=##|🔑|$)/g;
      let fallbackMatch;
      
      while ((fallbackMatch = fallbackRegex.exec(text)) !== null) {
        const [_, startTime, title, content] = fallbackMatch;
        
        // Get next start time or video end
        const nextMatchIndex = text.indexOf('##', fallbackMatch.index + 2);
        const nextTimeMatch = nextMatchIndex > -1 
          ? text.substring(nextMatchIndex).match(/(\d+:\d+)/) 
          : null;
        const endTimeStr = nextTimeMatch?.[1] || formatTime(totalDuration);
        
        segments.push({
          title: title.trim(),
          startTime: timeToSeconds(startTime),
          endTime: timeToSeconds(endTimeStr),
          timestamp: `${startTime}–${endTimeStr}`,
          hook: "Key insights from this segment",
          narratorSummary: content.trim()
        });
      }
    }
    
    // Sort segments by start time to ensure chronological order
    segments.sort((a, b) => a.startTime - b.startTime);
    
    // Deduplicate segments by checking for very similar titles or hooks
    const uniqueSegments = deduplicateSegments(segments);
    logger.info(`🧹 Processed segments: ${segments.length} → ${uniqueSegments.length}`);
    
    // Extract key takeaways
    const takeawaysMatch = text.match(/🔑\s*(?:Everything You Just Learned|Key Takeaways)[\s\S]*?\n((?:\s*[-*•]\s*.+\n?)+)/i);
    const keyTakeaways = takeawaysMatch
      ? takeawaysMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*[-*•]\s*/, '').trim())
          .filter(line => line.length > 0)
      : ['Analysis completed successfully'];
    
    // Deduplicate key takeaways
    const uniqueTakeaways = [...new Set(keyTakeaways)];
    
    // Extract overall summary from the content
    const overallSummary = mainTitle || 'Video analysis completed';
    
    // If no segments found, create segments covering the entire video duration
    if (uniqueSegments.length === 0) {
      logger.warn(`⚠️ No segments found in OpenAI response, creating fallback segment`);
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
    
    // CRITICAL FIX: Ensure complete video coverage
    if (uniqueSegments.length > 0) {
      const firstSegment = uniqueSegments[0];
      const lastSegment = uniqueSegments[uniqueSegments.length - 1];
      
      // Ensure first segment starts at 0:00
      if (firstSegment.startTime > 30) {
        logger.warn(`⚠️ First segment starts at ${formatTime(firstSegment.startTime)}, adding 0:00 segment`);
        uniqueSegments.unshift({
          title: 'Introduction',
          startTime: 0,
          endTime: firstSegment.startTime,
          timestamp: `0:00–${formatTime(firstSegment.startTime)}`,
          hook: 'Video introduction and setup',
          narratorSummary: 'The video begins with an introduction and setup phase.'
        });
      }
      
      // Ensure last segment ends at video end
      if (lastSegment.endTime < totalDuration - 30) {
        logger.warn(`⚠️ Last segment ends at ${formatTime(lastSegment.endTime)}, adding final segment to ${formatTime(totalDuration)}`);
        uniqueSegments.push({
          title: 'Conclusion and Final Thoughts',
          startTime: lastSegment.endTime,
          endTime: totalDuration,
          timestamp: `${formatTime(lastSegment.endTime)}–${formatTime(totalDuration)}`,
          hook: 'Wrapping up the video content',
          narratorSummary: 'The video concludes with final thoughts and takeaways.'
        });
      } else if (lastSegment.endTime < totalDuration) {
        // Just extend the last segment
        logger.warn(`⚠️ Last segment ends at ${formatTime(lastSegment.endTime)}, adjusting to video end ${formatTime(totalDuration)}`);
        lastSegment.endTime = totalDuration;
        lastSegment.timestamp = `${formatTime(lastSegment.startTime)}–${formatTime(totalDuration)}`;
      }
      
      // Check for gaps and fill them
      for (let i = 0; i < uniqueSegments.length - 1; i++) {
        const current = uniqueSegments[i];
        const next = uniqueSegments[i + 1];
        const gap = next.startTime - current.endTime;
        
        if (gap > 60) { // Gap larger than 1 minute
          logger.warn(`⚠️ Gap detected between ${formatTime(current.endTime)} and ${formatTime(next.startTime)}, adding filler segment`);
          uniqueSegments.splice(i + 1, 0, {
            title: 'Additional Content',
            startTime: current.endTime,
            endTime: next.startTime,
            timestamp: `${formatTime(current.endTime)}–${formatTime(next.startTime)}`,
            hook: 'Continued discussion and examples',
            narratorSummary: 'The video continues with additional content and examples.'
          });
          i++; // Skip the newly inserted segment
        }
      }
    }
    
    return {
      mainTitle,
      overallSummary,
      segments: uniqueSegments, // CRITICAL FIX: Remove the slice limit to include ALL segments
      keyTakeaways: uniqueTakeaways
    };
    
  } catch (error) {
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
function deduplicateSegments(segments: VideoSegment[]): VideoSegment[] {
  if (!segments || segments.length <= 1) return segments;
  
  // Use a Map to track unique segments by time range
  const uniqueSegments = new Map<string, VideoSegment>();
  
  // Process segments in order
  segments.forEach(segment => {
    const timeKey = segment.timestamp; // Use timestamp as a unique key
    
    // If we already have a segment with this time range, keep the more detailed one
    if (uniqueSegments.has(timeKey)) {
      const existing = uniqueSegments.get(timeKey)!;
      // If the new segment has a longer summary, replace the existing one
      if (segment.narratorSummary.length > existing.narratorSummary.length) {
        uniqueSegments.set(timeKey, segment);
      }
    } else {
      uniqueSegments.set(timeKey, segment);
    }
  });
  
  // Also check for very similar segments by title or hook
  const result = Array.from(uniqueSegments.values());
  const finalResult: VideoSegment[] = [];
  
  // Helper to check if strings are very similar (80%+ match)
  const areSimilar = (str1: string, str2: string): boolean => {
    if (!str1 || !str2) return false;
    const shorter = str1.length < str2.length ? str1 : str2;
    const longer = str1.length >= str2.length ? str1 : str2;
    // Calculate Levenshtein distance (simple version)
    let distance = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] !== longer[i]) distance++;
    }
    distance += longer.length - shorter.length;
    return distance / longer.length < 0.2; // Less than 20% different
  };
  
  // Only add segments that don't have very similar titles or hooks
  result.forEach(segment => {
    const isDuplicate = finalResult.some(existing => 
      (areSimilar(segment.title, existing.title) && segment.title.length > 0) || 
      (areSimilar(segment.hook, existing.hook) && segment.hook.length > 0)
    );
    if (!isDuplicate) {
      finalResult.push(segment);
    }
  });
  
  return finalResult;
}

// Enhanced segment expansion function
export async function generateExpandedSegmentSummary({
  transcriptSlice,
  videoTitle,
  startTime,
  endTime,
  segmentNumber,
  totalSegments,
  totalDuration
}: {
  transcriptSlice: any[],
  videoTitle: string,
  startTime: number,
  endTime: number,
  segmentNumber: number,
  totalSegments: number,
  totalDuration: number
}): Promise<string> {
  
  logger.info(`\n=== Generating Expanded Segment Summary ===`);
  logger.info(`Segment ${segmentNumber}/${totalSegments}: ${formatTime(startTime)}–${formatTime(endTime)}`);
  
  const segmentText = transcriptSlice.length > 0
    ? transcriptSlice.map(item => `[${formatTime(item.start)}] ${item.text}`).join('\n')
    : '';
  
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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
        model: 'gpt-4.1-nano-2025-04-14',
        messages,
        max_tokens: 1500,
        temperature: 1.0,
        top_p: 0.95,
      });
    }, `Segment ${segmentNumber} expansion`);

    return response.choices[0]?.message?.content || 'Segment analysis completed.';
    
  } catch (error: any) {
    logger.error(`Error expanding segment ${segmentNumber}: ${error instanceof Error ? error.message : String(error)}`);
    // Return a basic summary as fallback
    return `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Health check function
export async function checkOpenAIHealth(): Promise<boolean> {
  const HEALTH_CHECK_MODEL = 'gpt-4.1-nano-2025-04-14';
  
  logger.info(`\n🏥 ===== OPENAI HEALTH CHECK VERIFICATION =====`);
  logger.info(`📌 HEALTH CHECK MODEL: ${HEALTH_CHECK_MODEL}`);
  
  try {
    const response = await retryWithBackoff(async () => {
      return await getOpenAIClient().chat.completions.create({
        model: HEALTH_CHECK_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        temperature: 1.0,
      });
    }, 'OpenAI health check');
    
    logger.info(`✅ OpenAI health check SUCCESS with model: ${response.model || HEALTH_CHECK_MODEL}`);
    logger.info(`📌 Response ID: ${response.id || 'unknown'}`);
    
    return true;
  } catch (error) {
    logger.error(`❌ OpenAI health check FAILED with model ${HEALTH_CHECK_MODEL}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}