/**
 * Agent Observability Page
 * 
 * Dashboard for monitoring AI agent activity, reasoning chains,
 * and performance metrics.
 */

import { Metadata } from 'next';
import { AgentObservabilityDashboard } from '@/components/agents/AgentObservabilityDashboard';

export const metadata: Metadata = {
  title: 'Agent Observability | ConTigo',
  description: 'Monitor AI agent activity, reasoning chains, and performance in real-time',
};

export default function AgentObservabilityPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <AgentObservabilityDashboard />
    </div>
  );
}
