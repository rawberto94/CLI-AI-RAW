/**
 * Auto-Assign Workflow Steps Based on Roles
 * Automatically assigns approval steps to users based on their roles
 */

import { prisma } from '@/lib/prisma';

interface WorkflowStep {
  id: string;
  assignedRole?: string | null;
  assignedUser?: string | null;
  name: string;
  type: string;
}

interface UserWithRole {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roles: Array<{
    role: {
      name: string;
    };
  }>;
}

/**
 * Maps common role names to database role names
 */
const ROLE_MAPPINGS: Record<string, string[]> = {
  'legal': ['legal', 'legal_review', 'legal_director', 'legal_counsel', 'attorney'],
  'finance': ['finance', 'finance_review', 'finance_director', 'cfo', 'accounting'],
  'manager': ['manager', 'team_lead', 'department_head', 'supervisor'],
  'approver': ['approver', 'senior_manager', 'director', 'vp', 'vice_president'],
  'executive': ['executive', 'c-level', 'ceo', 'president', 'executive_director'],
  'reviewer': ['reviewer', 'analyst', 'specialist'],
  'compliance': ['compliance', 'compliance_officer', 'risk', 'audit'],
  'security': ['security', 'infosec', 'ciso', 'security_officer'],
};

/**
 * Gets all users with a specific role
 */
async function getUsersByRole(tenantId: string, rolePattern: string): Promise<UserWithRole[]> {
  // Get possible role names
  const possibleRoles = ROLE_MAPPINGS[rolePattern.toLowerCase()] || [rolePattern.toLowerCase()];
  
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      roles: {
        some: {
          role: {
            name: {
              in: possibleRoles,
              mode: 'insensitive',
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return users;
}

/**
 * Selects best user for a role (round-robin to distribute load)
 */
function selectUserForRole(users: UserWithRole[], lastAssignedUserId?: string): UserWithRole | null {
  if (users.length === 0) return null;
  if (users.length === 1) return users[0];
  
  // If we have a last assigned user, try to pick the next one (round-robin)
  if (lastAssignedUserId) {
    const lastIndex = users.findIndex(u => u.id === lastAssignedUserId);
    if (lastIndex !== -1) {
      const nextIndex = (lastIndex + 1) % users.length;
      return users[nextIndex];
    }
  }
  
  // Default: pick first user
  return users[0];
}

/**
 * Auto-assigns workflow steps to appropriate users based on roles
 * 
 * @param tenantId - Tenant ID
 * @param workflowExecutionId - Workflow execution ID
 * @returns Number of steps assigned
 */
export async function autoAssignWorkflowSteps(
  tenantId: string,
  workflowExecutionId: string
): Promise<{ assigned: number; errors: string[] }> {
  const errors: string[] = [];
  let assignedCount = 0;

  try {
    // Get workflow execution with steps
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      include: {
        workflow: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
        stepExecutions: true,
      },
    });

    if (!execution) {
      errors.push('Workflow execution not found');
      return { assigned: 0, errors };
    }

    // Track last assigned user per role for round-robin
    const lastAssignedByRole: Record<string, string> = {};

    // Process each step
    for (const step of execution.workflow.steps) {
      // Skip if already assigned to a specific user
      if (step.assignedUser) {
        continue;
      }

      // Skip if no role specified
      if (!step.assignedRole) {
        errors.push(`Step "${step.name}" has no assigned role`);
        continue;
      }

      // Find users with this role
      const users = await getUsersByRole(tenantId, step.assignedRole);

      if (users.length === 0) {
        errors.push(`No users found with role "${step.assignedRole}" for step "${step.name}"`);
        continue;
      }

      // Select user (round-robin if possible)
      const selectedUser = selectUserForRole(users, lastAssignedByRole[step.assignedRole]);

      if (!selectedUser) {
        errors.push(`Failed to select user for step "${step.name}"`);
        continue;
      }

      // Update step execution with assigned user
      const stepExecution = execution.stepExecutions.find(se => se.stepId === step.id);
      
      if (stepExecution) {
        await prisma.workflowStepExecution.update({
          where: { id: stepExecution.id },
          data: {
            assignedTo: selectedUser.id,
            metadata: {
              ...(stepExecution.metadata as object || {}),
              assignedAt: new Date().toISOString(),
              assignedBy: 'auto-assign',
              assignedUserEmail: selectedUser.email,
              assignedUserName: `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim(),
            },
          },
        });

        assignedCount++;
        lastAssignedByRole[step.assignedRole] = selectedUser.id;

        console.log(`✅ Auto-assigned step "${step.name}" to ${selectedUser.email}`);
      }
    }

    return { assigned: assignedCount, errors };
  } catch (error) {
    console.error('Auto-assign error:', error);
    errors.push(`System error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { assigned: assignedCount, errors };
  }
}

/**
 * Gets workload statistics for users in a role
 */
export async function getRoleWorkload(tenantId: string, role: string): Promise<{
  userId: string;
  email: string;
  name: string;
  pendingApprovals: number;
  avgCompletionTime: number;
}[]> {
  const users = await getUsersByRole(tenantId, role);
  
  const stats = await Promise.all(
    users.map(async (user) => {
      // Count pending approvals assigned to this user
      const pending = await prisma.workflowStepExecution.count({
        where: {
          assignedTo: user.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      // Calculate average completion time (in hours)
      const completed = await prisma.workflowStepExecution.findMany({
        where: {
          completedBy: user.id,
          status: 'COMPLETED',
          completedAt: { not: null },
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
        take: 10, // Last 10 completions
      });

      const avgTime = completed.length > 0
        ? completed.reduce((sum, step) => {
            if (!step.completedAt) return sum;
            const diff = step.completedAt.getTime() - step.startedAt.getTime();
            return sum + diff;
          }, 0) / completed.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      return {
        userId: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        pendingApprovals: pending,
        avgCompletionTime: Math.round(avgTime * 10) / 10, // Round to 1 decimal
      };
    })
  );

  return stats.sort((a, b) => a.pendingApprovals - b.pendingApprovals);
}
