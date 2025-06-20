import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Polar } from '@polar-sh/sdk';
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

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await getUserSubscription(user.id);
    if (!subscription || subscription.tier === 'free') {
      return NextResponse.json({
        success: true,
        message: 'You are on the free plan. Upgrade to manage subscriptions.',
        manageUrl: null
      });
    }

    // Initialize Polar SDK
    const polar = new Polar({ 
      accessToken: process.env.POLAR_ACCESS_TOKEN!,
      server: process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production'
    });

    // Create customer portal session for subscription management
    try {
      // Note: This is a simplified approach. In production, you'd need to:
      // 1. Store customer IDs when creating subscriptions
      // 2. Use Polar's customer portal API (if available)
      // For now, we'll provide instructions for manual management
      
      return NextResponse.json({
        success: true,
        message: 'Subscription management',
        subscription: {
          tier: subscription.tier,
          status: subscription.status,
          subscriptionId: subscription.subscriptionId
        },
        manageUrl: `https://polar.sh/dashboard/subscriptions`, // Polar's dashboard
        instructions: [
          '1. Visit Polar dashboard to manage your subscription',
          '2. Contact support for subscription changes',
          '3. Cancellations take effect at the end of billing period'
        ]
      });

    } catch (error: any) {
      console.error('Error creating management session:', error);
      return NextResponse.json(
        { error: 'Failed to create management session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in subscription management:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 