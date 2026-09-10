import { describe, expect, it } from 'vitest';
import { ourOrganizationPromptBlock, pickOurOrganization } from '../src/our-organization';

describe('pickOurOrganization', () => {
  it('prefers Settings ourOrganization over tenant name', () => {
    expect(pickOurOrganization({
      settings: { ourOrganization: 'Contigo AG', system: { ourOrganization: 'Ignored GmbH' } },
      tenantName: 'Tenant Brand',
    })?.name).toBe('Contigo AG');
  });

  it('reads system.ourOrganization when top-level is empty', () => {
    expect(pickOurOrganization({
      settings: { system: { ourOrganization: 'Contigo AG' } },
      tenantName: 'Tenant Brand',
    })?.name).toBe('Contigo AG');
  });

  it('falls back to tenant name', () => {
    expect(pickOurOrganization({
      settings: {},
      tenantName: 'Tenant Brand',
    })?.name).toBe('Tenant Brand');
  });

  it('returns null when nothing is set', () => {
    expect(pickOurOrganization({ settings: {}, tenantName: '' })).toBeNull();
  });
});

describe('ourOrganizationPromptBlock', () => {
  it('asks analysis to judge from our side', () => {
    const block = ourOrganizationPromptBlock({ name: 'Contigo AG', aliases: ['Contigo'] });
    expect(block).toMatch(/OUR ORGANIZATION: Contigo AG/);
    expect(block).toMatch(/aliases: Contigo/);
    expect(block).toMatch(/from our side/);
  });
});
