/**
 * Agent Approval Queue Page
 *
 * Review and approve/reject recommendations generated
 * by autonomous AI agents before they are enacted.
 */

import { Metadata } from 'next';
import { AgentApprovalQueue } from '@/components/agents/AgentApprovalQueue';

export const metadata: Metadata = {
  title: 'Agent Approvals | ConTigo',
  description:
    'Review and approve or reject AI agent recommendations before they are applied',
};

export default function AgentApprovalsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <AgentApprovalQueue />
    </div>
  );
}
