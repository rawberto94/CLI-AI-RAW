'use client';

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'focus',
] as const;

export function SessionActivityHeartbeat() {
  const { data: session, status, update } = useSession();
  const lastHeartbeatAtRef = useRef(0);
  const updateInFlightRef = useRef<Promise<unknown> | null>(null);
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    const sendHeartbeat = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const now = Date.now();
      if (now - lastHeartbeatAtRef.current < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      if (updateInFlightRef.current) {
        return;
      }

      lastHeartbeatAtRef.current = now;
      updateInFlightRef.current = Promise.resolve(
        update({ activityHeartbeat: now }),
      )
        .catch(() => {
          lastHeartbeatAtRef.current = 0;
        })
        .finally(() => {
          updateInFlightRef.current = null;
        });
    };

    const handleActivity = () => {
      sendHeartbeat();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user?.id, status, update]);

  useEffect(() => {
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }

    if (status !== 'authenticated') {
      return;
    }

    const expiresAt = session?.user?.sessionExpiresAt
      ? new Date(session.user.sessionExpiresAt).getTime()
      : null;

    if (!expiresAt || Number.isNaN(expiresAt)) {
      return;
    }

    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      void signOut({ callbackUrl: '/auth/signin?reason=session_expired' });
      return;
    }

    expiryTimeoutRef.current = setTimeout(() => {
      void signOut({ callbackUrl: '/auth/signin?reason=session_expired' });
    }, remainingMs);

    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }
    };
  }, [session?.user?.sessionExpiresAt, status]);

  return null;
}