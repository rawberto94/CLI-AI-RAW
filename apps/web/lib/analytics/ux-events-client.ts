/**
 * Client-safe UX telemetry helper (no Prisma / Node-only imports).
 * Browser components must import from here — not from ux-events.ts.
 */

export type UxAnalyticsEventName =
  | 'approval_requested'
  | 'approval_decided'
  | 'notification_impression'
  | 'notification_click'
  | 'agent_undo_used'
  | 'autonomy_changed';

/**
 * Client-side helper: POST to /api/analytics/ux-events (best-effort).
 */
export async function trackUxEventClient(
  event: UxAnalyticsEventName | string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch('/api/analytics/ux-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props: props ?? {} }),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}
