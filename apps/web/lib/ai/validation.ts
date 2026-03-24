/**
 * AI Service Validation Utilities
 * Provides consistent validation for AI API keys and service availability
 */

import { NextResponse } from 'next/server';
import { getOpenAIApiKey } from '@/lib/openai-client';

/**
 * Validate that OpenAI API key is configured and valid format
 * Returns an error response if validation fails, undefined if valid
 */
export function validateOpenAIKey(): NextResponse | undefined {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    return NextResponse.json(
      { 
        error: 'OpenAI API key not configured',
        code: 'OPENAI_NOT_CONFIGURED',
        message: 'Please configure OPENAI_API_KEY environment variable'
      },
      { status: 503 }
    );
  }
  
  // Validate key format (should start with sk-)
  if (!apiKey.startsWith('sk-')) {
    return NextResponse.json(
      { 
        error: 'Invalid OpenAI API key format',
        code: 'OPENAI_INVALID_KEY',
        message: 'OpenAI API key should start with "sk-"'
      },
      { status: 503 }
    );
  }
  
  return undefined;
}

/**
 * Validate that Anthropic API key is configured
 */
export function validateAnthropicKey(): NextResponse | undefined {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { 
        error: 'Anthropic API key not configured',
        code: 'ANTHROPIC_NOT_CONFIGURED',
        message: 'Please configure ANTHROPIC_API_KEY environment variable'
      },
      { status: 503 }
    );
  }
  
  return undefined;
}

/**
 * Get OpenAI API key or throw if not configured
 */
export function getOpenAIKeyOrThrow(): string {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('OpenAI API key not configured or invalid');
  }
  
  return apiKey;
}

/**
 * Check if OpenAI is configured (for optional features)
 */
export function isOpenAIConfigured(): boolean {
  const apiKey = getOpenAIApiKey();
  return !!apiKey && apiKey.startsWith('sk-');
}

/**
 * Check if Anthropic is configured
 */
export function isAnthropicConfigured(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return !!apiKey && apiKey.startsWith('sk-ant-');
}
