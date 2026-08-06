import { describe, it, expect } from 'vitest';
import {
  evaluateAutonomy,
  normalizeAutonomyMode,
  DEFAULT_AUTONOMY_MODE,
  type AgentAutonomyConfigShape,
} from '../agent-autonomy';

const baseConfig = (
  overrides: Partial<AgentAutonomyConfigShape> = {},
): AgentAutonomyConfigShape => ({
  tenantId: 't1',
  agentId: 'agent-a',
  actionType: 'agent_write',
  mode: 'auto',
  confidenceThreshold: 0.9,
  costThreshold: 1000,
  riskThreshold: 'medium',
  ...overrides,
});

describe('evaluateAutonomy', () => {
  it('defaults to review with no config (never silently auto)', () => {
    const d = evaluateAutonomy({ confidence: 0.99 });
    expect(d.allowAutoApply).toBe(false);
    expect(d.mode).toBe(DEFAULT_AUTONOMY_MODE);
    expect(d.reason).toBe('no_config_default_review');
  });

  it('never auto-applies in review mode even with high confidence', () => {
    const d = evaluateAutonomy({
      confidence: 0.99,
      config: baseConfig({ mode: 'review' }),
    });
    expect(d.allowAutoApply).toBe(false);
    expect(d.reason).toBe('mode_review');
  });

  it('never auto-applies in suggest mode', () => {
    const d = evaluateAutonomy({
      confidence: 0.99,
      config: baseConfig({ mode: 'suggest' }),
    });
    expect(d.allowAutoApply).toBe(false);
    expect(d.reason).toBe('mode_suggest');
  });

  it('auto-applies when mode=auto and all thresholds met', () => {
    const d = evaluateAutonomy({
      confidence: 0.95,
      cost: 100,
      risk: 'low',
      config: baseConfig(),
    });
    expect(d.allowAutoApply).toBe(true);
    expect(d.reason).toBe('auto_thresholds_met');
  });

  it('blocks auto when confidence below threshold', () => {
    const d = evaluateAutonomy({
      confidence: 0.8,
      config: baseConfig({ mode: 'auto', confidenceThreshold: 0.9 }),
    });
    expect(d.allowAutoApply).toBe(false);
    expect(d.reason).toBe('below_confidence_threshold');
  });

  it('blocks auto when cost above threshold', () => {
    const d = evaluateAutonomy({
      confidence: 0.99,
      cost: 5000,
      config: baseConfig({ mode: 'auto', costThreshold: 1000 }),
    });
    expect(d.allowAutoApply).toBe(false);
    expect(d.reason).toBe('above_cost_threshold');
  });

  it('blocks auto when risk above threshold', () => {
    const d = evaluateAutonomy({
      confidence: 0.99,
      risk: 'critical',
      config: baseConfig({ mode: 'auto', riskThreshold: 'medium' }),
    });
    expect(d.allowAutoApply).toBe(false);
    expect(d.reason).toBe('above_risk_threshold');
  });
});

describe('normalizeAutonomyMode', () => {
  it('falls back to review for unknown values', () => {
    expect(normalizeAutonomyMode('nope')).toBe('review');
    expect(normalizeAutonomyMode('auto')).toBe('auto');
  });
});
