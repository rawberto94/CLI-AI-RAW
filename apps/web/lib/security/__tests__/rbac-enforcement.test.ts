import { describe, expect, it } from 'vitest';

import { evaluateRbac } from '../rbac-enforcement';
import {
  hasPermissionForRole,
  normalizeRole,
  maxContractAclLevelForRole,
  getPermissionsForRole,
} from '@/lib/permissions';

describe('normalizeRole / permissions map', () => {
  it('normalizes aliases and defaults unknown to viewer', () => {
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('super_admin')).toBe('owner');
    expect(normalizeRole('user')).toBe('member');
    expect(normalizeRole(undefined)).toBe('viewer');
    expect(normalizeRole('nope')).toBe('viewer');
  });

  it('gives viewers read-only contract access', () => {
    expect(hasPermissionForRole('viewer', 'contracts:view')).toBe(true);
    expect(hasPermissionForRole('viewer', 'contracts:create')).toBe(false);
    expect(hasPermissionForRole('viewer', 'contracts:delete')).toBe(false);
    expect(maxContractAclLevelForRole('viewer')).toBe('VIEW');
  });

  it('gives members create/edit_own but not delete', () => {
    expect(hasPermissionForRole('member', 'contracts:create')).toBe(true);
    expect(hasPermissionForRole('member', 'contracts:edit_own')).toBe(true);
    expect(hasPermissionForRole('member', 'contracts:delete')).toBe(false);
    expect(maxContractAclLevelForRole('member')).toBe('EDIT');
  });

  it('gives managers delete/manage', () => {
    expect(hasPermissionForRole('manager', 'contracts:delete')).toBe(true);
    expect(maxContractAclLevelForRole('manager')).toBe('ADMIN');
  });

  it('owner has billing and tenant manage', () => {
    const perms = getPermissionsForRole('owner');
    expect(perms).toContain('billing:manage');
    expect(perms).toContain('tenant:manage');
  });
});

describe('evaluateRbac path rules', () => {
  it('blocks viewer from contract upload', () => {
    const decision = evaluateRbac({
      method: 'POST',
      pathname: '/api/contracts/upload',
      role: 'viewer',
    });
    expect(decision.allowed).toBe(false);
  });

  it('allows member to upload contracts', () => {
    const decision = evaluateRbac({
      method: 'POST',
      pathname: '/api/contracts/upload',
      role: 'member',
    });
    expect(decision.allowed).toBe(true);
  });

  it('blocks member from deleting contracts', () => {
    const decision = evaluateRbac({
      method: 'DELETE',
      pathname: '/api/contracts/abc-123',
      role: 'member',
    });
    expect(decision.allowed).toBe(false);
  });

  it('allows manager to delete contracts', () => {
    const decision = evaluateRbac({
      method: 'DELETE',
      pathname: '/api/contracts/abc-123',
      role: 'manager',
    });
    expect(decision.allowed).toBe(true);
  });

  it('allows viewer to list contracts', () => {
    const decision = evaluateRbac({
      method: 'GET',
      pathname: '/api/contracts',
      role: 'viewer',
    });
    expect(decision.allowed).toBe(true);
  });

  it('blocks viewer from chat send', () => {
    const decision = evaluateRbac({
      method: 'POST',
      pathname: '/api/agents/chat',
      role: 'viewer',
    });
    expect(decision.allowed).toBe(false);
  });

  it('allows member to send chat', () => {
    const decision = evaluateRbac({
      method: 'POST',
      pathname: '/api/agents/chat',
      role: 'member',
    });
    expect(decision.allowed).toBe(true);
  });

  it('requires admin for /api/admin', () => {
    expect(
      evaluateRbac({ method: 'GET', pathname: '/api/admin/groups', role: 'manager' }).allowed,
    ).toBe(false);
    expect(
      evaluateRbac({ method: 'GET', pathname: '/api/admin/groups', role: 'admin' }).allowed,
    ).toBe(true);
    expect(
      evaluateRbac({ method: 'GET', pathname: '/api/admin/groups', role: 'owner' }).allowed,
    ).toBe(true);
  });

  it('requires audit:view for audit logs', () => {
    expect(
      evaluateRbac({ method: 'GET', pathname: '/api/audit-logs', role: 'member' }).allowed,
    ).toBe(false);
    expect(
      evaluateRbac({ method: 'GET', pathname: '/api/audit-logs', role: 'admin' }).allowed,
    ).toBe(true);
  });

  it('allows viewer self-service notification mutations', () => {
    expect(
      evaluateRbac({
        method: 'POST',
        pathname: '/api/notifications/mark-all-read',
        role: 'viewer',
      }).allowed,
    ).toBe(true);
  });

  it('honors explicit permission options over path rules', () => {
    const denied = evaluateRbac({
      method: 'GET',
      pathname: '/api/contracts',
      role: 'viewer',
      options: { permission: 'billing:manage' },
    });
    expect(denied.allowed).toBe(false);

    const allowed = evaluateRbac({
      method: 'POST',
      pathname: '/api/contracts/upload',
      role: 'viewer',
      options: { skipRbac: true },
    });
    expect(allowed.allowed).toBe(true);
  });
});
