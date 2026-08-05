import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createMock = vi.fn();
const contractUpdateMock = vi.fn();

vi.mock('clients-db', () => {
  const client = {
    aiDecision: { create: (...args: unknown[]) => createMock(...args) },
    contract: { update: (...args: unknown[]) => contractUpdateMock(...args) },
    contractMetadata: { update: vi.fn() },
    obligation: { update: vi.fn() },
  };
  return { default: () => client };
});

vi.mock('../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('agent-write-gateway', () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    contractUpdateMock.mockReset();
    createMock.mockResolvedValue({ id: 'dec-1' });
    contractUpdateMock.mockResolvedValue({});
    delete process.env.AGENT_WRITES_ENABLED;
  });

  afterEach(() => {
    delete process.env.AGENT_WRITES_ENABLED;
  });

  it('rejects denylisted critical fields (TCV)', async () => {
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    const result = await applyAgentWrite({
      agentId: 'test-agent',
      tenantId: 't1',
      entity: 'Contract',
      entityId: 'c1',
      field: 'totalValue',
      value: 999999,
      confidence: 0.99,
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('denylisted_critical_field');
    expect(contractUpdateMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
  });

  it('rejects party and date fields', async () => {
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    for (const field of ['clientName', 'supplierName', 'effectiveDate', 'expirationDate']) {
      const result = await applyAgentWrite({
        agentId: 'test-agent',
        tenantId: 't1',
        entity: 'Contract',
        entityId: 'c1',
        field,
        value: 'x',
        confidence: 0.99,
      });
      expect(result.reason).toBe('denylisted_critical_field');
    }
    expect(contractUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects non-allowlisted fields', async () => {
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    const result = await applyAgentWrite({
      agentId: 'test-agent',
      tenantId: 't1',
      entity: 'Contract',
      entityId: 'c1',
      field: 'description',
      value: 'hello',
      confidence: 0.99,
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('not_allowlisted');
    expect(contractUpdateMock).not.toHaveBeenCalled();
  });

  it('dry-runs allowlisted tags when AGENT_WRITES_ENABLED is off', async () => {
    process.env.AGENT_WRITES_ENABLED = 'false';
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    const result = await applyAgentWrite({
      agentId: 'test-agent',
      tenantId: 't1',
      entity: 'Contract',
      entityId: 'c1',
      field: 'tags',
      value: ['a'],
      confidence: 0.99,
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('writes_disabled');
    expect(contractUpdateMock).not.toHaveBeenCalled();
  });

  it('queues pending approval for low-confidence allowlisted write when enabled', async () => {
    process.env.AGENT_WRITES_ENABLED = 'true';
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    const result = await applyAgentWrite({
      agentId: 'test-agent',
      tenantId: 't1',
      entity: 'Contract',
      entityId: 'c1',
      field: 'tags',
      value: ['needs-review'],
      confidence: 0.5,
    });
    expect(result.status).toBe('pending_approval');
    expect(result.reason).toBe('below_auto_apply_threshold');
    expect(contractUpdateMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'pending' }),
      }),
    );
  });

  it('applies high-confidence allowlisted write when enabled', async () => {
    process.env.AGENT_WRITES_ENABLED = 'true';
    const { applyAgentWrite } = await import('../services/agent-write-gateway');
    const result = await applyAgentWrite({
      agentId: 'test-agent',
      tenantId: 't1',
      entity: 'Contract',
      entityId: 'c1',
      field: 'tags',
      value: ['ok'],
      confidence: 0.9,
    });
    expect(result.status).toBe('applied');
    expect(contractUpdateMock).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { tags: ['ok'] },
    });
  });
});
