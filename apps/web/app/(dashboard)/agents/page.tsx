/**
 * Autonomous Agents Dashboard Page
 *
 * Overview of all autonomous AI agents, their status,
 * recent activity, and management controls.
 */

import { Metadata } from 'next';
import { AutonomousAgentDashboard } from '@/components/agents/AutonomousAgentDashboard';

export const metadata: Metadata = {
  title: 'Autonomous Agents | ConTigo',
  description:
    'Monitor and manage autonomous AI agents that continuously analyze your contract portfolio',
};

export default function AgentsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <AutonomousAgentDashboard />
    </div>
  );
}
