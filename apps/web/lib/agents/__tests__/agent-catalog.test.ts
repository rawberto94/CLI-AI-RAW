import { describe, it, expect } from 'vitest';
import {
  AGENT_CATALOG,
  AGENT_MENTION_MAP,
  AGENT_CODENAMES,
  resolveMentionedAgentIds,
  parseMentions,
  getAgentByMention,
} from '../agent-catalog';

describe('agent-catalog', () => {
  it('has unique agent ids and mentions', () => {
    const ids = AGENT_CATALOG.map((a) => a.id);
    const mentions = AGENT_CATALOG.map((a) => a.mention);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(mentions).size).toBe(mentions.length);
  });

  it('maps every mention to a known agent', () => {
    for (const agent of AGENT_CATALOG) {
      expect(AGENT_MENTION_MAP[agent.mention]).toBe(agent.id);
      expect(AGENT_CODENAMES[agent.id]?.name).toBe(agent.codename);
    }
  });

  it('resolves mentions from messages', () => {
    expect(parseMentions('hey @sage and @Warden')).toEqual(['@sage', '@warden']);
    expect(resolveMentionedAgentIds('Please ask @clockwork about deadlines')).toEqual([
      'autonomous-deadline-manager',
    ]);
    expect(getAgentByMention('@merchant')?.codename).toBe('Merchant');
  });

  it('ignores unknown mentions', () => {
    expect(resolveMentionedAgentIds('talk to @nobody')).toEqual([]);
  });
});
