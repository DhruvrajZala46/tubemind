// 🛠️ CREDIT DISPLAY UTILITIES
// Enhanced credit formatting with hours and minutes for better UX

import { PLAN_LIMITS, PlanTier } from '../config/plans';

/**
 * Convert minutes to hours and minutes display
 * @param minutes - Total minutes
 * @returns Formatted string like "2h 30m" or "45m" or "0m"
 */
export function formatCreditsTime(minutes: number): string {
  if (minutes <= 0) return "0m";
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format credits for dashboard display with precise time
 * @param creditsUsed - Credits consumed (in minutes)
 * @param creditsLimit - Total credits available (in minutes) 
 * @returns Object with formatted strings for display
 */
export function formatCreditDisplay(creditsUsed: number, creditsLimit: number) {
  const remainingCredits = Math.max(0, creditsLimit - creditsUsed);
  const usagePercentage = Math.round((creditsUsed / creditsLimit) * 100);
  
  return {
    used: formatCreditsTime(creditsUsed),
    remaining: formatCreditsTime(remainingCredits),
    total: formatCreditsTime(creditsLimit),
    percentage: usagePercentage,
    isNearLimit: usagePercentage >= 90,
    isOverLimit: creditsUsed > creditsLimit
  };
}

/**
 * Get credit status with color coding
 * @param creditsUsed - Credits consumed
 * @param creditsLimit - Total credits available
 * @returns Status object with color and message
 */
export function getCreditStatus(creditsUsed: number, creditsLimit: number) {
  const remaining = creditsLimit - creditsUsed;
  const percentage = (creditsUsed / creditsLimit) * 100;
  
  if (percentage >= 100) {
    return {
      status: 'over_limit',
      color: 'red',
      message: 'Credit limit exceeded',
      urgency: 'critical'
    };
  }
  
  if (percentage >= 90) {
    return {
      status: 'near_limit', 
      color: 'orange',
      message: `Only ${formatCreditsTime(remaining)} remaining`,
      urgency: 'warning'
    };
  }
  
  if (percentage >= 75) {
    return {
      status: 'moderate_usage',
      color: 'yellow', 
      message: `${formatCreditsTime(remaining)} remaining`,
      urgency: 'caution'
    };
  }
  
  return {
    status: 'good',
    color: 'green',
    message: `${formatCreditsTime(remaining)} available`,
    urgency: 'normal'
  };
}

/**
 * Calculate video processing cost in minutes
 * @param durationSeconds - Video duration in seconds
 * @returns Credits needed (1 credit = 1 minute of video)
 */
export function calculateVideoCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 60);
}

/**
 * Format video duration for display
 * @param seconds - Duration in seconds
 * @returns Formatted string like "15m 30s"
 */
export function formatVideoDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${remainingSeconds}s`;
}

/**
 * Get plan display name with proper formatting
 * @param tier - Plan tier from database
 * @returns Properly formatted plan name
 */
export function formatPlanName(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'free':
      return 'Free Plan';
    case 'basic':
      return 'Basic Plan';
    case 'pro':
      return 'Pro Plan';
    case 'enterprise':
      return 'Enterprise Plan';
    default:
      return 'Unknown Plan';
  }
}

/**
 * Get plan limits (single source of truth from PLAN_LIMITS)
 * @param tier - Plan tier
 */
export function getPlanLimits(tier: string) {
  const key = tier?.toLowerCase() as PlanTier;
  const plan = PLAN_LIMITS[key] ?? PLAN_LIMITS.free;

  // Set default max video length based on plan tier
  // Free: 30 minutes, Basic: 60 minutes, Pro: 120 minutes
  const maxVideoLengthMinutes = key === 'free' ? 30 : key === 'basic' ? 60 : 120;

  return {
    creditsLimit: plan.creditsPerMonth,
    videosPerDay: undefined, // Not managed here – kept for backward-compat
    maxVideoLength: maxVideoLengthMinutes * 60, // Convert minutes to seconds
    features: plan.features,
    isMonthlyReset: true, // All plans reset monthly
  };
}

/**
 * Calculate credits needed for a video (1 credit = 1 minute)
 * @param durationSeconds - Video duration in seconds
 * @returns Credits needed (minimum 1)
 */
export function calculateCreditsNeeded(durationSeconds: number): number {
  if (durationSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

/**
 * Get remaining credits for a user
 * @param creditsUsed - Credits already used
 * @param planTier - User's plan tier
 * @param creditsReserved - Credits currently reserved (optional)
 * @returns Remaining credits (minimum 0)
 */
export function getCreditsRemaining(creditsUsed: number, planTier: string, creditsReserved: number = 0): number {
  const limits = getPlanLimits(planTier);
  return Math.max(0, limits.creditsLimit - (creditsUsed + creditsReserved));
}

/**
 * Check if user can process a video
 * @param creditsUsed - Credits already used
 * @param planTier - User's plan tier
 * @param videoDurationSeconds - Video duration in seconds
 * @param creditsReserved - Credits currently reserved (optional)
 * @returns True if user has enough credits
 */
export function canProcessVideo(creditsUsed: number, planTier: string, videoDurationSeconds: number, creditsReserved: number = 0): boolean {
  const creditsNeeded = calculateCreditsNeeded(videoDurationSeconds);
  const creditsRemaining = getCreditsRemaining(creditsUsed, planTier, creditsReserved);
  return creditsNeeded <= creditsRemaining;
} 