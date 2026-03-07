/**
 * AI-powered column mapping using LLM
 * Falls back to fuzzy matching if AI is unavailable
 */

import { FuzzyMatcher, type MatchResult } from './fuzzy-matcher';

export interface AIMapperOptions {
  useAI?: boolean;
  apiKey?: string;
  model?: string;
}

export class AIMapper {
  /**
   * Suggest column mappings using AI or fuzzy matching
   */
  static async suggestMappings(
    headers: string[],
    sampleRows: Record<string, any>[],
    options: AIMapperOptions = {}
  ): Promise<MatchResult[]> {
    // Try AI mapping if enabled and API key available
    if (options.useAI && options.apiKey) {
      try {
        return await this.aiSuggestMappings(headers, sampleRows, options);
      } catch {
        // AI mapping failed, falling back to fuzzy matching
      }
    }

    // Fallback to fuzzy matching
    return FuzzyMatcher.matchColumns(headers);
  }

  /**
   * Use AI to suggest mappings
   */
  private static async aiSuggestMappings(
    headers: string[],
    sampleRows: Record<string, any>[],
    options: AIMapperOptions
  ): Promise<MatchResult[]> {
    const prompt = this.buildPrompt(headers, sampleRows);

    // Call OpenAI API (or similar)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing spreadsheet data and mapping columns to standard fields for rate card imports.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse AI response
    return this.parseAIResponse(content, headers);
  }

  /**
   * Build prompt for AI
   */
  private static buildPrompt(headers: string[], sampleRows: Record<string, any>[]): string {
    const standardFields = [
      'role - job title or position',
      'seniority - level (Junior, Mid, Senior, etc.)',
      'rate - the cost or price',
      'currency - currency code (USD, EUR, etc.)',
      'period - rate period (hourly, daily, monthly, annual)',
      'location - geographic location',
      'serviceLine - service category or practice area',
      'skills - required skills or expertise',
      'experience - years of experience',
    ];

    const sampleData = sampleRows.slice(0, 3).map(row => {
      const sample: Record<string, any> = {};
      headers.forEach(header => {
        sample[header] = row[header];
      });
      return sample;
    });

    return `Analyze these spreadsheet columns and map them to standard rate card fields.

COLUMNS:
${headers.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

SAMPLE DATA:
${JSON.stringify(sampleData, null, 2)}

STANDARD FIELDS:
${standardFields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

For each column, provide:
1. The best matching standard field
2. Confidence score (0-1)
3. Brief reasoning

Respond in JSON format:
{
  "mappings": [
    {
      "sourceColumn": "column name",
      "targetField": "standard field name",
      "confidence": 0.95,
      "reasoning": "why this mapping makes sense"
    }
  ]
}`;
  }

  /**
   * Parse AI response into match results
   */
  private static parseAIResponse(content: string, headers: string[]): MatchResult[] {
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const mappings = parsed.mappings || [];

      return mappings.map((m: any) => ({
        sourceColumn: m.sourceColumn,
        targetField: m.targetField,
        confidence: m.confidence || 0.8,
        method: 'ai' as const,
      }));
    } catch {
      // Fallback to fuzzy matching
      return FuzzyMatcher.matchColumns(headers);
    }
  }

  /**
   * Enhance fuzzy matches with AI insights
   */
  static async enhanceMappings(
    fuzzyMatches: MatchResult[],
    headers: string[],
    sampleRows: Record<string, any>[],
    options: AIMapperOptions = {}
  ): Promise<MatchResult[]> {
    if (!options.useAI || !options.apiKey) {
      return fuzzyMatches;
    }

    try {
      const aiMatches = await this.aiSuggestMappings(headers, sampleRows, options);
      
      // Merge AI and fuzzy matches, preferring AI for low-confidence fuzzy matches
      return fuzzyMatches.map(fuzzyMatch => {
        const aiMatch = aiMatches.find(m => m.sourceColumn === fuzzyMatch.sourceColumn);
        
        if (aiMatch && (fuzzyMatch.confidence < 0.8 || aiMatch.confidence > fuzzyMatch.confidence)) {
          return {
            ...aiMatch,
            method: 'ai' as any,
            alternatives: [
              { field: fuzzyMatch.targetField, confidence: fuzzyMatch.confidence },
              ...(fuzzyMatch.alternatives || []),
            ],
          };
        }
        
        return fuzzyMatch;
      });
    } catch {
      return fuzzyMatches;
    }
  }
}
