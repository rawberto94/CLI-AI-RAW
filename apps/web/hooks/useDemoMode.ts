/**
 * Runtime Demo Mode Hook
 *
 * Priority order:
 * 1. Tenant-level pilotMode flag in session (server-controlled, per-tenant)
 * 2. URL search param ?demo=1 (override for testing)
 * 3. localStorage flag (manual toggle)
 * 4. Build-time env NEXT_PUBLIC_DEMO_MODE
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY = 'contigo_demo_mode';
const CHANGE_EVENT = 'contigo-demo-mode-change';

// Read NEXT_PUBLIC_DEMO_MODE directly to avoid triggering full env validation
// on the client (which would require server-only secrets like DATABASE_URL).
function buildTimeDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function checkDemoMode(): boolean {
  // 1. URL search param (highest priority)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get('demo');
    if (demoParam === '1' || demoParam === 'true') {
      return true;
    }
    if (demoParam === '0' || demoParam === 'false') {
      return false;
    }

    // 2. localStorage
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  }

  // 3. Build-time env (fallback)
  return buildTimeDemoMode();
}

export function useDemoMode(): boolean {
  const { data: session } = useSession();
  const [isDemo, setIsDemo] = useState(() => checkDemoMode());

  useEffect(() => {
    setIsDemo(checkDemoMode());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIsDemo(checkDemoMode());
    };
    const handleCustom = () => setIsDemo(checkDemoMode());

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CHANGE_EVENT, handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CHANGE_EVENT, handleCustom);
    };
  }, []);

  // Tenant-level pilotMode overrides everything else
  if ((session?.user as { pilotMode?: boolean } | undefined)?.pilotMode) return true;

  return isDemo;
}

export function setDemoMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function clearDemoMode(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function useDemoModeToggle(): { isDemo: boolean; toggle: () => void } {
  const isDemo = useDemoMode();
  const toggle = useCallback(() => {
    if (isDemo) {
      clearDemoMode();
    } else {
      setDemoMode(true);
    }
  }, [isDemo]);
  return { isDemo, toggle };
}
