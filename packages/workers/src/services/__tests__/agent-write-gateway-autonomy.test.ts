/**
 * Autonomy evaluation integration for write gateway policy (pure logic path).
 * Full applyAgentWrite is integration-tested elsewhere; here we lock the
 * threshold rules that the gateway imports from @repo/utils.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAutonomy } from '@repo/utils';

describe('write-gateway autonomy policy', () => {
  it('never auto-applies without config (default review)', () => {
    const d = evaluateAutonomy({ confidence: 0.99 });
    expect(d.allowAutoApply).toBe(false);
  });

  it('auto only when mode=auto and confidence clears threshold', () => {
    expect(
      evaluateAutonomy({
        confidence: 0.91,
        risk: 'low',
        config: {
          tenantId: 't',
          agentId: 'a',
          actionType: 'agent_write',
          mode: 'auto',
          confidenceThreshold: 0.9,
          riskThreshold: 'medium',
        },
      }).allowAutoApply,
    ).toBe(true);

    expect(
      evaluateAutonomy({
        confidence: 0.8,
        risk: 'low',
        config: {
          tenantId: 't',
          agentId: 'a',
          actionType: 'agent_write',
          mode: 'auto',
          confidenceThreshold: 0.9,
          riskThreshold: 'medium',
        },
      }).allowAutoApply,
    ).toBe(false);
  });

  it('review mode always queues even at high confidence', () => {
    expect(
      evaluateAutonomy({
        confidence: 0.99,
        config: {
          tenantId: 't',
          agentId: 'a',
          actionType: 'agent_write',
          mode: 'review',
          confidenceThreshold: 0.5,
          riskThreshold: 'critical',
        },
      }).allowAutoApply,
    ).toBe(false);
  });
});
