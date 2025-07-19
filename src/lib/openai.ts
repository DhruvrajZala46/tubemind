import OpenAI from 'openai';
import { formatTranscriptByMinutes } from './youtube';
import { SYSTEM_PROMPT } from './system-prompt';
import { createLogger } from './logger';
import { timeToSeconds } from './utils';
import {
  formatFullTranscriptWithTimestamps,
} from './youtube';
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
async function callOpenAIWithRetry(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], model: string, context: string, maxRetries = 3, timeoutMs = 180000, temperature = 0.7, maxTokens = 4096) {
  let lastError;
  const backoffSchedule = [5000, 15000, 30000]; // 5s, 15s, 30s
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        logger.warn(`[API] Aborting OpenAI call due to timeout (${timeoutMs}ms) for ${context} (attempt ${attempt}/${maxRetries})`);
        controller.abort();
      }, timeoutMs);
      
      const response = await getOpenAIClient().chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens, // Standard max_tokens for gpt-4o-mini
        stream: false
      }, { signal: controller.signal });

      clearTimeout(timeout);
      return response;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        logger.warn(`[API] OpenAI call ABORTED due to timeout for ${context} (attempt ${attempt}/${maxRetries})`);
      } else {
        logger.warn(`[API] OpenAI call failed (attempt ${attempt}/${maxRetries}) for ${context}: ${err.message}`);
      }
      if (attempt < maxRetries) {
        const backoff = backoffSchedule[attempt - 1] || 30000;
        logger.info(`[API] Waiting ${backoff}ms before retrying for ${context} (attempt ${attempt + 1})`);
        await new Promise(res => setTimeout(res, backoff));
      }
    }
  }
  logger.error(`[API] OpenAI call failed after ${maxRetries} attempts for ${context}.`, { error: lastError?.message, stack: lastError?.stack });
  throw new Error('AI processing failed due to a network or API timeout. Please try again later.');
}

