import { NextRequest, NextResponse } from 'next/server';
import { resetMonthlyCredits } from '../../../../lib/subscription';
import { createLogger } from '../../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Basic security check (you might want to add a secret token)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting monthly credit reset...');
    await resetMonthlyCredits();
    console.log('✅ Monthly credit reset completed');

    return NextResponse.json({ 
      success: true, 
      message: 'Monthly credits reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in credit reset cron:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset credits',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 