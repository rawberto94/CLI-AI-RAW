/**
 * Voice Transcription API
 * 
 * POST /api/ai/transcribe - Transcribe audio to text using OpenAI Whisper
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = createOpenAIClient(key);
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

export const POST = withAuthApiHandler(async (request, ctx) => {
    if (!hasAIClientConfig()) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'OpenAI API key not configured', 500);
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No audio file provided', 400);
    }

    // Check file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Audio file too large (max 25MB)', 400);
    }

    // Convert blob to file for OpenAI
    const file = new File([audioFile], 'audio.webm', { type: audioFile.type || 'audio/webm' });

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en', // Can make this configurable
      prompt: 'This is a query about contracts, agreements, suppliers, renewals, and contract lifecycle management.' });

    return createSuccessResponse(ctx, {
      text: transcription.text,
      duration: null,
    });

  });

// Increase body size limit for audio files
export const config = {
  api: {
    bodyParser: false } };
