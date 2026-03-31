'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import EnhancedNavigation from '@/components/layout/EnhancedNavigation';
import { FloatingDataModeToggle } from '@/components/ui/DataModeToggle';
import { FloatingAIBubble } from '@/components/ai/FloatingAIBubble';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { Suspense, useEffect } from 'react';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

// Marketing pages that should not show the app navigation
const MARKETING_PAGES = ['/', '/home', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms', '/security'];

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Auth pages and marketing pages should not show the navigation
  const isAuthPage = pathname?.startsWith('/auth');
  const isMarketingPage = MARKETING_PAGES.includes(pathname || '');
  const hideFloatingAssistant = pathname === '/contigo-labs' && searchParams?.get('tab') === 'chat';
  
  // Move focus to main content after navigation when it was triggered from nav.
  // Use a longer delay to avoid racing with Next.js soft navigation transitions.
  useEffect(() => {
    // Skip for auth and marketing pages
    if (isAuthPage || isMarketingPage) return;
    
    // Use a microtask delay so Next.js finishes the route transition first
    const id = setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const nav = document.getElementById('main-nav');

      // Only steal focus if a navigation link (anchor) is currently focused
      // This avoids interfering with clicks on search, buttons, or content
      if (active?.tagName === 'A' && nav?.contains(active)) {
        const main = document.getElementById('main-content') as HTMLElement | null;
        main?.focus({ preventScroll: true });
      }
    }, 100);
    
    return () => clearTimeout(id);
  }, [pathname, isAuthPage, isMarketingPage]);

  // Marketing pages: Use marketing layout (handled by route group)
  if (isMarketingPage) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

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
        className="min-h-screen lg:pl-64 pt-16 lg:pt-0 bg-slate-50 dark:bg-slate-900 overflow-x-hidden transition-colors duration-200 scroll-mt-16"
        tabIndex={-1}
      >
        <div className="h-full w-full max-w-full">
          {children}
        </div>
      </main>
      <FloatingDataModeToggle />
      <Suspense fallback={null}>
        {!hideFloatingAssistant && <FloatingAIBubble />}
      </Suspense>
      <Suspense fallback={null}>
        <WelcomeTutorial />
      </Suspense>
      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      {/* Onboarding checklist for new users */}
      <Suspense fallback={null}>
        <OnboardingChecklist />
      </Suspense>
    </>
  );
}
