/**
 * Legacy Sidebar - Redirects to EnhancedNavigation
 * This component is kept for backwards compatibility but now redirects
 * all navigation to use the EnhancedNavigation component instead.
 * 
 * @deprecated Use EnhancedNavigation from @/components/layout/EnhancedNavigation
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function Sidebar() {
  const router = useRouter();
  
  useEffect(() => {
    // This sidebar is deprecated - navigation is now handled by EnhancedNavigation
    // in the ConditionalLayout component
  }, []);

  return null;
}

export default Sidebar;
