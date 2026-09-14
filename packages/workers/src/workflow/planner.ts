import { sha256 } from '../utils/hash';

export const POLICY_EVAL_MIN_TEXT_LENGTH = 80;

export function shouldEnqueuePolicyEvaluation(args: {
  textLength: number;
  policyPackId?: string | null;
  autoPolicyEvaluation?: string;
  policyPacksEnabled?: string;
}): boolean {
  if (args.policyPacksEnabled === 'false') return false;
  if (args.autoPolicyEvaluation === 'false') return false;
  if (args.textLength < POLICY_EVAL_MIN_TEXT_LENGTH) return false;
  // Pack selected at upload or tenant default: evaluate even short/demo files.
  // Global AUTO=true still evaluates every contract above the min length.
  return Boolean(args.policyPackId) || args.autoPolicyEvaluation === 'true';
}

export async function resolvePolicyPackIdForPlan(args: {
  prisma: { policyPack: { findFirst: (query: unknown) => Promise<any> } };
  tenantId: string;
  contractPolicyPackId?: string | null;
}): Promise<string | null> {
  if (args.contractPolicyPackId) return args.contractPolicyPackId;
  try {
    const pack = await args.prisma.policyPack.findFirst({
      where: { tenantId: args.tenantId, isDefault: true, status: 'active' },
      select: { id: true },
    });
    return pack?.id ?? null;
  } catch {
    return null;
  }
}

export function buildProcessingPlan(args: {
  extractedText: string;
  policyPackId?: string | null;
}): {
  plan: { ragIndexing: boolean; metadataExtraction: boolean; categorization: boolean; policyEvaluation: boolean };
  inputs: { rawTextHash: string; textLength: number };
} {
  const textLength = args.extractedText.length;

  // Simplest “agentic planner”: decide which downstream jobs to run.
  // Keep deterministic + debuggable.
  const plan = {
    ragIndexing: textLength > 500 && process.env.AUTO_RAG_INDEXING !== 'false',
    metadataExtraction: textLength > 200 && process.env.AUTO_METADATA_EXTRACTION !== 'false',
    categorization: textLength > 200 && process.env.AUTO_CATEGORIZATION !== 'false',
    policyEvaluation: shouldEnqueuePolicyEvaluation({
      textLength,
      policyPackId: args.policyPackId,
      autoPolicyEvaluation: process.env.AUTO_POLICY_EVALUATION,
      policyPacksEnabled: process.env.POLICY_PACKS_ENABLED,
    }),
  };

  return {
    plan,
    inputs: {
      rawTextHash: sha256(args.extractedText),
      textLength,
    },
  };
}
