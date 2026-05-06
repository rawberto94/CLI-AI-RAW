'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

import { SessionActivityHeartbeat } from '@/components/providers/SessionActivityHeartbeat';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider
      // Re-fetch session every 5 minutes to keep it fresh
      refetchInterval={5 * 60}
      // Re-validate when user returns to the tab
      refetchOnWindowFocus={true}
      // Don't attempt fetches when the browser is offline
      refetchWhenOffline={false}
    >
      <SessionActivityHeartbeat />
      {children}
    </SessionProvider>
  );
}
