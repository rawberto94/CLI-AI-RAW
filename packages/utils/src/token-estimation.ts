/**
 * Improved Token Estimation (no WASM/tiktoken dependency)
 * 
 * More accurate heuristic than simple `text.length / 4` by considering:
 * - Word boundaries and average token length in English (~1.3 tokens per word)
 * - Punctuation (typically individual tokens)
 * - Numbers (tokenized as individual digits)
 * - Whitespace compression
 * 
 * For critical paths, use tiktoken-based counting from apps/web/lib/ai/token-counter.ts
 */

export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}@#$%^&*+=<>|/\\~`\-_]/g) || []).length;
  const numberDigits = (text.match(/\d/g) || []).length;
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).join('').length;

  // Base: ~1.3 tokens per word for English prose
  const wordTokens = Math.ceil(words.length * 1.3);
  // Punctuation: approximately 1 token each
  // Number digits: approximately 1 token per 1-2 digits
  const digitTokens = Math.ceil(numberDigits * 0.7);
  // Code is more token-dense (~3.5 chars per token)
  const codeTokens = Math.ceil(codeBlocks / 3.5);
  // Non-code text
  const nonCodeLength = text.length - codeBlocks;
  const proseTokens = Math.ceil(nonCodeLength / 4);

  // Use the higher of word-based and char-based estimates for accuracy
  return Math.max(
    wordTokens + punctuation + digitTokens,
    codeBlocks > 0 ? codeTokens + Math.ceil((nonCodeLength) / 4) : proseTokens
  );
}
