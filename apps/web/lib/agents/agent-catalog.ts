/**
 * Single source of truth for agent identity in the web app.
 *
 * Used by:
 * - Contigo Labs roster / @mention autocomplete
 * - /api/agents/chat mention routing + response labels
 *
 * Worker implementations live under packages/workers/src/agents/* and share
 * the same technical `id` values — chat handlers are still a separate plane
 * but must not invent divergent codenames.
 */

export type AgentClusterId =
  | 'guardians'
  | 'oracles'
  | 'operators'
  | 'strategists'
  | 'evolution';

export interface AgentCatalogEntry {
  /** Technical id (matches worker agent module naming where possible) */
  id: string;
  /** Display codename (e.g. Sage) */
  codename: string;
  /** Chat mention including @ (e.g. @sage) */
  mention: string;
  avatar: string;
  color: string;
  cluster: AgentClusterId;
  description: string;
  /** Example prompt for autocomplete / empty states */
  example: string;
}

export const AGENT_CLUSTER_META: Record<
  AgentClusterId,
  { name: string; emoji: string; description: string; gradient: string }
> = {
  guardians: {
    name: 'Guardians',
    emoji: '🛡️',
    description: 'Compliance & Risk Protection',
    gradient: 'from-blue-500 to-cyan-500',
  },
  oracles: {
    name: 'Oracles',
    emoji: '🔮',
    description: 'Intelligence & Discovery',
    gradient: 'from-violet-500 to-purple-500',
  },
  operators: {
    name: 'Operators',
    emoji: '⚡',
    description: 'Execution & Monitoring',
    gradient: 'from-emerald-500 to-teal-500',
  },
  strategists: {
    name: 'Strategists',
    emoji: '🎯',
    description: 'Workflow & Planning',
    gradient: 'from-amber-500 to-orange-500',
  },
  evolution: {
    name: 'Evolution',
    emoji: '🧬',
    description: 'Learning & Improvement',
    gradient: 'from-rose-500 to-pink-500',
  },
};

