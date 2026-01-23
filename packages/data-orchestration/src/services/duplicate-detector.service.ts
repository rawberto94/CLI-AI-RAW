/**
 * Duplicate Detector Service
 * 
 * Finds near-duplicate rate cards using multi-dimensional similarity scoring.
 * Suggests merge or delete actions and tracks duplicate resolution.
 * 
 * @module DuplicateDetectorService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DuplicateCandidate {
  rateCardEntryId1: string;
  rateCardEntryId2: string;
  similarityScore: number;
  matchedFields: string[];
  differingFields: string[];
  suggestedAction: 'MERGE' | 'DELETE_DUPLICATE' | 'REVIEW_MANUALLY';
  confidence: number;
  detectedAt: Date;
}

export interface DuplicateGroup {
  id: string;
  masterRecordId: string;
  duplicateIds: string[];
  groupSize: number;
  averageSimilarity: number;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  createdAt: Date;
}

export interface DuplicateResolution {
  duplicateGroupId: string;
  action: 'MERGED' | 'DELETED' | 'KEPT_SEPARATE';
  resolvedBy: string;
  resolvedAt: Date;
  notes?: string;
  mergedIntoId?: string;
  deletedIds?: string[];
}

export interface SimilarityWeights {
  role: number;
  seniority: number;
  supplier: number;
  geography: number;
  rate: number;
  effectiveDate: number;
}

export interface DuplicateReport {
  tenantId: string;
  totalRateCards: number;
  duplicatesDetected: number;
  duplicateGroups: number;
  pendingReview: number;
  resolved: number;
  potentialSavings: number;
  topDuplicates: DuplicateCandidate[];
  generatedAt: Date;
}

// ============================================================================
// Duplicate Detector Service
// ============================================================================

export class DuplicateDetectorService {
  private prisma: PrismaClient;

  // Similarity thresholds
  private readonly HIGH_SIMILARITY_THRESHOLD = 0.95;
  private readonly MEDIUM_SIMILARITY_THRESHOLD = 0.85;
  private readonly LOW_SIMILARITY_THRESHOLD = 0.75;

  // Default similarity weights
  private readonly DEFAULT_WEIGHTS: SimilarityWeights = {
    role: 0.25,
    seniority: 0.15,
    supplier: 0.20,
    geography: 0.15,
    rate: 0.20,
    effectiveDate: 0.05,
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Duplicate Detection
  // ==========================================================================

  /**
   * Find duplicate candidates for a specific rate card
   */
  async findDuplicates(
    rateCardEntryId: string,
    weights?: Partial<SimilarityWeights>
  ): Promise<DuplicateCandidate[]> {
    const targetCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!targetCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    // Find potential duplicates (same tenant, similar role)
    const candidates = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId: targetCard.tenantId,
        id: { not: rateCardEntryId },
        roleStandardized: targetCard.roleStandardized,
      },
    });

    const duplicates: DuplicateCandidate[] = [];
    const finalWeights = { ...this.DEFAULT_WEIGHTS, ...weights };

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(
        targetCard,
        candidate,
        finalWeights
      );

      if (similarity >= this.LOW_SIMILARITY_THRESHOLD) {
        const { matchedFields, differingFields } = this.compareFields(
          targetCard,
          candidate
        );

        duplicates.push({
          rateCardEntryId1: rateCardEntryId,
          rateCardEntryId2: candidate.id,
          similarityScore: similarity,
          matchedFields,
          differingFields,
          suggestedAction: this.suggestAction(similarity, differingFields),
          confidence: this.calculateConfidence(similarity, matchedFields.length),
          detectedAt: new Date(),
        });
      }
    }

    return duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Find all duplicates for a tenant
   */
  async findAllDuplicates(
    tenantId: string,
    weights?: Partial<SimilarityWeights>
  ): Promise<DuplicateCandidate[]> {
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const duplicates: DuplicateCandidate[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < rateCards.length; i++) {
      const card1 = rateCards[i];
      if (processed.has(card1.id)) continue;

      for (let j = i + 1; j < rateCards.length; j++) {
        const card2 = rateCards[j];
        if (processed.has(card2.id)) continue;

        // Quick filter: same role
        if (card1.roleStandardized !== card2.roleStandardized) continue;

        const finalWeights = { ...this.DEFAULT_WEIGHTS, ...weights };
        const similarity = this.calculateSimilarity(card1, card2, finalWeights);

        if (similarity >= this.LOW_SIMILARITY_THRESHOLD) {
          const { matchedFields, differingFields } = this.compareFields(
            card1,
            card2
          );

          duplicates.push({
            rateCardEntryId1: card1.id,
            rateCardEntryId2: card2.id,
            similarityScore: similarity,
            matchedFields,
            differingFields,
            suggestedAction: this.suggestAction(similarity, differingFields),
            confidence: this.calculateConfidence(
              similarity,
              matchedFields.length
            ),
            detectedAt: new Date(),
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Group duplicates into clusters
   */
  async groupDuplicates(
    duplicates: DuplicateCandidate[]
  ): Promise<DuplicateGroup[]> {
    const groups: Map<string, Set<string>> = new Map();
    const cardToGroup: Map<string, string> = new Map();

    // Build groups using union-find approach
    for (const dup of duplicates) {
      const id1 = dup.rateCardEntryId1;
      const id2 = dup.rateCardEntryId2;

      const group1 = cardToGroup.get(id1);
      const group2 = cardToGroup.get(id2);

      if (!group1 && !group2) {
        // Create new group
        const groupId = id1;
        groups.set(groupId, new Set([id1, id2]));
        cardToGroup.set(id1, groupId);
        cardToGroup.set(id2, groupId);
      } else if (group1 && !group2) {
        // Add to existing group
        groups.get(group1)!.add(id2);
        cardToGroup.set(id2, group1);
      } else if (!group1 && group2) {
        // Add to existing group
        groups.get(group2)!.add(id1);
        cardToGroup.set(id1, group2);
      } else if (group1 !== group2) {
        // Merge groups
        const members2 = groups.get(group2!)!;
        groups.get(group1!)!.forEach((m) => members2.add(m));
        members2.forEach((m) => cardToGroup.set(m, group2!));
        groups.delete(group1!);
      }
    }

    // Convert to DuplicateGroup objects
    const result: DuplicateGroup[] = [];
    for (const [masterId, members] of groups.entries()) {
      const memberArray = Array.from(members);
      const groupDuplicates = duplicates.filter(
        (d) =>
          memberArray.includes(d.rateCardEntryId1) &&
          memberArray.includes(d.rateCardEntryId2)
      );

      const avgSimilarity =
        groupDuplicates.reduce((sum, d) => sum + d.similarityScore, 0) /
        groupDuplicates.length;

      result.push({
        id: masterId,
        masterRecordId: masterId,
        duplicateIds: memberArray.filter((id) => id !== masterId),
        groupSize: memberArray.length,
        averageSimilarity: avgSimilarity,
        status: 'PENDING',
        createdAt: new Date(),
      });
    }

    return result.sort((a, b) => b.groupSize - a.groupSize);
  }

  // ==========================================================================
  // Similarity Calculation
  // ==========================================================================

  /**
   * Calculate overall similarity score between two rate cards
   */
  private calculateSimilarity(
    card1: any,
    card2: any,
    weights: SimilarityWeights
  ): number {
    let score = 0;

    // Role similarity (exact match or similar)
    if (card1.roleStandardized === card2.roleStandardized) {
      score += weights.role;
    } else if (card1.roleCategory === card2.roleCategory) {
      score += weights.role * 0.5;
    }

    // Seniority similarity
    if (card1.seniority === card2.seniority) {
      score += weights.seniority;
    }

    // Supplier similarity
    if (card1.supplierId === card2.supplierId) {
      score += weights.supplier;
    } else if (card1.supplierName === card2.supplierName) {
      score += weights.supplier * 0.9;
    }

    // Geography similarity
    if (card1.country === card2.country) {
      score += weights.geography * 0.7;
      if (card1.region === card2.region) {
        score += weights.geography * 0.3;
      }
    }

    // Rate similarity (within 5%)
    const rate1 = Number(card1.dailyRateUSD);
    const rate2 = Number(card2.dailyRateUSD);
    const rateDiff = Math.abs(rate1 - rate2) / Math.max(rate1, rate2);
    if (rateDiff <= 0.05) {
      score += weights.rate;
    } else if (rateDiff <= 0.10) {
      score += weights.rate * 0.7;
    } else if (rateDiff <= 0.15) {
      score += weights.rate * 0.4;
    }

    // Effective date similarity (within 30 days)
    const date1 = new Date(card1.effectiveDate).getTime();
    const date2 = new Date(card2.effectiveDate).getTime();
    const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 30) {
      score += weights.effectiveDate;
    } else if (daysDiff <= 90) {
      score += weights.effectiveDate * 0.5;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Compare fields between two rate cards
   */
  private compareFields(
    card1: any,
    card2: any
  ): { matchedFields: string[]; differingFields: string[] } {
    const fieldsToCompare = [
      'roleStandardized',
      'seniority',
      'supplierId',
      'country',
      'region',
      'lineOfService',
      'currency',
    ];

    const matchedFields: string[] = [];
    const differingFields: string[] = [];

    for (const field of fieldsToCompare) {
      if (card1[field] === card2[field]) {
        matchedFields.push(field);
      } else {
        differingFields.push(field);
      }
    }

    // Check rate similarity
    const rate1 = Number(card1.dailyRateUSD);
    const rate2 = Number(card2.dailyRateUSD);
    const rateDiff = Math.abs(rate1 - rate2) / Math.max(rate1, rate2);
    if (rateDiff <= 0.05) {
      matchedFields.push('dailyRate');
    } else {
      differingFields.push('dailyRate');
    }

    return { matchedFields, differingFields };
  }

  /**
   * Suggest action based on similarity and differences
   */
  private suggestAction(
    similarity: number,
    differingFields: string[]
  ): 'MERGE' | 'DELETE_DUPLICATE' | 'REVIEW_MANUALLY' {
    if (similarity >= this.HIGH_SIMILARITY_THRESHOLD) {
      // Very similar - likely exact duplicate
      if (differingFields.length <= 1) {
        return 'DELETE_DUPLICATE';
      }
      return 'MERGE';
    } else if (similarity >= this.MEDIUM_SIMILARITY_THRESHOLD) {
      // Moderately similar - merge candidate
      return 'MERGE';
    } else {
      // Lower similarity - needs manual review
      return 'REVIEW_MANUALLY';
    }
  }

  /**
   * Calculate confidence in duplicate detection
   */
  private calculateConfidence(
    similarity: number,
    matchedFieldsCount: number
  ): number {
    // Base confidence from similarity
    let confidence = similarity;

    // Boost confidence based on number of matched fields
    const fieldBonus = Math.min(matchedFieldsCount * 0.05, 0.15);
    confidence = Math.min(confidence + fieldBonus, 1.0);

    return confidence;
  }

  // ==========================================================================
  // Duplicate Resolution
  // ==========================================================================

  /**
   * Merge duplicate rate cards
   */
  async mergeDuplicates(
    masterRecordId: string,
    duplicateIds: string[],
    mergedBy: string
  ): Promise<DuplicateResolution> {
    // 1. Fetch master record and duplicates
    const master = await this.prisma.rateCardEntry.findUnique({
      where: { id: masterRecordId },
    });

    if (!master) {
      throw new Error(`Master record not found: ${masterRecordId}`);
    }

    const duplicates = await this.prisma.rateCardEntry.findMany({
      where: { id: { in: duplicateIds } },
    });

    // 2. Combine data from duplicates into master
    // Keep the best quality data (prefer non-null values, most recent)
    const mergedData: Record<string, unknown> = {};

    // Merge additional info from duplicates
    const combinedInfo = {
      ...(master.additionalInfo as Record<string, unknown> || {}),
      mergedFrom: duplicateIds,
      mergedAt: new Date(),
      mergedBy,
    };

    for (const dup of duplicates) {
      const dupInfo = dup.additionalInfo as Record<string, unknown> || {};
      // Merge any unique metadata
      for (const [key, value] of Object.entries(dupInfo)) {
        if (value && !combinedInfo[key]) {
          combinedInfo[key] = value;
        }
      }
    }

    mergedData.additionalInfo = combinedInfo;

    // 3. Update master record
    await this.prisma.rateCardEntry.update({
      where: { id: masterRecordId },
      data: mergedData,
    });

    // 4. Update references from duplicates to master
    // Note: This depends on your schema - adjust table names as needed
    await this.prisma.$transaction(async (tx) => {
      // Update any contract references pointing to duplicates
      // Mark duplicates as merged (soft delete)
      await tx.rateCardEntry.updateMany({
        where: { id: { in: duplicateIds } },
        data: {
          additionalInfo: {
            merged: true,
            mergedInto: masterRecordId,
            mergedAt: new Date(),
            mergedBy,
          },
        },
      });
    });

    // 5. Create audit trail
    const resolution: DuplicateResolution = {
      duplicateGroupId: masterRecordId,
      action: 'MERGED',
      resolvedBy: mergedBy,
      resolvedAt: new Date(),
      mergedIntoId: masterRecordId,
      deletedIds: duplicateIds,
      notes: `Merged ${duplicateIds.length} duplicates into master record`,
    };

    // Save resolution
    await this.saveDuplicateResolution(resolution);

    return resolution;
  }

  /**
   * Delete duplicate rate cards
   */
  async deleteDuplicates(
    duplicateIds: string[],
    deletedBy: string,
    reason: string
  ): Promise<DuplicateResolution> {
    // Soft delete duplicates
    await this.prisma.rateCardEntry.updateMany({
      where: { id: { in: duplicateIds } },
      data: {
        // Mark as inactive or add deleted flag
        additionalInfo: {
          deleted: true,
          deletedBy,
          deletedAt: new Date(),
          reason,
        },
      },
    });

    const resolution: DuplicateResolution = {
      duplicateGroupId: duplicateIds[0],
      action: 'DELETED',
      resolvedBy: deletedBy,
      resolvedAt: new Date(),
      deletedIds: duplicateIds,
      notes: reason,
    };

    await this.saveDuplicateResolution(resolution);

    return resolution;
  }

  /**
   * Mark duplicates as separate (not actually duplicates)
   */
  async keepSeparate(
    rateCardIds: string[],
    reviewedBy: string,
    reason: string
  ): Promise<DuplicateResolution> {
    const resolution: DuplicateResolution = {
      duplicateGroupId: rateCardIds[0],
      action: 'KEPT_SEPARATE',
      resolvedBy: reviewedBy,
      resolvedAt: new Date(),
      notes: reason,
    };

    await this.saveDuplicateResolution(resolution);

    return resolution;
  }

  // ==========================================================================
  // Reporting
  // ==========================================================================

  /**
   * Generate comprehensive duplicate report
   */
  async generateDuplicateReport(tenantId: string): Promise<DuplicateReport> {
    const allDuplicates = await this.findAllDuplicates(tenantId);
    const totalRateCards = await this.prisma.rateCardEntry.count({
      where: { tenantId },
    });

    const groups = await this.groupDuplicates(allDuplicates);

    // Calculate potential savings from removing duplicates
    let potentialSavings = 0;
    for (const dup of allDuplicates) {
      if (dup.suggestedAction === 'DELETE_DUPLICATE') {
        // Estimate savings from data cleanup
        potentialSavings += 100; // Placeholder value
      }
    }

    return {
      tenantId,
      totalRateCards,
      duplicatesDetected: allDuplicates.length,
      duplicateGroups: groups.length,
      pendingReview: groups.filter((g) => g.status === 'PENDING').length,
      resolved: groups.filter((g) => g.status === 'RESOLVED').length,
      potentialSavings,
      topDuplicates: allDuplicates.slice(0, 20),
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Save duplicate resolution to database
   */
  private async saveDuplicateResolution(
    resolution: DuplicateResolution
  ): Promise<void> {
    await this.prisma.duplicateResolution.create({
      data: {
        duplicateGroupId: resolution.duplicateGroupId,
        action: resolution.action,
        resolvedBy: resolution.resolvedBy,
        resolvedAt: resolution.resolvedAt,
        notes: resolution.notes,
        mergedIntoId: resolution.mergedIntoId,
        deletedIds: resolution.deletedIds || [],
      },
    });
  }
}
