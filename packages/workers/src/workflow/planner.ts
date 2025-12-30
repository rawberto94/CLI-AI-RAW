import { sha256 } from '../utils/hash';

export function buildProcessingPlan(args: {
  extractedText: string;
}): {
  plan: { ragIndexing: boolean; metadataExtraction: boolean; categorization: boolean };
  inputs: { rawTextHash: string; textLength: number };
} {
  const textLength = args.extractedText.length;

  // Simplest “agentic planner”: decide which downstream jobs to run.
  // Keep deterministic + debuggable.
  const plan = {
    ragIndexing: textLength > 500 && process.env.AUTO_RAG_INDEXING !== 'false',
    metadataExtraction: textLength > 200 && process.env.AUTO_METADATA_EXTRACTION !== 'false',
    categorization: textLength > 200 && process.env.AUTO_CATEGORIZATION !== 'false',
  };

  return {
    plan,
    inputs: {
      rawTextHash: sha256(args.extractedText),
      textLength,
    },
  };
}
