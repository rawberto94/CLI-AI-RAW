/**
 * Autonomous Agents Dashboard Page
 * 
 * Redirects to the unified Contigo Labs experience
 */

import { redirect } from 'next/navigation';

export default function AgentsPage() {
  redirect('/contigo-labs?tab=agents');
}
