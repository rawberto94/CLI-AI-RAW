import { describe, it, expect } from 'vitest';
import {
  buildCriticalFields,
  derivePartiesFromCanonical,
  hasTcvDrift,
  isLegacyPartyFallbackEnabled,
  collectCriticalFieldDrift,
} from '../critical-fields';

describe('critical-fields', () => {
  it('derives parties from client/supplier', () => {
    expect(
      derivePartiesFromCanonical({ clientName: 'Acme', supplierName: 'Globex' }),
    ).toEqual([
      { legalName: 'Acme', role: 'Client' },
      { legalName: 'Globex', role: 'Supplier' },
    ]);
  });

  it('detects material TCV drift', () => {
    expect(hasTcvDrift(1000, 1000)).toBe(false);
    expect(hasTcvDrift(100000, 200000)).toBe(true);
    expect(hasTcvDrift(null, 100)).toBe(false);
  });

  it('marks conflict when artifact TCV drifts', () => {
    const fields = buildCriticalFields(
      { totalValue: 100000, currency: 'USD' },
      { artifactTotalValue: 250000 },
    );
    expect(fields.totalValue.trust).toBe('conflict');
    expect(collectCriticalFieldDrift(fields, { artifactTotalValue: 250000 })).toHaveLength(1);
  });

  it('missing when no value', () => {
    const fields = buildCriticalFields({});
    expect(fields.totalValue.trust).toBe('missing');
    expect(fields.parties.trust).toBe('missing');
  });

  it('legacy party fallback defaults on', () => {
    expect(isLegacyPartyFallbackEnabled({})).toBe(true);
    expect(isLegacyPartyFallbackEnabled({ LEGACY_PARTY_FALLBACK: 'false' })).toBe(false);
  });
});
