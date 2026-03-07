/**
 * Metadata Extraction Integration
 * 
 * Integrates metadata extraction into the contract processing pipeline.
 * Called after artifacts are generated to auto-populate metadata fields.
 */

import type { MetadataExtractionJobData, MetadataExtractionResult } from "./metadata-extraction-worker";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Unwrap potentially wrapped AI values
 */
function unwrap<T>(val: T | { value: T; source?: string } | undefined): T | undefined {
  if (val && typeof val === 'object' && 'value' in val) {
    return (val as { value: T }).value;
  }
  return val as T;
}

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

  // Check if auto metadata extraction is enabled
  const autoExtract = process.env.AUTO_METADATA_EXTRACTION !== "false";
  if (!autoExtract) {
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
          return { queued: false };
        }
      }
    } catch {
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
    } catch {
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
    } catch {
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

      // Map artifact data to metadata fields - unwrap potentially wrapped AI values
      const contractType = unwrap(data.contractType);
      if (contractType) {
        metadata.contract_type = contractType;
      }
      const effectiveDate = unwrap(data.effectiveDate);
      if (effectiveDate) {
        metadata.effective_date = effectiveDate;
      }
      const expirationDate = unwrap(data.expirationDate);
      if (expirationDate) {
        metadata.expiration_date = expirationDate;
      }
      const totalValue = unwrap(data.totalValue);
      if (totalValue) {
        metadata.total_value = totalValue;
      }
      const currency = unwrap(data.currency);
      if (currency) {
        metadata.currency = currency;
      }
      const jurisdiction = unwrap(data.jurisdiction);
      if (jurisdiction) {
        metadata.jurisdiction = jurisdiction;
        metadata.governing_law = jurisdiction;
      }
      const parties = unwrap(data.parties);
      if (parties && Array.isArray(parties)) {
        const client = parties.find((p: any) => {
          const role = unwrap(p.role);
          return typeof role === 'string' && (
            role.toLowerCase().includes("client") || 
            role.toLowerCase().includes("buyer")
          );
        });
        const supplier = parties.find((p: any) => {
          const role = unwrap(p.role);
          return typeof role === 'string' && (
            role.toLowerCase().includes("vendor") || 
            role.toLowerCase().includes("supplier") ||
            role.toLowerCase().includes("provider")
          );
        });
        const clientName = unwrap(client?.name);
        if (clientName) {
          metadata.client_name = clientName;
          metadata.party_a_name = clientName;
        }
        const supplierName = unwrap(supplier?.name);
        if (supplierName) {
          metadata.supplier_name = supplierName;
          metadata.party_b_name = supplierName;
        }
      }
      const summary = unwrap(data.summary);
      if (summary) {
        metadata.description = summary;
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

    return metadata;
  } catch {
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

    // Get existing metadata from metadata JSON field
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { metadata: true },
    });

    const existingMetadata = (contract?.metadata as Record<string, any>) || {};

    // Only apply new values (don't overwrite existing)
    const mergedMetadata: Record<string, any> = { ...existingMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (!existingMetadata[key] || existingMetadata[key] === null || existingMetadata[key] === "") {
        mergedMetadata[key] = value;
      }
    }

    // Update contract using metadata JSON field
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...mergedMetadata,
          _artifactExtractedAt: new Date().toISOString(),
        },
      },
    });

    return true;
  } catch {
    return false;
  }
}
