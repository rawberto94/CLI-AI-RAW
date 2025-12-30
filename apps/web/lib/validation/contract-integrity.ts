/**
 * Contract Integrity Validation
 * 
 * Validates business logic and data integrity for contracts
 */

import { prisma } from '@/lib/prisma';
import { isValidClassification } from 'data-orchestration';

export interface IntegrityIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  field?: string;
  suggestedFix?: string;
}

export interface IntegrityResult {
  valid: boolean;
  score: number; // 0-100
  issues: IntegrityIssue[];
  checks: {
    dates: boolean;
    values: boolean;
    taxonomy: boolean;
    hierarchy: boolean;
    processing: boolean;
    artifacts: boolean;
    metadata: boolean;
  };
}

/**
 * Validate contract data integrity
 */
export async function validateContractIntegrity(
  contractId: string,
  tenantId: string
): Promise<IntegrityResult> {
  const issues: IntegrityIssue[] = [];
  const checks = {
    dates: true,
    values: true,
    taxonomy: true,
    hierarchy: true,
    processing: true,
    artifacts: true,
    metadata: true,
  };

  try {
    // Fetch contract with relations
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
        processingJobs: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        parentContract: {
          select: {
            id: true,
            contractCategoryId: true,
            tenantId: true,
            status: true,
          },
        },
        childContracts: {
          select: {
            id: true,
            fileName: true,
            relationshipType: true,
          },
        },
        embeddings: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!contract) {
      issues.push({
        severity: 'error',
        category: 'existence',
        message: 'Contract not found',
      });
      return {
        valid: false,
        score: 0,
        issues,
        checks,
      };
    }

    // ========================================================================
    // DATE VALIDATION
    // ========================================================================

    // Start/End date consistency
    if (contract.startDate && contract.endDate) {
      if (contract.endDate <= contract.startDate) {
        issues.push({
          severity: 'error',
          category: 'dates',
          message: 'End date must be after start date',
          field: 'endDate',
          suggestedFix: 'Update endDate to be after startDate',
        });
        checks.dates = false;
      }

      // Warn if duration is unusually short (< 1 day) or long (> 10 years)
      const durationMs = contract.endDate.getTime() - contract.startDate.getTime();
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      
      if (durationDays < 1) {
        issues.push({
          severity: 'warning',
          category: 'dates',
          message: 'Contract duration is less than 1 day',
          field: 'endDate',
        });
      } else if (durationDays > 3650) {
        issues.push({
          severity: 'warning',
          category: 'dates',
          message: 'Contract duration exceeds 10 years',
          field: 'endDate',
        });
      }
    }

    // Effective/Expiration date consistency
    if (contract.effectiveDate && contract.expirationDate) {
      if (contract.expirationDate <= contract.effectiveDate) {
        issues.push({
          severity: 'error',
          category: 'dates',
          message: 'Expiration date must be after effective date',
          field: 'expirationDate',
          suggestedFix: 'Update expirationDate to be after effectiveDate',
        });
        checks.dates = false;
      }
    }

    // Check for expired contracts with wrong status
    if (contract.endDate && contract.endDate < new Date() && contract.status === 'ACTIVE') {
      issues.push({
        severity: 'warning',
        category: 'dates',
        message: 'Contract has passed end date but status is still ACTIVE',
        field: 'status',
        suggestedFix: 'Update status to EXPIRED or COMPLETED',
      });
    }

    // ========================================================================
    // VALUE VALIDATION
    // ========================================================================

    const totalValueNum = contract.totalValue != null ? Number(contract.totalValue) : null;
    const annualValueNum = contract.annualValue != null ? Number(contract.annualValue) : null;
    const monthlyValueNum = contract.monthlyValue != null ? Number(contract.monthlyValue) : null;

    // Negative values
    if (totalValueNum != null && totalValueNum < 0) {
      issues.push({
        severity: 'error',
        category: 'values',
        message: 'Total value cannot be negative',
        field: 'totalValue',
        suggestedFix: 'Update totalValue to positive number or null',
      });
      checks.values = false;
    }

    // Annual/Monthly value consistency
    if (annualValueNum != null && monthlyValueNum != null) {
      const expectedMonthly = annualValueNum / 12;
      const diff = Math.abs(monthlyValueNum - expectedMonthly);
      const tolerance = expectedMonthly * 0.1; // 10% tolerance

      if (diff > tolerance) {
        issues.push({
          severity: 'warning',
          category: 'values',
          message: 'Monthly value does not match annual value / 12',
          field: 'monthlyValue',
          suggestedFix: `Expected ~${expectedMonthly.toFixed(2)}, got ${monthlyValueNum}`,
        });
      }
    }

    // Currency missing when value present
    if (contract.totalValue && !contract.currency) {
      issues.push({
        severity: 'warning',
        category: 'values',
        message: 'Currency is missing but totalValue is set',
        field: 'currency',
        suggestedFix: 'Add currency (e.g., USD, EUR, GBP)',
      });
    }

    // ========================================================================
    // TAXONOMY VALIDATION
    // ========================================================================

    if (contract.contractCategoryId) {
      try {
        const valid = isValidClassification({
          category_id: contract.contractCategoryId as any,
          subtype: contract.contractSubtype || undefined,
          confidence: Number(contract.classificationConf) || 0,
          tags: {
            pricing_models: (contract.pricingModels as any) || [],
            delivery_models: (contract.deliveryModels as any) || [],
            data_profiles: (contract.dataProfiles as any) || [],
            risk_flags: (contract.riskFlags as any) || [],
          },
        } as any);

        if (!valid) {
          issues.push({
            severity: 'error',
            category: 'taxonomy',
            message: 'Invalid taxonomy classification',
            field: 'contractCategoryId',
            suggestedFix: 'Re-classify contract or fix taxonomy fields',
          });
          checks.taxonomy = false;
        }
      } catch (error) {
        issues.push({
          severity: 'warning',
          category: 'taxonomy',
          message: 'Could not validate taxonomy classification',
        });
      }

      // Low confidence warning
      if (contract.classificationConf && contract.classificationConf < 0.5) {
        issues.push({
          severity: 'warning',
          category: 'taxonomy',
          message: `Low classification confidence: ${(contract.classificationConf * 100).toFixed(1)}%`,
          suggestedFix: 'Consider manual review or re-classification',
        });
      }
    } else if (contract.status === 'ACTIVE') {
      // Active contracts should be classified
      issues.push({
        severity: 'info',
        category: 'taxonomy',
        message: 'Contract is not classified with taxonomy',
        suggestedFix: 'Run taxonomy classification',
      });
    }

    // ========================================================================
    // HIERARCHY VALIDATION
    // ========================================================================

    if (contract.parentContractId) {
      // Check if parent exists
      if (!contract.parentContract) {
        issues.push({
          severity: 'error',
          category: 'hierarchy',
          message: 'Parent contract reference is broken (orphaned link)',
          field: 'parentContractId',
          suggestedFix: 'Remove parent reference or restore parent contract',
        });
        checks.hierarchy = false;
      } else {
        // Check cross-tenant references
        if (contract.parentContract.tenantId !== tenantId) {
          issues.push({
            severity: 'error',
            category: 'hierarchy',
            message: 'Parent contract belongs to different tenant',
            field: 'parentContractId',
            suggestedFix: 'Remove invalid parent reference',
          });
          checks.hierarchy = false;
        }

        // Check if parent is deleted
        if (contract.parentContract.status === 'DELETED') {
          issues.push({
            severity: 'warning',
            category: 'hierarchy',
            message: 'Parent contract is deleted',
            field: 'parentContractId',
            suggestedFix: 'Unlink from deleted parent',
          });
        }

        // Validate relationship type
        if (!contract.relationshipType) {
          issues.push({
            severity: 'warning',
            category: 'hierarchy',
            message: 'Relationship type is missing',
            field: 'relationshipType',
            suggestedFix: 'Specify relationship type (e.g., SOW_UNDER_MSA)',
          });
        }
      }
    }

    // Check for circular references
    if (contract.childContracts.length > 0) {
      for (const child of contract.childContracts) {
        if (child.id === contractId) {
          issues.push({
            severity: 'error',
            category: 'hierarchy',
            message: 'Circular reference detected: contract is its own child',
            suggestedFix: 'Remove circular relationship',
          });
          checks.hierarchy = false;
        }
      }
    }

    // ========================================================================
    // PROCESSING STATUS VALIDATION
    // ========================================================================

    if (contract.status === 'PROCESSING') {
      if (contract.processingJobs.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'processing',
          message: 'Status is PROCESSING but no processing jobs found',
          field: 'status',
          suggestedFix: 'Update status to reflect actual state',
        });
        checks.processing = false;
      } else {
        const latestJob = contract.processingJobs[0];
        if (latestJob.status !== 'RUNNING' && latestJob.status !== 'PENDING') {
          issues.push({
            severity: 'warning',
            category: 'processing',
            message: `Status is PROCESSING but latest job is ${latestJob.status}`,
            suggestedFix: 'Update contract status based on job status',
          });
        }

        // Check for stuck processing (> 24 hours)
        const hoursSinceCreated = 
          (Date.now() - latestJob.createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreated > 24 && !latestJob.completedAt) {
          issues.push({
            severity: 'error',
            category: 'processing',
            message: 'Processing job appears stuck (> 24 hours)',
            suggestedFix: 'Restart processing or mark as failed',
          });
          checks.processing = false;
        }
      }
    }

    if (contract.status === 'FAILED') {
      issues.push({
        severity: 'info',
        category: 'processing',
        message: 'Contract processing failed',
        suggestedFix: 'Review error logs and retry processing',
      });
    }

    // ========================================================================
    // ARTIFACTS VALIDATION
    // ========================================================================

    if (contract.status === 'ACTIVE' || contract.status === 'COMPLETED') {
      if (contract.artifacts.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'artifacts',
          message: 'Active/completed contract has no artifacts',
          suggestedFix: 'Generate artifacts or update status',
        });
        checks.artifacts = false;
      }
    }

    // Check for RAG embeddings
    if (contract.status === 'ACTIVE' && contract.embeddings.length === 0) {
      issues.push({
        severity: 'info',
        category: 'artifacts',
        message: 'Contract has no RAG embeddings (chatbot search unavailable)',
        suggestedFix: 'Run embedding generation',
      });
    }

    // ========================================================================
    // METADATA VALIDATION
    // ========================================================================

    // Missing critical fields
    if (!contract.contractTitle) {
      issues.push({
        severity: 'warning',
        category: 'metadata',
        message: 'Contract title is missing',
        field: 'contractTitle',
        suggestedFix: 'Add descriptive title',
      });
    }

    if (!contract.clientName && !contract.supplierName) {
      issues.push({
        severity: 'info',
        category: 'metadata',
        message: 'Neither client nor supplier name is set',
        suggestedFix: 'Add at least one party name',
      });
    }

    // ========================================================================
    // CALCULATE SCORE
    // ========================================================================

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    // Score: 100 - (errors * 15) - (warnings * 5) - (info * 1)
    const score = Math.max(
      0,
      100 - errorCount * 15 - warningCount * 5 - infoCount * 1
    );

    return {
      valid: errorCount === 0,
      score,
      issues,
      checks,
    };
  } catch (error) {
    console.error('Contract integrity validation error:', error);
    
    return {
      valid: false,
      score: 0,
      issues: [
        {
          severity: 'error',
          category: 'system',
          message: 'Integrity validation failed',
        },
      ],
      checks,
    };
  }
}

/**
 * Get human-readable integrity report
 */
export function formatIntegrityReport(result: IntegrityResult): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('CONTRACT INTEGRITY REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Overall Score: ${result.score}/100`);
  lines.push(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('✅ No issues found');
    return lines.join('\n');
  }

  // Group by severity
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const info = result.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    lines.push(`❌ ERRORS (${errors.length}):`);
    errors.forEach((issue, i) => {
      lines.push(`  ${i + 1}. [${issue.category}] ${issue.message}`);
      if (issue.suggestedFix) {
        lines.push(`     → Fix: ${issue.suggestedFix}`);
      }
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push(`⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((issue, i) => {
      lines.push(`  ${i + 1}. [${issue.category}] ${issue.message}`);
      if (issue.suggestedFix) {
        lines.push(`     → Fix: ${issue.suggestedFix}`);
      }
    });
    lines.push('');
  }

  if (info.length > 0) {
    lines.push(`ℹ️  INFO (${info.length}):`);
    info.forEach((issue, i) => {
      lines.push(`  ${i + 1}. [${issue.category}] ${issue.message}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
