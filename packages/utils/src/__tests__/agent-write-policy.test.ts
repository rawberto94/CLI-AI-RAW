import { describe, it, expect } from 'vitest';
import {
  isAgentWriteDenylisted,
  isAgentWriteAllowlisted,
  AGENT_WRITE_ALLOWLIST_FIELDS,
} from '../agent-write-policy';

describe('agent-write-policy', () => {
  it('denies critical financial and party fields', () => {
    expect(isAgentWriteDenylisted('totalValue')).toBe(true);
    expect(isAgentWriteDenylisted('clientName')).toBe(true);
    expect(isAgentWriteDenylisted('effectiveDate')).toBe(true);
    expect(isAgentWriteDenylisted('tags')).toBe(false);
  });

  it('allowlists only deliberate Contract fields', () => {
    expect(isAgentWriteAllowlisted('Contract', 'tags')).toBe(true);
    expect(isAgentWriteAllowlisted('Contract', 'renewalStatus')).toBe(true);
    expect(isAgentWriteAllowlisted('Contract', 'totalValue')).toBe(false);
    expect(isAgentWriteAllowlisted('ContractMetadata', 'tags')).toBe(false);
    expect(AGENT_WRITE_ALLOWLIST_FIELDS.Contract).toContain('tags');
  });
});
