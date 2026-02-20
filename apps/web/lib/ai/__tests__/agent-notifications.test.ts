/**
 * Unit Tests for Agent Notification Service
 * Tests /lib/ai/agent-notifications.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushAgentNotification,
  getNotifications,
  markNotificationRead,
  markAllRead,
  getUnreadCount,
  subscribeToNotifications,
  type AgentNotification,
} from '@/lib/ai/agent-notifications';

describe('Agent Notification Service', () => {
  const tenantId = `test-tenant-${Date.now()}`;
  const userId = 'test-user-1';

  describe('pushAgentNotification', () => {
    it('creates a notification with auto-generated id and createdAt', () => {
      const notif = pushAgentNotification({
        tenantId,
        userId,
        type: 'risk_alert',
        severity: 'high',
        title: 'Test Alert',
        message: 'This is a test',
        source: 'test-suite',
      });

      expect(notif.id).toMatch(/^notif-/);
      expect(notif.createdAt).toBeInstanceOf(Date);
      expect(notif.read).toBe(false);
      expect(notif.title).toBe('Test Alert');
    });

    it('stores notification retrievable by getNotifications', () => {
      const tid = `push-${Date.now()}`;
      pushAgentNotification({
        tenantId: tid,
        userId,
        type: 'opportunity',
        severity: 'info',
        title: 'Opportunity Found',
        message: 'A savings opportunity was detected',
        source: 'savings-agent',
      });

      const result = getNotifications({ tenantId: tid, userId });
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].title).toBe('Opportunity Found');
    });

    it('trims to MAX_NOTIFICATIONS_PER_TENANT (100)', () => {
      const tid = `trim-${Date.now()}`;
      for (let i = 0; i < 110; i++) {
        pushAgentNotification({
          tenantId: tid,
          type: 'learning',
          severity: 'low',
          title: `Notif ${i}`,
          message: 'msg',
          source: 'test',
        });
      }
      const result = getNotifications({ tenantId: tid, limit: 200 });
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getNotifications', () => {
    it('filters by type', () => {
      const tid = `filter-type-${Date.now()}`;
      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'high', title: 'Risk', message: 'r', source: 's' });
      pushAgentNotification({ tenantId: tid, type: 'opportunity', severity: 'info', title: 'Opp', message: 'o', source: 's' });

      const risks = getNotifications({ tenantId: tid, types: ['risk_alert'] });
      expect(risks.length).toBe(1);
      expect(risks[0].title).toBe('Risk');
    });

    it('filters by severity', () => {
      const tid = `filter-sev-${Date.now()}`;
      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'critical', title: 'Crit', message: 'c', source: 's' });
      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'low', title: 'Low', message: 'l', source: 's' });

      const crits = getNotifications({ tenantId: tid, severities: ['critical'] });
      expect(crits.length).toBe(1);
      expect(crits[0].title).toBe('Crit');
    });

    it('filters unread only', () => {
      const tid = `filter-unread-${Date.now()}`;
      const n1 = pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: 'Read', message: 'm', source: 's' });
      pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: 'Unread', message: 'm', source: 's' });
      markNotificationRead(tid, n1.id);

      const unread = getNotifications({ tenantId: tid, unreadOnly: true });
      expect(unread.length).toBe(1);
      expect(unread[0].title).toBe('Unread');
    });

    it('respects limit', () => {
      const tid = `limit-${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: `N${i}`, message: 'm', source: 's' });
      }
      const limited = getNotifications({ tenantId: tid, limit: 3 });
      expect(limited.length).toBe(3);
    });
  });

  describe('markNotificationRead', () => {
    it('marks a notification as read', () => {
      const tid = `mark-${Date.now()}`;
      const n = pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'high', title: 'Mark Me', message: 'm', source: 's' });
      
      expect(markNotificationRead(tid, n.id)).toBe(true);
      const unread = getNotifications({ tenantId: tid, unreadOnly: true });
      expect(unread.find(x => x.id === n.id)).toBeUndefined();
    });

    it('returns true even for already-read notifications', () => {
      const tid = `mark-twice-${Date.now()}`;
      const n = pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'high', title: 'X', message: 'm', source: 's' });
      markNotificationRead(tid, n.id);
      // Second call on same notif — returns true (notif found, already read)
      expect(markNotificationRead(tid, n.id)).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read', () => {
      const tid = `markall-${Date.now()}`;
      pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: 'A', message: 'm', source: 's' });
      pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: 'B', message: 'm', source: 's' });

      const count = markAllRead(tid);
      expect(count).toBe(2);
      expect(getUnreadCount(tid)).toBe(0);
    });

    it('filters by userId when provided', () => {
      const tid = `markall-user-${Date.now()}`;
      pushAgentNotification({ tenantId: tid, userId: 'alice', type: 'learning', severity: 'info', title: 'Alice1', message: 'm', source: 's' });
      pushAgentNotification({ tenantId: tid, userId: 'bob', type: 'learning', severity: 'info', title: 'Bob1', message: 'm', source: 's' });

      const count = markAllRead(tid, 'alice');
      expect(count).toBe(1);
      expect(getUnreadCount(tid, 'bob')).toBe(1);
    });
  });

  describe('getUnreadCount', () => {
    it('returns correct count', () => {
      const tid = `count-${Date.now()}`;
      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'high', title: 'A', message: 'm', source: 's' });
      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'high', title: 'B', message: 'm', source: 's' });
      expect(getUnreadCount(tid)).toBe(2);

      markAllRead(tid);
      expect(getUnreadCount(tid)).toBe(0);
    });
  });

  describe('subscribeToNotifications', () => {
    it('calls callback on new notification', () => {
      const tid = `sub-${Date.now()}`;
      const callback = vi.fn();
      const unsub = subscribeToNotifications(tid, undefined, callback);

      pushAgentNotification({ tenantId: tid, type: 'risk_alert', severity: 'critical', title: 'RT Alert', message: 'msg', source: 'test' });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][0].title).toBe('RT Alert');

      unsub();
    });

    it('unsubscribe stops callbacks', () => {
      const tid = `unsub-${Date.now()}`;
      const callback = vi.fn();
      const unsub = subscribeToNotifications(tid, undefined, callback);
      unsub();

      pushAgentNotification({ tenantId: tid, type: 'learning', severity: 'info', title: 'After Unsub', message: 'msg', source: 'test' });
      expect(callback).not.toHaveBeenCalled();
    });

    it('filters by userId when provided', () => {
      const tid = `sub-user-${Date.now()}`;
      const aliceCallback = vi.fn();
      const unsub = subscribeToNotifications(tid, 'alice', aliceCallback);

      // This goes to tenant-level, not alice-specific
      pushAgentNotification({ tenantId: tid, userId: 'bob', type: 'learning', severity: 'info', title: 'Bob', message: 'msg', source: 'test' });
      // Alice should not be called for bob's notification
      // (notification emitter sends to tenant-level AND user-specific)
      // alice callback listens on `notification:{tid}:alice` — bob's goes to `notification:{tid}:bob`
      expect(aliceCallback).not.toHaveBeenCalled();

      // Now push for alice
      pushAgentNotification({ tenantId: tid, userId: 'alice', type: 'learning', severity: 'info', title: 'Alice', message: 'msg', source: 'test' });
      expect(aliceCallback).toHaveBeenCalledOnce();

      unsub();
    });
  });
});
