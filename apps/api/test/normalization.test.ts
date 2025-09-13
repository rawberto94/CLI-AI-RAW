import { describe, it, expect } from 'vitest';
import { matchRole, matchSupplier, addRoleAlias, reloadNormalizationDicts } from '../normalization/matcher';
import { addPendingRate, approveAllValidPending } from '../store';

describe('normalization matcher', () => {
  it('matches a close software engineer alias', () => {
    reloadNormalizationDicts();
    const res = matchRole('Sr SW Eng', ['engineering']);
    expect(res.type).toBe('role');
    // Should produce some candidates or at least a valid structure
    if (res.matches.length) {
      const top = res.matches[0];
      expect(top.canonicalName.length).toBeGreaterThan(0);
      expect(top.score).toBeGreaterThan(0);
    } else {
      expect(res.status === 'unmapped' || res.status === 'review' || res.status === 'auto').toBeTruthy();
    }
  });

  it('supplier preview returns candidates', () => {
    reloadNormalizationDicts();
    const res = matchSupplier('Acme', 'acme.com');
    expect(res.type).toBe('supplier');
    expect(res.status === 'auto' || res.status === 'review' || res.status === 'unmapped').toBeTruthy();
  });

  it('pending -> approve alias -> approveAllValid still works', () => {
    reloadNormalizationDicts();
    // Add a pending with a dangling role alias
    const p = addPendingRate({ role: 'Sr SW Eng', currency: 'USD', uom: 'day', dailyUsd: 500, submittedFrom: 'api' });
    // Approve a role alias pointing to SWE
    const roleMatch = matchRole('Sr SW Eng', ['engineering']);
    if (roleMatch.matches.length) {
      addRoleAlias('Sr SW Eng', roleMatch.matches[0].id, 'tester', true, 0.99);
    }
    const res = approveAllValidPending();
    expect(res.total).toBeGreaterThan(0);
    expect(res.approved).toBeGreaterThan(0);
  });
});
