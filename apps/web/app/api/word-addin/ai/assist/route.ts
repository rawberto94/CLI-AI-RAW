/**
 * Word Add-in AI Assist API
 * Provides AI-powered contract assistance for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { getAIClient } from '@/lib/ai/ai-client';
import { logger } from '@/lib/logger';

const aiAssistSchema = z.object({
  context: z.string().max(50000, 'Context too long (max 50,000 chars)').optional().default(''),
  selection: z.string().max(10000, 'Selection too long (max 10,000 chars)').optional(),
  action: z.enum(['suggest', 'improve', 'simplify', 'risk-check', 'complete'], {
    required_error: 'Action is required',
  }),
  contractType: z.string().max(50).optional(),
}).refine(data => data.context || data.selection, {
  message: 'Context or selection is required',
});

interface AISuggestion {
  id: string;
  text: string;
  explanation: string;
  type: 'clause' | 'improvement' | 'completion';
  confidence: number;
}

interface RiskFlag {
  text: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  suggestion?: string;
}

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const validation = aiAssistSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', validation.error.errors[0].message, 400);
    }
    const { context, selection, action, contractType } = validation.data;

    const textToAnalyze = selection || context;
    const aiClient = await getAIClient();

    // Build prompt based on action
    let systemPrompt: string;
    let userPrompt: string;

    switch (action) {
      case 'suggest':
        systemPrompt = `You are a legal contract expert. Suggest relevant contract clauses based on the context provided.
          Always respond in JSON format with this structure:
          {
            "suggestions": [
              {"id": "1", "text": "clause text", "explanation": "why this clause is relevant", "type": "clause", "confidence": 0.9}
            ]
          }`;
        userPrompt = `Based on this contract context, suggest relevant clauses:\n\nContract Type: ${contractType || 'General'}\n\nContext:\n${textToAnalyze}`;
        break;

      case 'improve':
        systemPrompt = `You are a legal contract expert. Improve the clarity and legal soundness of contract language.
          Always respond in JSON format with this structure:
          {
            "suggestions": [
              {"id": "1", "text": "improved text", "explanation": "why this is better", "type": "improvement", "confidence": 0.85}
            ]
          }`;
        userPrompt = `Improve this contract language for clarity and legal precision:\n\n${textToAnalyze}`;
        break;

      case 'simplify':
        systemPrompt = `You are a legal contract expert. Simplify complex legal language while preserving meaning.
          Always respond in JSON format with this structure:
          {
            "suggestions": [
              {"id": "1", "text": "simplified text", "explanation": "what was simplified", "type": "improvement", "confidence": 0.8}
            ]
          }`;
        userPrompt = `Simplify this legal language while preserving its legal meaning:\n\n${textToAnalyze}`;
        break;

      case 'risk-check':
        systemPrompt = `You are a legal contract risk analyst. Identify potential risks in contract language.
          Always respond in JSON format with this structure:
          {
            "riskFlags": [
              {"text": "problematic text", "risk": "HIGH", "explanation": "why this is risky", "suggestion": "how to fix it"}
            ],
            "suggestions": []
          }
          Risk levels: LOW, MEDIUM, HIGH, CRITICAL`;
        userPrompt = `Analyze this contract text for potential legal risks:\n\nContract Type: ${contractType || 'General'}\n\nText:\n${textToAnalyze}`;
        break;

      case 'complete':
        systemPrompt = `You are a legal contract expert. Complete partial contract clauses appropriately.
          Always respond in JSON format with this structure:
          {
            "suggestions": [
              {"id": "1", "text": "completed clause text", "explanation": "how the clause was completed", "type": "completion", "confidence": 0.75}
            ]
          }`;
        userPrompt = `Complete this partial contract clause appropriately:\n\nContract Type: ${contractType || 'General'}\n\nPartial text:\n${textToAnalyze}`;
        break;

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
    }

    // Call AI
    const completion = await aiClient.chat.completions.create({
      model: aiClient.model || 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse JSON response
    let parsed: { suggestions?: AISuggestion[]; riskFlags?: RiskFlag[] };
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch {
      // Fallback to a single suggestion with the raw text
      parsed = {
        suggestions: [
          {
            id: '1',
            text: responseText,
            explanation: 'AI-generated response',
            type: action === 'risk-check' ? 'improvement' : action === 'complete' ? 'completion' : 'improvement',
            confidence: 0.7,
          },
        ],
      };
    }

    return createSuccessResponse(ctx, {
      suggestions: parsed.suggestions || [],
      riskFlags: parsed.riskFlags || [],
      confidence: parsed.suggestions?.[0]?.confidence || 0.8,
    });
  } catch (error) {
    logger.error('Word Add-in AI assist error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'AI assistance failed', 500);
  }
});
