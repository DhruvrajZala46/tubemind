import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUserSubscription } from '../../../../lib/subscription';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get subscription details
    const subscription = await getUserSubscription(user.id);
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Calculate remaining credits
    const remainingCredits = subscription.creditsLimit - subscription.creditsUsed;
    const usagePercentage = Math.round((subscription.creditsUsed / subscription.creditsLimit) * 100);

    return NextResponse.json({
      success: true,
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        creditsUsed: subscription.creditsUsed,
        creditsLimit: subscription.creditsLimit,
        remainingCredits,
        usagePercentage,
        subscriptionEndDate: subscription.subscriptionEndDate,
        isActive: subscription.status === 'active' || subscription.tier === 'free'
      }
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
} 