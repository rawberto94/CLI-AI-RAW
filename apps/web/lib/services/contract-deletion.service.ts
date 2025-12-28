/**
 * Safe Contract Deletion Service
 * 
 * Handles cascading deletion of contracts and all related data
 */

import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { deleteContractFile } from '@/lib/storage/delete';

interface DeleteOptions {
  deleteFromStorage?: boolean;
  userId?: string;
  reason?: string;
}

interface DeleteResult {
  success: boolean;
  deletedRecords: {
    embeddings: number;
    contractEmbeddings: number;
    artifacts: number;
    rateCardEntries: number;
    processingJobs: number;
    clauses: number;
    versions: number;
    financialAnalyses: number;
    overviewAnalyses: number;
    templateAnalyses: number;
    workflowExecutions: number;
  };
  unlinkedChildren: number;
  error?: string;
}

/**
 * Safely delete a contract and all related data in a transaction
 */
export async function safeDeleteContract(
  contractId: string,
  tenantId: string,
  options: DeleteOptions = {}
): Promise<DeleteResult> {
  const { deleteFromStorage = true, userId, reason } = options;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const deletedRecords = {
          embeddings: 0,
          contractEmbeddings: 0,
          artifacts: 0,
          rateCardEntries: 0,
          processingJobs: 0,
          clauses: 0,
          versions: 0,
          financialAnalyses: 0,
          overviewAnalyses: 0,
          templateAnalyses: 0,
          workflowExecutions: 0,
        };

        // Verify contract exists and belongs to tenant
        const contract = await tx.contract.findUnique({
          where: { id: contractId, tenantId },
          select: {
            id: true,
            storagePath: true,
            storageProvider: true,
            fileName: true,
          },
        });

        if (!contract) {
          throw new Error('Contract not found or access denied');
        }

        // 1. Delete embeddings
        const embeddingsResult = await tx.embedding.deleteMany({
          where: { contractId },
        });
        deletedRecords.embeddings = embeddingsResult.count;

        // 2. Delete contract embeddings
        const contractEmbeddingsResult = await tx.contractEmbedding.deleteMany({
          where: { contractId },
        });
        deletedRecords.contractEmbeddings = contractEmbeddingsResult.count;

        // 3. Delete rate card entries linked to artifacts
        const artifacts = await tx.artifact.findMany({
          where: { contractId },
          select: { id: true },
        });

        for (const artifact of artifacts) {
          const rateCardResult = await tx.rateCardEntry.deleteMany({
            where: { artifactId: artifact.id },
          });
          deletedRecords.rateCardEntries += rateCardResult.count;
        }

        // 4. Delete artifacts
        const artifactsResult = await tx.artifact.deleteMany({
          where: { contractId },
        });
        deletedRecords.artifacts = artifactsResult.count;

        // 5. Delete processing jobs
        const jobsResult = await tx.processingJob.deleteMany({
          where: { contractId },
        });
        deletedRecords.processingJobs = jobsResult.count;

        // 6. Delete clauses
        const clausesResult = await tx.clause.deleteMany({
          where: { contractId },
        });
        deletedRecords.clauses = clausesResult.count;

        // 7. Delete versions
        const versionsResult = await tx.contractVersion.deleteMany({
          where: { contractId },
        });
        deletedRecords.versions = versionsResult.count;

        // 8. Delete financial analyses
        const financialResult = await tx.financialAnalysis.deleteMany({
          where: { contractId },
        });
        deletedRecords.financialAnalyses = financialResult.count;

        // 9. Delete overview analyses
        const overviewResult = await tx.overviewAnalysis.deleteMany({
          where: { contractId },
        });
        deletedRecords.overviewAnalyses = overviewResult.count;

        // 10. Delete template analyses
        const templateResult = await tx.templateAnalysis.deleteMany({
          where: { contractId },
        });
        deletedRecords.templateAnalyses = templateResult.count;

        // 11. Delete workflow executions
        const workflowResult = await tx.workflowExecution.deleteMany({
          where: { contractId },
        });
        deletedRecords.workflowExecutions = workflowResult.count;

        // 12. Unlink child contracts (don't delete them)
        const unlinkedChildren = await tx.contract.updateMany({
          where: { parentContractId: contractId },
          data: {
            parentContractId: null,
            relationshipType: null,
            relationshipNote: null,
            linkedAt: null,
          },
        });

        // 13. Delete contract metadata (if exists)
        await tx.contractMetadata.deleteMany({
          where: { contractId },
        });

        // 14. Delete runs (if any)
        await tx.run.deleteMany({
          where: { contractId },
        });

        // 15. Delete cost savings opportunities
        await tx.costSavingsOpportunity.deleteMany({
          where: { contractId },
        });

        // 16. Delete contract artifacts mapping
        await tx.contractArtifact.deleteMany({
          where: { contractId },
        });

        // 17. Finally, delete the contract
        await tx.contract.delete({
          where: { id: contractId, tenantId },
        });

        // 18. Log activity
        try {
          await tx.activityLog.create({
            data: {
              tenantId,
              userId: userId || 'system',
              action: 'contract_deleted',
              entityType: 'contract',
              entityId: contractId,
              metadata: {
                fileName: contract.fileName,
                cascade: true,
                deletedRecords,
                unlinkedChildren: unlinkedChildren.count,
                reason: reason || 'User initiated deletion',
              },
            },
          });
        } catch (logError) {
          // Activity logging failure shouldn't stop deletion
          console.error('Failed to log deletion activity:', logError);
        }

        return {
          success: true,
          deletedRecords,
          unlinkedChildren: unlinkedChildren.count,
          contract,
        };
      },
      {
        maxWait: 10000, // 10 seconds
        timeout: 30000, // 30 seconds
      }
    );

    // Delete from storage (outside transaction)
    if (deleteFromStorage && result.contract.storagePath) {
      try {
        const storageResult = await deleteContractFile(result.contract.storagePath);
        
        if (storageResult.success) {
          console.log('✅ Deleted file from storage:', result.contract.storagePath);
        } else {
          console.warn('⚠️ Storage deletion failed:', storageResult.error);
        }
      } catch (storageError) {
        console.error('⚠️ Storage deletion failed (non-fatal):', storageError);
        // Don't fail the whole operation if storage deletion fails
      }
    }

    // Publish realtime event
    try {
      await publishRealtimeEvent({
        event: 'contract:deleted',
        data: {
          tenantId,
          contractId,
          fileName: result.contract.fileName,
        },
        source: 'service:contract-deletion',
      });
    } catch (eventError) {
      console.error('⚠️ Failed to publish deletion event:', eventError);
    }

    return {
      success: true,
      deletedRecords: result.deletedRecords,
      unlinkedChildren: result.unlinkedChildren,
    };
  } catch (error) {
    console.error('❌ Safe contract deletion failed:', error);
    return {
      success: false,
      deletedRecords: {
        embeddings: 0,
        contractEmbeddings: 0,
        artifacts: 0,
        rateCardEntries: 0,
        processingJobs: 0,
        clauses: 0,
        versions: 0,
        financialAnalyses: 0,
        overviewAnalyses: 0,
        templateAnalyses: 0,
        workflowExecutions: 0,
      },
      unlinkedChildren: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Soft delete a contract (mark as deleted without removing data)
 */
export async function softDeleteContract(
  contractId: string,
  tenantId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.contract.update({
      where: { id: contractId, tenantId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId || 'system',
        status: 'DELETED',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId,
        userId: userId || 'system',
        action: 'contract_soft_deleted',
        entityType: 'contract',
        entityId: contractId,
        metadata: { softDelete: true },
      },
    });

    // Publish event
    await publishRealtimeEvent({
      event: 'contract:soft_deleted',
      data: { tenantId, contractId },
      source: 'service:contract-deletion',
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Soft delete failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore a soft-deleted contract
 */
export async function restoreContract(
  contractId: string,
  tenantId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.contract.update({
      where: { id: contractId, tenantId, isDeleted: true },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        status: 'ACTIVE',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId,
        userId: userId || 'system',
        action: 'contract_restored',
        entityType: 'contract',
        entityId: contractId,
      },
    });

    // Publish event
    await publishRealtimeEvent({
      event: 'contract:restored',
      data: { tenantId, contractId },
      source: 'service:contract-deletion',
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Contract restoration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
