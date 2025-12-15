/**
 * Metadata Extraction Integration
 * 
 * Integrates metadata extraction into the contract processing pipeline.
 * Called after artifacts are generated to auto-populate metadata fields.
 */

import type { MetadataExtractionJobData, MetadataExtractionResult } from "./metadata-extraction-worker";

// ============================================================================
// TYPES
// ============================================================================

export interface PostArtifactMetadataOptions {
  /** Whether to auto-apply high-confidence values */
  autoApply?: boolean;
  /** Minimum confidence for auto-apply */
  autoApplyThreshold?: number;
  /** Whether to run synchronously or queue for background */
  synchronous?: boolean;
  /** Whether to skip if metadata already exists */
  skipIfExists?: boolean;
}

// ============================================================================
// MAIN INTEGRATION FUNCTION
// ============================================================================

/**
 * Trigger metadata extraction after artifact generation
 * 
 * This is designed to be called from the OCR artifact worker
 * after successful artifact generation.
 */
export async function triggerPostArtifactMetadataExtraction(
  contractId: string,
  tenantId: string,
  options: PostArtifactMetadataOptions = {}
): Promise<{ queued: boolean; jobId?: string; result?: MetadataExtractionResult }> {
  const {
    autoApply = true,
    autoApplyThreshold = 0.85,
    synchronous = false,
    skipIfExists = true,
  } = options;

  console.log(`🔗 Triggering post-artifact metadata extraction for ${contractId}`);

  // Check if auto metadata extraction is enabled
  const autoExtract = process.env.AUTO_METADATA_EXTRACTION !== "false";
  if (!autoExtract) {
    console.log("⏭️ Auto metadata extraction disabled");
    return { queued: false };
  }

  // Check if metadata already exists
  if (skipIfExists) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: { contractMetadata: true },
      });

      if (contract?.contractMetadata) {
        const metadata = contract.contractMetadata as Record<string, any>;
        const hasValues = Object.entries(metadata)
          .filter(([key]) => !key.startsWith("_"))
          .some(([, value]) => value !== null && value !== undefined && value !== "");

        if (hasValues) {
          console.log(`📋 Contract ${contractId} already has metadata, skipping`);
          return { queued: false };
        }
      }
    } catch (error) {
      console.warn("Failed to check existing metadata:", error);
      // Continue with extraction
    }
  }

  const jobData: MetadataExtractionJobData = {
    contractId,
    tenantId,
    autoApply,
    autoApplyThreshold,
    source: "upload",
    priority: "normal",
  };

  if (synchronous) {
    // Run extraction synchronously (blocking)
    try {
      const { processMetadataExtractionJob } = await import("./metadata-extraction-worker");
      
      // Create a mock job object for the worker
      const mockJob = {
        data: jobData,
        id: `sync-${contractId}-${Date.now()}`,
        updateProgress: async () => {},
      };

      const result = await processMetadataExtractionJob(mockJob as any);
      return { queued: false, result };
    } catch (error) {
      console.error("Synchronous metadata extraction failed:", error);
      return { queued: false };
    }
  } else {
    // Queue for background processing
    try {
      const { queueMetadataExtractionJob } = await import("./metadata-extraction-worker");
      
      const jobId = await queueMetadataExtractionJob(jobData, {
        delay: 2000, // 2 second delay to let artifacts settle
      });

      return { queued: true, jobId };
    } catch (error) {
      console.error("Failed to queue metadata extraction:", error);
      return { queued: false };
    }
  }
}

/**
 * Extract metadata from artifacts (uses already-generated AI analysis)
 * 
 * This is a lighter-weight option that uses the OVERVIEW artifact
 * data to pre-populate some metadata fields without re-calling AI.
 */
export async function extractMetadataFromArtifacts(
  contractId: string,
  tenantId: string
): Promise<Record<string, any>> {
  const metadata: Record<string, any> = {};

  try {
    const { prisma } = await import("@/lib/prisma");

    // Get overview artifact
    const overviewArtifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId,
        type: "OVERVIEW",
      },
      orderBy: { createdAt: "desc" },
    });

    if (overviewArtifact?.data) {
      const data = overviewArtifact.data as Record<string, any>;

      // Map artifact data to metadata fields
      if (data.contractType) {
        metadata.contract_type = data.contractType;
      }
      if (data.effectiveDate) {
        metadata.effective_date = data.effectiveDate;
      }
      if (data.expirationDate) {
        metadata.expiration_date = data.expirationDate;
      }
      if (data.totalValue) {
        metadata.total_value = data.totalValue;
      }
      if (data.currency) {
        metadata.currency = data.currency;
      }
      if (data.jurisdiction) {
        metadata.jurisdiction = data.jurisdiction;
        metadata.governing_law = data.jurisdiction;
      }
      if (data.parties && Array.isArray(data.parties)) {
        const client = data.parties.find((p: any) => 
          p.role?.toLowerCase().includes("client") || 
          p.role?.toLowerCase().includes("buyer")
        );
        const supplier = data.parties.find((p: any) => 
          p.role?.toLowerCase().includes("vendor") || 
          p.role?.toLowerCase().includes("supplier") ||
          p.role?.toLowerCase().includes("provider")
        );
        if (client?.name) {
          metadata.client_name = client.name;
          metadata.party_a_name = client.name;
        }
        if (supplier?.name) {
          metadata.supplier_name = supplier.name;
          metadata.party_b_name = supplier.name;
        }
      }
      if (data.summary) {
        metadata.description = data.summary;
      }
    }

    // Get financial artifact for payment terms
    const financialArtifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId,
        type: "FINANCIAL",
      },
      orderBy: { createdAt: "desc" },
    });

    if (financialArtifact?.data) {
      const data = financialArtifact.data as Record<string, any>;

      if (data.paymentTerms) {
        metadata.payment_terms = data.paymentTerms;
      }
      if (data.billingFrequency) {
        metadata.billing_frequency = data.billingFrequency;
      }
    }

    // Get compliance artifact
    const complianceArtifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId,
        type: "COMPLIANCE",
      },
      orderBy: { createdAt: "desc" },
    });

    if (complianceArtifact?.data) {
      const data = complianceArtifact.data as Record<string, any>;

      if (data.certifications) {
        metadata.certifications = data.certifications;
      }
    }

    console.log(`📋 Extracted ${Object.keys(metadata).length} metadata fields from artifacts`);

    return metadata;
  } catch (error) {
    console.error("Failed to extract metadata from artifacts:", error);
    return {};
  }
}

/**
 * Apply artifact-based metadata to a contract
 */
export async function applyArtifactMetadataToContract(
  contractId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const metadata = await extractMetadataFromArtifacts(contractId, tenantId);

    if (Object.keys(metadata).length === 0) {
      return false;
    }

    const { prisma } = await import("@/lib/prisma");

    // Get existing metadata
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { contractMetadata: true },
    });

    const existingMetadata = (contract?.contractMetadata as Record<string, any>) || {};

    // Only apply new values (don't overwrite existing)
    const mergedMetadata: Record<string, any> = { ...existingMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (!existingMetadata[key] || existingMetadata[key] === null || existingMetadata[key] === "") {
        mergedMetadata[key] = value;
      }
    }

    // Update contract
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        contractMetadata: {
          ...mergedMetadata,
          _artifactExtractedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`✅ Applied artifact metadata to contract ${contractId}`);
    return true;
  } catch (error) {
    console.error("Failed to apply artifact metadata:", error);
    return false;
  }
}