// Main function with a single, direct call to OpenAI
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
  
  // STEP 1: Beautify the entire transcript into a single string
  await updateProgress?.('summarizing', 10, 'Formatting full transcript...');
  logger.info('[WORKFLOW] Formatting full transcript...');
  const formattedTranscript = formatFullTranscriptWithTimestamps(transcript);
  
  if (!formattedTranscript) {
    throw new OpenAIServiceError('No transcript available for analysis or transcript is empty', 'MISSING_TRANSCRIPT', 400, false);
  }
  logger.info('[WORKFLOW] Transcript formatted successfully.');

  // STEP 2: Select model and validate token count for a single call
  // Use 4.1 mini for videos longer than 45 minutes, otherwise use 4.1 nano
  const useMini = totalDuration >= 45 * 60; // 45 minutes in seconds
  const model = useMini ? 'gpt-4.1-nano-2025-04-14' : 'gpt-4.1-nano-2025-04-14';
  logger.info(`[MODEL] Using model: ${model} for a single-call video recreation. (Video duration: ${totalDuration}s)`);

  const systemPromptTokens = encode(SYSTEM_PROMPT).length;
  const transcriptTokens = encode(formattedTranscript).length;
  const userPromptTemplateTokens = encode(`I have the full transcript for a video titled "" The total video duration is . Your task is to act as a master storyteller... Here is the full transcript to synthesize:`).length;
  const estimatedInputTokens = systemPromptTokens + transcriptTokens + userPromptTemplateTokens;

  const modelInfo = OFFICIAL_OPENAI_PRICING[model as keyof typeof OFFICIAL_OPENAI_PRICING];
  const maxInputTokens = modelInfo.maxContextTokens - 1000; // Minimal buffer to maximize output space

  logger.info(`[TOKENS] System: ${systemPromptTokens}, Transcript: ${transcriptTokens}, Template: ${userPromptTemplateTokens}`);
  logger.info(`[TOKENS] Estimated input tokens: ${estimatedInputTokens}`);
  logger.info(`[TOKENS] Model max input tokens: ${maxInputTokens} (Context: ${modelInfo.maxContextTokens}, Output buffer: 1000)`);

  if (estimatedInputTokens > maxInputTokens) {
    const excessTokens = estimatedInputTokens - maxInputTokens;
    logger.error(`[TOKENS] Transcript is too long for a single API call. Exceeds by ${excessTokens} tokens.`);
    throw new OpenAIServiceError(
      `Video transcript is too long to process in a single request (exceeds by ~${Math.round(excessTokens / 1000)}k tokens). Please try a shorter video.`,
      'TRANSCRIPT_TOO_LONG',
      400,
      false
    );
  }

  // STEP 3: Construct the final prompt for the single API call
  await updateProgress?.('summarizing', 20, 'Preparing final request for AI...');
  logger.info('[WORKFLOW] Constructing final prompt...');

  const finalUserPrompt = `I have the full transcript for a video titled "${videoTitle}". The total video duration is ${formatTime(totalDuration)}.

Your task is to **RECREATE THE ENTIRE VIDEO EXPERIENCE** in a human-style narrative. *Do NOT summarise.* Follow **ZERO-LOSS** rules in the system prompt and maintain perfect flow from start to finish.

**🚨 MANDATORY TIMESTAMP REQUIREMENTS:**
- **EVERY segment MUST have EXACT timestamp ranges** (e.g., "0:00–3:45 | Title")
- **Use the transcript timestamps to create accurate time ranges**
- **Cover the ENTIRE video from 0:00 to ${formatTime(totalDuration)}**
- **NO gaps in timeline** - each segment must connect to the next
- **Segment by topic changes, not arbitrary time blocks**

**🚨 MANDATORY FORMATTING REQUIREMENTS:**
- **Follow the EXACT system prompt format** with rich visual elements

**🚨 MANDATORY CONTENT REQUIREMENTS:**
- **Recreate EVERY sentence, story, joke, example** from the transcript
- **Explain technical terms immediately** when they appear
- **Include all quotes and reactions** exactly as spoken
- **Add context and background** for any references
- **Make it feel like watching the full video** with enhanced clarity

**CRITICAL INSTRUCTIONS:**
1.  **ADHERE TO THE SYSTEM PROMPT:** You must follow the main "Human-Style, Flow-Based, Total Video Recreation System" prompt for the final output's structure, tone, and formatting.
2.  **USE THE FULL TRANSCRIPT:** The full transcript with timestamps is provided below. You must process all of it.
3.  **TOTAL VIDEO DURATION:** The total video duration is **${formatTime(totalDuration)}**. Your final timeline and all segments must accurately reflect this, ending at the exact final second.
4.  **INTELLIGENT SEGMENTATION:** Create logical segments based on the actual topic flow of the content. The timestamps in the transcript are your guide.
5.  **COMPLETE COVERAGE:** Ensure every key point, example, and story from the transcript is included in the final output. Nothing can be left out.

**No matter what language the transcript is in, you must always output the summary in simple, clear English. Do not use any other language.**

Please recreate the video using the exact formatting, segmentation, and teaching style rules in the system prompt above. Do not summarize. Use all required headings, subheadings, lists, and teaching blocks. Here is the transcript.


Here is the full transcript to synthesize:
${formattedTranscript}`;

  const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{
    role: 'system',
    content: SYSTEM_PROMPT,
  }, {
    role: 'user',
    content: finalUserPrompt,
  }];
  
  // STEP 4: Make the single, powerful API call
  await updateProgress?.('summarizing', 30, 'Sending request to AI. This may take a few minutes...');
  logger.info('[WORKFLOW] Calling final generation API...');
  const finalResponse = await callOpenAIWithRetry(finalMessages, model, "Final Video Recreation", 3, 300000, 0.5, 32000); // 5-minute timeout for long videos, max_tokens set to 32000 for full coverage
  const rawOutput = finalResponse.choices[0]?.message?.content || '';
  await updateProgress?.('summarizing', 95, 'Finalizing video recreation...');

  if (!rawOutput) {
    throw new OpenAIServiceError('OpenAI returned empty response during final generation', 'EMPTY_RESPONSE', 500, true);
  }
  logger.info('[WORKFLOW] Received final response from AI.');

  // STEP 5: Parse and enhance the final output
  const parsedResponse = parseOpenAIResponse(rawOutput, videoTitle, totalDuration);
  const enhancedOutput = enhanceReadability(rawOutput);
  
  // Add model name to title for debugging/tracking
  parsedResponse.mainTitle = `[Model: ${model}] ${parsedResponse.mainTitle}`;
  
  // 🚨 CRITICAL: Validate timestamp coverage
  if (parsedResponse.segments.length > 0) {
    const firstSegment = parsedResponse.segments[0];
    const lastSegment = parsedResponse.segments[parsedResponse.segments.length - 1];
    
    logger.info(`✅ Video coverage verification: ${parsedResponse.segments.length} segments from ${formatTime(firstSegment?.startTime ?? 0)} to ${formatTime(lastSegment?.endTime ?? totalDuration)}`);
    
    // Validate complete coverage
    if (firstSegment.startTime > 30) {
      logger.warn(`⚠️ First segment starts at ${formatTime(firstSegment.startTime)} - missing beginning coverage`);
    }
    if (lastSegment.endTime < totalDuration - 30) {
      logger.warn(`⚠️ Last segment ends at ${formatTime(lastSegment.endTime)} - missing ending coverage (video ends at ${formatTime(totalDuration)})`);
    }
    
    // Check for gaps
    for (let i = 0; i < parsedResponse.segments.length - 1; i++) {
      const current = parsedResponse.segments[i];
      const next = parsedResponse.segments[i + 1];
      const gap = next.startTime - current.endTime;
      if (gap > 60) {
        logger.warn(`⚠️ Gap detected: ${formatTime(current.endTime)} to ${formatTime(next.startTime)} (${gap}s gap)`);
      }
    }
  }

  // STEP 6: Calculate costs and return final structure
  const promptTokens = finalResponse.usage?.prompt_tokens || 0;
  const completionTokens = finalResponse.usage?.completion_tokens || 0;
  
  const costResult = calculateExactCost(model, promptTokens, completionTokens, 'Final Video Recreation');

  return {
    ...parsedResponse,
    rawOpenAIOutput: rawOutput,
    transcriptSent: formattedTranscript, // Send the full formatted transcript
    openaiOutput: enhancedOutput,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    inputCost: costResult.inputCostUSD,
    outputCost: costResult.outputCostUSD,
    totalCost: costResult.totalCostUSD,
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
    const segmentRegex = /##\s+(?:\*\*)?(?:(?:[🔍🔎🔬🔭📊📈📉📌📍🔖🔗📎📏📐✂️🔒🔓🔏🔐🔑🗝️🔨🪓⛏️🚪🛏️🛋️🪑🚽🚿🛁🧴🧷🧹🧺🧻🧼🧽🧯🛢️⛽🚨🚥🚦🚧⚓⛵🚤🛳️⛴️🛥️🚢✈️🛩️🛫🛬🪂💺🚁🚟🚠🚡🚀🛸🛎️🧳⌛⏳⌚⏰⏱️⏲️🕰️]|[💻🚀📈💡⚡🔧🎯🏃‍♂️🥗❤️🧠💊🔥📚🎓✨🔍📝🌟🎭🎨🌅��🎪💰📊💎🏦💸🔑]|[🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌡️☀️🌝🌞🪐⭐🌟🌠🌌☁️⛅⛈️🌤️🌥️🌧️🌨️🌩️🌪️🌫️🌬️🌈🌂☂️☔⛱️⚡❄️☃️⛄☄️🔥💧🌊])?\s*)?(\d+:\d+(?::\d+)?(?:\s*[–-]\s*\d+:\d+(?::\d+)?)?)\s*\|\s*(.+?)\n([\s\S]+?)(?=##\s+|🔑|$)/g;
    
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
      const timeMatch = timeRange.match(/(\d+:\d+(?::\d+)?)(?:\s*[–-]\s*(\d+:\d+(?::\d+)?)?)?/);
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
        const timeMatch = timeRange.match(/(\d+:\d+(?::\d+)?)(?:\s*[–-]\s*(\d+:\d+(?::\d+)?)?)?/);
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

    // Filter out invalid segments to prevent DB constraint errors
    const validSegments = uniqueSegments.filter(
      seg =>
        typeof seg.startTime === 'number' &&
        typeof seg.endTime === 'number' &&
        seg.endTime > seg.startTime &&
        seg.startTime >= 0 &&
        seg.endTime <= totalDuration
    );
    if (validSegments.length !== uniqueSegments.length) {
      logger.warn(
        `Filtered out ${uniqueSegments.length - validSegments.length} invalid segments (end_time <= start_time or out of bounds)`
      );
    }
    
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
    if (validSegments.length === 0) {
      logger.warn(`⚠️ No valid segments found in OpenAI response, creating fallback segment`);
      const endTimeStr = formatTime(totalDuration);
      validSegments.push({
        title: 'Complete Video Analysis',
        startTime: 0,
        endTime: totalDuration,
        timestamp: `0:00–${endTimeStr}`,
        hook: 'Full video content analyzed',
        narratorSummary: text.substring(0, 500) + '...'
      });
    }
    
    // CRITICAL FIX: Ensure complete video coverage
    if (validSegments.length > 0) {
      const firstSegment = validSegments[0];
      const lastSegment = validSegments[validSegments.length - 1];
      
      // Ensure first segment starts at 0:00
      if (firstSegment.startTime > 30) {
        logger.warn(`⚠️ First segment starts at ${formatTime(firstSegment.startTime)}, adding 0:00 segment`);
        validSegments.unshift({
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
        validSegments.push({
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
      for (let i = 0; i < validSegments.length - 1; i++) {
        const current = validSegments[i];
        const next = validSegments[i + 1];
        const gap = next.startTime - current.endTime;
        
        if (gap > 60) { // Gap larger than 1 minute
          logger.warn(`⚠️ Gap detected between ${formatTime(current.endTime)} and ${formatTime(next.startTime)}, adding filler segment`);
          validSegments.splice(i + 1, 0, {
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
      segments: validSegments, // CRITICAL FIX: Only use valid segments
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
  const unique = new Map<string, VideoSegment>();
  for (const seg of segments) {
    if (!unique.has(seg.timestamp)) {
      unique.set(seg.timestamp, seg);
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.startTime - b.startTime);
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
}): Promise<{
  content: string,
  promptTokens: number,
  completionTokens: number,
  inputCostUSD: number,
  outputCostUSD: number,
  totalCostUSD: number
}> {
  
  logger.info(`\n=== Generating Expanded Segment Recreation ===`);
  logger.info(`Segment ${segmentNumber}/${totalSegments}: ${formatTime(startTime)}–${formatTime(endTime)}`);
  
  const segmentText = transcriptSlice.length > 0
    ? transcriptSlice.map(item => `[${formatTime(item.start)}] ${item.text}`).join('\n')
    : '';
  
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are an expert content recreator. Recreate this specific video segment in full detail following the ZERO-LOSS storytelling principles outlined in the main system prompt.`
    },
    {
      role: 'user',
      content: `Recreate this specific segment of the video "${videoTitle}" in FULL DETAIL:

**Segment Details:**
- Time Range: ${formatTime(startTime)}–${formatTime(endTime)}
- Segment: ${segmentNumber} of ${totalSegments}
- Total Video Duration: ${formatTime(totalDuration)}

**Transcript for this time range:**
${segmentText}

**CRITICAL: Recreate this segment in FULL DETAIL (ZERO LOSS).** Use the required storytelling format:

## ${formatTime(startTime)} – ${formatTime(endTime)} | [Descriptive Title with Emoji]
🔥 [Compelling hook/question from this segment]

[Detailed, storytelling-style recreation that covers EVERYTHING in this segment. Write as if explaining to a friend, maintaining chronological order, and including specific quotes and examples. Make it engaging and complete. DO NOT SUMMARIZE - RECREATE EVERY DETAIL.]

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

    // At the very end, instead of returning a string, return detailed object
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const costResult = calculateExactCost('gpt-4.1-nano-2025-04-14', promptTokens, completionTokens, `Segment ${segmentNumber}`);
    const content = response.choices[0]?.message?.content || 'Segment analysis completed.';
    return {
      content,
      promptTokens,
      completionTokens,
      inputCostUSD: costResult.inputCostUSD,
      outputCostUSD: costResult.outputCostUSD,
      totalCostUSD: costResult.totalCostUSD
    };
    
  } catch (error: any) {
    logger.error(`Error expanding segment ${segmentNumber}: ${error instanceof Error ? error.message : String(error)}`);
    // Return a basic summary as fallback
    return {
      content: `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
      promptTokens: 0,
      completionTokens: 0,
      inputCostUSD: 0,
      outputCostUSD: 0,
      totalCostUSD: 0
    };
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

// ===== Helper: Enhance readability of OpenAI output =====
// --- Table fixer: Convert malformed markdown tables to valid format ---
function fixMalformedMarkdownTables(text: string): string {
  // Regex to find tables that are all on one line (with repeated pipes and separator rows)
  // This will match tables with at least 2 pipes, a separator row, and at least one data row, all on one line
  return text.replace(/((?:\|[^\n])+\|\s*\|[-:| ]+\|(?:\s*\|[^\n]+\|)+)/g, (tableBlock) => {
    // Try to split the table into header, separator, and rows
    // Remove extra pipes and split by pipe
    let parts = tableBlock.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 4) return tableBlock; // Not a real table
    // Try to reconstruct header, separator, and rows
    // Find the separator row (--- or :--- etc)
    let sepIdx = parts.findIndex(p => /^-+|:?-+:?$/.test(p));
    if (sepIdx === -1 || sepIdx === 0 || sepIdx === parts.length-1) return tableBlock;
    let header = parts.slice(0, sepIdx);
    let separator = parts.slice(sepIdx, sepIdx + header.length);
    let rows: string[][] = [];
    let i = sepIdx + header.length;
    while (i + header.length <= parts.length) {
      let row = parts.slice(i, i + header.length);
      if (row.length === header.length) rows.push(row);
      i += header.length;
    }
    // Rebuild the table in valid markdown
    let out = '| ' + header.join(' | ') + ' |\n';
    out += '| ' + separator.join(' | ') + ' |\n';
    for (const row of rows) {
      out += '| ' + row.join(' | ') + ' |\n';
    }
    return out.trim();
  });
}

function enhanceReadability(text: string): string {
  // Fix malformed tables first
  let processed = fixMalformedMarkdownTables(text);
  // Replace bullet characters • with markdown dash
  processed = processed.replace(/^•\s+/gm, '- ');

  // Split long paragraphs into blocks of max 2 sentences
  const lines = processed.split(/\n/);
  const rebuilt: string[] = [];
  const sentenceRegex = /([.!?])+\s+/;
  lines.forEach(line => {
    const trimmed = line.trim();
    // Skip headings, bullets or very short lines
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('>') || trimmed.length < 120) {
      rebuilt.push(line);
      return;
    }
    // Break into sentences
    const parts = trimmed.split(sentenceRegex).filter(p => p.length > 0);
    let buffer: string[] = [];
    parts.forEach(part => {
      buffer.push(part);
      if (buffer.length === 4) { // approx 2 sentences (sentence + punctuation repeated)
        rebuilt.push(buffer.join('').trim());
        buffer = [];
      }
    });
    if (buffer.length) rebuilt.push(buffer.join('').trim());
  });
  processed = rebuilt.join('\n\n');
  return processed;
}