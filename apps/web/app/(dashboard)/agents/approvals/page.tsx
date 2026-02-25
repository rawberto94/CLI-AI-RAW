/**
 * Agent Approvals Page
 * 
 * Redirects to the unified Contigo Labs experience
 */

import { redirect } from 'next/navigation';

export default function AgentsApprovalsPage() {
  redirect('/contigo-labs?tab=approvals');
}
