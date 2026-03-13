/**
 * Improved Token Estimation (no tiktoken dependency)
 * 
 * More accurate heuristic than simple `text.length / 4` by considering
 * word boundaries and average token length in English (~1.3 tokens per word).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}@#$%^&*+=<>|/\\~`\-_]/g) || []).length;
  const numberDigits = (text.match(/\d/g) || []).length;

  // ~1.3 tokens per word for English prose
  const wordTokens = Math.ceil(words.length * 1.3);
  const digitTokens = Math.ceil(numberDigits * 0.7);
  const charTokens = Math.ceil(text.length / 4);

  return Math.max(wordTokens + punctuation + digitTokens, charTokens);
}
