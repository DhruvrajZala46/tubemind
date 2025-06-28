import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '../../../../lib/system-prompt';

export async function GET(req: NextRequest) {
  // The model used in src/lib/openai.ts
  const model = 'gpt-4.1-mini';
  const systemPrompt = SYSTEM_PROMPT;
  const isNewPrompt = systemPrompt.includes('Video-to-Story Transformation System');
  const isOldPrompt = systemPrompt.includes('Ultimate Fast-Flow Video Summary System');
  const preview = systemPrompt.substring(0, 200);

  return NextResponse.json({
    model,
    isNewPrompt,
    isOldPrompt,
    systemPrompt,
    preview
  });
} 