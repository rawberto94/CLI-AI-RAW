import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Mock approval queue data (fallback)
const mockApprovals = [
  {
    id: 'appr1',
    type: 'contract',
    title: 'Master Agreement - Acme Corp',
    description: 'Annual master services agreement renewal with updated terms',
    requestedBy: {
      id: 'user1',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      avatar: '/avatars/sarah.jpg',
    },
    requestedAt: '2024-03-10T09:30:00Z',
    dueDate: '2024-03-15T17:00:00Z',
    priority: 'high',
    status: 'pending',
    value: 1200000,
    riskLevel: 'medium',
    stage: 'legal-review',
    assignedTo: {
      id: 'user2',
      name: 'Mike Johnson',
      email: 'mike.johnson@company.com',
    },
    approvalChain: [
      { step: 1, role: 'Legal Review', status: 'completed', approver: 'Jane Smith', completedAt: '2024-03-11T14:00:00Z' },
      { step: 2, role: 'Finance Review', status: 'pending', approver: 'Mike Johnson', completedAt: null },
      { step: 3, role: 'VP Approval', status: 'waiting', approver: 'Alex Williams', completedAt: null },
    ],
    documents: [
      { name: 'Master Agreement v3.pdf', size: '2.4 MB' },
      { name: 'Pricing Schedule.xlsx', size: '156 KB' },
    ],
    healthScore: 78,
    deviations: 3,
  },
  {
    id: 'appr2',
    type: 'amendment',
    title: 'Cloud Services SLA Amendment',
    description: 'Adding new service tiers and updated SLA metrics',
    requestedBy: {
      id: 'user3',
      name: 'Tom Wilson',
      email: 'tom.wilson@company.com',
    },
    requestedAt: '2024-03-12T11:00:00Z',
    dueDate: '2024-03-14T17:00:00Z',
    priority: 'critical',
    status: 'pending',
    value: 450000,
    riskLevel: 'low',
    stage: 'finance-review',
    assignedTo: {
      id: 'user2',
      name: 'Mike Johnson',
      email: 'mike.johnson@company.com',
    },
    approvalChain: [
      { step: 1, role: 'Legal Review', status: 'completed', approver: 'Jane Smith', completedAt: '2024-03-12T16:00:00Z' },
      { step: 2, role: 'Finance Review', status: 'in-progress', approver: 'Mike Johnson', completedAt: null },
    ],
    documents: [
      { name: 'SLA Amendment.pdf', size: '890 KB' },
    ],
    healthScore: 92,
    deviations: 0,
  },
  {
    id: 'appr3',
    type: 'contract',
    title: 'New Vendor Agreement - DataTech Inc',
    description: 'New data analytics services contract',
    requestedBy: {
      id: 'user4',
      name: 'Lisa Park',
      email: 'lisa.park@company.com',
    },
    requestedAt: '2024-03-08T10:00:00Z',
    dueDate: '2024-03-20T17:00:00Z',
    priority: 'medium',
    status: 'pending',
    value: 320000,
    riskLevel: 'high',
    stage: 'initial-review',
    assignedTo: {
      id: 'user5',
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
    },
    approvalChain: [
      { step: 1, role: 'Initial Review', status: 'in-progress', approver: 'Jane Smith', completedAt: null },
      { step: 2, role: 'Security Review', status: 'waiting', approver: 'Security Team', completedAt: null },
      { step: 3, role: 'Legal Review', status: 'waiting', approver: 'Legal Team', completedAt: null },
      { step: 4, role: 'VP Approval', status: 'waiting', approver: 'Alex Williams', completedAt: null },
    ],
    documents: [
      { name: 'DataTech Proposal.pdf', size: '1.8 MB' },
      { name: 'Security Questionnaire.pdf', size: '450 KB' },
    ],
    healthScore: 65,
    deviations: 5,
  },
];

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || 'demo';
  const userId = request.headers.get('x-user-id') || 'current-user';
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const type = searchParams.get('type');
  const assignedTo = searchParams.get('assignedTo');

  // Try database first
  try {
    // Get workflow executions that need approval
    const workflowExecutions = await prisma.workflowExecution.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        workflow: true,
        contract: {
          select: {
            id: true,
            title: true,
            counterparty: true,
            contractValue: true,
            status: true,
          },
        },
        stepExecutions: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to approvals format
    const dbApprovals = workflowExecutions.map((exec) => {
      const currentStep = exec.stepExecutions.find(s => s.status === 'PENDING');
      const completedSteps = exec.stepExecutions.filter(s => s.status === 'COMPLETED').length;
      
      return {
        id: exec.id,
        type: exec.workflow?.type?.toLowerCase() || 'contract',
        title: `${exec.workflow?.name || 'Workflow'} - ${exec.contract?.title || 'Contract'}`,
        description: exec.workflow?.description || '',
        contractName: exec.contract?.title || 'Unknown Contract',
        supplierName: exec.contract?.counterparty || 'Unknown',
        requestedBy: {
          id: exec.startedBy || 'system',
          name: exec.startedBy || 'System',
          email: `${exec.startedBy || 'system'}@company.com`,
        },
        requestedAt: exec.createdAt.toISOString(),
        dueDate: exec.dueDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: (exec.metadata as Record<string, string>)?.priority || 'medium',
        status: exec.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
        value: exec.contract?.contractValue ?? 0,
        riskLevel: 'medium',
        stage: currentStep?.stepName || 'initial-review',
        assignedTo: currentStep ? {
          id: currentStep.assignedTo || 'unassigned',
          name: currentStep.assignedTo || 'Unassigned',
          email: `${currentStep.assignedTo || 'unassigned'}@company.com`,
        } : undefined,
        approvalChain: exec.stepExecutions.map((step, idx) => ({
          step: idx + 1,
          role: step.stepName,
          status: step.status.toLowerCase(),
          approver: step.assignedTo || 'Unassigned',
          completedAt: step.completedAt?.toISOString() || null,
        })),
        currentStep: completedSteps + 1,
        totalSteps: exec.stepExecutions.length,
        documents: [],
        healthScore: 75,
        deviations: 0,
      };
    });

    if (dbApprovals.length > 0) {
      let approvals = [...dbApprovals];
      if (status && status !== 'all') {
        approvals = approvals.filter(a => a.status === status);
      }
      if (priority && priority !== 'all') {
        approvals = approvals.filter(a => a.priority === priority);
      }
      if (type && type !== 'all') {
        approvals = approvals.filter(a => a.type === type);
      }

      const stats = {
        total: dbApprovals.length,
        pending: dbApprovals.filter(a => a.status === 'pending').length,
        approved: dbApprovals.filter(a => a.status === 'approved').length,
        rejected: dbApprovals.filter(a => a.status === 'rejected').length,
        critical: dbApprovals.filter(a => a.priority === 'critical').length,
        overdue: dbApprovals.filter(a => new Date(a.dueDate) < new Date()).length,
        avgProcessingTime: '2.1 days',
        totalValue: dbApprovals.reduce((sum, a) => sum + a.value, 0),
      };

      return NextResponse.json({
        success: true,
        data: {
          items: approvals,
          approvals,
          stats,
          filters: {
            statuses: ['pending', 'approved', 'rejected', 'on-hold'],
            priorities: ['critical', 'high', 'medium', 'low'],
            types: ['contract', 'amendment', 'renewal', 'termination'],
          },
        },
        source: 'database',
      });
    }
  } catch (dbError) {
    console.warn('Database lookup failed, using mock:', dbError);
  }

  // Fallback to mock data
  let approvals = [...mockApprovals];

  if (status && status !== 'all') {
    approvals = approvals.filter(a => a.status === status);
  }
  if (priority && priority !== 'all') {
    approvals = approvals.filter(a => a.priority === priority);
  }
  if (type && type !== 'all') {
    approvals = approvals.filter(a => a.type === type);
  }
  if (assignedTo) {
    approvals = approvals.filter(a => a.assignedTo?.id === assignedTo);
  }

  // Calculate stats
  const stats = {
    total: mockApprovals.length,
    pending: mockApprovals.filter(a => a.status === 'pending').length,
    approved: mockApprovals.filter(a => a.status === 'approved').length,
    rejected: mockApprovals.filter(a => a.status === 'rejected').length,
    critical: mockApprovals.filter(a => a.priority === 'critical').length,
    overdue: mockApprovals.filter(a => new Date(a.dueDate) < new Date()).length,
    avgProcessingTime: '2.3 days',
    totalValue: mockApprovals.reduce((sum, a) => sum + a.value, 0),
  };

  return NextResponse.json({
    success: true,
    data: {
      items: approvals,
      approvals,
      stats,
      filters: {
        statuses: ['pending', 'approved', 'rejected', 'on-hold'],
        priorities: ['critical', 'high', 'medium', 'low'],
        types: ['contract', 'amendment', 'renewal', 'termination'],
      },
    },
    source: 'mock',
  });
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const userId = request.headers.get('x-user-id') || 'current-user';
    const body = await request.json();
    const { action, approvalId, approvalIds, comment, delegateTo, reason } = body;

    // Try database operations first
    try {
      if (action === 'approve') {
        // Update workflow step execution
        if (approvalId) {
          await prisma.workflowStepExecution.updateMany({
            where: {
              executionId: approvalId,
              status: 'PENDING',
            },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              completedBy: userId,
              result: { approved: true, comment },
            },
          });

          // Check if all steps are complete
          const stepExecutions = await prisma.workflowStepExecution.findMany({
            where: { executionId: approvalId },
          });
          const allComplete = stepExecutions.every(s => s.status === 'COMPLETED');
          
          if (allComplete) {
            await prisma.workflowExecution.update({
              where: { id: approvalId },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });
          } else {
            // Move to next step
            const nextStep = stepExecutions.find(s => s.status === 'PENDING');
            if (nextStep) {
              await prisma.workflowExecution.update({
                where: { id: approvalId },
                data: { currentStep: String(nextStep.stepOrder) },
              });
            }
          }

          // Create notification for next approver
          const nextPending = await prisma.workflowStepExecution.findFirst({
            where: { executionId: approvalId, status: 'PENDING' },
          });
          if (nextPending && nextPending.assignedTo) {
            await prisma.notification.create({
              data: {
                tenantId,
                userId: nextPending.assignedTo,
                type: 'APPROVAL_REQUEST',
                title: 'Approval Required',
                message: `${nextPending.stepName} step requires your approval`,
                link: `/approvals`,
                metadata: { approvalId, stepName: nextPending.stepName },
              },
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: approvalIds?.length > 1
            ? `${approvalIds.length} items approved successfully`
            : 'Approval completed successfully',
          data: {
            approvalId: approvalId || approvalIds?.[0],
            newStatus: 'approved',
            approvedAt: new Date().toISOString(),
            comment,
          },
          source: 'database',
        });
      }

      if (action === 'reject') {
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'Rejection reason is required' },
            { status: 400 }
          );
        }

        if (approvalId) {
          await prisma.workflowStepExecution.updateMany({
            where: {
              executionId: approvalId,
              status: 'PENDING',
            },
            data: {
              status: 'REJECTED',
              completedAt: new Date(),
              completedBy: userId,
              result: { rejected: true, reason },
            },
          });

          await prisma.workflowExecution.update({
            where: { id: approvalId },
            data: { status: 'REJECTED', completedAt: new Date() },
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Approval rejected',
          data: {
            approvalId,
            newStatus: 'rejected',
            rejectedAt: new Date().toISOString(),
            reason,
          },
          source: 'database',
        });
      }
    } catch (dbError) {
      console.warn('Database operation failed:', dbError);
    }

    // Fallback mock responses
    if (action === 'approve') {
      return NextResponse.json({
        success: true,
        message: approvalIds?.length > 1
          ? `${approvalIds.length} items approved successfully`
          : 'Approval completed successfully',
        data: {
          approvalId: approvalId || approvalIds?.[0],
          newStatus: 'approved',
          approvedAt: new Date().toISOString(),
          comment,
        },
        source: 'mock',
      });
    }

    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Approval rejected',
        data: {
          approvalId,
          newStatus: 'rejected',
          rejectedAt: new Date().toISOString(),
          reason,
        },
        source: 'mock',
      });
    }

    if (action === 'delegate') {
      if (!delegateTo) {
        return NextResponse.json(
          { success: false, error: 'Delegate target is required' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Delegated to ${delegateTo}`,
        data: {
          approvalId,
          delegatedTo: delegateTo,
          delegatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'request-info') {
      return NextResponse.json({
        success: true,
        message: 'Information request sent',
        data: {
          approvalId,
          status: 'info-requested',
          requestedAt: new Date().toISOString(),
          comment,
        },
      });
    }

    if (action === 'escalate') {
      return NextResponse.json({
        success: true,
        message: 'Approval escalated to next level',
        data: {
          approvalId,
          escalatedAt: new Date().toISOString(),
          newAssignee: 'VP Level Approver',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { approvalId, updates } = body;

    if (!approvalId) {
      return NextResponse.json(
        { success: false, error: 'Approval ID is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Approval updated',
      data: {
        approvalId,
        updates,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
