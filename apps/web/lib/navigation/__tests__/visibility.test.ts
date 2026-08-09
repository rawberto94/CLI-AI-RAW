import { describe, expect, it } from 'vitest';
import {
  getNavigationAudiences,
  isAdminNavigationRole,
  normalizeNavigationRole,
} from '../visibility';

describe('navigation visibility RBAC alignment', () => {
  it('defaults unknown roles to viewer (least privilege)', () => {
    expect(normalizeNavigationRole(undefined)).toBe('viewer');
    expect(normalizeNavigationRole('weird')).toBe('viewer');
  });

  it('does not give viewers operator or admin audiences', () => {
    const a = getNavigationAudiences('viewer');
    expect(a.has('all')).toBe(true);
    expect(a.has('operator')).toBe(false);
    expect(a.has('admin')).toBe(false);
  });

  it('gives members operator but not admin', () => {
    const a = getNavigationAudiences('member');
    expect(a.has('operator')).toBe(true);
    expect(a.has('admin')).toBe(false);
  });

  it('gives managers oversight', () => {
    const a = getNavigationAudiences('manager');
    expect(a.has('oversight')).toBe(true);
    expect(a.has('operator')).toBe(true);
  });

  it('recognizes admin/owner as admin navigation', () => {
    expect(isAdminNavigationRole('admin')).toBe(true);
    expect(isAdminNavigationRole('owner')).toBe(true);
    expect(isAdminNavigationRole('member')).toBe(false);
    expect(isAdminNavigationRole('admin', { viewingAsClient: true })).toBe(false);
  });
});
