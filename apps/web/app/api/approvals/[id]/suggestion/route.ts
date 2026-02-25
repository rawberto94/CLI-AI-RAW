/**
 * AI Approval Suggestion API Route
 * 
 * Analyzes a pending approval using contract data, vendor history, 
 * compliance factors, and historical patterns to generate an AI-powered
 * approval/reject/review/escalate recommendation with confidence score.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Helper
function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const url = new URL(request.url);
  // Extract approval ID from the path: /api/approvals/[id]/suggestion
  const segments = url.pathname.split('/');
  const approvalIdIdx = segments.indexOf('approvals') + 1;
  const approvalId = segments[approvalIdIdx] || '';

  if (!approvalId || approvalId === 'suggestion') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Approval ID is required', 400);
  }

  try {
    // ── 1. Fetch the workflow execution (= approval) ──
    const execution = await prisma.workflowExecution.findFirst({
      where: { id: approvalId, tenantId },
      include: {
        workflow: true,
        contract: {
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            supplierName: true,
            totalValue: true,
            status: true,
            category: true,
            startDate: true,
            endDate: true,
            metadata: true,
          },
        },
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!execution) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Approval not found', 404);
    }

    const contract = execution.contract;
    const contractValue = contract?.totalValue ? Number(contract.totalValue) : 0;
    const contractName = contract?.contractTitle || contract?.fileName || 'Unknown';
    const supplierName = contract?.supplierName || 'Unknown';

    // ── 2. Gather historical context ──
    // Count past contracts with same supplier
    let pastContracts = { total: 0, completed: 0, rejected: 0 };
    if (contract?.supplierName) {
      const [total, completed, rejected] = await Promise.all([
        prisma.contract.count({
          where: { tenantId, supplierName: contract.supplierName },
        }),
        prisma.workflowExecution.count({
          where: {
            tenantId,
            status: 'COMPLETED',
            contract: { supplierName: contract.supplierName },
          },
        }),
        prisma.workflowExecution.count({
          where: {
            tenantId,
            status: 'REJECTED',
            contract: { supplierName: contract.supplierName },
          },
        }),
      ]);
      pastContracts = { total, completed, rejected };
    }

    // ── 3. Check existing risk detections ──
    let riskDetections: Array<{ riskType: string; severity: string; description: string }> = [];
    try {
      riskDetections = await prisma.riskDetectionLog.findMany({
        where: { contractId: contract?.id, tenantId },
        select: { riskType: true, severity: true, description: true },
        take: 5,
        orderBy: { detectedAt: 'desc' },
      });
    } catch {
      // Table may not exist yet
    }

    // ── 4. Build factors from data analysis ──
    const factors: Array<{
      id: string;
      label: string;
      description: string;
      type: 'positive' | 'negative' | 'neutral' | 'warning';
      weight: number;
      category: 'financial' | 'compliance' | 'relationship' | 'risk' | 'timeline';
      source: string;
    }> = [];

    let factorId = 1;

    // Financial analysis
    if (contractValue > 0) {
      if (contractValue <= 50000) {
        factors.push({
          id: String(factorId++),
          label: 'Low Contract Value',
          description: `Contract value of $${contractValue.toLocaleString()} is within typical low-risk range.`,
          type: 'positive',
          weight: 70,
          category: 'financial',
          source: 'Value Analysis',
        });
      } else if (contractValue > 500000) {
        factors.push({
          id: String(factorId++),
          label: 'High Contract Value',
          description: `Contract value of $${contractValue.toLocaleString()} exceeds standard threshold — additional scrutiny recommended.`,
          type: 'warning',
          weight: -45,
          category: 'financial',
          source: 'Value Analysis',
        });
      } else {
        factors.push({
          id: String(factorId++),
          label: 'Contract Value Within Range',
          description: `Contract value of $${contractValue.toLocaleString()} is within normal approval range.`,
          type: 'positive',
          weight: 60,
          category: 'financial',
          source: 'Value Analysis',
        });
      }
    }

    // Relationship analysis
    if (pastContracts.total > 0) {
      const approvalRate = pastContracts.total > 0
        ? (pastContracts.completed / pastContracts.total) * 100
        : 0;
      if (approvalRate >= 80) {
        factors.push({
          id: String(factorId++),
          label: 'Strong Vendor History',
          description: `${supplierName} has ${pastContracts.total} past contracts with ${Math.round(approvalRate)}% approval rate.`,
          type: 'positive',
          weight: 75,
          category: 'relationship',
          source: 'Vendor Database',
        });
      } else if (approvalRate >= 50) {
        factors.push({
          id: String(factorId++),
          label: 'Mixed Vendor History',
          description: `${supplierName} has ${pastContracts.total} past contracts with ${Math.round(approvalRate)}% approval rate.`,
          type: 'neutral',
          weight: 10,
          category: 'relationship',
          source: 'Vendor Database',
        });
      } else {
        factors.push({
          id: String(factorId++),
          label: 'Concerning Vendor History',
          description: `${supplierName} has only ${Math.round(approvalRate)}% approval rate across ${pastContracts.total} contracts.`,
          type: 'negative',
          weight: -60,
          category: 'relationship',
          source: 'Vendor Database',
        });
      }
    } else {
      factors.push({
        id: String(factorId++),
        label: 'New Vendor',
        description: `No prior contract history found for ${supplierName}. Due diligence recommended.`,
        type: 'warning',
        weight: -25,
        category: 'relationship',
        source: 'Vendor Database',
      });
    }

    // Risk detections
    const criticalRisks = riskDetections.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
    if (criticalRisks.length > 0) {
      factors.push({
        id: String(factorId++),
        label: `${criticalRisks.length} High-Severity Risk(s) Detected`,
        description: criticalRisks.map(r => r.description).join('; ').slice(0, 200),
        type: 'negative',
        weight: -70,
        category: 'risk',
        source: 'Risk Detection Engine',
      });
    } else if (riskDetections.length > 0) {
      factors.push({
        id: String(factorId++),
        label: 'Minor Risks Noted',
        description: `${riskDetections.length} low/medium risk(s) detected — manageable.`,
        type: 'neutral',
        weight: -10,
        category: 'risk',
        source: 'Risk Detection Engine',
      });
    } else {
      factors.push({
        id: String(factorId++),
        label: 'No Risks Detected',
        description: 'No compliance or risk issues have been flagged for this contract.',
        type: 'positive',
        weight: 50,
        category: 'compliance',
        source: 'Risk Detection Engine',
      });
    }

    // Timeline analysis
    if (execution.dueDate) {
      const remaining = execution.dueDate.getTime() - Date.now();
      const hoursRemaining = remaining / (1000 * 60 * 60);
      if (hoursRemaining < 0) {
        factors.push({
          id: String(factorId++),
          label: 'Overdue',
          description: `Approval is ${Math.abs(Math.round(hoursRemaining))} hours overdue.`,
          type: 'warning',
          weight: -30,
          category: 'timeline',
          source: 'SLA Tracker',
        });
      } else if (hoursRemaining < 24) {
        factors.push({
          id: String(factorId++),
          label: 'Due Soon',
          description: `Only ${Math.round(hoursRemaining)} hours remaining before deadline.`,
          type: 'warning',
          weight: -15,
          category: 'timeline',
          source: 'SLA Tracker',
        });
      }
    }

    // Workflow progress
    const completedSteps = execution.stepExecutions.filter(s => s.status === 'COMPLETED').length;
    const totalSteps = execution.stepExecutions.length;
    if (completedSteps > 0 && totalSteps > 0) {
      factors.push({
        id: String(factorId++),
        label: `${completedSteps}/${totalSteps} Steps Completed`,
        description: `Previous approvers have already endorsed this contract.`,
        type: completedSteps > totalSteps / 2 ? 'positive' : 'neutral',
        weight: completedSteps > totalSteps / 2 ? 40 : 15,
        category: 'compliance',
        source: 'Workflow Progress',
      });
    }

    // ── 5. Calculate confidence and suggestion ──
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const maxPossible = factors.length * 80; // theoretical max positive weight
    const normalizedScore = Math.max(0, Math.min(100, Math.round(50 + (totalWeight / Math.max(maxPossible, 1)) * 50)));

    let suggestion: 'approve' | 'reject' | 'review' | 'escalate';
    if (criticalRisks.length >= 2) {
      suggestion = 'escalate';
    } else if (normalizedScore >= 70) {
      suggestion = 'approve';
    } else if (normalizedScore >= 45) {
      suggestion = 'review';
    } else {
      suggestion = 'reject';
    }

    // ── 6. Optionally enhance with LLM ──
    let recommendedActions: string[] = [];
    try {
      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `You are an approval advisor for contracts. Given this context, provide 2-3 short recommended actions (one sentence each):
Contract: "${contractName}" worth $${contractValue.toLocaleString()} from ${supplierName}.
Workflow status: ${completedSteps}/${totalSteps} steps done.
AI suggestion: ${suggestion} (confidence: ${normalizedScore}%).
Key factors: ${factors.map(f => `[${f.type}] ${f.label}`).join(', ')}.
Respond ONLY with a JSON array of strings.`;

        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        recommendedActions = Array.isArray(parsed.actions) ? parsed.actions : Array.isArray(parsed) ? parsed : [];
      }
    } catch (llmErr) {
      logger.warn('[Suggestion API] LLM enhancement failed, using fallback', llmErr);
    }

    // Fallback recommended actions
    if (recommendedActions.length === 0) {
      if (suggestion === 'approve') {
        recommendedActions = ['Review final terms and approve', 'Confirm budget allocation'];
      } else if (suggestion === 'reject') {
        recommendedActions = ['Request revised pricing', 'Schedule vendor re-negotiation'];
      } else if (suggestion === 'escalate') {
        recommendedActions = ['Escalate to VP for review', 'Request legal opinion on flagged risks'];
      } else {
        recommendedActions = ['Review flagged items before deciding', 'Request additional documentation'];
      }
    }

    return createSuccessResponse(ctx, {
      id: `suggestion-${approvalId}`,
      approvalId,
      suggestion,
      confidence: normalizedScore,
      confidenceLevel: getConfidenceLevel(normalizedScore),
      factors,
      similarContracts: pastContracts.total > 0
        ? {
            total: pastContracts.total,
            approved: pastContracts.completed,
            rejected: pastContracts.rejected,
          }
        : undefined,
      estimatedImpact: {
        revenue: contractValue || undefined,
        risk: criticalRisks.length > 0 ? 'high' : riskDetections.length > 0 ? 'medium' : 'low',
        relationship:
          pastContracts.total > 3 ? 'positive' : pastContracts.total > 0 ? 'neutral' : 'neutral',
      },
      recommendedActions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[AI Suggestion GET]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate AI suggestion', 500);
  }
});
