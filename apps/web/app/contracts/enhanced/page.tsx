import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enhanced Contract View | ConTigo',
  description: 'Enhanced Contract View — Manage and monitor your contract intelligence platform',
};


/**
 * The Enhanced Contracts demo page has been retired.
 * All enhanced UI components are now integrated into the main contracts page.
 */
export default function EnhancedContractsRedirect() {
  redirect('/contracts');
}
