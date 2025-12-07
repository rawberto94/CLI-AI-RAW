'use client';

import { usePathname } from 'next/navigation';
import EnhancedNavigation from '@/components/layout/EnhancedNavigation';
import { FloatingDataModeToggle } from '@/components/ui/DataModeToggle';
import { FloatingAIBubble } from '@/components/ai/FloatingAIBubble';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { Suspense } from 'react';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  
  // Auth pages should not show the navigation
  const isAuthPage = pathname?.startsWith('/auth');
  
  if (isAuthPage) {
    // Auth pages: No navigation, no sidebar, full page
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }
  
  // Regular pages: Full navigation and layout
  return (
    <>
      <EnhancedNavigation />
      <main 
        id="main-content"
        className="min-h-screen lg:pl-64 pt-16 lg:pt-0 bg-slate-50 overflow-x-hidden"
        tabIndex={-1}
      >
        <div className="h-full w-full max-w-full">
          {children}
        </div>
      </main>
      <FloatingDataModeToggle />
      <Suspense fallback={null}>
        <FloatingAIBubble />
      </Suspense>
      <Suspense fallback={null}>
        <WelcomeTutorial />
      </Suspense>
    </>
  );
}
