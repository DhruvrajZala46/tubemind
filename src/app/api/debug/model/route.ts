import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '../../../../lib/system-prompt';
import { requireAdmin } from '../../../../lib/auth-utils';
import env from '../../../../lib/env';

export async function GET(req: NextRequest) {
  // Block in production unless admin
  if (env.NODE_ENV === 'production') {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 });
    }
  }

  // The model used in src/lib/openai.ts
  const model = 'gpt-4.1-nano-2025-04-14';
  const systemPrompt = SYSTEM_PROMPT;
  const isNewPrompt = systemPrompt.includes('Video-to-Story Transformation System');
  const isOldPrompt = systemPrompt.includes('Ultimate Fast-Flow Video Summary System');
  const preview = systemPrompt.substring(0, 200);

  return NextResponse.json({
    model,
    isNewPrompt,
    isOldPrompt,
    systemPrompt: preview + '... [truncated]',
    preview
  });
} 