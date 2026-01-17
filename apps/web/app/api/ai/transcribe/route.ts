/**
 * Voice Transcription API
 * 
 * POST /api/ai/transcribe - Transcribe audio to text using OpenAI Whisper
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Check file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }

    // Convert blob to file for OpenAI
    const file = new File([audioFile], 'audio.webm', { type: audioFile.type || 'audio/webm' });

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en', // Can make this configurable
      prompt: 'This is a query about contracts, agreements, suppliers, renewals, and contract lifecycle management.',
    });

    return NextResponse.json({
      text: transcription.text,
      duration: null, // Could add duration if needed
    });

  } catch (error: unknown) {
    // Handle specific OpenAI errors
    const errorCode = (error as { code?: string })?.code;
    if (errorCode === 'audio_too_short') {
      return NextResponse.json(
        { error: 'Audio too short. Please speak for at least 1 second.' },
        { status: 400 }
      );
    }

    if (errorCode === 'invalid_audio') {
      return NextResponse.json(
        { error: 'Invalid audio format. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio. Please try again.' },
      { status: 500 }
    );
  }
}

// Increase body size limit for audio files
export const config = {
  api: {
    bodyParser: false,
  },
};
