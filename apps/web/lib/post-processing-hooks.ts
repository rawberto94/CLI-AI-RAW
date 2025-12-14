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
  console.log(`🏷️ Auto-categorizing contract: ${contractId}`);

  try {
    // Check if tenant has taxonomy categories
    const categoryCount = await prisma.taxonomyCategory.count({
      where: { tenantId, isActive: true },
    });

    if (categoryCount === 0) {
      console.log(`⏭️ No taxonomy categories for tenant ${tenantId}, skipping auto-categorization`);
      return { success: true, category: undefined };
    }

    // Check if contract is already categorized
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { category: true },
    });

    if (contract?.category) {
      console.log(`⏭️ Contract already categorized as "${contract.category}"`);
      return { success: true, category: contract.category };
    }

    // Categorize the contract
    const result = await categorizeContract({
      contractId,
      tenantId,
      forceRecategorize: false,
    });

    if (result.success && result.category) {
      console.log(`✅ Contract categorized as "${result.category}" (${result.confidence}% confidence)`);
      return { success: true, category: result.category };
    }

    console.log(`⚠️ Could not categorize contract: ${result.error || "No matching category"}`);
    return { success: false, error: result.error };
  } catch (error) {
    console.error("❌ Auto-categorization error:", error);
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
  console.log(`🔧 Running post-processing hooks for contract: ${contractId}`);

  // Run categorization
  const categorizationResult = await triggerAutoCategorization(contractId, tenantId);

  return {
    categorization: categorizationResult,
  };
}

const postProcessingHooks = { triggerAutoCategorization, runPostProcessingHooks };
export default postProcessingHooks;
