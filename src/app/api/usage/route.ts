import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserSubscription } from '../../../lib/subscription';

export async function GET() {
  try {
    // 1. 🔐 Authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
  }

    const userId = user.id;

    // 2. 🛠️ Get subscription with fallback
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'User subscription not found' },
        { status: 404 }
      );
    }

    // 3. 🎯 FIXED: Return response in expected format
    const response = {
      success: true,
      // Core data (what frontend expects)
      plan: subscription.tier,  // 🔥 CRITICAL: Use 'plan' not 'tier' 
      tier: subscription.tier,
      status: subscription.status, 
      usage: subscription.creditsUsed,      // 🔥 CRITICAL: Use 'usage' not 'creditsUsed'
      limit: subscription.creditsLimit,     // 🔥 CRITICAL: Use 'limit' not 'creditsLimit'  
      remaining: Math.max(0, subscription.creditsLimit - subscription.creditsUsed),
      
      // Additional data
      creditsUsed: subscription.creditsUsed,
      creditsLimit: subscription.creditsLimit,
      creditsRemaining: Math.max(0, subscription.creditsLimit - subscription.creditsUsed),
      usagePercentage: Math.round((subscription.creditsUsed / subscription.creditsLimit) * 100),
      timestamp: Date.now(), // Add timestamp for tracking
      
      // 🛠️ Enhanced display formatting with hours and minutes
      display: {
        planName: formatPlanName(subscription.tier),
        creditsUsedFormatted: formatCreditsTime(subscription.creditsUsed),
        creditsRemainingFormatted: formatCreditsTime(Math.max(0, subscription.creditsLimit - subscription.creditsUsed)),
        creditsLimitFormatted: formatCreditsTime(subscription.creditsLimit),
        isNearLimit: (subscription.creditsUsed / subscription.creditsLimit) >= 0.9,
        isOverLimit: subscription.creditsUsed > subscription.creditsLimit
      }
    };

    console.log('✅ Usage API response:', {
      plan: response.plan,
      usage: response.usage,
      limit: response.limit,
      remaining: response.remaining
    });

    // Add Cache-Control header to prevent caching
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error('Usage API error:', error);
    
    // 🛠️ Graceful error response with fallback data
    return NextResponse.json(
      { 
        error: 'Failed to fetch usage data',
        fallback: {
          plan: 'free',
          tier: 'free',
          status: 'active', 
          usage: 0,
          limit: 60,
          remaining: 60,
          creditsUsed: 0,
          creditsLimit: 60,
          creditsRemaining: 60,
          usagePercentage: 0,
          timestamp: Date.now(),
          display: {
            planName: 'Free Plan',
            creditsUsedFormatted: '0m',
            creditsRemainingFormatted: '1h',
            creditsLimitFormatted: '1h',
            isNearLimit: false,
            isOverLimit: false
          }
        }
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
}

// 🛠️ Helper functions for credit formatting
function formatCreditsTime(minutes: number): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) return "0m";
  
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

function formatPlanName(tier: string): string {
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