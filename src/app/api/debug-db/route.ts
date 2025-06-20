import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import env from '../../../lib/env';

const sql = neon(env.DATABASE_URL);

const BLOCKED_RESPONSE = NextResponse.json({ error: 'Endpoint disabled in production' }, { status: 404 });

export async function GET(request: NextRequest) {
  if (env.NODE_ENV === 'production') return BLOCKED_RESPONSE;

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current user data
    const userData = await sql`
      SELECT * FROM users WHERE id = ${user.id}
    `;

    // Get all users to see database state
    const allUsers = await sql`
      SELECT id, email, subscription_tier, subscription_status, credits_used, last_credit_reset 
      FROM users 
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      currentUser: userData[0] || null,
      userEmail: user.emailAddresses[0]?.emailAddress,
      userId: user.id,
      allUsers,
    });
  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (env.NODE_ENV === 'production') return BLOCKED_RESPONSE;

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tier } = await request.json();
    
    if (!['free', 'basic', 'pro'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;

    // Update user subscription tier
    await sql`
      UPDATE users 
      SET 
        subscription_tier = ${tier},
        subscription_status = 'active',
        credits_used = 0,
        last_credit_reset = NOW(),
        updated_at = NOW(),
        email = ${userEmail}
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Updated user ${user.id} to ${tier} tier`,
    });
  } catch (error) {
    console.error('Update DB error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
} 