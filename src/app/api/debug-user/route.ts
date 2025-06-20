import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import env from '../../../lib/env';

const BLOCKED_RESPONSE = NextResponse.json({ error: 'Endpoint disabled in production' }, { status: 404 });

export async function GET() {
  if (env.NODE_ENV === 'production') return BLOCKED_RESPONSE;
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ 
      error: 'Not authenticated', 
      message: 'Please sign in first' 
    }, { status: 401 });
  }

  return NextResponse.json({ 
    userId, 
    message: 'Add this userId to ADMIN_USER_IDS environment variable',
    instructions: [
      '1. Copy the userId above',
      '2. Go to Vercel Dashboard → Settings → Environment Variables',
      '3. Add: ADMIN_USER_IDS=your_user_id_here',
      '4. Redeploy your app',
      '5. Delete this debug endpoint for security'
    ]
  });
} 