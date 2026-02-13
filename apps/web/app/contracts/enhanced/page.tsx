import { redirect } from 'next/navigation';

/**
 * The Enhanced Contracts demo page has been retired.
 * All enhanced UI components are now integrated into the main contracts page.
 */
export default function EnhancedContractsRedirect() {
  redirect('/contracts');
}
