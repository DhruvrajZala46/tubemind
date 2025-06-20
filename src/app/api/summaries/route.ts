import { currentUser } from '@clerk/nextjs/server';
import { getUserSummaries } from '../../../lib/db-actions';
import { NextResponse } from 'next/server';

// --- Simple in-memory rate limiter (for demo; use Redis for production) ---
const userRateLimitMap = new Map();
const RATE_LIMIT = 20; // max requests
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(userId: string) {
  const now = Date.now();
  const entry = userRateLimitMap.get(userId);
  if (!entry) {
    userRateLimitMap.set(userId, { count: 1, start: now });
    return false;
  }
  if (now - entry.start > WINDOW_MS) {
    userRateLimitMap.set(userId, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  entry.count++;
  return false;
}

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Rate limiting ---
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes before trying again.' },
      { status: 429 }
    );
  }

  try {
    const summaries = await getUserSummaries(user.id);
    return NextResponse.json({ data: summaries }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching user summaries:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch summaries' }, { status: 500 });
  }
} 