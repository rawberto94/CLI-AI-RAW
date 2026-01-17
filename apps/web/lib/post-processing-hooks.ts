/**
 * Post-Processing Hooks
 * 
 * Triggered after artifact generation to perform additional processing:
 * - Auto-categorization using tenant taxonomy
 * - Health score calculation
 * - Notifications
 */

import { categorizeContract } from "@/lib/categorization-service";
import { prisma } from "@/lib/prisma";

/**
 * Trigger auto-categorization for a contract
 * Called after artifact generation completes
 */
export async function triggerAutoCategorization(
  contractId: string,
  tenantId: string
): Promise<{ success: boolean; category?: string; error?: string }> {
  try {
    // Check if tenant has taxonomy categories
    const categoryCount = await prisma.taxonomyCategory.count({
      where: { tenantId, isActive: true },
    });

    if (categoryCount === 0) {
      return { success: true, category: undefined };
    }

    // Check if contract is already categorized
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { category: true },
    });

    if (contract?.category) {
      return { success: true, category: contract.category };
    }

    // Categorize the contract
    const result = await categorizeContract({
      contractId,
      tenantId,
      forceRecategorize: false,
    });

    if (result.success && result.category) {
      return { success: true, category: result.category };
    }

    return { success: false, error: result.error };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run all post-processing hooks for a contract
 */
export async function runPostProcessingHooks(
  contractId: string,
  tenantId: string
): Promise<{
  categorization: { success: boolean; category?: string; error?: string };
}> {
  // Run categorization
  const categorizationResult = await triggerAutoCategorization(contractId, tenantId);

  return {
    categorization: categorizationResult,
  };
}

const postProcessingHooks = { triggerAutoCategorization, runPostProcessingHooks };
export default postProcessingHooks;
