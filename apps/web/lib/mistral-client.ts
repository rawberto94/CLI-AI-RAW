/**
 * Mistral AI Client
 * Provides document analysis using Mistral AI (EU-hosted, GDPR compliant)
 * 
 * Configuration:
 * - MISTRAL_API_KEY: Your Mistral API key
 * - MISTRAL_API_URL: Optional custom endpoint (default: https://api.mistral.ai)
 */

export interface MistralAnalysisResult {
  summary: string;
  keyTerms: string[];
  entities: {
    type: string;
    value: string;
    confidence: number;
  }[];
  metadata: Record<string, string>;
}

export interface MistralChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MistralChatOptions {
  model?: 'mistral-large-latest' | 'mistral-medium-latest' | 'mistral-small-latest' | 'open-mixtral-8x22b';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

const MISTRAL_API_URL = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1';

/**
 * Make a chat completion request to Mistral AI
 */
async function mistralChat(
  messages: MistralChatMessage[],
  options: MistralChatOptions = {}
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('Mistral API key not configured (set MISTRAL_API_KEY environment variable)');
  }

  const response = await fetch(`${MISTRAL_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'mistral-large-latest',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens || 4096,
      top_p: options.topP ?? 0.95,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Mistral API error: ${error.message || error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Analyze a document using Mistral AI
 * Uses Mistral Large for high-quality document analysis (EU-hosted, GDPR compliant)
 */
export async function analyzeDocumentWithMistral(
  documentText: string,
  options?: {
    extractEntities?: boolean;
    maxTokens?: number;
  }
): Promise<MistralAnalysisResult> {
  // Check for Mistral API key, fall back to stub if not available
  if (!process.env.MISTRAL_API_KEY) {
    return {
      summary: 'Document analysis not available - Mistral API key not configured',
      keyTerms: [],
      entities: [],
      metadata: {},
    };
  }

  try {
    // Truncate very long documents to fit context window
    const maxChars = 30000;
    const truncatedText = documentText.length > maxChars 
      ? documentText.substring(0, maxChars) + '\n\n[Document truncated...]'
      : documentText;

    const systemPrompt = `You are a contract analysis assistant. Analyze the provided document and extract:
1. A concise summary (2-3 sentences)
2. Key terms and concepts (up to 10)
${options?.extractEntities ? '3. Named entities (parties, dates, amounts, locations) with confidence scores' : ''}

Respond in JSON format:
{
  "summary": "...",
  "keyTerms": ["term1", "term2", ...],
  "entities": [{"type": "party|date|amount|location", "value": "...", "confidence": 0.0-1.0}],
  "metadata": {"documentType": "...", "language": "...", "wordCount": "..."}
}`;

    const response = await mistralChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this document:\n\n${truncatedText}` }
      ],
      { 
        model: 'mistral-large-latest',
        maxTokens: options?.maxTokens || 2048,
        temperature: 0.2 
      }
    );

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        keyTerms: parsed.keyTerms || [],
        entities: parsed.entities || [],
        metadata: {
          ...parsed.metadata,
          length: String(documentText.length),
          wordCount: String(documentText.split(/\s+/).length),
        },
      };
    }

    // Fallback if JSON parsing fails
    return {
      summary: response.substring(0, 500),
      keyTerms: [],
      entities: [],
      metadata: {
        length: String(documentText.length),
        wordCount: String(documentText.split(/\s+/).length),
        parseError: 'Could not parse structured response',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Document analysis failed: ${errorMessage}`);
  }
}

/**
 * Generate contract insights using Mistral AI
 */
export async function generateContractInsights(
  contractText: string,
  questions: string[]
): Promise<Record<string, string>> {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('Mistral API key not configured');
  }

  const systemPrompt = `You are a contract analysis assistant. Answer questions about the provided contract.
Respond in JSON format with question numbers as keys.`;

  const userPrompt = `Contract:\n${contractText.substring(0, 25000)}\n\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

  const response = await mistralChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model: 'mistral-large-latest', temperature: 0.3 }
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return { error: 'Could not parse response' };
  }
}

const mistralClient = {
  analyzeDocumentWithMistral,
  generateContractInsights,
  mistralChat,
};

export default mistralClient;