/** Canonical agent list — order within cluster is display order */
export const AGENT_CATALOG: readonly AgentCatalogEntry[] = [
  // Guardians
  {
    id: 'proactive-validation-agent',
    codename: 'Sentinel',
    mention: '@sentinel',
    avatar: '🛡️',
    color: 'blue',
    cluster: 'guardians',
    description: 'First line of defense — catches errors before they propagate',
    example: 'Validate this contract for errors',
  },
  {
    id: 'compliance-monitoring-agent',
    codename: 'Vigil',
    mention: '@vigil',
    avatar: '⚖️',
    color: 'emerald',
    cluster: 'guardians',
    description: 'Regulatory watchdog — ensures contracts meet all requirements',
    example: 'Check compliance status of my contracts',
  },
  {
    id: 'proactive-risk-detector',
    codename: 'Warden',
    mention: '@warden',
    avatar: '🔥',
    color: 'orange',
    cluster: 'guardians',
    description: 'Early warning system — detects risks before they materialize',
    example: 'What are the top risks in my portfolio?',
  },
  {
    id: 'conflict-resolution-agent',
    codename: 'Mediator',
    mention: '@mediator',
    avatar: '⚖️',
    color: 'indigo',
    cluster: 'guardians',
    description: 'Contradiction hunter — finds clauses at war with each other',
    example: 'Find clause conflicts in my contracts',
  },
  // Oracles
  {
    id: 'intelligent-search-agent',
    codename: 'Sage',
    mention: '@sage',
    avatar: '🔮',
    color: 'violet',
    cluster: 'oracles',
    description: 'Seer of contracts — finds anything with intent-aware search',
    example: 'Find all NDAs expiring this quarter',
  },
  {
    id: 'opportunity-discovery-engine',
    codename: 'Prospector',
    mention: '@prospector',
    avatar: '💎',
    color: 'amber',
    cluster: 'oracles',
    description: 'Fortune finder — discovers savings and optimization gold',
    example: 'Where can I save money on renewals?',
  },
  {
    id: 'rfx-detection-agent',
    codename: 'Scout',
    mention: '@scout',
    avatar: '🎯',
    color: 'rose',
    cluster: 'oracles',
    description: 'Sniper — spots RFx opportunities before they expire',
    example: 'Are there any open RFx opportunities?',
  },
  {
    id: 'contract-transformation-agent',
    codename: 'MemoryKeeper',
    mention: '@memorykeeper',
    avatar: '🧬',
    color: 'fuchsia',
    cluster: 'oracles',
    description: 'Pattern decoder — transforms contracts into structured knowledge',
    example: 'Transform contracts into structured data',
  },
  {
    id: 'data-synthesizer-agent',
    codename: 'Synthesizer',
    mention: '@synthesizer',
    avatar: '🔮',
    color: 'pink',
    cluster: 'oracles',
    description: 'Portfolio oracle — synthesises insights across your contract base',
    example: 'Give me a portfolio risk overview',
  },
  // Operators
  {
    id: 'autonomous-deadline-manager',
    codename: 'Clockwork',
    mention: '@clockwork',
    avatar: '⏰',
    color: 'cyan',
    cluster: 'operators',
    description: 'Precision timekeeper — never misses a deadline',
    example: 'What deadlines are coming up?',
  },
  {
    id: 'obligation-tracking-agent',
    codename: 'Steward',
    mention: '@steward',
    avatar: '📋',
    color: 'emerald',
    cluster: 'operators',
    description: 'Dedicated steward — tracks every commitment',
    example: 'Track all outstanding obligations',
  },
  {
    id: 'smart-gap-filling-agent',
    codename: 'Artificer',
    mention: '@artificer',
    avatar: '🔧',
    color: 'gray',
    cluster: 'operators',
    description: 'Master craftsperson — fills missing data with precision',
    example: 'Fill missing metadata across contracts',
  },
  {
    id: 'template-generation-agent',
    codename: 'Builder',
    mention: '@builder',
    avatar: '🏗️',
    color: 'lime',
    cluster: 'operators',
    description: 'Template architect — structures contracts from learned patterns',
    example: 'Generate a standard NDA template',
  },
  // Strategists
  {
    id: 'workflow-authoring-agent',
    codename: 'Blueprinter',
    mention: '@blueprinter',
    avatar: '📐',
    color: 'slate',
    cluster: 'strategists',
    description: 'Flow designer — creates tailored approval workflows',
    example: 'Design an approval workflow for NDAs',
  },
  {
    id: 'rfx-procurement-agent',
    codename: 'Merchant',
    mention: '@merchant',
    avatar: '🤝',
    color: 'yellow',
    cluster: 'strategists',
    description: 'Master negotiator — manages RFx lifecycles',
    example: 'Start an RFx procurement process',
  },
  {
    id: 'multi-agent-coordinator',
    codename: 'Conductor',
    mention: '@conductor',
    avatar: '🎼',
    color: 'amber',
    cluster: 'strategists',
    description: 'Orchestra leader — coordinates agent symphonies',
    example: 'Coordinate a multi-agent analysis',
  },
  {
    id: 'onboarding-coach-agent',
    codename: 'Navigator',
    mention: '@navigator',
    avatar: '🧭',
    color: 'teal',
    cluster: 'strategists',
    description: 'Setup guide — helps teams get the most from the platform',
    example: 'Help me get started with Contigo',
  },
  // Evolution
  {
    id: 'user-feedback-learner',
    codename: 'Mnemosyne',
    mention: '@mnemosyne',
    avatar: '🧠',
    color: 'violet',
    cluster: 'evolution',
    description: 'Memory incarnate — learns from every interaction',
    example: 'What have I asked about recently?',
  },
  {
    id: 'ab-testing-engine',
    codename: 'A/B',
    mention: '@ab',
    avatar: '🧪',
    color: 'cyan',
    cluster: 'evolution',
    description: 'Scientist — tests and validates agent performance',
    example: 'Run performance tests on agent responses',
  },
  {
    id: 'agent-swarm',
    codename: 'Swarm',
    mention: '@swarm',
    avatar: '🐝',
    color: 'yellow',
    cluster: 'evolution',
    description: 'Collective intelligence — many minds, one purpose',
    example: 'Run a full portfolio deep-dive',
  },
  {
    id: 'workflow-orchestrator-agent',
    codename: 'Orchestrator',
    mention: '@orchestrator',
    avatar: '🎼',
    color: 'purple',
    cluster: 'evolution',
    description: 'Meta-conductor — coordinates multi-agent analysis plans',
    example: 'Plan multi-agent analysis of my portfolio',
  },
] as const;

/** mention (@sage) → agent id */
export const AGENT_MENTION_MAP: Record<string, string> = Object.fromEntries(
  AGENT_CATALOG.map((a) => [a.mention.toLowerCase(), a.id]),
);

/** agent id → display meta (chat responses) */
export const AGENT_CODENAMES: Record<string, { name: string; avatar: string; color: string }> =
  Object.fromEntries(
    AGENT_CATALOG.map((a) => [
      a.id,
      { name: a.codename, avatar: a.avatar, color: a.color },
    ]),
  );

/** codename → avatar */
export const AGENT_AVATAR_MAP: Record<string, string> = Object.fromEntries(
  AGENT_CATALOG.map((a) => [a.codename, a.avatar]),
);

export function getAgentById(id: string): AgentCatalogEntry | undefined {
  return AGENT_CATALOG.find((a) => a.id === id);
}

export function getAgentByMention(mention: string): AgentCatalogEntry | undefined {
  const key = mention.startsWith('@') ? mention.toLowerCase() : `@${mention.toLowerCase()}`;
  const id = AGENT_MENTION_MAP[key];
  return id ? getAgentById(id) : undefined;
}

export function agentsByCluster(cluster: AgentClusterId): AgentCatalogEntry[] {
  return AGENT_CATALOG.filter((a) => a.cluster === cluster);
}

export function parseMentions(message: string): string[] {
  const matches = message.match(/@\w+/gi) || [];
  return matches.map((m) => m.toLowerCase());
}

export function resolveMentionedAgentIds(message: string): string[] {
  return parseMentions(message)
    .map((m) => AGENT_MENTION_MAP[m])
    .filter((id): id is string => Boolean(id));
}
