'use client';

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, MessageSquare, AlertTriangle,
  Lightbulb, Save, Eye, Edit3, Sparkles, FileText,
  GitBranch, Bold, Italic, List,
  Heading1, X, Send, Clock, Zap, Shield, Scale,
  RefreshCw, Loader2, Brain, AlertCircle,
  FileDown, CheckCircle2, ArrowRight,
  BookOpen, Search, Lock, Unlock, ThumbsUp, ThumbsDown,
  Check, GripVertical, Undo2, Redo2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection } from 'prosemirror-state';
import StarterKit from '@tiptap/starter-kit';
// Note: StarterKit v3 already bundles the Underline extension; importing
// @tiptap/extension-underline separately causes a "Duplicate extension names"
// warning at runtime.
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'isomorphic-dompurify';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { exportDraftAsPDF, exportDraftAsDOCX } from '@/lib/drafting/draft-export';
import type { CopilotWorkflowContext } from '@/lib/drafting/copilot-handoff';
import { VersionDiffView } from './VersionDiffView';
import { DraftShapeAssist } from './DraftShapeAssist';

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AI_HTML_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'sub', 'sup'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'data-*'],
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Extract CSRF token from cookie for mutating API calls */
function getCsrfHeaders(): Record<string, string> {
  const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
  const csrfToken = csrfCookie?.split('=').slice(1).join('=') || '';
  return csrfToken
    ? { 'x-csrf-token': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
    : { 'X-Requested-With': 'XMLHttpRequest' };
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function normalizeAiHtml(text: string): string {
  const raw = /^\s*</.test(text) ? text : textToHtml(text);
  return DOMPurify.sanitize(raw, AI_HTML_SANITIZE_OPTIONS);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveDraftTitle(title: string | null | undefined, fallback: string): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

const DESKTOP_SIDEBAR_DEFAULT_WIDTH = 400;
const DESKTOP_SIDEBAR_MIN_WIDTH = 340;
const DESKTOP_SIDEBAR_MAX_WIDTH = 560;
const DESKTOP_SIDEBAR_STORAGE_KEY = 'drafting-desktop-sidebar-width';

function clampDesktopSidebarWidth(width: number, viewportWidth?: number): number {
  const widthToClamp = Number.isFinite(width) ? width : DESKTOP_SIDEBAR_DEFAULT_WIDTH;
  const viewportBound = typeof viewportWidth === 'number' && Number.isFinite(viewportWidth)
    ? Math.max(
        DESKTOP_SIDEBAR_MIN_WIDTH,
        Math.min(DESKTOP_SIDEBAR_MAX_WIDTH, viewportWidth - 380),
      )
    : DESKTOP_SIDEBAR_MAX_WIDTH;

  return Math.min(viewportBound, Math.max(DESKTOP_SIDEBAR_MIN_WIDTH, Math.round(widthToClamp)));
}

function resolveInitialDesktopSidebarWidth(): number {
  if (typeof window === 'undefined') {
    return DESKTOP_SIDEBAR_DEFAULT_WIDTH;
  }

  try {
    const rawValue = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    const parsedWidth = rawValue ? Number(rawValue) : NaN;
    return clampDesktopSidebarWidth(parsedWidth, window.innerWidth);
  } catch {
    return DESKTOP_SIDEBAR_DEFAULT_WIDTH;
  }
}

function normalizeSourceTrailAction(action: unknown): 'inserted' | 'replaced' {
  return action === 'replaced' ? 'replaced' : 'inserted';
}

function normalizeSourceTrailEntry(entry: unknown): SourceTrailEntry | null {
  if (!entry || typeof entry !== 'object') return null;

  const candidate = entry as Record<string, unknown>;
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
  const sourceLabel = typeof candidate.sourceLabel === 'string' ? candidate.sourceLabel.trim() : '';
  if (!label || !sourceLabel) return null;

  const timestamp = candidate.timestamp instanceof Date
    ? candidate.timestamp
    : typeof candidate.timestamp === 'string'
      ? new Date(candidate.timestamp)
      : new Date();

  return {
    id: typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id
      : `source-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entry'}`,
    label,
    sourceLabel,
    action: normalizeSourceTrailAction(candidate.action),
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
    confidence: typeof candidate.confidence === 'number' ? candidate.confidence : undefined,
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    sourceId: typeof candidate.sourceId === 'string' ? candidate.sourceId : undefined,
    sourceKind: typeof candidate.sourceKind === 'string' ? candidate.sourceKind : undefined,
  };
}

function normalizeSourceTrail(entries: unknown): SourceTrailEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => normalizeSourceTrailEntry(entry))
    .filter((entry): entry is SourceTrailEntry => Boolean(entry));
}

function serializeSourceTrail(entries: SourceTrailEntry[]): Array<Record<string, unknown>> {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    sourceLabel: entry.sourceLabel,
    action: entry.action,
    timestamp: entry.timestamp.toISOString(),
    confidence: entry.confidence,
    detail: entry.detail,
    sourceId: entry.sourceId,
    sourceKind: entry.sourceKind,
  }));
}

function normalizeDraftHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesDraftKeywords(title: string, keywords: string[]): boolean {
  const normalizedTitle = normalizeDraftHeading(title);
  return keywords.some((keyword) => normalizedTitle.includes(normalizeDraftHeading(keyword)));
}

function renderSimpleMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];

  const renderInline = (raw: string) => (
    <>
      {raw.split(/\*\*(.+?)\*\*/g).map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
      )}
    </>
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^[-•]\s/.test(line)) {
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {renderInline(line.replace(/^[-•]\s/, ''))}
        </li>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={index} className="ml-4 list-decimal">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />);
      continue;
    }

    elements.push(<p key={index}>{renderInline(line)}</p>);
  }

  return <div className="space-y-1">{elements}</div>;
}

interface DiffSegment {
  type: 'equal' | 'add' | 'remove';
  value: string;
}

function tokenizeDiffText(text: string): string[] {
  return text.split(/(\s+|[()[\]{},.;:!?/\\-])/).filter(Boolean);
}

function mergeDiffSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.reduce<DiffSegment[]>((merged, segment) => {
    if (!segment.value) return merged;

    const previous = merged[merged.length - 1];
    if (previous && previous.type === segment.type) {
      previous.value += segment.value;
      return merged;
    }

    merged.push({ ...segment });
    return merged;
  }, []);
}

function computeDiffSegments(before: string, after: string): DiffSegment[] {
  const beforeTokens = tokenizeDiffText(before);
  const afterTokens = tokenizeDiffText(after);

  if (beforeTokens.length === 0 && afterTokens.length === 0) return [];
  if (beforeTokens.length === 0) return mergeDiffSegments([{ type: 'add', value: after }]);
  if (afterTokens.length === 0) return mergeDiffSegments([{ type: 'remove', value: before }]);

  const complexity = beforeTokens.length * afterTokens.length;
  if (complexity > 24000) {
    return mergeDiffSegments([
      { type: 'remove', value: before },
      { type: 'add', value: after },
    ]);
  }

  const dp = Array.from({ length: beforeTokens.length + 1 }, () => Array<number>(afterTokens.length + 1).fill(0));

  for (let i = beforeTokens.length - 1; i >= 0; i -= 1) {
    for (let j = afterTokens.length - 1; j >= 0; j -= 1) {
      dp[i][j] = beforeTokens[i] === afterTokens[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < beforeTokens.length && j < afterTokens.length) {
    if (beforeTokens[i] === afterTokens[j]) {
      segments.push({ type: 'equal', value: beforeTokens[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'remove', value: beforeTokens[i] });
      i += 1;
    } else {
      segments.push({ type: 'add', value: afterTokens[j] });
      j += 1;
    }
  }

  while (i < beforeTokens.length) {
    segments.push({ type: 'remove', value: beforeTokens[i] });
    i += 1;
  }

  while (j < afterTokens.length) {
    segments.push({ type: 'add', value: afterTokens[j] });
    j += 1;
  }

  return mergeDiffSegments(segments);
}

function InlineDiffPreview({ before, after }: { before: string; after: string }) {
  const segments = computeDiffSegments(before, after);

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No textual delta detected.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      {segments.map((segment, index) => {
        if (segment.type === 'equal') {
          return <span key={`${segment.type}-${index}`}>{segment.value}</span>;
        }

        if (segment.type === 'add') {
          return (
            <span
              key={`${segment.type}-${index}`}
              className="rounded bg-emerald-100/90 px-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
            >
              {segment.value}
            </span>
          );
        }

        return (
          <span
            key={`${segment.type}-${index}`}
            className="rounded bg-rose-100/80 px-0.5 text-rose-700 line-through dark:bg-rose-900/30 dark:text-rose-200"
          >
            {segment.value}
          </span>
        );
      })}
    </div>
  );
}

function normalizeConfidence(confidence?: number): number | null {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null;
  return confidence > 1 ? Math.min(confidence / 100, 1) : Math.min(Math.max(confidence, 0), 1);
}

function formatConfidenceLabel(confidence?: number): string | null {
  const normalized = normalizeConfidence(confidence);
  if (normalized === null) return null;
  return `${Math.round(normalized * 100)}% confidence`;
}

function getConfidenceTone(confidence?: number): 'high' | 'medium' | 'low' | 'unknown' {
  const normalized = normalizeConfidence(confidence);
  if (normalized === null) return 'unknown';
  if (normalized >= 0.85) return 'high';
  if (normalized >= 0.65) return 'medium';
  return 'low';
}

function getRiskSeverityRank(level: RiskHighlight['riskLevel']): number {
  switch (level) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AI_QUICK_PROMPTS: Record<string, string[]> = {
  NDA: [
    'Add mutual disclosure terms',
    'Set confidentiality period',
    'Add permitted disclosures',
    'Make more protective',
  ],
  MSA: [
    'Add payment terms',
    'Define scope of services',
    'Add termination clause',
    'Simplify the language',
  ],
  EMPLOYMENT: [
    'Add non-compete clause',
    'Set notice period',
    'Add benefits section',
    'Simplify the language',
  ],
  SOW: [
    'Add deliverables table',
    'Define acceptance criteria',
    'Add milestone payments',
    'Make more protective',
  ],
  SLA: [
    'Define uptime requirements',
    'Add penalty provisions',
    'Set response times',
    'Add escalation process',
  ],
  DEFAULT: [
    'Make more protective',
    'Add a termination clause',
    'Simplify the language',
    'Add compliance notes',
  ],
};

const NEGOTIATION_QUICK_PROMPTS: Record<string, string[]> = {
  NDA: [
    'Make this more mutual for both parties',
    'Anticipate recipient pushback on confidentiality scope',
    'Create a fallback on residual knowledge language',
  ],
  MSA: [
    'Rewrite this clause in a buyer-favorable position',
    'Anticipate supplier pushback on liability caps',
    'Create a balanced fallback for payment timing',
  ],
  EMPLOYMENT: [
    'Pressure-test the termination language for negotiation risk',
    'Create an employer-friendly fallback position',
    'Rewrite this clause in a more balanced tone',
  ],
  SOW: [
    'Create a customer-friendly fallback for acceptance criteria',
    'Anticipate vendor pushback on milestones',
    'Rewrite this section in a more balanced delivery posture',
  ],
  SLA: [
    'Make service credits more enforceable for the customer',
    'Anticipate supplier pushback on uptime obligations',
    'Create a fallback for chronic breach escalation',
  ],
  DEFAULT: [
    'Rewrite this clause in a stronger commercial position',
    'Anticipate likely counterparty pushback',
    'Create a balanced fallback position',
  ],
};

interface StructureBlockTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  html: string;
  contractTypes?: string[];
}

interface SlashCommandConfig {
  id: string;
  label: string;
  description: string;
  kind: 'block' | 'ai';
  blockId?: string;
  prompt?: string;
  keywords?: string[];
}

interface DraftBlueprintStep {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  blockId?: string;
}

interface AssistantJourneyAction {
  id: string;
  title: string;
  description: string;
  badge: string;
  emphasis: 'violet' | 'emerald' | 'amber' | 'slate';
  mode: 'prompt' | 'block';
  prompt?: string;
  blockId?: string;
}

const STRUCTURE_BLOCKS: StructureBlockTemplate[] = [
  {
    id: 'parties',
    title: 'Parties and purpose',
    description: 'Add the contracting parties, background, and scope setup.',
    category: 'Core',
    html: '<h2>Parties</h2><p>This Agreement is entered into between [Party A], a [jurisdiction and entity type], and [Party B], a [jurisdiction and entity type].</p><h2>Purpose</h2><p>The parties wish to define the terms governing [services, supply, or project scope].</p>',
  },
  {
    id: 'definitions',
    title: 'Definitions',
    description: 'Create a standard definitions section for key terms.',
    category: 'Core',
    html: '<h2>Definitions</h2><p>In this Agreement, the following terms have the meanings set out below.</p><ul><li><strong>Confidential Information</strong> means any non-public information disclosed by one party to the other in connection with this Agreement.</li><li><strong>Deliverables</strong> means the outputs, reports, materials, or services expressly described in this Agreement.</li><li><strong>Effective Date</strong> means the date on which this Agreement becomes binding on both parties.</li></ul>',
  },
  {
    id: 'payment',
    title: 'Commercial terms',
    description: 'Insert pricing, invoicing, and payment language.',
    category: 'Commercial',
    html: '<h2>Fees and Payment</h2><p>In consideration for the services under this Agreement, [Customer] shall pay [Supplier] the fees set out in the applicable order form or statement of work.</p><ul><li>Invoices are due within [30] days of receipt.</li><li>Any disputed amount must be notified in writing within [10] business days.</li><li>Late payments may accrue interest at the lesser of [1.0%] per month or the maximum rate permitted by law.</li></ul>',
  },
  {
    id: 'milestones',
    title: 'Milestones and deliverables',
    description: 'Create a milestone section for delivery tracking.',
    category: 'Operations',
    html: '<h2>Milestones and Deliverables</h2><table><thead><tr><th>Milestone</th><th>Deliverable</th><th>Owner</th><th>Target Date</th></tr></thead><tbody><tr><td>[Milestone 1]</td><td>[Deliverable]</td><td>[Owner]</td><td>[Date]</td></tr><tr><td>[Milestone 2]</td><td>[Deliverable]</td><td>[Owner]</td><td>[Date]</td></tr></tbody></table>',
    contractTypes: ['SOW', 'MSA', 'SLA'],
  },
  {
    id: 'governance',
    title: 'Governance and escalation',
    description: 'Add operating cadence, meetings, and escalation flow.',
    category: 'Operations',
    html: '<h2>Governance and Escalation</h2><p>The parties shall maintain an operating cadence appropriate for the services under this Agreement.</p><ul><li>Operational review meetings will take place [monthly].</li><li>Commercial issues will be escalated to [role or team].</li><li>Critical incidents will be escalated within [time period] to designated executive sponsors.</li></ul>',
  },
  {
    id: 'termination',
    title: 'Termination and exit',
    description: 'Insert termination rights and transition obligations.',
    category: 'Risk',
    html: '<h2>Termination</h2><p>Either party may terminate this Agreement for material breach if the other party fails to cure the breach within [30] days after written notice.</p><p>Upon termination or expiry, each party shall promptly return or securely destroy the other party\'s Confidential Information, except where retention is required by law.</p><h3>Transition Assistance</h3><p>Upon request, [Supplier] shall provide reasonable transition assistance for a period of [30-90] days on mutually agreed commercial terms.</p>',
  },
  {
    id: 'signature',
    title: 'Signature block',
    description: 'Add execution lines for both parties.',
    category: 'Execution',
    html: '<h2>Signatures</h2><p>IN WITNESS WHEREOF, the parties have caused this Agreement to be executed by their duly authorized representatives.</p><table><tbody><tr><td><strong>[Party A]</strong><br />By: ______________________<br />Name: ____________________<br />Title: _____________________<br />Date: _____________________</td><td><strong>[Party B]</strong><br />By: ______________________<br />Name: ____________________<br />Title: _____________________<br />Date: _____________________</td></tr></tbody></table>',
  },
];

const SLASH_COMMANDS: SlashCommandConfig[] = [
  { id: 'parties', label: '/parties', description: 'Insert a parties and purpose section.', kind: 'block', blockId: 'parties', keywords: ['introduction', 'scope'] },
  { id: 'definitions', label: '/definitions', description: 'Insert a definitions section.', kind: 'block', blockId: 'definitions', keywords: ['terms', 'glossary'] },
  { id: 'payment', label: '/payment', description: 'Insert commercial and payment terms.', kind: 'block', blockId: 'payment', keywords: ['fees', 'commercial'] },
  { id: 'milestones', label: '/milestones', description: 'Insert milestones and deliverables.', kind: 'block', blockId: 'milestones', keywords: ['delivery', 'timeline'] },
  { id: 'termination', label: '/termination', description: 'Insert termination and exit language.', kind: 'block', blockId: 'termination', keywords: ['breach', 'exit'] },
  { id: 'signature', label: '/signature', description: 'Insert a signature block.', kind: 'block', blockId: 'signature', keywords: ['execution', 'signatures'] },
  { id: 'rewrite', label: '/rewrite', description: 'Ask AI to rewrite the current passage more clearly.', kind: 'ai', prompt: 'Rewrite the current clause in clearer, more precise legal language while preserving intent.', keywords: ['improve', 'clarify'] },
  { id: 'review', label: '/review', description: 'Ask AI to review the current clause for risks and gaps.', kind: 'ai', prompt: 'Review the current clause for legal, operational, and drafting risks. Call out gaps and suggest improvements.', keywords: ['risk', 'check'] },
  { id: 'buyer', label: '/buyer', description: 'Ask AI to strengthen the current clause for your side.', kind: 'ai', prompt: 'Rewrite the current clause into a stronger negotiation position while keeping it commercially credible.', keywords: ['negotiation', 'stronger'] },
  { id: 'fallback', label: '/fallback', description: 'Ask AI for a fallback clause package.', kind: 'ai', prompt: 'Create a preferred clause, a fallback clause, and a walk-away issue for the current clause or section.', keywords: ['negotiation', 'backup'] },
  { id: 'summary', label: '/summary', description: 'Ask AI what is still missing in the draft.', kind: 'ai', prompt: 'Summarize the current draft and identify the most important missing sections, risks, or follow-up questions.', keywords: ['missing', 'overview'] },
];

const DRAFTING_BLUEPRINTS: Record<string, DraftBlueprintStep[]> = {
  NDA: [
    {
      id: 'parties',
      title: 'Parties and purpose',
      description: 'Anchor who is sharing information and the purpose of the exchange.',
      keywords: ['parties', 'purpose'],
      blockId: 'parties',
    },
    {
      id: 'definitions',
      title: 'Confidential information and definitions',
      description: 'Define what is protected and how the core terms are interpreted.',
      keywords: ['definitions', 'confidential information', 'defined terms'],
      blockId: 'definitions',
    },
    {
      id: 'use-disclosure',
      title: 'Use and disclosure guardrails',
      description: 'Set permitted use, exceptions, and recipient handling obligations.',
      keywords: ['permitted disclosures', 'use restrictions', 'confidentiality obligations', 'exceptions'],
    },
    {
      id: 'termination',
      title: 'Term and return or destruction',
      description: 'Cover duration, return or deletion, and post-termination obligations.',
      keywords: ['term', 'termination', 'return', 'destroy'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Make signature mechanics and authorization explicit.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
  MSA: [
    {
      id: 'parties',
      title: 'Parties and purpose',
      description: 'Set the relationship, commercial intent, and baseline scope.',
      keywords: ['parties', 'purpose'],
      blockId: 'parties',
    },
    {
      id: 'definitions',
      title: 'Definitions',
      description: 'Clarify the recurring business and legal terms up front.',
      keywords: ['definitions', 'defined terms'],
      blockId: 'definitions',
    },
    {
      id: 'payment',
      title: 'Commercial terms',
      description: 'Define pricing, invoicing, and payment timing.',
      keywords: ['fees', 'payment', 'commercial terms'],
      blockId: 'payment',
    },
    {
      id: 'milestones',
      title: 'Milestones and deliverables',
      description: 'Describe outputs, milestones, and delivery expectations.',
      keywords: ['milestones', 'deliverables', 'acceptance'],
      blockId: 'milestones',
    },
    {
      id: 'governance',
      title: 'Governance and escalation',
      description: 'Set meeting cadence, issue ownership, and escalation routes.',
      keywords: ['governance', 'escalation', 'operational review'],
      blockId: 'governance',
    },
    {
      id: 'termination',
      title: 'Risk and exit',
      description: 'Cover termination, transition, and core protection mechanics.',
      keywords: ['termination', 'transition assistance', 'liability', 'indemnity'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Lock the agreement with signature language and authority lines.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
  EMPLOYMENT: [
    {
      id: 'parties',
      title: 'Role and relationship',
      description: 'Identify the employee, employer, and purpose of the engagement.',
      keywords: ['parties', 'employment', 'position', 'role'],
      blockId: 'parties',
    },
    {
      id: 'payment',
      title: 'Compensation and benefits',
      description: 'Define salary, bonus logic, and core benefits or allowances.',
      keywords: ['compensation', 'salary', 'benefits', 'payment'],
      blockId: 'payment',
    },
    {
      id: 'governance',
      title: 'Duties and reporting',
      description: 'Set responsibilities, reporting lines, and performance cadence.',
      keywords: ['responsibilities', 'duties', 'reporting', 'performance'],
      blockId: 'governance',
    },
    {
      id: 'termination',
      title: 'Termination and restrictive covenants',
      description: 'Cover notice, cause, exit obligations, and post-employment limits.',
      keywords: ['termination', 'notice', 'non compete', 'restrictive covenants'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Capture signature authority and acceptance mechanics.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
  SOW: [
    {
      id: 'parties',
      title: 'Parties and statement of intent',
      description: 'Tie the work order back to the parties and engagement scope.',
      keywords: ['parties', 'purpose', 'statement of work'],
      blockId: 'parties',
    },
    {
      id: 'milestones',
      title: 'Scope, milestones, and deliverables',
      description: 'Define what gets delivered, by whom, and when.',
      keywords: ['scope', 'milestones', 'deliverables', 'acceptance'],
      blockId: 'milestones',
    },
    {
      id: 'payment',
      title: 'Commercial terms',
      description: 'Link milestones to pricing and payment triggers.',
      keywords: ['fees', 'payment', 'commercial terms'],
      blockId: 'payment',
    },
    {
      id: 'governance',
      title: 'Governance and escalation',
      description: 'Set operational governance and issue escalation paths.',
      keywords: ['governance', 'escalation', 'reporting'],
      blockId: 'governance',
    },
    {
      id: 'termination',
      title: 'Change control and termination',
      description: 'Explain what happens when scope changes or the work stops.',
      keywords: ['change control', 'termination', 'exit'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Close the work order with authorized signature lines.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
  SLA: [
    {
      id: 'parties',
      title: 'Parties and service context',
      description: 'Identify the service relationship and service boundary.',
      keywords: ['parties', 'purpose', 'services'],
      blockId: 'parties',
    },
    {
      id: 'definitions',
      title: 'Service definitions',
      description: 'Clarify uptime, incidents, exclusions, and measurement terms.',
      keywords: ['definitions', 'service levels', 'availability'],
      blockId: 'definitions',
    },
    {
      id: 'milestones',
      title: 'Service levels and response times',
      description: 'Spell out target metrics, windows, and service commitments.',
      keywords: ['service levels', 'response times', 'uptime', 'deliverables'],
      blockId: 'milestones',
    },
    {
      id: 'governance',
      title: 'Monitoring and escalation',
      description: 'Set reporting cadence, incident ownership, and escalation rules.',
      keywords: ['governance', 'escalation', 'monitoring'],
      blockId: 'governance',
    },
    {
      id: 'termination',
      title: 'Remedies and exit',
      description: 'Address service credits, chronic breach, and termination mechanics.',
      keywords: ['service credits', 'termination', 'remedies'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Finalize with signature and authorization mechanics.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
  DEFAULT: [
    {
      id: 'parties',
      title: 'Parties and purpose',
      description: 'Identify the parties and what the agreement is for.',
      keywords: ['parties', 'purpose'],
      blockId: 'parties',
    },
    {
      id: 'definitions',
      title: 'Definitions',
      description: 'Clarify the most reusable terms early.',
      keywords: ['definitions', 'defined terms'],
      blockId: 'definitions',
    },
    {
      id: 'payment',
      title: 'Commercial terms',
      description: 'Explain how value, invoices, and payment timing work.',
      keywords: ['fees', 'payment', 'commercial terms'],
      blockId: 'payment',
    },
    {
      id: 'termination',
      title: 'Termination and exit',
      description: 'Describe how the agreement ends and what obligations survive.',
      keywords: ['termination', 'exit'],
      blockId: 'termination',
    },
    {
      id: 'signature',
      title: 'Execution',
      description: 'Capture signature and authority details.',
      keywords: ['signatures', 'signature', 'execution'],
      blockId: 'signature',
    },
  ],
};

function hasEditorDropPayload(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types || []).includes(EDITOR_DROP_MIME);
}

// ============================================================================
// TYPES
// ============================================================================

interface CopilotSuggestion {
  id: string;
  type: 'clause_improvement' | 'risk_warning' | 'compliance' | 'auto_complete' | 'negotiation';
  triggerText: string;
  originalText?: string;
  suggestedText: string;
  explanation: string;
  confidence: number;
  position: { startOffset: number; endOffset: number };
  source: {
    type: 'playbook' | 'clause_library' | 'ai' | 'historical';
    name?: string;
    clauseId?: string;
    confidence: number;
  };
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
}

interface RiskHighlight {
  id: string;
  text: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  explanation: string;
  suggestedFix?: string;
  position: { startOffset: number; endOffset: number };
}

/**
 * Normalize risks produced by the agentic draft pipeline
 * ({ category, severity, description, clause, suggestion, remediation })
 * — or already-canonical RiskHighlight rows — into RiskHighlight shape.
 */
function normalizeInitialRisks(raw: unknown): RiskHighlight[] {
  if (!Array.isArray(raw)) return [];
  const valid: RiskHighlight[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const r = item as Record<string, unknown>;
    const severity = String(r.severity ?? r.riskLevel ?? 'medium').toLowerCase();
    const level: RiskHighlight['riskLevel'] = severity === 'critical'
      ? 'critical'
      : severity === 'high'
      ? 'high'
      : severity === 'low'
      ? 'low'
      : 'medium';
    const text = String(r.clause ?? r.text ?? '').trim();
    const explanation = String(r.description ?? r.explanation ?? '').trim();
    if (!text && !explanation) return;
    const remediationStr = typeof r.remediation === 'string' ? r.remediation.trim() : '';
    const suggestedFixStr = typeof r.suggestedFix === 'string' ? r.suggestedFix.trim() : '';
    const suggestionStr = typeof r.suggestion === 'string' ? r.suggestion.trim() : '';
    const suggestedFix = remediationStr || suggestedFixStr || suggestionStr || undefined;
    valid.push({
      id: String(r.id ?? `agent-risk-${i}`),
      text,
      riskLevel: level,
      category: String(r.category ?? 'GENERAL'),
      explanation: explanation || text,
      suggestedFix,
      position: (r.position as RiskHighlight['position']) ?? { startOffset: 0, endOffset: 0 },
    });
  });
  return valid;
}

interface AutoCompletion {
  id: string;
  text: string;
  source: 'library' | 'historical' | 'ai';
  matchScore: number;
  clauseId?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

/** Comment from API */
interface ApiComment {
  id: string;
  content: string;
  resolved: boolean;
  anchorPos: Record<string, unknown>;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; firstName: string | null; lastName: string | null; email: string };
  }>;
}

/** Version from API */
interface ApiVersion {
  id: string;
  version: number;
  label: string | null;
  changeSummary: string | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  content?: string;
}

/** Clause from library */
interface LibraryClause {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  isStandard: boolean;
  usageCount: number;
}

/** Approval entry */
interface ApprovalEntry {
  userId: string;
  action: 'APPROVED' | 'REJECTED';
  comment?: string;
  reason?: string;
  timestamp: string;
}

interface ChatQuickReply {
  label: string;
  value: string;
}

interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  title?: string;
  draftHtml?: string;
  applyMode?: 'replace_selection' | 'insert_at_cursor' | 'none';
  suggestions?: ChatQuickReply[];
  followUpQuestion?: string;
  comparisonText?: string;
  operation?: 'add_clause' | 'replace_clause' | 'remove_clause' | 'rewrite' | 'fill_variables' | 'tighten_risk' | 'other';
  detectedCategory?: string | null;
  detectedParameters?: Record<string, string>;
  playbookApplied?: { id: string; name: string } | null;
}

interface EditorDropPayload {
  kind: 'suggestion' | 'clause' | 'ai-draft';
  label: string;
  plainText: string;
  html: string;
  sourceLabel?: string;
  confidence?: number;
  detail?: string;
  applyMode?: 'replace_selection' | 'insert_at_cursor' | 'none';
}

interface SourceTrailEntry {
  id: string;
  label: string;
  sourceLabel: string;
  action: 'inserted' | 'replaced';
  timestamp: Date;
  confidence?: number;
  detail?: string;
  sourceId?: string;
  sourceKind?: string;
}

interface HeatmapMarker {
  id: string;
  type: 'risk' | 'comment';
  topPercent: number;
  from: number;
  to?: number;
  label: string;
  detail: string;
  tone: 'critical' | 'high' | 'medium' | 'low' | 'comment';
}

interface InlineRiskChip {
  id: string;
  top: number;
  risk: RiskHighlight;
  extraCount: number;
}

interface DraftOutlineSection {
  id: string;
  title: string;
  level: number;
  startPos: number;
  endPos: number;
}

interface SelectionToolbarState {
  top: number;
  left: number;
  from: number;
  to: number;
  text: string;
}

interface DropIndicatorState {
  top: number;
  left: number;
  width: number;
  insertPos: number;
}

const EDITOR_DROP_MIME = 'application/x-contigo-editor-snippet';
const OUTLINE_REORDER_MIME = 'application/x-contigo-outline-section';

interface CopilotDraftingCanvasProps {
  contractId?: string;
  initialContent?: string;
  initialTitle?: string;
  initialSourceTrail?: unknown;
  /**
   * Pre-identified risks from an earlier analysis (e.g. the agentic draft
   * pipeline). Seeded into the risks panel so reviewers can see them
   * immediately when the editor opens — they will be replaced the next
   * time the realtime copilot call returns fresh risks.
   */
  initialRisks?: unknown;
  contractType?: string;
  playbookId?: string;
  templateId?: string;
  draftId?: string;
  isBlankDocument?: boolean;
  workflowContext?: CopilotWorkflowContext;
  onSave?: (payload: { content: string; title: string; clauses?: Array<Record<string, unknown>> }) => Promise<void>;
  onLegalReview?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CopilotDraftingCanvas({
  contractId,
  initialContent = '',
  initialTitle,
  initialSourceTrail,
  initialRisks,
  contractType = 'MSA',
  playbookId,
  templateId,
  draftId,
  isBlankDocument,
  workflowContext,
  onSave,
  onLegalReview,
}: CopilotDraftingCanvasProps) {
  const { data: session } = useSession();
  // Accessible confirmation dialog (focus-trapped, keyboard- & screen-reader-friendly).
  // Replaces browser-native window.confirm() which is blocked on some mobile browsers,
  // has no ARIA role, and can be silenced by the “prevent further dialogs” checkbox.
  const confirm = useConfirm();

  // Content state — TipTap manages the DOM; we keep refs for AI API payloads
  // to avoid re-rendering the entire component on every keystroke/cursor move.
  const contentRef = useRef(initialContent);
  const cursorPositionRef = useRef(0);
  const selectedTextRef = useRef('');
  // Lightweight state only for the debounce trigger (string length, not full HTML)
  const [contentVersion, setContentVersion] = useState(0);
  const debouncedContentVersion = useDebounce(contentVersion, 500);
  // Expose content length for guards (cheap number comparison, no re-render on text change)
  const contentLengthRef = useRef(0);
  const fallbackDocumentTitle = useMemo(
    () => resolveDraftTitle(initialTitle, `${contractType} Contract`),
    [initialTitle, contractType],
  );
  const [draftTitle, setDraftTitle] = useState(fallbackDocumentTitle);
  const debouncedDraftTitle = useDebounce(draftTitle, 300);
  const hasEditedTitleRef = useRef(false);
  const documentCanvasTitle = useMemo(
    () => resolveDraftTitle(draftTitle, `${contractType} Contract`),
    [draftTitle, contractType],
  );

  // Copilot state
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [risks, setRisks] = useState<RiskHighlight[]>(() => normalizeInitialRisks(initialRisks));
  const [autoCompletions, setAutoCompletions] = useState<AutoCompletion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [completionPopupPos, setCompletionPopupPos] = useState<{ top: number; left: number }>({ top: 80, left: 32 });
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number }>({ top: 120, left: 40 });
  const [slashQuery, setSlashQuery] = useState('');

  // UI state
  const [activeTab, setActiveTabRaw] = useState<'assistant' | 'review' | 'clauses'>(() => {
    if (typeof window === 'undefined') return 'assistant';
    const saved = localStorage.getItem('drafting-sidebar-tab');
    if (saved === 'assistant') return saved;
    if (saved === 'review') return saved;
    if (saved === 'clauses') return saved;
    if (saved === 'copilot') return 'assistant';
    if (saved === 'comments' || saved === 'versions') return 'review';
    return 'assistant';
  });
  const setActiveTab = useCallback((tab: typeof activeTab | ((prev: typeof activeTab) => typeof activeTab)) => {
    setActiveTabRaw(prev => {
      const next = typeof tab === 'function' ? tab(prev) : tab;
      try { localStorage.setItem('drafting-sidebar-tab', next); } catch { /* quota exceeded */ }
      return next;
    });
  }, []);
  const aiChatStorageKey = useMemo(
    () => (draftId ? `contigo.draft.${draftId}.chat` : null),
    [draftId],
  );
  const [aiChatMessages, _setAiChatMessages] = useState<AiChatMessage[]>(() => {
    // Rehydrate prior chat thread for this draft so the conversation survives
    // reloads. We drop any half-streamed assistant bubble (isStreaming=true)
    // and cap to the most recent 30 messages to stay inside the 5MB quota.
    if (typeof window === 'undefined' || !draftId) return [];
    try {
      const raw = localStorage.getItem(`contigo.draft.${draftId}.chat`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((m: any) => ({
          ...m,
          timestamp: m?.timestamp ? new Date(m.timestamp) : new Date(),
          isStreaming: false,
        }))
        .filter((m: any) => m && typeof m.id === 'string' && typeof m.content === 'string')
        .slice(-30) as AiChatMessage[];
    } catch {
      return [];
    }
  });
  const [rejectedDraftIds, setRejectedDraftIds] = useState<Set<string>>(() => new Set());
  const [appliedDraftIds, setAppliedDraftIds] = useState<Set<string>>(() => new Set());
  const toggleDraftRejected = useCallback((id: string) => {
    setRejectedDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const markDraftApplied = useCallback((id: string) => {
    setAppliedDraftIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const aiChatMessagesRef = useRef<AiChatMessage[]>(aiChatMessages);
  // Keep ref in sync so sendAiChatMessage reads latest without re-creating
  const setAiChatMessages = useCallback((update: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])) => {
    _setAiChatMessages(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      aiChatMessagesRef.current = next;
      return next;
    });
  }, []);

  // Track which draft our current `aiChatMessages` belongs to. Without this
  // the state is seeded ONCE from the initial draftId and never resets when
  // the route switches to a different draft — the persist effect would then
  // write draft-A's thread into draft-B's localStorage key, cross-contaminating
  // (including across tenants/users). Whenever draftId changes we re-read
  // storage for the new key and hard-replace the messages.
  const loadedChatDraftIdRef = useRef<string | null | undefined>(draftId);
  const hasShownQuotaWarningRef = useRef(false);
  useEffect(() => {
    if (loadedChatDraftIdRef.current === draftId) return;
    // If a chat stream was still in flight for the previous draft, abort it
    // FIRST — otherwise its SSE chunks would continue landing on the newly
    // rehydrated messages for the new draft (the abort controller outlives
    // the route change, and the stream reader has no idea which draft it
    // started for).
    try { aiChatAbortRef.current?.abort(); } catch { /* ignore */ }
    aiChatAbortRef.current = null;
    loadedChatDraftIdRef.current = draftId;
    if (typeof window === 'undefined' || !draftId) {
      setAiChatMessages([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`contigo.draft.${draftId}.chat`);
      if (!raw) { setAiChatMessages([]); return; }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) { setAiChatMessages([]); return; }
      const rehydrated = parsed
        .map((m: any) => ({
          ...m,
          timestamp: m?.timestamp ? new Date(m.timestamp) : new Date(),
          isStreaming: false,
        }))
        .filter((m: any) => m && typeof m.id === 'string' && typeof m.content === 'string')
        .slice(-30) as AiChatMessage[];
      setAiChatMessages(rehydrated);
    } catch {
      setAiChatMessages([]);
    }
  }, [draftId, setAiChatMessages]);

  // Persist the chat thread per-draft so reloads/navigation don't wipe
  // context. We only write when the last message has finished streaming
  // (avoids JSON-stringifying on every SSE chunk, which would hammer the
  // main thread on fast streams and risk storing half-formed bubbles).
  // We also require `loadedChatDraftIdRef` to have caught up with the
  // current `draftId` so we never write the previous draft's state into
  // the new draft's key during the brief window between route-change and
  // the rehydration effect above.
  useEffect(() => {
    if (!aiChatStorageKey || typeof window === 'undefined') return;
    if (loadedChatDraftIdRef.current !== draftId) return;
    const last = aiChatMessages[aiChatMessages.length - 1];
    if (last?.isStreaming) return;
    try {
      if (aiChatMessages.length === 0) {
        localStorage.removeItem(aiChatStorageKey);
      } else {
        // Cap at 30 most-recent to stay well under quota even with big drafts.
        const slice = aiChatMessages.slice(-30);
        localStorage.setItem(aiChatStorageKey, JSON.stringify(slice));
      }
    } catch (err) {
      // QuotaExceededError — tell the user once per session so they know
      // their chat isn't being saved. We don't retry; truncating further
      // would silently drop legitimate context.
      if (!hasShownQuotaWarningRef.current) {
        hasShownQuotaWarningRef.current = true;
        const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
        toast.warning(
          isQuota
            ? 'Chat history can’t be saved — browser storage is full. Clear older drafts or use “Clear” to reset this thread.'
            : 'Couldn’t save chat history for this draft.',
          { duration: 6000 },
        );
      }
    }
  }, [aiChatMessages, aiChatStorageKey, draftId]);
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatInputRef = useRef<HTMLInputElement | null>(null);

  /** Focus the chat input and (optionally) preset a value. Used by both the
   *  "Not what I meant?" button and the Ctrl/Cmd+J shortcut. Moves cursor to
   *  the end so typing continues naturally.
   *
   *  If the input already has user-typed content we DO NOT overwrite it —
   *  the user's in-flight text takes priority over any scaffolded preset.
   *  That way clicking the CTA twice, or clicking it after you've started
   *  typing, never eats your words. */
  const focusChatInput = useCallback((preset?: string) => {
    if (typeof preset === 'string') {
      setAiChatInput(prev => (prev.trim().length === 0 ? preset : prev));
    }
    // Defer focus so any state update flushes first.
    requestAnimationFrame(() => {
      const el = aiChatInputRef.current;
      if (!el) return;
      el.focus();
      try {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch {
        // setSelectionRange is unsupported on some input types; ignore.
      }
    });
  }, []);

  const [showShortcutCoachmark, setShowShortcutCoachmark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('drafting-shortcut-coachmark-dismissed') !== '1';
  });
  const dismissShortcutCoachmark = useCallback(() => {
    setShowShortcutCoachmark(false);
    try { localStorage.setItem('drafting-shortcut-coachmark-dismissed', '1'); } catch { /* ignore */ }
  }, []);
  const [showHelpCheatsheet, setShowHelpCheatsheet] = useState(false);
  const [showSectionJump, setShowSectionJump] = useState(false);
  const [sectionJumpQuery, setSectionJumpQuery] = useState('');
  const [sectionJumpIndex, setSectionJumpIndex] = useState(0);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  // Focus mode: hides sidebars for distraction-free writing; persists to localStorage
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('drafting-focus-mode') === '1';
  });
  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      const next = !prev;
      try { localStorage.setItem('drafting-focus-mode', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);
  // Word count goal: user-defined target to track drafting progress
  const [wordGoal, setWordGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem('drafting-word-goal');
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const setWordGoalPersistent = useCallback((n: number) => {
    setWordGoal(n);
    try {
      if (n > 0) localStorage.setItem('drafting-word-goal', String(n));
      else localStorage.removeItem('drafting-word-goal');
    } catch { /* ignore */ }
  }, []);
  const [isAiChatStreaming, setIsAiChatStreaming] = useState(false);
  const aiChatAbortRef = useRef<AbortController | null>(null);
  const aiChatScrollRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<'draft' | 'negotiate'>('draft');
  // Default the assistant sidebar open on large viewports and remember the user's
  // explicit preference in localStorage so manual toggles persist across reloads.
  const SIDEBAR_VISIBILITY_STORAGE_KEY = 'drafting-desktop-sidebar-visible';
  const [showDesktopSidebar, setShowDesktopSidebar] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_VISIBILITY_STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch { /* localStorage unavailable */ }
    // No saved preference yet → open by default on lg+ (Tailwind's lg breakpoint)
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_VISIBILITY_STORAGE_KEY,
        showDesktopSidebar ? 'true' : 'false',
      );
    } catch { /* ignore storage failures */ }
  }, [showDesktopSidebar]);
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(resolveInitialDesktopSidebarWidth);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isEditorDropActive, setIsEditorDropActive] = useState(false);
  const [draggedSnippetLabel, setDraggedSnippetLabel] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState | null>(null);
  const [showInlineCommentComposer, setShowInlineCommentComposer] = useState(false);
  const [inlineCommentDraft, setInlineCommentDraft] = useState('');
  const [draggedOutlineId, setDraggedOutlineId] = useState<string | null>(null);
  const [outlineDropTargetId, setOutlineDropTargetId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [selectedHeatmapMarkerId, setSelectedHeatmapMarkerId] = useState<string | null>(null);
  const [inlineRiskChips, setInlineRiskChips] = useState<InlineRiskChip[]>([]);
  const [sourceTrail, setSourceTrail] = useState<SourceTrailEntry[]>(() => normalizeSourceTrail(initialSourceTrail));
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'DRAFT' | 'IN_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FINALIZED'>('DRAFT');
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const router = useRouter();

  // Comments & versions — now wired to API
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showDiffView, setShowDiffView] = useState(false);
  const [diffVersions, setDiffVersions] = useState<Array<{ version: number; content: string; author: string; timestamp: string; label?: string }>>([]);

  // Clause library state
  const [clauseSearch, setClauseSearch] = useState('');
  const debouncedClauseSearch = useDebounce(clauseSearch, 300);
  const [clauseCategory, setClauseCategory] = useState('all');
  const [clauses, setClauses] = useState<LibraryClause[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);

  // Locking / collaboration state
  const [lockInfo, setLockInfo] = useState<{ isLocked: boolean; lockedBy: string | null; lockedAt: string | null }>({
    isLocked: false, lockedBy: null, lockedAt: null,
  });
  const [isLocking, setIsLocking] = useState(false);

  // Approval workflow state
  const [approvalHistory, setApprovalHistory] = useState<ApprovalEntry[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState<'approve' | 'reject' | 'submit_review' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Cleanup pending requests on unmount or page navigation
  // Also release lock via sendBeacon so the next user isn't blocked.
  const draftIdRef = useRef(draftId);
  const lockInfoRef = useRef(lockInfo);
  const sessionUserIdRef = useRef(session?.user?.id);
  const sidebarResizeRef = useRef({ startX: 0, startWidth: DESKTOP_SIDEBAR_DEFAULT_WIDTH });
  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);

  // Seed risks from the prop whenever it changes (e.g. draft hydrates
  // asynchronously after the canvas has mounted). We only overwrite if
  // the realtime copilot hasn't produced a fresher set yet.
  const hasRealtimeRisksRef = useRef(false);
  useEffect(() => {
    if (hasRealtimeRisksRef.current) return;
    const normalized = normalizeInitialRisks(initialRisks);
    if (normalized.length > 0) {
      setRisks(normalized);
    }
  }, [initialRisks]);
  useEffect(() => { lockInfoRef.current = lockInfo; }, [lockInfo]);
  useEffect(() => { sessionUserIdRef.current = session?.user?.id; }, [session?.user?.id]);

  const setClampedDesktopSidebarWidth = useCallback((nextWidth: number) => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : undefined;
    setDesktopSidebarWidth(clampDesktopSidebarWidth(nextWidth, viewportWidth));
  }, []);

  const handleDesktopSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: desktopSidebarWidth,
    };
    setIsResizingSidebar(true);
  }, [desktopSidebarWidth]);

  const handleDesktopSidebarResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setClampedDesktopSidebarWidth(desktopSidebarWidth + 24);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setClampedDesktopSidebarWidth(desktopSidebarWidth - 24);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setClampedDesktopSidebarWidth(DESKTOP_SIDEBAR_MIN_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setClampedDesktopSidebarWidth(DESKTOP_SIDEBAR_MAX_WIDTH);
    }
  }, [desktopSidebarWidth, setClampedDesktopSidebarWidth]);

  useEffect(() => {
    const cleanup = () => {
      aiChatAbortRef.current?.abort();
      // Release lock on exit (fire-and-forget, works during unload via keepalive)
      const id = draftIdRef.current;
      const lock = lockInfoRef.current;
      if (id && lock.isLocked && lock.lockedBy === sessionUserIdRef.current) {
        try {
          fetch(`/api/drafts/${id}/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
            body: JSON.stringify({ action: 'unlock' }),
            keepalive: true, // survives page unload
          }).catch(() => {});
        } catch { /* best-effort */ }
      }
    };
    // Warn about unsaved changes
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== lastSavedContentRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('beforeunload', warnUnsaved);
      cleanup();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, String(desktopSidebarWidth));
    } catch {
      // ignore storage failures
    }
  }, [desktopSidebarWidth]);

  useEffect(() => {
    const handleWindowResize = () => {
      setDesktopSidebarWidth((currentWidth) => clampDesktopSidebarWidth(currentWidth, window.innerWidth));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - sidebarResizeRef.current.startX;
      setClampedDesktopSidebarWidth(sidebarResizeRef.current.startWidth - deltaX);
    };

    const handlePointerUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, setClampedDesktopSidebarWidth]);

  useEffect(() => {
    const container = aiChatScrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: aiChatMessages.length > 1 ? 'smooth' : 'auto',
    });
  }, [aiChatMessages, isAiChatStreaming]);

  // ============================================================================
  // TIPTAP EDITOR
  // ============================================================================

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: isBlankDocument 
          ? 'Start drafting your contract here. Press Ctrl+/ or open Assistant when you need clauses, rewrites, or review help.'
          : 'Start drafting your contract…',
      }),
    ],
    content: initialContent || '',
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-lg max-w-none focus:outline-none min-h-[620px] md:min-h-[780px] font-serif text-[17px] leading-[1.95] tracking-[0.003em] text-slate-800 prose-headings:font-semibold prose-headings:tracking-[-0.03em] prose-h1:mb-6 prose-h1:text-[2.25rem] prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-[1.45rem] prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-[1.12rem] prose-p:my-5 prose-p:text-slate-700 prose-li:my-1 prose-li:text-slate-700 prose-strong:text-slate-900 prose-a:text-violet-700 prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-600 dark:prose-invert dark:text-slate-100 dark:prose-p:text-slate-300 dark:prose-li:text-slate-300 dark:prose-strong:text-slate-50 dark:prose-a:text-violet-300 dark:prose-blockquote:border-l-slate-600 dark:prose-blockquote:text-slate-300 md:text-[18px]',
        style: "font-family: Charter, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
      },
      handleTextInput: (view, from, to, text) => {
        // Smart bracket/quote pairing: insert matching closer when user types an opener
        if (from !== to) return false;
        const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', '\u201c': '\u201d' };
        const closers = new Set([')', ']', '}', '"', '\u201d']);
        const nextChar = view.state.doc.textBetween(from, Math.min(from + 1, view.state.doc.content.size));
        // Skip-over: if user types a closer that already sits at cursor, just move past it
        if (closers.has(text) && nextChar === text) {
          const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1));
          view.dispatch(tr);
          return true;
        }
        const closer = pairs[text];
        if (!closer) return false;
        // don't pair when immediately before a word char (likely editing existing content)
        if (nextChar && /\w/.test(nextChar)) return false;
        // don't pair when next char is already a closer (prevents nested `(("text"))` bugs)
        if (nextChar && closers.has(nextChar)) return false;
        // for quotes, also skip when previous char is a letter (contractions like don"t)
        if ((text === '"' || text === '\u201c') && from > 0) {
          const prevChar = view.state.doc.textBetween(from - 1, from);
          if (/\w/.test(prevChar)) return false;
        }
        let tr = view.state.tr.insertText(text + closer, from, to);
        tr = tr.setSelection(TextSelection.create(tr.doc, from + 1));
        view.dispatch(tr);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      contentRef.current = html;
      contentLengthRef.current = html.length;
      // Bump version to trigger debounce — no full HTML in state
      setContentVersion(v => v + 1);

      // trigger auto-completions only when user pauses typing at end of a
      // substantial line (not mid-sentence edits or cursor-only moves)
      const { from } = ed.state.selection;
      cursorPositionRef.current = from;
      const resolvedPos = ed.state.doc.resolve(from);
      const lineEnd = resolvedPos.end();
      const isAtLineEnd = from >= lineEnd - 1; // within 1 char of line end
      const docText = ed.state.doc.textBetween(0, from, '\n');
      const lines = docText.split('\n');
      const currentLine = (lines[lines.length - 1] || '').trim();

      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);

      const slashMatch = ed.state.selection.empty
        ? ed.state.doc.textBetween(Math.max(0, from - 80), from, '\n').match(/(?:^|\s)\/([a-z-]*)$/i)
        : null;

      if (slashMatch) {
        const query = slashMatch[1].toLowerCase();
        slashCommandRangeRef.current = { from: from - query.length - 1, to: from };
        setSlashQuery(query);
        setSelectedSlashIndex(0);

        try {
          const coords = ed.view.coordsAtPos(from);
          const editorRect = (editorSurfaceRef.current || ed.view.dom).getBoundingClientRect();
          setSlashMenuPos({
            top: Math.max(12, Math.min(coords.bottom - editorRect.top + 8, editorRect.height - 180)),
            left: Math.max(12, Math.min(coords.left - editorRect.left, editorRect.width - 320)),
          });
        } catch { /* preserve previous slash menu position */ }

        setShowSlashMenu(true);
      } else {
        slashCommandRangeRef.current = null;
        setShowSlashMenu(false);
        setSlashQuery('');
      }

      // Only trigger when: at end-of-line, line is substantial, and line ends
      // with natural pause punctuation or a space (user paused typing)
      if (isAtLineEnd && currentLine.length > 15 && /[\s,;.]$/.test(currentLine)) {
        // Capture cursor coordinates for popup positioning
        try {
          const coords = ed.view.coordsAtPos(from);
          const editorRect = ed.view.dom.getBoundingClientRect();
          const scrollParent = ed.view.dom.closest('.overflow-y-auto, .overflow-auto') || ed.view.dom.parentElement;
          const scrollTop = scrollParent?.scrollTop || 0;
          const rawTop = coords.bottom - editorRect.top + scrollTop + 4;
          const rawLeft = coords.left - editorRect.left;
          // Clamp within visible editor area
          setCompletionPopupPos({
            top: Math.max(0, Math.min(rawTop, editorRect.height - 100)),
            left: Math.max(8, Math.min(rawLeft, editorRect.width - 400)),
          });
        } catch { /* use previous position */ }

        completionTimerRef.current = setTimeout(() => {
          fetchAutoCompletions(currentLine);
        }, 1200);
      } else {
        // Dismiss if user keeps typing or moves away
        setShowCompletionPopup(false);
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      cursorPositionRef.current = from;
      const sel = ed.state.doc.textBetween(from, to, ' ');
      selectedTextRef.current = sel;
      // Dismiss auto-complete when user moves cursor (avoids stale popups)
      if (showCompletionPopup) setShowCompletionPopup(false);

      if (!ed.state.selection.empty && ed.isEditable) {
        try {
          const startCoords = ed.view.coordsAtPos(from);
          const endCoords = ed.view.coordsAtPos(to);
          const editorRect = (editorSurfaceRef.current || ed.view.dom).getBoundingClientRect();
          const center = ((startCoords.left + endCoords.right) / 2) - editorRect.left;

          setSelectionToolbar({
            from,
            to,
            text: sel,
            top: Math.max(12, startCoords.top - editorRect.top - 54),
            left: Math.max(16, Math.min(center - 150, editorRect.width - 340)),
          });
        } catch {
          setSelectionToolbar(null);
        }
      } else {
        setSelectionToolbar(null);
        setShowInlineCommentComposer(false);
      }

      if (!ed.state.selection.empty) {
        setShowSlashMenu(false);
        setSlashQuery('');
        slashCommandRangeRef.current = null;
      }
    },
  });

  // Sync editable flag when mode toggles
  useEffect(() => {
    if (editor) editor.setEditable(isEditing);
  }, [isEditing, editor]);

  // ============================================================================
  // COPILOT API CALLS
  // ============================================================================

  const fetchSuggestions = useCallback(async () => {
    const currentContent = contentRef.current;
    if (!currentContent || currentContent.length < 50) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          text: currentContent,
          cursorPosition: cursorPositionRef.current,
          selectedText: selectedTextRef.current,
          contractType,
          playbookId,
          mode: 'realtime',
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setSuggestions(data.suggestions || []);
        // Only replace risks when the realtime copilot actually returned some.
        // The realtime endpoint often returns an empty array (e.g. when the
        // selection is too small or OpenAI throttles) — without this guard
        // the pre-hydrated risks from ContractDraft.structure.risks would be
        // wiped out on every copilot call.
        const nextRisks = Array.isArray(data.risks) ? data.risks : [];
        if (nextRisks.length > 0) {
          setRisks(nextRisks);
          hasRealtimeRisksRef.current = true;
        }
      } else {
        const errorBody = await response.json().catch(() => null);
        console.warn('Copilot suggestions non-OK:', response.status, errorBody?.error || response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to fetch AI suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [contractType, playbookId]);

  const fetchAutoCompletions = useCallback(async (text: string) => {
    if (!text || text.length < 10) {
      setAutoCompletions([]);
      setShowCompletionPopup(false);
      return;
    }

    try {
      const response = await fetch('/api/copilot/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          text,
          cursorPosition: cursorPositionRef.current,
          contractType,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setAutoCompletions(data.completions || []);
        setShowCompletionPopup(data.completions?.length > 0);
        setSelectedCompletionIndex(0);
      } else {
        console.warn('Auto-complete non-OK:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch completions:', error);
      toast.error('Auto-complete unavailable', { id: 'autocomplete-err' });
    }
  }, [contractType]);

  // Risks are fetched alongside suggestions in fetchSuggestions — no separate poll needed.

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch suggestions when content changes (debounced via contentVersion)
  useEffect(() => {
    if (contentLengthRef.current > 100) {
      fetchSuggestions();
    }
  }, [debouncedContentVersion, fetchSuggestions]);

  // Track last saved content to avoid redundant auto-saves
  const lastSavedContentRef = useRef(initialContent);
  const lastSavedTitleRef = useRef(fallbackDocumentTitle);
  // Lock to prevent concurrent auto-save and manual save
  const saveLockRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After the editor mounts, TipTap normalises the HTML (e.g. wrapping raw text in <p>),
  // so the HTML that flows through onUpdate differs from the raw `initialContent` prop
  // we seeded the saved-ref with. Re-sync both refs once on mount so the beforeunload
  // "unsaved changes" guard doesn't fire on drafts the user hasn't touched.
  const didSyncInitialSavedRef = useRef(false);
  useEffect(() => {
    if (didSyncInitialSavedRef.current) return;
    if (!editor) return;
    const normalized = editor.getHTML();
    contentRef.current = normalized;
    lastSavedContentRef.current = normalized;
    didSyncInitialSavedRef.current = true;
  }, [editor]);
  const editorDragCounterRef = useRef(0);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const slashCommandRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (hasEditedTitleRef.current) return;

    setDraftTitle(fallbackDocumentTitle);
    if (!draftId) {
      lastSavedTitleRef.current = fallbackDocumentTitle;
    }
  }, [draftId, fallbackDocumentTitle]);

  // Auto-save: triggered by content or draft-title changes.
  useEffect(() => {
    if (!editor || draftStatus === 'FINALIZED') return;

    const html = editor.getHTML();
    const nextTitle = resolveDraftTitle(debouncedDraftTitle, `${contractType} Contract`);
    const contentChanged = html !== lastSavedContentRef.current;
    const titleChanged = nextTitle !== lastSavedTitleRef.current;

    if (!contentChanged && !titleChanged) return;
    if (!draftId && !contentChanged && stripHtml(html).length === 0) return;

    const timer = setTimeout(async () => {
      // Skip if a manual save is in progress
      if (saveLockRef.current) return;
      saveLockRef.current = true;
      // Content changed — save via onSave callback or direct API
      const savingStartedAt = Date.now();
      setIsSaving(true);
      try {
        const serializedSourceTrail = serializeSourceTrail(sourceTrail);
        if (onSave) {
          await onSave({ content: html, title: nextTitle, clauses: serializedSourceTrail });
        } else if (draftId) {
          const res = await fetch(`/api/drafts/${draftId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getCsrfHeaders(),
            },
            body: JSON.stringify({ content: html, title: nextTitle, clauses: serializedSourceTrail }),
          });
          if (res.status === 401) {
            toast.error('Session expired. Your changes are not being saved — please sign in again.');
            throw new Error('Session expired');
          }
          if (res.status === 403) {
            // Access was revoked (or tenant membership changed) while the
            // tab was open. Keep the error loud so the user knows this
            // draft is read-only now, not merely a transient network blip.
            toast.error('You no longer have access to this draft — saves are failing.', { duration: 8000 });
            throw new Error('Forbidden');
          }
          if (res.status === 404) {
            // Draft was deleted (or the URL is stale). Don't silently
            // retry forever; tell the user so they can decide whether
            // to copy their work elsewhere.
            toast.error('This draft no longer exists on the server — your edits can’t be saved. Copy important changes before closing the tab.', { duration: 10000 });
            throw new Error('Draft not found');
          }
          if (!res.ok) throw new Error('Autosave failed');
        }
        lastSavedContentRef.current = html;
        lastSavedTitleRef.current = nextTitle;
        hasEditedTitleRef.current = false;
        setLastSaved(new Date());
        setAutosaveFailed(false);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutosaveFailed(true);
      } finally {
        // Ensure "Saving…" is visible for at least 600ms so users feel the system alive
        const elapsed = Date.now() - savingStartedAt;
        const remaining = Math.max(0, 600 - elapsed);
        setTimeout(() => {
          setIsSaving(false);
          saveLockRef.current = false;
        }, remaining);
      }
    }, 5000); // 5s after last debounced content change

    autoSaveTimerRef.current = timer;
    return () => { clearTimeout(timer); autoSaveTimerRef.current = null; };
  }, [debouncedContentVersion, debouncedDraftTitle, editor, onSave, draftId, draftStatus, contractType, sourceTrail]);

  // ====================================================================
  // FETCH COMMENTS, VERSIONS, CLAUSES, LOCK INFO from API
  // ====================================================================

  const fetchComments = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data?.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [draftId]);

  const fetchVersions = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/versions`);
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data?.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [draftId]);

  const fetchClauses = useCallback(async () => {
    setIsLoadingClauses(true);
    try {
      const params = new URLSearchParams();
      if (debouncedClauseSearch) params.set('search', debouncedClauseSearch);
      if (clauseCategory && clauseCategory !== 'all') params.set('category', clauseCategory);
      params.set('limit', '30');

      const res = await fetch(`/api/clauses/library?${params}`);
      if (res.ok) {
        const json = await res.json();
        setClauses(json.clauses || json.data?.clauses || []);
      } else {
        console.warn('Clauses fetch non-OK:', res.status);
        toast.error('Failed to load clause library', { id: 'clauses-err' });
      }
    } catch (err) {
      console.error('Failed to fetch clauses:', err);
      toast.error('Failed to load clause library', { id: 'clauses-err' });
    } finally {
      setIsLoadingClauses(false);
    }
  }, [debouncedClauseSearch, clauseCategory]);

  const fetchDraftMeta = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data?.draft;
        if (d) {
          setDraftStatus(d.status || 'DRAFT');
          // Lock editor for finalized drafts
          if (d.status === 'FINALIZED') setIsEditing(false);
          setLockInfo({ isLocked: d.isLocked, lockedBy: d.lockedBy, lockedAt: d.lockedAt });
          setApprovalHistory(Array.isArray(d.approvalWorkflow) ? d.approvalWorkflow : []);
          const serverTitle = resolveDraftTitle(d.title, fallbackDocumentTitle);
          lastSavedTitleRef.current = serverTitle;
          if (!hasEditedTitleRef.current) {
            setDraftTitle(serverTitle);
          }
          if (d.updatedAt) {
            setLastSaved(new Date(d.updatedAt));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch draft meta:', err);
    }
  }, [draftId, fallbackDocumentTitle]);

  // On mount: fetch draft metadata, comments, versions
  useEffect(() => {
    if (draftId) {
      fetchDraftMeta();
      fetchComments();
      fetchVersions();
    }
  }, [draftId, fetchDraftMeta, fetchComments, fetchVersions]);

  // Fetch clauses when tab is opened or search changes
  useEffect(() => {
    if (activeTab === 'clauses') {
      fetchClauses();
    }
  }, [activeTab, fetchClauses]);

  // Poll lock status every 30s
  useEffect(() => {
    if (!draftId) return;
    const interval = setInterval(() => {
      fetchDraftMeta();
    }, 30000);
    return () => clearInterval(interval);
  }, [draftId, fetchDraftMeta]);

  // ====================================================================
  // COMMENT HANDLERS
  // ====================================================================

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
        toast.success('Comment added');
      }
    } catch { toast.error('Failed to add comment'); }
  }, [newComment, draftId, fetchComments]);

  const handleInlineCommentCreate = useCallback(async () => {
    if (!draftId) {
      toast.error('Save the draft before adding inline comments');
      return;
    }
    if (!selectionToolbar || !inlineCommentDraft.trim()) return;

    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          content: inlineCommentDraft.trim(),
          anchorPos: {
            from: selectionToolbar.from,
            to: selectionToolbar.to,
            text: selectionToolbar.text,
          },
        }),
      });

      if (res.ok) {
        setInlineCommentDraft('');
        setShowInlineCommentComposer(false);
        setActiveTab('review');
        setShowDesktopSidebar(true);
        fetchComments();
        toast.success('Inline review comment added');
      } else {
        toast.error('Failed to add inline comment');
      }
    } catch {
      toast.error('Failed to add inline comment');
    }
  }, [draftId, fetchComments, inlineCommentDraft, selectionToolbar, setActiveTab]);

  const handleReply = useCallback(async (parentId: string) => {
    if (!replyContent.trim() || !draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ content: replyContent.trim(), parentId }),
      });
      if (res.ok) {
        setReplyContent('');
        setReplyTarget(null);
        fetchComments();
      }
    } catch { toast.error('Failed to reply'); }
  }, [replyContent, draftId, fetchComments]);

  const handleResolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ resolved }),
      });
      fetchComments();
    } catch { toast.error('Failed to update comment'); }
  }, [draftId, fetchComments]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}/comments/${commentId}`, { method: 'DELETE', headers: getCsrfHeaders() });
      fetchComments();
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete comment'); }
  }, [draftId, fetchComments]);

  const handleJumpToCommentAnchor = useCallback((anchorPos: Record<string, unknown>) => {
    if (!editor) return;

    const from = typeof anchorPos.from === 'number' ? anchorPos.from : null;
    const to = typeof anchorPos.to === 'number' ? anchorPos.to : null;
    if (from === null) return;

    if (to && to > from) {
      editor.chain().focus().setTextSelection({ from, to }).run();
    } else {
      editor.chain().focus().setTextSelection(from).run();
    }
  }, [editor]);

  const recordSourceTrail = useCallback((entry: Omit<SourceTrailEntry, 'id' | 'timestamp'> & { timestamp?: Date }) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setSourceTrail((previous) => [
      {
        ...entry,
        id,
        timestamp: entry.timestamp ?? new Date(),
      },
      ...previous,
    ].slice(0, 8));
  }, []);

  const focusDraftRange = useCallback((from: number, to?: number) => {
    if (!editor) return false;

    const docSize = editor.state.doc.content.size;
    const safeFrom = Math.max(1, Math.min(from, docSize));
    const safeTo = typeof to === 'number' ? Math.max(safeFrom, Math.min(to, docSize)) : undefined;

    if (safeTo && safeTo > safeFrom) {
      editor.chain().focus().setTextSelection({ from: safeFrom, to: safeTo }).run();
    } else {
      editor.chain().focus().setTextSelection(safeFrom).run();
    }

    return true;
  }, [editor]);

  const locateTextRange = useCallback((text: string) => {
    if (!editor) return null;

    const raw = text.trim();
    if (!raw) return null;

    const candidates = [raw, raw.replace(/\s+/g, ' '), raw.slice(0, 80)].filter(Boolean);
    const docText = editor.state.doc.textContent;

    for (const candidate of candidates) {
      const index = docText.indexOf(candidate);
      if (index !== -1) {
        return { from: index + 1, to: index + 1 + candidate.length };
      }
    }

    return null;
  }, [editor]);

  const handleFocusRisk = useCallback((risk: RiskHighlight) => {
    let from = risk.position.startOffset;
    let to = risk.position.endOffset;

    const docSize = editor?.state.doc.content.size ?? 0;
    const isUsableRange = from > 0 && to >= from && to <= docSize;

    if (!isUsableRange) {
      const located = locateTextRange(risk.text);
      if (located) {
        from = located.from;
        to = located.to;
      }
    }

    if (from > 0) {
      focusDraftRange(from, to);
    }

    setSelectedHeatmapMarkerId(`risk-${risk.id}`);
    setActiveTab('review');
    setShowDesktopSidebar(true);
  }, [editor, focusDraftRange, locateTextRange, setActiveTab]);

  useEffect(() => {
    if (!editor || !editorSurfaceRef.current || risks.length === 0) {
      setInlineRiskChips([]);
      return;
    }

    const computeInlineRiskChips = () => {
      if (!editor || !editorSurfaceRef.current) return;

      const editorRect = editorSurfaceRef.current.getBoundingClientRect();
      const docSize = editor.state.doc.content.size;
      const grouped: Array<{ top: number; risks: RiskHighlight[] }> = [];

      for (const risk of risks.slice(0, 16)) {
        let from = risk.position.startOffset;
        let to = risk.position.endOffset;
        const isUsableRange = from > 0 && to >= from && to <= docSize;

        if (!isUsableRange) {
          const located = locateTextRange(risk.text);
          if (located) {
            from = located.from;
            to = located.to;
          }
        }

        if (!(from > 0)) continue;

        try {
          const coords = editor.view.coordsAtPos(from);
          const top = Math.max(96, Math.min(editorRect.height - 44, coords.top - editorRect.top - 10));
          const bucket = grouped.find((entry) => Math.abs(entry.top - top) < 34);
          if (bucket) {
            bucket.top = Math.min(bucket.top, top);
            bucket.risks.push(risk);
          } else {
            grouped.push({ top, risks: [risk] });
          }
        } catch {
          // Ignore coords lookup errors for stale positions.
        }
      }

      const nextChips = grouped
        .map((group, index) => {
          const sortedRisks = [...group.risks].sort((left, right) => getRiskSeverityRank(right.riskLevel) - getRiskSeverityRank(left.riskLevel));
          return {
            id: `inline-risk-${index}-${sortedRisks[0]?.id || 'risk'}`,
            top: group.top,
            risk: sortedRisks[0],
            extraCount: Math.max(0, group.risks.length - 1),
          } satisfies InlineRiskChip;
        })
        .sort((left, right) => left.top - right.top)
        .slice(0, 10);

      setInlineRiskChips(nextChips);
    };

    const frame = window.requestAnimationFrame(computeInlineRiskChips);
    const handleResize = () => computeInlineRiskChips();
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, [editor, risks, debouncedContentVersion, locateTextRange]);

  // ====================================================================
  // VERSION DIFF HANDLERS
  // ====================================================================

  const handleOpenDiff = useCallback(async () => {
    if (!draftId || versions.length < 1) return;
    // Fetch content for each version
    try {
      const fullVersions = await Promise.all(
        versions.slice(0, 10).map(async (v) => {
          const res = await fetch(`/api/drafts/${draftId}/versions?version=${v.version}`);
          if (!res.ok) return null;
          const json = await res.json();
          const vdata = json.data?.version;
          return vdata ? {
            version: vdata.version,
            content: vdata.content || '',
            author: [vdata.user?.firstName, vdata.user?.lastName].filter(Boolean).join(' ') || vdata.user?.email || 'Unknown',
            timestamp: new Date(vdata.createdAt).toLocaleString(),
            label: vdata.label || undefined,
          } : null;
        }),
      );
      // Add current version
      const currentContent = editor?.getHTML() || '';
      const allVersions = [
        ...fullVersions.filter(Boolean) as Array<{ version: number; content: string; author: string; timestamp: string; label?: string }>,
        { version: (versions[0]?.version || 0) + 1, content: currentContent, author: 'Current', timestamp: 'Now', label: 'Current' },
      ].sort((a, b) => a.version - b.version);

      setDiffVersions(allVersions);
      setShowDiffView(true);
    } catch (err) {
      console.error('Failed to load versions for diff:', err);
      toast.error('Failed to load version content');
    }
  }, [draftId, versions, editor]);

  // ====================================================================
  // CLAUSE LIBRARY HANDLER
  // ====================================================================

  const insertHtmlIntoDraft = useCallback((html: string, options?: { position?: number; successLabel?: string }) => {
    if (!editor) return;

    const sanitized = normalizeAiHtml(html);
    if (typeof options?.position === 'number') {
      editor.chain().focus().insertContentAt(options.position, sanitized).run();
    } else {
      editor.chain().focus().insertContent(sanitized).run();
    }

    if (options?.successLabel) {
      toast.success(`Inserted ${options.successLabel}`);
    }
  }, [editor]);

  const findStructureBlock = useCallback(
    (blockId: string) => STRUCTURE_BLOCKS.find(
      (block) => block.id === blockId && (!block.contractTypes || block.contractTypes.includes(contractType?.toUpperCase() || '')),
    ),
    [contractType],
  );

  const handleInsertStructureBlock = useCallback((block: StructureBlockTemplate, position?: number) => {
    insertHtmlIntoDraft(block.html, { position, successLabel: block.title });
    recordSourceTrail({
      label: block.title,
      sourceLabel: 'Studio block',
      action: 'inserted',
      confidence: 0.96,
      detail: `${block.category} template`,
      sourceId: block.id,
      sourceKind: 'studio-block',
    });
  }, [insertHtmlIntoDraft, recordSourceTrail]);

  const handleInsertClause = useCallback((clause: LibraryClause, position?: number) => {
    const rawHtml = clause.content.startsWith('<') ? clause.content : `<p>${clause.content}</p>`;
    insertHtmlIntoDraft(rawHtml, { position, successLabel: clause.title });
    recordSourceTrail({
      label: clause.title,
      sourceLabel: clause.isStandard ? 'Standard clause library' : 'Clause library',
      action: 'inserted',
      detail: `${clause.category} · used ${clause.usageCount} times`,
      sourceId: clause.id,
      sourceKind: 'library-clause',
    });
  }, [insertHtmlIntoDraft, recordSourceTrail]);

  const buildEditorDropPayload = useCallback((payload: EditorDropPayload) => {
    const normalizedHtml = payload.html ? normalizeAiHtml(payload.html) : textToHtml(payload.plainText);
    return {
      ...payload,
      html: normalizedHtml,
      plainText: payload.plainText || stripHtml(normalizedHtml),
    };
  }, []);

  const clearEditorDragState = useCallback(() => {
    editorDragCounterRef.current = 0;
    setIsEditorDropActive(false);
    setDraggedSnippetLabel(null);
    setDropIndicator(null);
  }, []);

  const handleSnippetDragStart = useCallback((event: React.DragEvent<HTMLElement>, payload: EditorDropPayload) => {
    const normalizedPayload = buildEditorDropPayload(payload);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(EDITOR_DROP_MIME, JSON.stringify(normalizedPayload));
    event.dataTransfer.setData('text/plain', normalizedPayload.plainText);
    setDraggedSnippetLabel(normalizedPayload.label);
  }, [buildEditorDropPayload]);

  const handleSnippetDragEnd = useCallback(() => {
    clearEditorDragState();
  }, [clearEditorDragState]);

  const readEditorDropPayload = useCallback((event: Pick<React.DragEvent<HTMLElement>, 'dataTransfer'>): EditorDropPayload | null => {
    const rawPayload = event.dataTransfer.getData(EDITOR_DROP_MIME);
    if (!rawPayload) return null;

    try {
      const parsed = JSON.parse(rawPayload) as EditorDropPayload;
      if (!parsed?.label || !parsed?.plainText) return null;
      return buildEditorDropPayload(parsed);
    } catch {
      return null;
    }
  }, [buildEditorDropPayload]);

  const maybeAutoScrollWindow = useCallback((clientY: number) => {
    const edgeThreshold = 120;
    if (clientY < edgeThreshold) {
      window.scrollBy({ top: -32, left: 0, behavior: 'auto' });
    } else if (window.innerHeight - clientY < edgeThreshold) {
      window.scrollBy({ top: 32, left: 0, behavior: 'auto' });
    }
  }, []);

  const updateDropIndicator = useCallback((clientX: number, clientY: number) => {
    if (!editor || !editorSurfaceRef.current) return editor?.state.selection.from || 1;

    const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
    const insertPos = coords?.pos ?? editor.state.selection.from;
    const safePos = Math.max(1, Math.min(insertPos, editor.state.doc.content.size));

    try {
      const markerCoords = editor.view.coordsAtPos(safePos);
      const editorRect = editorSurfaceRef.current.getBoundingClientRect();

      setDropIndicator({
        insertPos: safePos,
        top: Math.max(16, markerCoords.top - editorRect.top),
        left: 16,
        width: Math.max(140, editorRect.width - 32),
      });
    } catch {
      setDropIndicator(null);
    }

    return safePos;
  }, [editor]);

  const insertDroppedContent = useCallback((payload: EditorDropPayload, clientX: number, clientY: number) => {
    const insertPosition = dropIndicator?.insertPos ?? updateDropIndicator(clientX, clientY);
    insertHtmlIntoDraft(payload.html, { position: insertPosition, successLabel: payload.label });
    recordSourceTrail({
      label: payload.label,
      sourceLabel: payload.sourceLabel || 'Dragged content',
      action: payload.applyMode === 'replace_selection' ? 'replaced' : 'inserted',
      confidence: payload.confidence,
      detail: payload.detail || 'Dropped into draft',
      sourceKind: payload.kind,
    });
  }, [dropIndicator?.insertPos, insertHtmlIntoDraft, recordSourceTrail, updateDropIndicator]);

  const handleEditorDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasEditorDropPayload(event.dataTransfer)) return;
    event.preventDefault();
    editorDragCounterRef.current += 1;
    setIsEditorDropActive(true);
  }, []);

  const handleEditorDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasEditorDropPayload(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    maybeAutoScrollWindow(event.clientY);
    setIsEditorDropActive(true);
    updateDropIndicator(event.clientX, event.clientY);
  }, [maybeAutoScrollWindow, updateDropIndicator]);

  const handleEditorDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasEditorDropPayload(event.dataTransfer)) return;
    event.preventDefault();
    editorDragCounterRef.current = Math.max(0, editorDragCounterRef.current - 1);
    if (editorDragCounterRef.current === 0) {
      setIsEditorDropActive(false);
    }
  }, []);

  const handleEditorDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const payload = readEditorDropPayload(event);
    if (!payload) return;

    event.preventDefault();
    insertDroppedContent(payload, event.clientX, event.clientY);
    clearEditorDragState();
  }, [clearEditorDragState, insertDroppedContent, readEditorDropPayload]);

  const handleFocusOutlineSection = useCallback((section: DraftOutlineSection) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(Math.max(section.startPos + 1, 1)).run();
  }, [editor]);

  const moveOutlineSection = useCallback((sourceId: string, targetId: string) => {
    if (!editor || sourceId === targetId) return;

    const currentSections: DraftOutlineSection[] = [];
    const headings: Array<{ title: string; level: number; startPos: number }> = [];

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({
          title: node.textContent.trim() || 'Untitled section',
          level: typeof node.attrs.level === 'number' ? node.attrs.level : 1,
          startPos: pos,
        });
      }
    });

    headings.forEach((heading, index) => {
      currentSections.push({
        id: `${heading.startPos}-${heading.title}`,
        title: heading.title,
        level: heading.level,
        startPos: heading.startPos,
        endPos: index + 1 < headings.length ? headings[index + 1].startPos : editor.state.doc.content.size,
      });
    });

    const sourceSection = currentSections.find((section) => section.id === sourceId);
    const targetSection = currentSections.find((section) => section.id === targetId);
    if (!sourceSection || !targetSection) return;

    const sectionSize = sourceSection.endPos - sourceSection.startPos;
    if (sectionSize <= 0) return;

    const sectionSlice = editor.state.doc.slice(sourceSection.startPos, sourceSection.endPos);
    let insertPos = targetSection.startPos;

    let transaction = editor.state.tr.delete(sourceSection.startPos, sourceSection.endPos);
    if (sourceSection.startPos < targetSection.startPos) {
      insertPos -= sectionSize;
    }

    transaction = transaction.insert(insertPos, sectionSlice.content).scrollIntoView();
    editor.view.dispatch(transaction);
    toast.success(`Moved ${sourceSection.title}`);
  }, [editor]);

  const duplicateOutlineSection = useCallback((sectionId: string) => {
    if (!editor) return;
    const headings: Array<{ title: string; level: number; startPos: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({
          title: node.textContent.trim() || 'Untitled section',
          level: typeof node.attrs.level === 'number' ? node.attrs.level : 1,
          startPos: pos,
        });
      }
    });
    const sections = headings.map((h, i) => ({
      id: `${h.startPos}-${h.title}`,
      startPos: h.startPos,
      endPos: i + 1 < headings.length ? headings[i + 1].startPos : editor.state.doc.content.size,
      title: h.title,
    }));
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const slice = editor.state.doc.slice(section.startPos, section.endPos);
    const tr = editor.state.tr.insert(section.endPos, slice.content).scrollIntoView();
    editor.view.dispatch(tr);
    toast.success(`Duplicated ${section.title}`);
  }, [editor]);

  const deleteOutlineSection = useCallback(async (sectionId: string) => {
    if (!editor) return;
    const headings: Array<{ title: string; level: number; startPos: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({
          title: node.textContent.trim() || 'Untitled section',
          level: typeof node.attrs.level === 'number' ? node.attrs.level : 1,
          startPos: pos,
        });
      }
    });
    const sections = headings.map((h, i) => ({
      id: `${h.startPos}-${h.title}`,
      startPos: h.startPos,
      endPos: i + 1 < headings.length ? headings[i + 1].startPos : editor.state.doc.content.size,
      title: h.title,
    }));
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const ok = await confirm({
      title: 'Delete section?',
      description: `“${section.title}” will be permanently removed from the draft.`,
      confirmText: 'Delete',
      destructive: true,
      variant: 'danger',
    });
    if (!ok) return;
    const tr = editor.state.tr.delete(section.startPos, section.endPos).scrollIntoView();
    editor.view.dispatch(tr);
    toast.success(`Deleted ${section.title}`);
  }, [editor, confirm]);

  const handleOutlineDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, sectionId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(OUTLINE_REORDER_MIME, sectionId);
    setDraggedOutlineId(sectionId);
  }, []);

  const handleOutlineDragOver = useCallback((event: React.DragEvent<HTMLButtonElement>, sectionId: string) => {
    const sourceId = event.dataTransfer.getData(OUTLINE_REORDER_MIME);
    if (!sourceId || sourceId === sectionId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setOutlineDropTargetId(sectionId);
  }, []);

  const handleOutlineDrop = useCallback((event: React.DragEvent<HTMLButtonElement>, sectionId: string) => {
    const sourceId = event.dataTransfer.getData(OUTLINE_REORDER_MIME);
    if (!sourceId || sourceId === sectionId) return;
    event.preventDefault();
    moveOutlineSection(sourceId, sectionId);
    setDraggedOutlineId(null);
    setOutlineDropTargetId(null);
  }, [moveOutlineSection]);

  const handleOutlineDragEnd = useCallback(() => {
    setDraggedOutlineId(null);
    setOutlineDropTargetId(null);
  }, []);

  // ====================================================================
  // LOCK HANDLERS
  // ====================================================================

  const handleLock = useCallback(async (action: 'lock' | 'unlock') => {
    if (!draftId) return;
    setIsLocking(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const json = await res.json();
        setLockInfo(json.data?.draft || { isLocked: false, lockedBy: null, lockedAt: null });
        toast.success(action === 'lock' ? 'Draft locked for editing' : 'Draft unlocked');
      } else {
        await res.json().catch(() => ({}));
        toast.error(`Failed to ${action} draft`);
      }
    } catch { toast.error(`Failed to ${action} draft`); }
    finally { setIsLocking(false); }
  }, [draftId]);

  // Lock heartbeat — re-acquire lock every 2 minutes to prevent stale-lock expiry
  useEffect(() => {
    if (!draftId || !lockInfo.isLocked || lockInfo.lockedBy !== session?.user?.id) return;
    let failCount = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/drafts/${draftId}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
          body: JSON.stringify({ action: 'lock' }),
        });
        if (res.ok) {
          failCount = 0; // reset on success
        } else {
          throw new Error(`Lock heartbeat ${res.status}`);
        }
      } catch {
        failCount++;
        if (failCount >= 3) {
          toast.error('Lock lost — another user may take over. Save your work.', { id: 'lock-lost' });
          setIsEditing(false);
          setLockInfo({ isLocked: false, lockedBy: null, lockedAt: null });
          clearInterval(interval);
        }
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [draftId, lockInfo.isLocked, lockInfo.lockedBy, session?.user?.id]);

  // ====================================================================
  // APPROVAL HANDLERS
  // ====================================================================

  const handleApprove = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ comment: approvalComment }),
      });
      if (res.ok) {
        setDraftStatus('APPROVED');
        setShowApprovalModal(null);
        setApprovalComment('');
        fetchDraftMeta();
        toast.success('Draft approved!');
      } else {
        await res.json().catch(() => ({}));
        toast.error('Approval failed');
      }
    } catch { toast.error('Approval failed'); }
  }, [draftId, approvalComment, fetchDraftMeta]);

  const handleReject = useCallback(async () => {
    if (!draftId || !approvalComment.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      const res = await fetch(`/api/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ reason: approvalComment }),
      });
      if (res.ok) {
        setDraftStatus('REJECTED');
        setShowApprovalModal(null);
        setApprovalComment('');
        fetchDraftMeta();
        toast.success('Draft rejected — returned to author');
      } else {
        await res.json().catch(() => ({}));
        toast.error('Rejection failed');
      }
    } catch { toast.error('Rejection failed'); }
  }, [draftId, approvalComment, fetchDraftMeta]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Auto-completion debounce ref
  const completionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Ref to always call the latest handleSave (avoids stale closure since it's defined later)
  const handleSaveRef = useRef<(titleOverride?: string) => Promise<void> | void>(() => {});
  const applySlashCommandRef = useRef<(command: SlashCommandConfig) => void>(() => {});
  const filteredSlashCommandsRef = useRef<SlashCommandConfig[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ── Global keyboard shortcuts ──
    const isMod = e.ctrlKey || e.metaKey;

    // Ctrl+S — Save
    if (isMod && e.key === 's') {
      e.preventDefault();
      handleSaveRef.current();
      return;
    }
    // Ctrl+Shift+E — More actions
    if (isMod && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      setShowActionsMenu((v) => !v);
      return;
    }
    // Ctrl+/ — Open assistant
    if (isMod && e.key === '/') {
      e.preventDefault();
      setActiveTab('assistant');
      setShowDesktopSidebar(true);
      return;
    }
    // Ctrl+K — Quick-jump to outline section
    if (isMod && e.key === 'k') {
      e.preventDefault();
      setShowSectionJump(true);
      return;
    }
    // Ctrl+J — Jump to AI chat input (opens assistant tab if needed)
    if (isMod && e.key === 'j') {
      e.preventDefault();
      setActiveTab('assistant');
      setShowDesktopSidebar(true);
      focusChatInput();
      return;
    }
    // Ctrl+H — Find & Replace
    if (isMod && e.key === 'h') {
      e.preventDefault();
      setShowFindReplace(true);
      return;
    }
    // Ctrl+Space — Manual auto-complete trigger
    if (isMod && e.key === ' ') {
      e.preventDefault();
      if (editor) {
        const { from } = editor.state.selection;
        const docText = editor.state.doc.textBetween(0, from, '\n');
        const lines = docText.split('\n');
        const currentLine = (lines[lines.length - 1] || '').trim();
        if (currentLine.length > 5) {
          fetchAutoCompletions(currentLine);
        }
      }
      return;
    }
    // Slash commands
    if (showSlashMenu && filteredSlashCommandsRef.current.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((index) => Math.min(index + 1, filteredSlashCommandsRef.current.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        const selectedCommand = filteredSlashCommandsRef.current[selectedSlashIndex];
        if (selectedCommand) {
          e.preventDefault();
          applySlashCommandRef.current(selectedCommand);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashQuery('');
        slashCommandRangeRef.current = null;
        return;
      }
    }
    // Handle auto-completion navigation
    if (showCompletionPopup && autoCompletions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.min(i + 1, autoCompletions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (autoCompletions[selectedCompletionIndex]) {
          e.preventDefault();
          applyCompletion(autoCompletions[selectedCompletionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowCompletionPopup(false);
      }
    }
  }, [showCompletionPopup, autoCompletions, selectedCompletionIndex, editor, fetchAutoCompletions, showSlashMenu, selectedSlashIndex]);

  const applyCompletion = useCallback((completion: AutoCompletion) => {
    if (!editor) return;
    // Replace from start-of-current line to cursor with the completion text
    editor.chain().focus().insertContent(completion.text).run();
    setShowCompletionPopup(false);
  }, [editor]);

  const applySuggestion = useCallback((suggestion: CopilotSuggestion) => {
    if (!editor) return;

    const sourceLabel = suggestion.source.type === 'clause_library'
      ? 'Clause library'
      : suggestion.source.type === 'historical'
        ? 'Past language'
        : suggestion.source.type === 'playbook'
          ? 'Policy pack'
          : 'AI suggestion';

    const docSize = editor.state.doc.content.size;
    let from = suggestion.position.startOffset;
    let to = suggestion.position.endOffset;

    // If positions are out of range (document changed since analysis), fall back
    // to searching for the original text in the document.
    if (from >= docSize || to > docSize || from < 0 || to < from) {
      const original = suggestion.originalText;
      if (original) {
        const located = locateTextRange(original);
        if (located) {
          from = located.from;
          to = located.to;
        } else {
          editor.chain().focus().insertContent(suggestion.suggestedText).run();
          recordSourceTrail({
            label: suggestion.explanation || suggestion.triggerText || 'AI suggestion',
            sourceLabel,
            action: 'inserted',
            confidence: suggestion.source.confidence || suggestion.confidence,
            detail: suggestion.category || suggestion.type,
            sourceId: suggestion.source.clauseId,
            sourceKind: suggestion.source.type,
          });
          setSelectedSuggestion(null);
          setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
          return;
        }
      } else {
        editor.chain().focus().insertContent(suggestion.suggestedText).run();
        recordSourceTrail({
          label: suggestion.explanation || suggestion.triggerText || 'AI suggestion',
          sourceLabel,
          action: 'inserted',
          confidence: suggestion.source.confidence || suggestion.confidence,
          detail: suggestion.category || suggestion.type,
          sourceId: suggestion.source.clauseId,
          sourceKind: suggestion.source.type,
        });
        setSelectedSuggestion(null);
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        return;
      }
    }

    from = Math.max(0, Math.min(from, docSize));
    to = Math.max(from, Math.min(to, docSize));

    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, suggestion.suggestedText).run();
    recordSourceTrail({
      label: suggestion.explanation || suggestion.triggerText || 'AI suggestion',
      sourceLabel,
      action: suggestion.originalText ? 'replaced' : 'inserted',
      confidence: suggestion.source.confidence || suggestion.confidence,
      detail: suggestion.category || suggestion.type,
      sourceId: suggestion.source.clauseId,
      sourceKind: suggestion.source.type,
    });
    setSelectedSuggestion(null);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [editor, locateTextRange, recordSourceTrail]);

  const previewSuggestion = useCallback((suggestion: CopilotSuggestion) => {
    const isOpen = selectedSuggestion === suggestion.id;
    setSelectedSuggestion(isOpen ? null : suggestion.id);
    if (isOpen) return;

    const located = suggestion.originalText ? locateTextRange(suggestion.originalText) : null;
    if (located) {
      focusDraftRange(located.from, located.to);
      return;
    }

    const fallbackFrom = suggestion.position.startOffset;
    const fallbackTo = suggestion.position.endOffset;
    if (fallbackFrom > 0) {
      focusDraftRange(fallbackFrom, fallbackTo);
    }
  }, [focusDraftRange, locateTextRange, selectedSuggestion]);



  const commitDraftTitle = useCallback(() => {
    const nextTitle = resolveDraftTitle(draftTitle, `${contractType} Contract`);
    setDraftTitle(nextTitle);

    const hasDraftContent = !!editor && stripHtml(editor.getHTML()).length > 0;
    if ((draftId || hasDraftContent) && nextTitle !== lastSavedTitleRef.current) {
      void handleSaveRef.current(nextTitle);
    }
  }, [draftId, draftTitle, contractType, editor]);

  const revertDraftTitle = useCallback(() => {
    hasEditedTitleRef.current = false;
    setDraftTitle(lastSavedTitleRef.current);
  }, []);

  const handleSave = useCallback(async (titleOverride?: string) => {
    if (!editor) return;
    if (!onSave && !draftId) return;
    
    // Cancel pending auto-save and acquire lock
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    saveLockRef.current = true;
    const savingStartedAt = Date.now();
    setIsSaving(true);
    try {
      const html = editor.getHTML();
      const nextTitle = resolveDraftTitle(titleOverride ?? draftTitle, `${contractType} Contract`);
      const serializedSourceTrail = serializeSourceTrail(sourceTrail);
      if (onSave) {
        await onSave({ content: html, title: nextTitle, clauses: serializedSourceTrail });
      } else if (draftId) {
        const res = await fetch(`/api/drafts/${draftId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({ content: html, title: nextTitle, clauses: serializedSourceTrail }),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      lastSavedContentRef.current = html;
      lastSavedTitleRef.current = nextTitle;
      hasEditedTitleRef.current = false;
      setDraftTitle(nextTitle);
      setLastSaved(new Date());
      setAutosaveFailed(false);
      toast.success('Document saved');
    } catch (error) {
      console.error('Save failed:', error);
      setAutosaveFailed(true);
      toast.error('Save failed');
    } finally {
      const elapsed = Date.now() - savingStartedAt;
      const remaining = Math.max(0, 600 - elapsed);
      setTimeout(() => {
        setIsSaving(false);
        saveLockRef.current = false;
      }, remaining);
    }
  }, [editor, onSave, draftId, draftTitle, contractType, sourceTrail]);

  // Keep ref in sync so handleKeyDown (Ctrl+S) always calls latest handler
  handleSaveRef.current = handleSave;

  // ============================================================================
  // FORMATTING HELPERS — TipTap commands
  // ============================================================================

  const insertFormatting = useCallback((format: string) => {
    if (!editor) return;

    switch (format) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'list':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
    }
  }, [editor]);

  const handleUndo = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().undo().run();
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().redo().run();
  }, [editor]);

  // Find & Replace helpers
  const findNext = useCallback(() => {
    if (!editor || !findQuery) return;
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
    const haystack = findCaseSensitive ? text : text.toLowerCase();
    const needle = findCaseSensitive ? findQuery : findQuery.toLowerCase();
    const start = editor.state.selection.to;
    let idx = haystack.indexOf(needle, start);
    if (idx === -1) idx = haystack.indexOf(needle, 0); // wrap
    if (idx === -1) { toast.error('No match'); return; }
    editor.chain().focus().setTextSelection({ from: idx + 1, to: idx + 1 + needle.length }).scrollIntoView().run();
  }, [editor, findQuery, findCaseSensitive]);

  const replaceOne = useCallback(() => {
    if (!editor || !findQuery) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, '\n');
    const matches = findCaseSensitive ? selected === findQuery : selected.toLowerCase() === findQuery.toLowerCase();
    if (matches) {
      editor.chain().focus().insertContentAt({ from, to }, replaceQuery).run();
    }
    findNext();
  }, [editor, findQuery, replaceQuery, findCaseSensitive, findNext]);

  const replaceAll = useCallback(() => {
    if (!editor || !findQuery) return;
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
    const flags = findCaseSensitive ? 'g' : 'gi';
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, flags);
    const matches = text.match(re);
    if (!matches || matches.length === 0) { toast.error('No matches'); return; }
    // Walk the doc backwards to preserve positions
    const positions: Array<{ from: number; to: number }> = [];
    let searchFrom = 0;
    const searchText = findCaseSensitive ? text : text.toLowerCase();
    const needle = findCaseSensitive ? findQuery : findQuery.toLowerCase();
    while (true) {
      const idx = searchText.indexOf(needle, searchFrom);
      if (idx === -1) break;
      positions.push({ from: idx + 1, to: idx + 1 + needle.length });
      searchFrom = idx + needle.length;
    }
    let chain = editor.chain().focus();
    for (let i = positions.length - 1; i >= 0; i--) {
      chain = chain.insertContentAt(positions[i], replaceQuery);
    }
    chain.run();
    toast.success(`Replaced ${positions.length} occurrence${positions.length === 1 ? '' : 's'}`);
  }, [editor, findQuery, replaceQuery, findCaseSensitive]);

  const handleClearFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  // ============================================================================
  // EXPORT HANDLERS
  // ============================================================================

  const handleExportPDF = useCallback(async () => {
    if (!editor) return;
    setIsExporting(true);
    const toastId = `export-pdf-${Date.now()}`;
    toast.loading('Preparing PDF…', { id: toastId });
    try {
      await exportDraftAsPDF({
        title: documentCanvasTitle,
        content: editor.getHTML(),
        contractType,
        author: session?.user?.name || 'Unknown',
      });
      toast.success('PDF exported successfully', { id: toastId });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('PDF export failed', { id: toastId });
    } finally {
      setIsExporting(false);
      setShowActionsMenu(false);
    }
  }, [editor, documentCanvasTitle, contractType, session]);

  const handleExportDOCX = useCallback(async () => {
    if (!editor) return;
    setIsExporting(true);
    const toastId = `export-docx-${Date.now()}`;
    toast.loading('Preparing DOCX…', { id: toastId });
    try {
      await exportDraftAsDOCX({
        title: documentCanvasTitle,
        content: editor.getHTML(),
        contractType,
        author: session?.user?.name || 'Unknown',
      });
      toast.success('DOCX exported successfully', { id: toastId });
    } catch (error) {
      console.error('DOCX export failed:', error);
      toast.error('DOCX export failed', { id: toastId });
    } finally {
      setIsExporting(false);
      setShowActionsMenu(false);
    }
  }, [editor, documentCanvasTitle, contractType, session]);

  // ============================================================================
  // FINALIZATION HANDLERS
  // ============================================================================

  const handleStatusChange = useCallback(async (newStatus: typeof draftStatus) => {
    if (!draftId) {
      toast.error('Save the draft first before changing status');
      return;
    }

    // Warn on status-skip (e.g., DRAFT → FINALIZED)
    const order = ['DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'FINALIZED'] as const;
    const curIdx = order.indexOf(draftStatus as typeof order[number]);
    const nextIdx = order.indexOf(newStatus as typeof order[number]);
    if (curIdx >= 0 && nextIdx > curIdx + 1) {
      const skipped = order.slice(curIdx + 1, nextIdx).join(' → ');
      const ok = await confirm({
        title: 'Skip review steps?',
        description: `This skips ${skipped}. Continue anyway?`,
        confirmText: 'Continue',
        variant: 'warning',
      });
      if (!ok) return;
    }

    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.status === 401) {
        toast.error('Your session has expired. Please sign in again.');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
        return;
      }
      if (!response.ok) throw new Error('Status update failed');

      setDraftStatus(newStatus);
      toast.success(`Draft status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Status change failed:', error);
      toast.error('Failed to update draft status');
    }
  }, [draftId, draftStatus]);

  const handleFinalize = useCallback(async () => {
    if (!draftId) return;

    try {
      const response = await fetch(`/api/drafts/${draftId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || err.data?.error || 'Finalization failed');
      }

      const result = await response.json();
      const contractId = result?.data?.data?.contract?.id || result?.data?.contract?.id;

      setDraftStatus('FINALIZED');
      setIsEditing(false);
      setCreatedContractId(contractId || null);

      if (contractId) {
        toast.success('Draft finalized! Redirecting to contract...', { duration: 2000 });
        // Short delay for the user to see the success state, then navigate
        setTimeout(() => {
          router.push(`/contracts/${contractId}`);
        }, 1500);
      } else {
        toast.success('Draft finalized successfully!');
      }
    } catch (error) {
      console.error('Finalization failed:', error);
      toast.error(error instanceof Error ? error.message : 'Finalization failed');
    }
  }, [draftId, router]);

  const handleRevertToDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      if (!response.ok) throw new Error('Failed to revert to draft');
      setDraftStatus('DRAFT');
      toast.success('Draft reverted — you can now edit and re-submit.');
    } catch (error) {
      console.error('Revert failed:', error);
      toast.error('Failed to revert draft status');
    }
  }, [draftId]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const riskSummary = useMemo(() => {
    return {
      critical: risks.filter(r => r.riskLevel === 'critical').length,
      high: risks.filter(r => r.riskLevel === 'high').length,
      medium: risks.filter(r => r.riskLevel === 'medium').length,
      low: risks.filter(r => r.riskLevel === 'low').length,
    };
  }, [risks]);

  const priorityRiskCount = riskSummary.critical + riskSummary.high;
  const unresolvedCommentsCount = useMemo(
    () => comments.filter((comment) => !comment.resolved).length,
    [comments],
  );
  const selectedSuggestionData = useMemo(
    () => suggestions.find((suggestion) => suggestion.id === selectedSuggestion) || null,
    [selectedSuggestion, suggestions],
  );
  const availableStructureBlocks = useMemo(
    () => STRUCTURE_BLOCKS.filter(
      (block) => !block.contractTypes || block.contractTypes.includes(contractType?.toUpperCase() || ''),
    ),
    [contractType],
  );
  const availableStructureBlockIds = useMemo(
    () => new Set(availableStructureBlocks.map((block) => block.id)),
    [availableStructureBlocks],
  );
  const isRenewalWorkflow = workflowContext?.kind === 'renewal';
  const isAmendmentWorkflow = workflowContext?.kind === 'amendment';
  const workflowQuickPrompts = useMemo(() => {
    if (workflowContext?.kind === 'renewal') {
      return workspaceMode === 'negotiate'
        ? [
            'Pressure-test this renewal against the source contract and suggest stronger fallback language for pricing, renewal notice, and termination rights.',
            'Create a negotiation package for this renewal: preferred language, fallback language, and walk-away issues for the riskiest clauses.',
            'Identify which clauses should be expressly carried forward, updated, or removed in this renewal and explain why.',
          ]
        : [
            'Review this renewal draft for missing term, pricing, notice, and carry-forward language compared with the source contract.',
            'Rewrite the riskiest renewal clauses so they are cleaner, more precise, and contract-ready.',
            'Draft a short executive checklist of what still needs to be aligned before this renewal is finalized.',
          ];
    }

    if (workflowContext?.kind === 'amendment') {
      return workspaceMode === 'negotiate'
        ? [
            'Create stronger and fallback amendment language for the selected clause, preserving the commercial intent but improving leverage.',
            'Identify amendment language that could create scope creep, pricing ambiguity, or downstream delivery risk.',
            'Draft a negotiation-ready summary of the highest-stakes changes in this amendment.',
          ]
        : [
            'Review this amendment for unclear deltas from the original contract and suggest cleaner drafting.',
            'Rewrite the proposed amendment language so the before-and-after change is explicit and enforceable.',
            'List any missing approval, timing, or change-control language this amendment still needs.',
          ];
    }

    return [] as string[];
  }, [workflowContext, workspaceMode]);
  const assistantQuickPrompts = useMemo(
    () => {
      const basePrompts = workspaceMode === 'negotiate'
        ? (NEGOTIATION_QUICK_PROMPTS[contractType?.toUpperCase() || ''] || NEGOTIATION_QUICK_PROMPTS.DEFAULT)
        : (AI_QUICK_PROMPTS[contractType?.toUpperCase() || ''] || AI_QUICK_PROMPTS.DEFAULT);

      return [...workflowQuickPrompts, ...basePrompts]
        .filter((prompt, index, prompts) => prompts.indexOf(prompt) === index)
        .slice(0, 3);
    },
    [contractType, workflowQuickPrompts, workspaceMode],
  );
  const filteredSlashCommands = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    return SLASH_COMMANDS.filter((command) => {
      if (command.kind === 'block' && command.blockId && !availableStructureBlockIds.has(command.blockId)) {
        return false;
      }

      if (!query) return true;
      return [command.label, command.description, ...(command.keywords || [])]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [availableStructureBlockIds, slashQuery]);
  filteredSlashCommandsRef.current = filteredSlashCommands;
  const outlineSections = useMemo<DraftOutlineSection[]>(() => {
    if (!editor) return [];

    const sections: Array<{ title: string; level: number; startPos: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        sections.push({
          title: node.textContent.trim() || 'Untitled section',
          level: typeof node.attrs.level === 'number' ? node.attrs.level : 1,
          startPos: pos,
        });
      }
    });

    return sections.map((section, index) => ({
      id: `${section.startPos}-${section.title}`,
      title: section.title,
      level: section.level,
      startPos: section.startPos,
      endPos: index + 1 < sections.length ? sections[index + 1].startPos : editor.state.doc.content.size,
    }));
  }, [editor, debouncedContentVersion]);
  const documentWordCount = useMemo(() => {
    if (!editor) return 0;

    const text = editor.getText().trim();
    return text ? text.split(/\s+/).length : 0;
  }, [editor, debouncedContentVersion]);
  const documentReadMinutes = useMemo(
    () => (documentWordCount > 0 ? Math.max(1, Math.round(documentWordCount / 220)) : 0),
    [documentWordCount],
  );
  // Selection word/char count — updates on each editor transaction
  const [selectionStats, setSelectionStats] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 });
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to } = editor.state.selection;
      if (from === to) { setSelectionStats({ words: 0, chars: 0 }); return; }
      const text = editor.state.doc.textBetween(from, to, '\n').trim();
      setSelectionStats({
        words: text ? text.split(/\s+/).length : 0,
        chars: text.length,
      });
    };
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
    };
  }, [editor]);
  const clauseConflicts = useMemo<string[]>(() => {
    if (!editor) return [];
    const text = editor.getText().toLowerCase();
    if (!text || text.length < 200) return [];
    const conflicts: string[] = [];
    // Termination-for-convenience vs only-for-cause
    const hasForConvenience = /terminat\w*\s+(?:this agreement\s+)?for\s+convenience/i.test(text);
    const hasOnlyForCause = /terminat\w*\s+only\s+for\s+cause|solely\s+for\s+cause/i.test(text);
    if (hasForConvenience && hasOnlyForCause) {
      conflicts.push('Termination: "for convenience" conflicts with "only for cause"');
    }
    // Governing law duplication
    const govMatches = text.match(/governed by the laws of ([^.,;]+)/gi) || [];
    if (govMatches.length >= 2) {
      const normalized = Array.from(new Set(govMatches.map((m) => m.trim().toLowerCase())));
      if (normalized.length > 1) {
        conflicts.push('Governing law: multiple jurisdictions referenced');
      }
    }
    // Auto-renewal vs no-renewal
    const hasAutoRenew = /auto(?:matic)?\s*(?:ally)?\s*renew/i.test(text);
    const hasNoRenew = /shall not (?:auto(?:matically)?\s*)?renew|no\s+automatic\s+renewal/i.test(text);
    if (hasAutoRenew && hasNoRenew) {
      conflicts.push('Renewal: auto-renewal conflicts with no-renewal clause');
    }
    // Exclusivity vs non-exclusivity
    const hasExclusive = /\bexclusive\s+(?:rights?|license|agreement)\b/i.test(text);
    const hasNonExclusive = /\bnon[- ]exclusive\b/i.test(text);
    if (hasExclusive && hasNonExclusive) {
      conflicts.push('Exclusivity: exclusive vs. non-exclusive language both present');
    }
    return conflicts;
  }, [editor, debouncedContentVersion]);
  const [dismissedConflictBanner, setDismissedConflictBanner] = useState(false);
  useEffect(() => {
    if (clauseConflicts.length > 0) setDismissedConflictBanner(false);
  }, [clauseConflicts.length]);

  // Per-draft "reviewed" set for clause conflicts (persisted to localStorage).
  const conflictReviewKey = useMemo(
    () => (draftId ? `contigo.draft.${draftId}.reviewedConflicts` : null),
    [draftId],
  );
  const [reviewedConflicts, setReviewedConflicts] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!conflictReviewKey) return;
    try {
      const raw = window.localStorage.getItem(conflictReviewKey);
      if (raw) setReviewedConflicts(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [conflictReviewKey]);
  const toggleConflictReviewed = useCallback((conflict: string) => {
    setReviewedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(conflict)) next.delete(conflict); else next.add(conflict);
      if (conflictReviewKey) {
        try { window.localStorage.setItem(conflictReviewKey, JSON.stringify([...next])); } catch { /* ignore */ }
      }
      return next;
    });
  }, [conflictReviewKey]);
  const unreviewedConflicts = useMemo(
    () => clauseConflicts.filter((c) => !reviewedConflicts.has(c)),
    [clauseConflicts, reviewedConflicts],
  );

  // Transient next-action pill (dismissible per-session), derived from live state.
  const [dismissedNextAction, setDismissedNextAction] = useState<string | null>(null);

  // Negotiation rationale cache — "why did we accept this wording?" keyed by selected-text hash,
  // persisted per-draft to localStorage so it survives reloads and handoffs.
  const rationaleStorageKey = useMemo(
    () => (draftId ? `contigo.draft.${draftId}.rationales` : null),
    [draftId],
  );
  const [rationales, setRationales] = useState<Array<{ id: string; quote: string; note: string; at: number }>>([]);
  useEffect(() => {
    if (!rationaleStorageKey) return;
    try {
      const raw = window.localStorage.getItem(rationaleStorageKey);
      if (raw) setRationales(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [rationaleStorageKey]);
  const persistRationales = useCallback((next: Array<{ id: string; quote: string; note: string; at: number }>) => {
    setRationales(next);
    if (rationaleStorageKey) {
      try { window.localStorage.setItem(rationaleStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }, [rationaleStorageKey]);
  const [showRationaleComposer, setShowRationaleComposer] = useState(false);
  const [rationaleDraft, setRationaleDraft] = useState('');
  const [showRationalePanel, setShowRationalePanel] = useState(false);
  const contractTypeKey = useMemo(
    () => contractType?.toUpperCase() || 'DEFAULT',
    [contractType],
  );
  const draftingBlueprint = useMemo(
    () => DRAFTING_BLUEPRINTS[contractTypeKey] || DRAFTING_BLUEPRINTS.DEFAULT,
    [contractTypeKey],
  );
  const blueprintProgress = useMemo(() => {
    const normalizedOutlineTitles = outlineSections.map((section) => normalizeDraftHeading(section.title));
    const completionState = draftingBlueprint.map((step) =>
      normalizedOutlineTitles.some((title) => matchesDraftKeywords(title, step.keywords))
    );
    const firstMissingIndex = completionState.findIndex((isComplete) => !isComplete);

    return draftingBlueprint.map((step, index) => ({
      ...step,
      completed: completionState[index],
      state: completionState[index]
        ? 'complete'
        : firstMissingIndex === index
          ? 'next'
          : 'missing',
    }));
  }, [draftingBlueprint, outlineSections]);
  const completedBlueprintCount = useMemo(
    () => blueprintProgress.filter((step) => step.completed).length,
    [blueprintProgress],
  );
  const missingBlueprintSteps = useMemo(
    () => blueprintProgress.filter((step) => !step.completed),
    [blueprintProgress],
  );
  const nextBlueprintStep = useMemo(
    () => missingBlueprintSteps[0] || null,
    [missingBlueprintSteps],
  );
  // Compute the single highest-priority next action to nudge the user toward.
  // Ordering: blocking issues (conflicts, high-risk) → structural gaps → polish.
  const nextActionPill = useMemo(() => {
    if (draftStatus === 'FINALIZED') return null;
    if (documentWordCount < 20) return null; // let the empty-state overlay handle it
    if (unreviewedConflicts.length > 0) {
      return {
        id: `conflict:${unreviewedConflicts[0]}`,
        tone: 'rose' as const,
        icon: 'alert' as const,
        label: unreviewedConflicts.length === 1 ? 'Clause conflict detected' : `${unreviewedConflicts.length} clause conflicts detected`,
        hint: 'Resolving these before review prevents rework.',
        cta: 'Resolve with AI',
        prompt: `Review this draft and propose concrete wording fixes for the following conflict${unreviewedConflicts.length > 1 ? 's' : ''}:\n\n${unreviewedConflicts.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
      };
    }
    if (priorityRiskCount > 0) {
      return {
        id: `risk:${priorityRiskCount}`,
        tone: 'amber' as const,
        icon: 'shield' as const,
        label: `${priorityRiskCount} high-priority risk${priorityRiskCount === 1 ? '' : 's'} to address`,
        hint: 'Fix these before approval to avoid reviewer back-and-forth.',
        cta: 'Draft fixes',
        prompt: `This ${contractTypeKey.toLowerCase()} draft has ${priorityRiskCount} critical/high-severity risk${priorityRiskCount === 1 ? '' : 's'}. Quote each flagged clause verbatim and propose redline wording that neutralises the risk while preserving commercial intent.`,
      };
    }
    if (unresolvedCommentsCount > 0) {
      return {
        id: `comments:${unresolvedCommentsCount}`,
        tone: 'blue' as const,
        icon: 'chat' as const,
        label: `${unresolvedCommentsCount} open reviewer comment${unresolvedCommentsCount === 1 ? '' : 's'}`,
        hint: 'Group into must-fix, optional, and follow-ups.',
        cta: 'Organize with AI',
        prompt: `Create a revision plan for the open reviewer comments in this ${contractTypeKey.toLowerCase()} draft. Group the work into must-fix items, optional changes, and follow-up questions.`,
      };
    }
    if (missingBlueprintSteps.length > 0 && nextBlueprintStep) {
      return {
        id: `blueprint:${nextBlueprintStep.title}`,
        tone: 'violet' as const,
        icon: 'sparkle' as const,
        label: `Missing: ${nextBlueprintStep.title}`,
        hint: 'Add the next core section to keep the structure complete.',
        cta: 'Draft section',
        prompt: `Draft the "${nextBlueprintStep.title}" section for this ${contractTypeKey.toLowerCase()}. Match the tone, numbering, and cross-references already established in the document.`,
      };
    }
    if (documentWordCount > 400) {
      return {
        id: 'polish:readiness',
        tone: 'emerald' as const,
        icon: 'sparkle' as const,
        label: 'Structure looks complete',
        hint: 'Run a final AI readiness check before sending to review.',
        cta: 'Run readiness check',
        prompt: `Run a final AI readiness check on this ${contractTypeKey.toLowerCase()} draft. Check legal gaps, commercial consistency, defined-term usage, cross-reference integrity, and negotiation leverage. Return a prioritized checklist.`,
      };
    }
    return null;
  }, [draftStatus, documentWordCount, unreviewedConflicts, priorityRiskCount, unresolvedCommentsCount, missingBlueprintSteps.length, nextBlueprintStep, contractTypeKey]);
  const visibleNextActionPill = nextActionPill && dismissedNextAction !== nextActionPill.id ? nextActionPill : null;
  const draftingJourneyStatus = useMemo(() => {
    if (documentWordCount < 80 && outlineSections.length === 0) {
      return {
        title: 'Kick off the first draft',
        description: `Use AI to scaffold the core sections of this ${contractTypeKey} before refining clause language.`,
      };
    }

    if (missingBlueprintSteps.length > 0) {
      return {
        title: `${completedBlueprintCount} of ${draftingBlueprint.length} core sections are in place`,
        description: nextBlueprintStep
          ? `${nextBlueprintStep.title} is the clearest next section to add before deeper review.`
          : 'Keep closing the structural gaps before final review.',
      };
    }

    if (priorityRiskCount > 0 || unresolvedCommentsCount > 0) {
      return {
        title: 'Structure is in place — now pressure-test it',
        description: 'Use the assistant to tighten flagged issues and clear reviewer feedback before handoff.',
      };
    }

    return {
      title: 'This draft is ready for a final AI readiness check',
      description: 'The next high-leverage move is to run a final review for legal, commercial, and negotiation gaps.',
    };
  }, [
    completedBlueprintCount,
    contractTypeKey,
    documentWordCount,
    draftingBlueprint.length,
    missingBlueprintSteps.length,
    nextBlueprintStep,
    outlineSections.length,
    priorityRiskCount,
    unresolvedCommentsCount,
  ]);
  const assistantJourneyActions = useMemo<AssistantJourneyAction[]>(() => {
    const actions: AssistantJourneyAction[] = [];
    const selectedClauseText = selectionToolbar?.text?.trim() || '';
    const workflowNotesContext = workflowContext?.notes?.trim()
      ? `\n\nWorkflow notes to respect:\n${workflowContext.notes.trim()}`
      : '';

    if (workflowContext?.kind === 'renewal') {
      actions.push({
        id: 'renewal-alignment-review',
        title: 'Pressure-test renewal deltas',
        description: 'Check whether dates, commercial changes, and carry-forward terms line up cleanly with the source contract.',
        badge: 'Renewal',
        emphasis: 'violet',
        mode: 'prompt',
        prompt: `Review this renewal draft against its source contract context. Focus on renewal dates, pricing changes, notice mechanics, clauses that should be preserved, and clauses that need explicit updates. Return the top fixes with contract-ready language.${workflowNotesContext}`,
      });
    }

    if (documentWordCount < 80 && outlineSections.length === 0) {
      actions.push({
        id: 'scaffold-first-pass',
        title: 'Build a first-pass draft',
        description: `Generate a realistic ${contractTypeKey} skeleton with headings, placeholders, and starter language.`,
        badge: 'Launch',
        emphasis: 'violet',
        mode: 'prompt',
        prompt: `Create a first-pass ${contractTypeKey} agreement structure with short contract-ready starter language for ${draftingBlueprint
          .slice(0, Math.min(4, draftingBlueprint.length))
          .map((step) => step.title.toLowerCase())
          .join(', ')}. Use clear headings, explicit placeholders, and commercially realistic wording.`,
      });
    }

    if (nextBlueprintStep) {
      actions.push({
        id: `draft-${nextBlueprintStep.id}`,
        title: `Draft ${nextBlueprintStep.title}`,
        description: nextBlueprintStep.description,
        badge: 'Next section',
        emphasis: 'emerald',
        mode: 'prompt',
        prompt: `Draft a ${nextBlueprintStep.title.toLowerCase()} section for this ${contractTypeKey} agreement. Use the current draft for context, write contract-ready language, and leave explicit placeholders where facts are missing.`,
      });

      if (nextBlueprintStep.blockId && availableStructureBlockIds.has(nextBlueprintStep.blockId)) {
        actions.push({
          id: `insert-${nextBlueprintStep.id}`,
          title: `Insert ${nextBlueprintStep.title} scaffold`,
          description: 'Drop in a structure block now, then refine it with AI or manual edits.',
          badge: 'Structure',
          emphasis: 'slate',
          mode: 'block',
          blockId: nextBlueprintStep.blockId,
        });
      }
    }

    if (selectedClauseText) {
      actions.push({
        id: workspaceMode === 'negotiate' ? 'selection-pushback' : 'selection-review',
        title: workspaceMode === 'negotiate' ? 'Pressure-test the selected clause' : 'Improve the selected clause',
        description: workspaceMode === 'negotiate'
          ? 'Ask AI to anticipate pushback and offer fallback language against the current selection.'
          : 'Ask AI to tighten the selected language and make it more contract-ready.',
        badge: 'Selection',
        emphasis: 'violet',
        mode: 'prompt',
        prompt: workspaceMode === 'negotiate'
          ? `Review this selected ${contractTypeKey} clause for negotiation leverage, likely counterparty pushback, and fallback positions. Then draft a stronger alternative:\n\n${selectedClauseText}`
          : `Review this selected ${contractTypeKey} clause for ambiguity, legal risk, and drafting quality. Then draft a clearer, tighter alternative:\n\n${selectedClauseText}`,
      });
    }

    if (priorityRiskCount > 0) {
      actions.push({
        id: 'redline-plan',
        title: 'Create a redline plan for flagged issues',
        description: `Prioritize the ${priorityRiskCount} high-severity issue${priorityRiskCount === 1 ? '' : 's'} and propose fixes.`,
        badge: 'Risk',
        emphasis: 'amber',
        mode: 'prompt',
        prompt: `Summarize the top flagged risks in this ${contractTypeKey} draft and give me a redline plan in priority order with proposed clause fixes.`,
      });
    }

    if (unresolvedCommentsCount > 0) {
      actions.push({
        id: 'resolve-comments',
        title: 'Turn reviewer comments into a revision plan',
        description: `Use AI to organize ${unresolvedCommentsCount} open comment${unresolvedCommentsCount === 1 ? '' : 's'} into concrete drafting work.`,
        badge: 'Review',
        emphasis: 'violet',
        mode: 'prompt',
        prompt: `Create a revision plan for the open reviewer comments in this ${contractTypeKey} draft. Group the work into must-fix items, optional changes, and follow-up questions.`,
      });
    }

    if (actions.length < 3 && missingBlueprintSteps.length === 0 && priorityRiskCount === 0) {
      actions.push({
        id: 'final-readiness-check',
        title: 'Run a final readiness check',
        description: 'Ask AI for a final legal, commercial, and negotiation checklist before handoff.',
        badge: 'Final pass',
        emphasis: 'emerald',
        mode: 'prompt',
        prompt: `Assess whether this ${contractTypeKey} draft is ready for legal review. Identify any missing clauses, ambiguities, operational questions, or negotiation gaps and return a final checklist.`,
      });
    }

    return actions.slice(0, 4);
  }, [
    availableStructureBlockIds,
    contractTypeKey,
    documentWordCount,
    draftingBlueprint,
    missingBlueprintSteps.length,
    nextBlueprintStep,
    outlineSections.length,
    priorityRiskCount,
    selectionToolbar?.text,
    unresolvedCommentsCount,
    workflowContext,
    workspaceMode,
  ]);
  const documentCanvasSummary = useMemo(
    () => {
      if (isRenewalWorkflow) {
        return isEditing
          ? 'This renewal draft came from the renewal workflow. Use the studio for clause rewrites, negotiation-ready alternatives, and final drafting polish. The draft title still saves separately from the body.'
          : 'This renewal draft stays connected to its workflow context while you review, export, and finalize it.';
      }

      if (isAmendmentWorkflow) {
        return isEditing
          ? 'This amendment draft is in the shared studio so you can rewrite change language with full AI support. The draft title still saves separately from the body.'
          : 'This amendment draft stays connected to its source context while you review, export, and finalize it.';
      }

      return isEditing
        ? 'Rename this draft here. The contract body begins below and saves separately from the draft title.'
        : 'The draft title is saved separately from the contract body and is used for review, export, and finalization.';
    },
    [isAmendmentWorkflow, isEditing, isRenewalWorkflow],
  );
  const heatmapMarkers = useMemo<HeatmapMarker[]>(() => {
    if (!editor) return [];

    const docSize = Math.max(editor.state.doc.content.size, 1);
    const markers: HeatmapMarker[] = [];

    for (const risk of risks.slice(0, 24)) {
      const from = typeof risk.position.startOffset === 'number' ? risk.position.startOffset : null;
      if (!from || from < 1) continue;

      markers.push({
        id: `risk-${risk.id}`,
        type: 'risk',
        topPercent: Math.max(3, Math.min(97, (from / docSize) * 100)),
        from,
        to: typeof risk.position.endOffset === 'number' ? risk.position.endOffset : undefined,
        label: risk.category || 'Risk',
        detail: risk.explanation || risk.text,
        tone: risk.riskLevel,
      });
    }

    for (const comment of comments.filter((entry) => !entry.resolved)) {
      const anchorFrom = typeof comment.anchorPos?.['from'] === 'number' ? comment.anchorPos['from'] : null;
      const anchorTo = typeof comment.anchorPos?.['to'] === 'number' ? comment.anchorPos['to'] : undefined;
      if (!anchorFrom || anchorFrom < 1) continue;

      markers.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        topPercent: Math.max(3, Math.min(97, (anchorFrom / docSize) * 100)),
        from: anchorFrom,
        to: anchorTo,
        label: 'Open comment',
        detail: comment.content,
        tone: 'comment',
      });
    }

    return markers.sort((left, right) => left.topPercent - right.topPercent);
  }, [comments, editor, risks]);
  const latestInlineAiProposal = useMemo(
    () => [...aiChatMessages].reverse().find(
      (message) => message.role === 'assistant'
        && message.applyMode === 'replace_selection'
        && typeof message.draftHtml === 'string'
        && typeof message.comparisonText === 'string'
        && message.comparisonText.trim().length > 0,
    ) || null,
    [aiChatMessages],
  );

  const getSuggestionIcon = (type: CopilotSuggestion['type']) => {
    switch (type) {
      case 'risk_warning': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'compliance': return <Shield className="h-4 w-4 text-violet-500" />;
      case 'clause_improvement': return <Sparkles className="h-4 w-4 text-violet-500" />;
      case 'auto_complete': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'negotiation': return <Scale className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    switch (getConfidenceTone(confidence)) {
      case 'high':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'low':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const getSuggestionSourceLabel = (sourceType: CopilotSuggestion['source']['type']) => {
    switch (sourceType) {
      case 'clause_library':
        return 'Clause library';
      case 'historical':
        return 'Past language';
      case 'playbook':
        return 'Policy pack';
      default:
        return 'AI suggestion';
    }
  };

  const applyAiChatDraft = useCallback((message: AiChatMessage) => {
    if (!editor || !message.draftHtml) return;

    const sanitized = normalizeAiHtml(message.draftHtml);
    const { from, to } = editor.state.selection;
    const shouldReplace = message.applyMode === 'replace_selection' && from !== to;

    if (shouldReplace) {
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, sanitized).run();
    } else {
      editor.chain().focus().insertContent(sanitized).run();
    }

    recordSourceTrail({
      label: message.title || 'AI drafting proposal',
      sourceLabel: workspaceMode === 'negotiate' ? 'AI negotiation assistant' : 'AI assistant',
      action: shouldReplace ? 'replaced' : 'inserted',
      detail: message.applyMode === 'replace_selection' ? 'Targeted rewrite' : 'Draft insertion',
      sourceKind: workspaceMode === 'negotiate' ? 'ai-negotiation' : 'ai-assistant',
    });

    toast.success(shouldReplace ? 'AI rewrite applied' : 'AI draft inserted');
    markDraftApplied(message.id);
  }, [editor, recordSourceTrail, workspaceMode, markDraftApplied]);

  const copyAiChatContent = useCallback(async (message: AiChatMessage) => {
    const text = message.draftHtml ? stripHtml(message.draftHtml) : message.content;
    if (!text) return;

    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  const stopAiChat = useCallback(() => {
    aiChatAbortRef.current?.abort();
    setIsAiChatStreaming(false);
  }, []);

  // ============================================================================
  // AI CHAT IN SIDEBAR
  // ============================================================================

  const sendAiChatMessage = useCallback(async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    // Hard guard: `isAiChatStreaming` is state and can be stale in captured
    // closures (e.g. a suggestion pill rendered with an older callback). The
    // abort-ref is authoritative — if a controller is attached, a stream is
    // already in-flight and we must refuse the new request so we don't
    // overwrite the in-flight controller and interleave SSE chunks from two
    // concurrent requests into the same assistant bubble.
    if (isAiChatStreaming || aiChatAbortRef.current) {
      toast('Finishing the current reply first — try again in a moment.', { duration: 2500 });
      return;
    }

    const selectedText = editor?.state?.selection
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : '';

    const assistantMessageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `assistant-${Date.now()}`;
    const userMessageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}`;

    const userMsg: AiChatMessage = {
      id: userMessageId,
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    };
    const assistantMsg: AiChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      comparisonText: selectedText || undefined,
    };

    setAiChatMessages(prev => [...prev, userMsg, assistantMsg]);
    setAiChatInput('');
    setIsAiChatStreaming(true);

    try {
      const controller = new AbortController();
      aiChatAbortRef.current = controller;

      // Extract document headings for structural context
      const headings: string[] = [];
      editor?.state?.doc?.descendants?.((node) => {
        if (node.type.name === 'heading' && node.textContent) {
          headings.push(node.textContent);
        }
      });

      const conversationHistory = [...aiChatMessagesRef.current, userMsg].map((chatMessage) => ({
        role: chatMessage.role,
        content: [
          chatMessage.content,
          chatMessage.draftHtml ? `Suggested draft:\n${stripHtml(chatMessage.draftHtml)}` : '',
        ].filter(Boolean).join('\n\n'),
      }));

      const response = await fetch('/api/ai/agents/draft-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          message: trimmedMessage,
          conversationHistory,
          context: {
            contractType,
            currentContent: editor?.getText()?.slice(0, 12000) || '',
            selectedText: selectedText || undefined,
            documentSections: headings.length > 0 ? headings : undefined,
            playbookId,
          },
          action: 'editor_assist',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line (\n\n). Splitting on a
        // single \n loses the frame boundary and mis-parses any future
        // multi-line data: payload. Split on \n\n, keep the trailing
        // incomplete frame in the buffer.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          if (!frame.trim()) continue;
          // A single frame may contain multiple data: lines that should
          // be joined with newlines per the SSE spec.
          const dataLines = frame
            .split('\n')
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6));
          if (dataLines.length === 0) continue;
          const payload = dataLines.join('\n');
          {
            try {
              const parsed = JSON.parse(payload);

              if ('draftHtml' in parsed || 'applyMode' in parsed || 'title' in parsed || 'followUpQuestion' in parsed) {
                setAiChatMessages(prev => {
                  return prev.map((chatMessage) =>
                    chatMessage.id === assistantMessageId
                      ? {
                          ...chatMessage,
                          content: typeof parsed.content === 'string' ? parsed.content : chatMessage.content,
                          title: typeof parsed.title === 'string' ? parsed.title : chatMessage.title,
                          draftHtml: typeof parsed.draftHtml === 'string' ? parsed.draftHtml : chatMessage.draftHtml,
                          applyMode:
                            parsed.applyMode === 'replace_selection' || parsed.applyMode === 'insert_at_cursor' || parsed.applyMode === 'none'
                              ? parsed.applyMode
                              : chatMessage.applyMode,
                          followUpQuestion:
                            typeof parsed.followUpQuestion === 'string' && parsed.followUpQuestion.trim()
                              ? parsed.followUpQuestion
                              : chatMessage.followUpQuestion,
                          operation:
                            typeof parsed.operation === 'string' &&
                            ['add_clause','replace_clause','remove_clause','rewrite','fill_variables','tighten_risk','other'].includes(parsed.operation)
                              ? (parsed.operation as AiChatMessage['operation'])
                              : chatMessage.operation,
                          detectedCategory:
                            typeof parsed.detectedCategory === 'string' && parsed.detectedCategory.trim()
                              ? parsed.detectedCategory
                              : (parsed.detectedCategory === null ? null : chatMessage.detectedCategory),
                          detectedParameters:
                            parsed.detectedParameters && typeof parsed.detectedParameters === 'object' && !Array.isArray(parsed.detectedParameters)
                              ? Object.fromEntries(
                                  Object.entries(parsed.detectedParameters as Record<string, unknown>)
                                    .filter(([, v]) => typeof v === 'string' && (v as string).trim())
                                    .map(([k, v]) => [k, (v as string).trim()])
                                )
                              : chatMessage.detectedParameters,
                          playbookApplied:
                            parsed.playbookApplied && typeof parsed.playbookApplied === 'object' && typeof (parsed.playbookApplied as Record<string, unknown>).id === 'string'
                              ? {
                                  id: String((parsed.playbookApplied as Record<string, unknown>).id),
                                  name: typeof (parsed.playbookApplied as Record<string, unknown>).name === 'string'
                                    ? String((parsed.playbookApplied as Record<string, unknown>).name)
                                    : 'Playbook',
                                }
                              : (parsed.playbookApplied === null ? null : chatMessage.playbookApplied),
                          isStreaming: false,
                        }
                      : chatMessage
                  );
                });
                continue;
              }

              if ('suggestions' in parsed && Array.isArray(parsed.suggestions)) {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? {
                        ...chatMessage,
                        suggestions: parsed.suggestions.filter(
                          (suggestion: { label?: unknown; value?: unknown }) =>
                            typeof suggestion?.label === 'string' && typeof suggestion?.value === 'string'
                        ) as ChatQuickReply[],
                      }
                    : chatMessage
                ));
                continue;
              }

              if ('content' in parsed && 'role' in parsed && typeof parsed.content === 'string') {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? { ...chatMessage, content: chatMessage.content + parsed.content }
                    : chatMessage
                ));
                continue;
              }

              if ('error' in parsed && typeof parsed.error === 'string') {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? { ...chatMessage, content: parsed.error, isStreaming: false }
                    : chatMessage
                ));
                continue;
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setAiChatMessages(prev => prev.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? { ...chatMessage, isStreaming: false, content: chatMessage.content || 'Request cancelled.' }
            : chatMessage
        ));
        return;
      }

      toast.error('AI chat error. Please try again.');
      setAiChatMessages(prev => prev.map((chatMessage) =>
        chatMessage.id === assistantMessageId
          ? {
              ...chatMessage,
              content: chatMessage.content || 'Sorry, I encountered an error. Please try again.',
              isStreaming: false,
            }
          : chatMessage
      ));
    } finally {
      setIsAiChatStreaming(false);
      setAiChatMessages(prev => prev.map((chatMessage) =>
        chatMessage.id === assistantMessageId
          ? { ...chatMessage, isStreaming: false }
          : chatMessage
      ));
      aiChatAbortRef.current = null;
    }
  }, [isAiChatStreaming, editor, contractType, playbookId]);

  const handleNegotiationAssistantAction = useCallback((mode: 'buyer' | 'balanced' | 'pushback' | 'fallback') => {
    const selectedText = selectionToolbar?.text?.trim();
    if (selectionToolbar && editor) {
      editor.chain().focus().setTextSelection({ from: selectionToolbar.from, to: selectionToolbar.to }).run();
    }

    setActiveTab('assistant');
    setShowDesktopSidebar(true);

    const target = selectedText
      ? `this selected clause:\n\n${selectedText}`
      : `the current ${contractType} draft`;

    const prompt = mode === 'buyer'
      ? `Rewrite ${target} into a stronger buyer-friendly position while staying commercially credible.`
      : mode === 'balanced'
        ? `Rewrite ${target} into a more balanced negotiation position that both parties could plausibly accept.`
        : mode === 'pushback'
          ? `For ${target}, anticipate the most likely counterparty pushback and list the pressure points they will attack first.`
          : `Create a fallback position for ${target}. Give me a preferred clause, a fallback clause, and a walk-away issue.`;

    sendAiChatMessage(prompt);
  }, [contractType, editor, selectionToolbar, sendAiChatMessage, setActiveTab]);

  const handleSelectionAssistantAction = useCallback((prompt: string) => {
    if (!selectionToolbar || !editor) return;

    editor.chain().focus().setTextSelection({ from: selectionToolbar.from, to: selectionToolbar.to }).run();
    setActiveTab('assistant');
    setShowDesktopSidebar(true);
    sendAiChatMessage(prompt);
  }, [editor, selectionToolbar, sendAiChatMessage, setActiveTab]);

  const handleApplySlashCommand = useCallback((command: SlashCommandConfig) => {
    if (!editor) return;

    const range = slashCommandRangeRef.current;
    if (range) {
      editor.chain().focus().deleteRange(range).run();
    }

    if (command.kind === 'block' && command.blockId) {
      const block = findStructureBlock(command.blockId);
      if (!block) {
        toast.error('That block is not available for this draft type');
        return;
      }
      handleInsertStructureBlock(block, range?.from);
    }

    if (command.kind === 'ai' && command.prompt) {
      setActiveTab('assistant');
      setShowDesktopSidebar(true);
      sendAiChatMessage(command.prompt);
    }

    slashCommandRangeRef.current = null;
    setShowSlashMenu(false);
    setSlashQuery('');
  }, [editor, findStructureBlock, handleInsertStructureBlock, sendAiChatMessage, setActiveTab]);

  applySlashCommandRef.current = handleApplySlashCommand;

  const handleAssistantJourneyAction = useCallback((action: AssistantJourneyAction) => {
    if (action.mode === 'block' && action.blockId) {
      const block = findStructureBlock(action.blockId);
      if (!block) {
        toast.error('That structure block is not available for this draft type');
        return;
      }

      handleInsertStructureBlock(block);
      return;
    }

    if (action.mode === 'prompt' && action.prompt) {
      setActiveTab('assistant');
      setShowDesktopSidebar(true);
      sendAiChatMessage(action.prompt);
    }
  }, [findStructureBlock, handleInsertStructureBlock, sendAiChatMessage, setActiveTab]);

  const sidebarPanelClass = 'h-full space-y-5 overflow-y-auto pr-1 pb-1';
  const sidebarSectionClass = 'space-y-3 rounded-[24px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800/95';
  const sidebarEyebrowClass = 'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';
  const sidebarBodyClass = 'text-[13px] leading-6 text-slate-600 dark:text-slate-300';
  const editorEyebrowClass = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500';
  const editorMetaPillClass = 'rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200';
  const editorToolbarGroupClass = 'inline-flex items-center gap-0.5 rounded-[18px] border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/80';
  const editorToolbarButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
  const editorToolbarButtonActiveClass = 'bg-slate-950 text-white shadow-sm hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200';
  const sidebarTabButtonBaseClass = 'flex min-h-[46px] min-w-fit shrink-0 items-center justify-center gap-2 rounded-[18px] border px-4 py-2.5 text-[12px] font-semibold transition-all duration-150 md:min-w-0 md:w-full';
  const draftingButtonBaseClass = 'inline-flex items-center justify-center gap-1.5 rounded-[14px] px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50';
  const draftingPrimaryButtonClass = `${draftingButtonBaseClass} bg-slate-950 text-white shadow-[0_16px_28px_-20px_rgba(15,23,42,0.55)] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200`;
  const draftingSecondaryButtonClass = `${draftingButtonBaseClass} border border-slate-200/90 bg-white/92 text-slate-700 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.45)] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800`;
  const draftingVioletButtonClass = `${draftingButtonBaseClass} bg-violet-600 text-white shadow-[0_16px_28px_-20px_rgba(124,58,237,0.55)] hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400`;
  const draftingEmeraldButtonClass = `${draftingButtonBaseClass} bg-emerald-600 text-white shadow-[0_16px_28px_-20px_rgba(5,150,105,0.55)] hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400`;
  const draftingDangerButtonClass = `${draftingButtonBaseClass} bg-rose-600 text-white shadow-[0_16px_28px_-20px_rgba(225,29,72,0.55)] hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400`;
  const draftingWarningButtonClass = `${draftingButtonBaseClass} border border-amber-200/80 bg-amber-50/90 text-amber-800 shadow-[0_14px_24px_-22px_rgba(180,83,9,0.35)] hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/45`;
  const draftingInlineButtonClass = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
  const draftingChipButtonClass = 'shrink-0 rounded-full border border-slate-200/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700';
  const draftingCardActionBaseClass = 'rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
  const headerActionButtonClass = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800';
  const headerAccentButtonClass = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50 px-3.5 text-[12px] font-semibold text-violet-700 shadow-sm transition-all duration-150 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/55';

  const editorCanvasMaxWidthClass = useMemo(() => {
    if (!showDesktopSidebar) {
      return 'max-w-[70rem] xl:max-w-[78rem]';
    }

    if (desktopSidebarWidth >= 520) {
      return 'max-w-[54rem] xl:max-w-[58rem]';
    }

    if (desktopSidebarWidth >= 460) {
      return 'max-w-[58rem] xl:max-w-[62rem]';
    }

    return 'max-w-[60rem] xl:max-w-[64rem]';
  }, [desktopSidebarWidth, showDesktopSidebar]);

  // ============================================================================
  // SIDEBAR CONTENT (shared between desktop and mobile)
  // ============================================================================

  const renderSidebarContent = () => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200/80 px-4 pt-4 dark:border-slate-700/80">
        <div className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible" role="tablist" aria-label="Sidebar panels">
          {[
            { id: 'assistant', icon: Brain, label: 'Assistant', count: suggestions.length + priorityRiskCount },
            { id: 'review', icon: CheckCircle2, label: 'Review', count: unresolvedCommentsCount + approvalHistory.length + risks.length },
            { id: 'clauses', icon: BookOpen, label: 'Clauses', count: debouncedClauseSearch ? clauses.length : 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`${sidebarTabButtonBaseClass} ${
                activeTab === tab.id
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[0_16px_30px_-22px_rgba(15,23,42,0.65)] dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-gray-200/90 bg-white/88 text-gray-600 hover:border-gray-300 hover:bg-slate-50 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.id
                    ? 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-700'
                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-5 pt-4">
        {activeTab === 'assistant' && (
          <div id="panel-assistant" role="tabpanel" aria-labelledby="tab-assistant" className="flex h-full min-h-0 flex-col">
            {/* Sticky 'Next section' CTA — always visible while on assistant tab */}
            {nextBlueprintStep && (
              <div className="sticky top-0 z-10 mb-3 -mx-1 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-slate-900/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">
                      Next section
                    </p>
                    <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      {nextBlueprintStep.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssistantJourneyAction({
                      id: `draft-${nextBlueprintStep.id}`,
                      title: `Draft ${nextBlueprintStep.title}`,
                      description: nextBlueprintStep.description,
                      badge: 'Next section',
                      emphasis: 'emerald',
                      mode: 'prompt',
                      prompt: `Draft a ${nextBlueprintStep.title.toLowerCase()} section for this ${contractTypeKey} agreement. Use the current draft for context, write contract-ready language, and leave explicit placeholders where facts are missing.`,
                    })}
                    className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    Draft this →
                  </button>
                </div>
              </div>
            )}
            {/* First-run coachmark: discoverability of / and Ctrl+/ */}
            {showShortcutCoachmark && (
              <div className="mb-3 rounded-2xl border border-violet-200/80 bg-violet-50/85 px-4 py-3 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/25">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-violet-600 dark:text-violet-300" />
                  <div className="min-w-0 flex-1 text-[12px] leading-5 text-violet-900 dark:text-violet-200">
                    <p className="font-semibold">Pro tips for faster drafting</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      <li>Type <kbd className="rounded bg-white/70 px-1 font-mono text-[10px] text-violet-800 dark:bg-slate-900/60 dark:text-violet-200">/</kbd> anywhere in the editor to insert blocks or ask AI.</li>
                      <li>Press <kbd className="rounded bg-white/70 px-1 font-mono text-[10px] text-violet-800 dark:bg-slate-900/60 dark:text-violet-200">Ctrl+/</kbd> to jump to the assistant.</li>
                      <li>Press <kbd className="rounded bg-white/70 px-1 font-mono text-[10px] text-violet-800 dark:bg-slate-900/60 dark:text-violet-200">Ctrl+J</kbd> to jump straight into the chat input.</li>
                      <li>Select text, then use the toolbar to Rewrite or Review with AI.</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={dismissShortcutCoachmark}
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300 dark:hover:bg-slate-900/60"
                    aria-label="Dismiss tips"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
            <div ref={aiChatScrollRef} className="flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
              {/* Copilot workspace header — renders ONLY while the thread is empty.
                   Once a conversation starts, the "Understood as" banner on each
                   assistant message + the chat input itself carry the context,
                   so this big header collapses away and the thread gets the
                   vertical room it needs. State-of-the-art chat UX: the tool
                   should fade into the work, not compete with it. */}
              {aiChatMessages.length === 0 && (
              <div className="rounded-[24px] border border-slate-200/90 bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-[linear-gradient(140deg,rgba(30,41,59,0.96),rgba(15,23,42,0.98))]">
                <div className="min-w-0 space-y-2">
                  <p className={sidebarEyebrowClass}>Copilot workspace</p>
                  <p className="text-base font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-100">
                    {workspaceMode === 'negotiate' ? 'Negotiation assistant' : 'Drafting assistant'}
                  </p>
                  <p className={sidebarBodyClass}>
                    {workspaceMode === 'negotiate'
                      ? 'Pressure-test language, prepare fallback positions, and shape a stronger negotiation posture.'
                      : 'Rewrite language, add a clause, or pressure-test the section you are editing.'}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
                  <p className={sidebarEyebrowClass}>Quick starts</p>
                  <div className="mt-2 grid gap-2">
                    {assistantQuickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendAiChatMessage(prompt)}
                        className={`${draftingCardActionBaseClass} border-slate-200/90 bg-white/92 text-[13px] font-semibold leading-5 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              )}

              {/* Shape Assist — continuous, one-click AI support that turns the
                   current draft into a worklist (placeholders, thin sections,
                   undefined terms). Missing blueprint sections are owned by the
                   "Drafting path" card below to avoid duplicate UX. */}
              <DraftShapeAssist
                editor={editor}
                contentVersion={debouncedContentVersion}
                contractTypeKey={contractTypeKey}
                onAskAi={sendAiChatMessage}
              />

              <div className="rounded-[24px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800/95">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className={sidebarEyebrowClass}>Drafting path</p>
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-100">
                        {draftingJourneyStatus.title}
                      </p>
                      <p className={sidebarBodyClass}>{draftingJourneyStatus.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                    {completedBlueprintCount}/{draftingBlueprint.length}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#0ea5e9)] transition-[width] duration-300"
                    style={{ width: `${draftingBlueprint.length > 0 ? (completedBlueprintCount / draftingBlueprint.length) * 100 : 0}%` }}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {blueprintProgress.map((step) => (
                    <div
                      key={step.id}
                      className={`rounded-2xl border px-3.5 py-3 transition-colors ${
                        step.state === 'complete'
                          ? 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                          : step.state === 'next'
                            ? 'border-violet-200/80 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/20'
                            : 'border-slate-200/80 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          step.state === 'complete'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : step.state === 'next'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {step.state === 'complete' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : step.state === 'next' ? (
                            <ArrowRight className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              step.state === 'complete'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : step.state === 'next'
                                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {step.state === 'complete' ? 'In place' : step.state === 'next' ? 'Next move' : 'Missing'}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {assistantJourneyActions.length > 0 && (
                  <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
                    <p className={sidebarEyebrowClass}>Recommended moves</p>
                    <div className="mt-2 grid gap-2">
                      {assistantJourneyActions.map((action) => {
                        const toneClasses = action.emphasis === 'violet'
                          ? 'border-violet-200/80 bg-violet-50/75 hover:bg-violet-100/80 dark:border-violet-900/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/35'
                          : action.emphasis === 'emerald'
                            ? 'border-emerald-200/80 bg-emerald-50/75 hover:bg-emerald-100/80 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35'
                            : action.emphasis === 'amber'
                              ? 'border-amber-200/80 bg-amber-50/80 hover:bg-amber-100/85 dark:border-amber-900/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/35'
                              : 'border-slate-200/80 bg-slate-50/75 hover:bg-slate-100/85 dark:border-slate-700 dark:bg-slate-900/45 dark:hover:bg-slate-900/70';
                        const badgeClasses = action.emphasis === 'violet'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                          : action.emphasis === 'emerald'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : action.emphasis === 'amber'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => handleAssistantJourneyAction(action)}
                            className={`${draftingCardActionBaseClass} ${toneClasses}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}>
                                    {action.badge}
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{action.title}</p>
                                </div>
                                <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                                  {action.description}
                                </p>
                              </div>
                              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {workspaceMode === 'negotiate' && (
                <div className="rounded-[24px] border border-emerald-200/90 bg-[linear-gradient(140deg,rgba(236,253,245,0.94),rgba(255,255,255,0.9))] p-5 shadow-[0_18px_40px_-34px_rgba(5,150,105,0.45)] dark:border-emerald-900/50 dark:bg-[linear-gradient(140deg,rgba(6,78,59,0.18),rgba(15,23,42,0.4))]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/70">Commercial posture</p>
                      <div className="space-y-1.5">
                        <p className="text-base font-semibold tracking-[-0.01em] text-emerald-950 dark:text-emerald-200">Negotiation mode</p>
                        <p className="text-[13px] leading-6 text-emerald-900/80 dark:text-emerald-200/80">
                        {selectionToolbar?.text
                          ? 'The assistant will work against the selected clause and propose stronger, balanced, or fallback positions.'
                          : 'Select a clause to generate buyer-friendly, balanced, or fallback negotiation language.'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
                      {selectionToolbar?.text ? 'Selection-aware' : 'Draft-wide'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleNegotiationAssistantAction('buyer')}
                      className={`${draftingCardActionBaseClass} border-emerald-200/80 bg-white/92 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900/85 dark:text-emerald-200 dark:hover:bg-emerald-900/20`}
                    >
                      Stronger position
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNegotiationAssistantAction('balanced')}
                      className={`${draftingCardActionBaseClass} border-emerald-200/80 bg-white/92 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900/85 dark:text-emerald-200 dark:hover:bg-emerald-900/20`}
                    >
                      Balanced option
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNegotiationAssistantAction('pushback')}
                      className={`${draftingCardActionBaseClass} border-emerald-200/80 bg-white/92 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900/85 dark:text-emerald-200 dark:hover:bg-emerald-900/20`}
                    >
                      Anticipate pushback
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNegotiationAssistantAction('fallback')}
                      className={`${draftingCardActionBaseClass} border-emerald-200/80 bg-white/92 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900/85 dark:text-emerald-200 dark:hover:bg-emerald-900/20`}
                    >
                      Fallback package
                    </button>
                  </div>
                </div>
              )}

              {(suggestions.length > 0 || isLoadingSuggestions) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={sidebarEyebrowClass}>Live guidance</p>
                      <h4 className="mt-1 text-base font-semibold tracking-[-0.01em] text-gray-900 dark:text-slate-100">Suggested next steps</h4>
                      <p className="mt-1 text-[13px] leading-6 text-gray-500 dark:text-slate-400">
                        AI picks up risky or incomplete language as you draft.
                      </p>
                    </div>
                    <button
                      onClick={() => fetchSuggestions()}
                      aria-label="Refresh AI suggestions"
                      className={`${draftingSecondaryButtonClass} rounded-full px-3 py-2 text-[11px]`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  </div>

                  {isLoadingSuggestions && suggestions.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suggestions.slice(0, 4).map((suggestion) => (
                        <motion.div
                          key={suggestion.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={selectedSuggestion === suggestion.id}
                          className={`cursor-pointer rounded-[24px] border p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                            selectedSuggestion === suggestion.id
                              ? 'border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))] shadow-[0_18px_32px_-34px_rgba(15,23,42,0.75)] dark:border-slate-600 dark:bg-slate-800'
                              : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                          onClick={() => previewSuggestion(suggestion)}
                          onKeyDown={(e) => e.key === 'Enter' && previewSuggestion(suggestion)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/70">
                              {getSuggestionIcon(suggestion.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <p className={sidebarEyebrowClass}>{suggestion.category || suggestion.type.replace(/_/g, ' ')}</p>
                                {suggestion.riskLevel && (
                                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${getRiskColor(suggestion.riskLevel)}`}>
                                    {suggestion.riskLevel} risk
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[15px] font-semibold leading-6 tracking-[-0.01em] text-gray-900 dark:text-slate-100">{suggestion.explanation}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                  {getSuggestionSourceLabel(suggestion.source.type)}
                                </span>
                                {formatConfidenceLabel(suggestion.source.confidence || suggestion.confidence) && (
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getConfidenceColor(suggestion.source.confidence || suggestion.confidence)}`}>
                                    {formatConfidenceLabel(suggestion.source.confidence || suggestion.confidence)}
                                  </span>
                                )}
                                {suggestion.category && (
                                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                    {suggestion.category}
                                  </span>
                                )}
                              </div>

                              <AnimatePresence>
                                {selectedSuggestion === suggestion.id && (
                                  <motion.div key="selected-suggestion"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 space-y-2"
                                  >
                                    <div
                                      draggable
                                      onDragStart={(event) => handleSnippetDragStart(event, {
                                        kind: 'suggestion',
                                        label: suggestion.explanation || 'AI suggestion',
                                        plainText: suggestion.suggestedText,
                                        html: suggestion.suggestedText,
                                        sourceLabel: getSuggestionSourceLabel(suggestion.source.type),
                                        confidence: suggestion.source.confidence || suggestion.confidence,
                                        detail: suggestion.category || suggestion.type,
                                      })}
                                      onDragEnd={handleSnippetDragEnd}
                                      className="cursor-grab rounded-2xl border border-slate-200/80 bg-slate-50/95 p-3.5 text-[13px] leading-6 text-slate-600 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                                    >
                                      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                        <span>Proposed language</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                                          <GripVertical className="h-3 w-3" />
                                          Drag into draft
                                        </span>
                                      </div>
                                      {suggestion.suggestedText.length > 220 ? suggestion.suggestedText.slice(0, 220) + '...' : suggestion.suggestedText}
                                    </div>
                                    {(suggestion.originalText || suggestion.triggerText) && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                            Proposed inline diff
                                          </p>
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              if (suggestion.riskLevel) {
                                                handleFocusRisk({
                                                  id: suggestion.id,
                                                  text: suggestion.originalText || suggestion.triggerText,
                                                  riskLevel: suggestion.riskLevel,
                                                  category: suggestion.category || suggestion.type,
                                                  explanation: suggestion.explanation,
                                                  suggestedFix: suggestion.suggestedText,
                                                  position: suggestion.position,
                                                });
                                              }
                                            }}
                                            className="text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
                                          >
                                            View in context
                                          </button>
                                        </div>
                                        <InlineDiffPreview
                                          before={suggestion.originalText || suggestion.triggerText}
                                          after={suggestion.suggestedText}
                                        />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          applySuggestion(suggestion);
                                        }}
                                        className={`${draftingPrimaryButtonClass} flex-1 text-xs`}
                                      >
                                        Apply
                                      </button>
                                      {suggestions.length > 1 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const idx = suggestions.findIndex(s => s.id === suggestion.id);
                                            const nextSuggestion = suggestions[idx + 1] || suggestions[0];
                                            applySuggestion(suggestion);
                                            if (nextSuggestion && nextSuggestion.id !== suggestion.id) {
                                              // Defer so state update from applySuggestion settles
                                              setTimeout(() => setSelectedSuggestion(nextSuggestion.id), 80);
                                            }
                                          }}
                                          className={`${draftingSecondaryButtonClass} flex-1 text-xs`}
                                          title="Apply this suggestion, then open the next one"
                                        >
                                          Apply &amp; next
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
                                          setSelectedSuggestion(null);
                                        }}
                                        className={`${draftingSecondaryButtonClass} flex-1 text-xs`}
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      {suggestions.length > 4 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Showing the top 4 suggestions. Use refresh after major edits.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(suggestions.length > 0 || riskSummary.critical > 0 || riskSummary.high > 0) && aiChatMessages.length > 0 && (
                <div className="border-t border-gray-200 dark:border-slate-700 pt-2" />
              )}

              {aiChatMessages.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-5 py-7 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <MessageSquare className="mx-auto mb-3 h-7 w-7 opacity-50" />
                  <p className={sidebarEyebrowClass}>Assistant thread</p>
                  <p className="mt-2 text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">No active thread yet</p>
                  <p className="mt-2 text-[13px] leading-6 text-gray-400 dark:text-slate-500">
                    Ask for a rewrite, a new clause, or a quick review of the selected text.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-0.5">
                    <p className={sidebarEyebrowClass}>
                      Thread · {aiChatMessages.length} {aiChatMessages.length === 1 ? 'message' : 'messages'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (aiChatMessages.some(m => m.isStreaming)) return;
                        setAiChatMessages([]);
                      }}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      title="Start a fresh conversation (saved history will be discarded)"
                      aria-label="Clear chat thread"
                    >
                      Clear
                    </button>
                  </div>
                  {aiChatMessages.map((msg, idx) => {
                  // Look up the original user ask so a "Not what I meant?" click can
                  // prefill the input with a rephrase scaffold (proves the AI heard you,
                  // lets you correct it without retyping the whole request).
                  const prevMsg = idx > 0 ? aiChatMessages[idx - 1] : null;
                  const originalAsk = prevMsg?.role === 'user' ? prevMsg.content : '';
                  const operationLabel =
                    msg.operation === 'add_clause' ? 'Add clause' :
                    msg.operation === 'replace_clause' ? 'Replace clause' :
                    msg.operation === 'remove_clause' ? 'Remove clause' :
                    msg.operation === 'rewrite' ? 'Rewrite' :
                    msg.operation === 'fill_variables' ? 'Fill values' :
                    msg.operation === 'tighten_risk' ? 'Tighten risk' : '';
                  const hasUnderstanding = Boolean(
                    msg.role === 'assistant' &&
                    (operationLabel || msg.detectedCategory || msg.title ||
                     msg.playbookApplied ||
                     (msg.detectedParameters && Object.keys(msg.detectedParameters).length > 0))
                  );
                  return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="w-full">
                      {msg.role === 'user' ? (
                        <div className="ml-auto max-w-[92%] rounded-[22px] rounded-tr-md bg-[linear-gradient(135deg,#6d28d9,#7c3aed)] px-4 py-3 text-sm leading-6 text-white shadow-sm">
                          {renderSimpleMarkdown(msg.content)}
                        </div>
                      ) : (
                        <div className="rounded-[24px] rounded-tl-md border border-gray-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-violet-700 dark:bg-slate-700/70 dark:text-violet-300">
                              <Brain className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              {/* "Understood as" banner — renders as soon as the AI's
                                  classification arrives over SSE, so the user sees
                                  what was heard BEFORE the full answer is ready. */}
                              {hasUnderstanding && (
                                <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white/90 px-3 py-2.5 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-slate-900/60">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/80 dark:text-violet-300/80">
                                        Understood as
                                      </p>
                                      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                                        {operationLabel && msg.detectedCategory
                                          ? `${operationLabel} · ${msg.detectedCategory.replace(/_/g, ' ')}`
                                          : operationLabel || (msg.detectedCategory ? msg.detectedCategory.replace(/_/g, ' ') : (msg.title || 'Interpreting your request…'))}
                                      </p>
                                      {msg.detectedParameters && Object.keys(msg.detectedParameters).length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {Object.entries(msg.detectedParameters).slice(0, 5).map(([k, v]) => (
                                            <span
                                              key={k}
                                              className="inline-flex items-center gap-1 rounded-full border border-violet-200/70 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:border-violet-800/60 dark:bg-slate-900/80 dark:text-violet-200"
                                              title={`${k}: ${v}`}
                                            >
                                              <span className="opacity-70">{k}:</span>
                                              <span className="font-semibold">{v.length > 28 ? `${v.slice(0, 28)}…` : v}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {msg.playbookApplied && (
                                        <div className="mt-1.5">
                                          <span
                                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                                            title={`Playbook applied: ${msg.playbookApplied.name}`}
                                          >
                                            Playbook · {msg.playbookApplied.name}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {originalAsk && !msg.isStreaming && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          focusChatInput('That wasn’t quite what I meant. What I actually want is: ')
                                        }
                                        className="shrink-0 rounded-full border border-violet-200/80 bg-white/90 px-2 py-1 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-violet-800 dark:bg-slate-900/80 dark:text-violet-200 dark:hover:bg-slate-800"
                                        title="Prefill a rephrase so you can correct the AI without retyping your whole ask"
                                      >
                                        Not what I meant?
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className={sidebarEyebrowClass}>{msg.title || 'Assistant response'}</p>
                                {msg.content ? (
                                  <div className="mt-2 text-[13px] leading-6 text-gray-900 dark:text-slate-100">
                                    {renderSimpleMarkdown(msg.content)}
                                  </div>
                                ) : msg.isStreaming ? (
                                  <div className="mt-2 flex items-center gap-2 py-1 text-sm text-gray-500 dark:text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {hasUnderstanding
                                      ? `Drafting${msg.title ? `: ${msg.title}` : operationLabel ? ` a ${operationLabel.toLowerCase()}` : '…'}`
                                      : 'Understanding your request…'}
                                  </div>
                                ) : null}
                              </div>

                              {/* Post-hoc pills row removed — the "Understood as"
                                  banner at the top of the assistant bubble now
                                  shows the same operation / category / params,
                                  so rendering them here again was duplicate UX. */}

                              {msg.followUpQuestion && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-[13px] leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                  <span className="font-semibold">Need one detail:</span> {msg.followUpQuestion}
                                </div>
                              )}

                              {msg.draftHtml && (
                                <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4 dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.85),rgba(15,23,42,0.92))]">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className={sidebarEyebrowClass}>Prepared language</p>
                                      <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">Suggested contract language</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                          {workspaceMode === 'negotiate' ? 'AI negotiation assist' : 'AI synthesis'}
                                        </span>
                                        {msg.comparisonText && msg.applyMode === 'replace_selection' && (
                                          <span className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[10px] font-semibold text-violet-700 shadow-sm dark:border-violet-800 dark:bg-slate-800 dark:text-violet-300">
                                            Inline diff ready
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {msg.applyMode && msg.applyMode !== 'none' && (
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                          {msg.applyMode === 'replace_selection' ? 'Replace selection' : 'Insert at cursor'}
                                        </span>
                                      )}
                                      <div
                                        draggable
                                        onDragStart={(event) => handleSnippetDragStart(event, {
                                          kind: 'ai-draft',
                                          label: msg.title || 'AI draft',
                                          plainText: stripHtml(msg.draftHtml ?? ''),
                                          html: msg.draftHtml ?? '',
                                          sourceLabel: workspaceMode === 'negotiate' ? 'AI negotiation assistant' : 'AI assistant',
                                          detail: msg.title || 'AI drafting proposal',
                                          applyMode: msg.applyMode,
                                        })}
                                        onDragEnd={handleSnippetDragEnd}
                                        className="inline-flex cursor-grab items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        title="Drag into draft"
                                      >
                                        <GripVertical className="h-3 w-3" />
                                        Drag
                                      </div>
                                    </div>
                                  </div>
                                  {msg.comparisonText && msg.applyMode === 'replace_selection' && (
                                    <div className="mt-3 space-y-2">
                                      <p className={sidebarEyebrowClass}>
                                        Inline rewrite diff
                                      </p>
                                      <InlineDiffPreview before={msg.comparisonText} after={stripHtml(msg.draftHtml)} />
                                    </div>
                                  )}
                                  <div
                                    draggable
                                    onDragStart={(event) => handleSnippetDragStart(event, {
                                      kind: 'ai-draft',
                                      label: msg.title || 'AI draft',
                                      plainText: stripHtml(msg.draftHtml ?? ''),
                                      html: msg.draftHtml ?? '',
                                      sourceLabel: workspaceMode === 'negotiate' ? 'AI negotiation assistant' : 'AI assistant',
                                      detail: msg.title || 'AI drafting proposal',
                                      applyMode: msg.applyMode,
                                    })}
                                    onDragEnd={handleSnippetDragEnd}
                                    className="prose prose-sm mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/80 bg-white px-3.5 py-3.5 text-gray-900 shadow-inner dark:prose-invert dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    dangerouslySetInnerHTML={{ __html: normalizeAiHtml(msg.draftHtml) }}
                                  />
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {rejectedDraftIds.has(msg.id) ? (
                                      <>
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                                          <X className="h-3.5 w-3.5" />
                                          Rejected
                                        </span>
                                        <button
                                          onClick={() => toggleDraftRejected(msg.id)}
                                          className={`${draftingSecondaryButtonClass} text-xs`}
                                        >
                                          Undo
                                        </button>
                                      </>
                                    ) : appliedDraftIds.has(msg.id) ? (
                                      <>
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                          <Check className="h-3.5 w-3.5" />
                                          Applied
                                        </span>
                                        <button
                                          onClick={() => applyAiChatDraft(msg)}
                                          className={`${draftingSecondaryButtonClass} text-xs`}
                                          title="Insert this proposal again"
                                        >
                                          Re-apply
                                        </button>
                                        <button
                                          onClick={() => copyAiChatContent(msg)}
                                          className={`${draftingSecondaryButtonClass} text-xs`}
                                        >
                                          Copy text
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => applyAiChatDraft(msg)}
                                          className={`${draftingPrimaryButtonClass} text-xs`}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          {msg.applyMode === 'replace_selection' ? 'Replace selection' : 'Insert into draft'}
                                        </button>
                                        <button
                                          onClick={() => copyAiChatContent(msg)}
                                          className={`${draftingSecondaryButtonClass} text-xs`}
                                        >
                                          Copy text
                                        </button>
                                        <button
                                          onClick={() => toggleDraftRejected(msg.id)}
                                          className={`${draftingSecondaryButtonClass} text-xs`}
                                          title="Reject this proposal"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !msg.isStreaming && (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {msg.suggestions.map((suggestion) => (
                            <button
                              key={`${msg.id}-${suggestion.value}`}
                              onClick={() => sendAiChatMessage(suggestion.value)}
                              className={draftingChipButtonClass}
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                </>
              )}
            </div>

            {/* Chat Input — always visible at bottom */}
            <div className="mt-auto border-t border-gray-200/80 pt-4 dark:border-slate-700/80">
              <div className="rounded-[22px] border border-slate-200/90 bg-white/92 p-2.5 shadow-[0_18px_30px_-26px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900/84">
                <div className="flex gap-2">
                  <input
                    type="text"
                    ref={aiChatInputRef}
                    data-ai-chat-input="true"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendAiChatMessage(aiChatInput)}
                    placeholder="Ask the assistant to rewrite, add, or review..."
                    disabled={isAiChatStreaming}
                    className="flex-1 rounded-[16px] border border-transparent bg-transparent px-3.5 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 dark:text-slate-100"
                  />
                  {isAiChatStreaming ? (
                    <button
                      onClick={stopAiChat}
                      className={`${draftingDangerButtonClass} min-h-[46px] min-w-[46px] rounded-[16px] px-0`}
                      aria-label="Stop AI response"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => sendAiChatMessage(aiChatInput)}
                      disabled={!aiChatInput.trim()}
                      className={`${draftingVioletButtonClass} min-h-[46px] min-w-[46px] rounded-[16px] px-0`}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="px-1 pt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  Use plain instructions. The assistant will respond in contract-ready language.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'review' && (
          <div id="panel-review" role="tabpanel" aria-labelledby="tab-review" className={sidebarPanelClass}>
            {draftId && (
              <section className={sidebarSectionClass}>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Workflow</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Status: {draftStatus.replace('_', ' ').toLowerCase()} {unresolvedCommentsCount > 0 ? `· ${unresolvedCommentsCount} open comment${unresolvedCommentsCount === 1 ? '' : 's'}` : '· no open comments'}.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {draftStatus === 'DRAFT' && (
                    <button
                      onClick={() => setShowApprovalModal('submit_review')}
                      className={`${draftingVioletButtonClass} rounded-full text-xs`}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Submit for review
                    </button>
                  )}

                  {(draftStatus === 'IN_REVIEW' || draftStatus === 'PENDING_APPROVAL') && ['admin', 'owner', 'manager'].includes(session?.user?.role || '') && (
                    <>
                      <button
                        onClick={() => setShowApprovalModal('approve')}
                        className={`${draftingEmeraldButtonClass} rounded-full text-xs`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowApprovalModal('reject')}
                        className={`${draftingDangerButtonClass} rounded-full text-xs`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {(draftStatus === 'APPROVED' || draftStatus === 'IN_REVIEW') && (() => {
                    const canFinalize = ['admin', 'owner', 'manager'].includes(session?.user?.role || '');
                    const needsApproval = draftStatus === 'IN_REVIEW';
                    const disabled = !canFinalize || needsApproval;
                    const reason = !canFinalize
                      ? 'Only admin, owner, or manager roles can finalize'
                      : needsApproval
                        ? 'Draft must be approved before finalizing'
                        : 'Create the signed contract from this draft';
                    return (
                      <button
                        onClick={handleFinalize}
                        disabled={disabled}
                        className={`${draftingPrimaryButtonClass} rounded-full text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={reason}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalize contract
                      </button>
                    );
                  })()}

                  {draftStatus === 'FINALIZED' && createdContractId && (
                    <button
                      onClick={() => router.push(`/contracts/${createdContractId}`)}
                      className={`${draftingSecondaryButtonClass} rounded-full text-xs`}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      View contract
                    </button>
                  )}

                  {draftStatus === 'REJECTED' && (
                    <button
                      onClick={handleRevertToDraft}
                      className={`${draftingWarningButtonClass} rounded-full text-xs`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Revise draft
                    </button>
                  )}
                </div>
              </section>
            )}

            {risks.length > 0 && (
              <section className={sidebarSectionClass}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      Risks to review
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {risks.length} item{risks.length === 1 ? '' : 's'} flagged by AI — click any to jump to the clause.
                    </p>
                  </div>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {risks.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {[...risks]
                    .sort((a, b) => getRiskSeverityRank(b.riskLevel) - getRiskSeverityRank(a.riskLevel))
                    .slice(0, 25)
                    .map((risk) => {
                      const toneClass =
                        risk.riskLevel === 'critical'
                          ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                          : risk.riskLevel === 'high'
                            ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300'
                            : risk.riskLevel === 'medium'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-700/30 dark:text-slate-300';
                      const snippet = risk.text && risk.text.length > 180 ? `${risk.text.slice(0, 180)}…` : risk.text;
                      return (
                        <li
                          key={risk.id}
                          className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-[0_6px_18px_-18px_rgba(15,23,42,0.6)] transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/80"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}>
                              {risk.riskLevel === 'critical' ? (
                                <AlertCircle className="h-3 w-3" />
                              ) : (
                                <Shield className="h-3 w-3" />
                              )}
                              {risk.riskLevel}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {risk.category}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-slate-200">
                            {risk.explanation}
                          </p>
                          {snippet && (
                            <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-[11px] italic text-slate-500 dark:border-slate-600 dark:text-slate-400">
                              {snippet}
                            </blockquote>
                          )}
                          {risk.suggestedFix && (
                            <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <strong className="mr-1 font-semibold">Suggested fix:</strong>
                              {risk.suggestedFix}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleFocusRisk(risk)}
                            className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                          >
                            <ArrowRight className="h-3 w-3" />
                            Jump to clause
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </section>
            )}

            <section className={sidebarSectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Document outline</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Reorder sections by dragging them. Click a row to jump to that section.
                  </p>
                </div>
                {outlineSections.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {outlineSections.length} section{outlineSections.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {outlineSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <p className="text-sm font-medium">No headings yet</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                    Add headings or use the block palette to build a draggable outline.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outlineSections.map((section, idx) => (
                    <div key={section.id} className="group relative">
                    <button
                      type="button"
                      draggable
                      onClick={() => handleFocusOutlineSection(section)}
                      onKeyDown={(event) => {
                        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                          event.preventDefault();
                          const neighborIdx = event.key === 'ArrowUp' ? idx - 1 : idx + 1;
                          const neighbor = outlineSections[neighborIdx];
                          if (neighbor) moveOutlineSection(section.id, neighbor.id);
                        }
                      }}
                      aria-label={`Outline section ${section.title}. Press Alt+Up or Alt+Down to reorder.`}
                      onDragStart={(event) => handleOutlineDragStart(event, section.id)}
                      onDragOver={(event) => handleOutlineDragOver(event, section.id)}
                      onDrop={(event) => handleOutlineDrop(event, section.id)}
                      onDragEnd={handleOutlineDragEnd}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                        outlineDropTargetId === section.id
                          ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/30'
                          : draggedOutlineId === section.id
                            ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/60'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60'
                      }`}
                      style={{ paddingLeft: `${Math.min(24 + (section.level - 1) * 14, 52)}px`, paddingRight: '60px' }}
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        <GripVertical className="h-3 w-3" />
                        Move
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {section.title}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        H{section.level}
                      </span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); duplicateOutlineSection(section.id); }}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        title="Duplicate section"
                        aria-label={`Duplicate ${section.title}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteOutlineSection(section.id); }}
                        className="rounded-md p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-900/40 dark:hover:text-rose-300"
                        title="Delete section"
                        aria-label={`Delete ${section.title}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>
                      </button>
                    </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={sidebarSectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Source trail</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Track where inserted drafting language came from during this session.
                  </p>
                </div>
                {sourceTrail.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {sourceTrail.length} recent
                  </span>
                )}
              </div>

              {sourceTrail.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <p className="text-sm font-medium">No inserted language yet</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                    Insert from AI, structure blocks, or the clause library to build a provenance trail.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sourceTrail.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{entry.label}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                              {entry.sourceLabel}
                            </span>
                            {formatConfidenceLabel(entry.confidence) && (
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getConfidenceColor(entry.confidence)}`}>
                                {formatConfidenceLabel(entry.confidence)}
                              </span>
                            )}
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                              {entry.action}
                            </span>
                          </div>
                          {entry.detail && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                          {formatTimeSince(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={sidebarSectionClass}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Comments</h3>
                {comments.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {unresolvedCommentsCount > 0
                      ? `${unresolvedCommentsCount} open`
                      : 'All resolved'}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Add a comment..."
                    aria-label="Add a comment"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className={`${draftingVioletButtonClass} min-h-[40px] min-w-[40px] rounded-lg px-0`}
                    aria-label="Submit comment"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Use comments for review notes and discussion.</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const anchorTextValue = comment.anchorPos?.['text'];
                  const anchorFrom = comment.anchorPos?.['from'];
                  const anchorTo = comment.anchorPos?.['to'];
                  const anchorText = typeof anchorTextValue === 'string' ? anchorTextValue.trim() : '';
                  const hasAnchor = typeof anchorFrom === 'number' && typeof anchorTo === 'number';

                  // Drift detection: compare saved anchor text to live editor text at that range
                  let isStale = false;
                  if (hasAnchor && anchorText && editor && !comment.resolved) {
                    try {
                      const docSize = editor.state.doc.content.size;
                      const from = Math.max(0, Math.min(anchorFrom as number, docSize));
                      const to = Math.max(from, Math.min(anchorTo as number, docSize));
                      const liveText = editor.state.doc.textBetween(from, to, ' ').trim();
                      if (!liveText) {
                        isStale = true;
                      } else {
                        // Levenshtein-lite: normalized length delta + containment check
                        const a = anchorText.toLowerCase();
                        const b = liveText.toLowerCase();
                        if (b !== a && !b.includes(a) && !a.includes(b)) {
                          const maxLen = Math.max(a.length, b.length);
                          // Quick char-overlap ratio
                          let common = 0;
                          const aChars = new Map<string, number>();
                          for (const ch of a) aChars.set(ch, (aChars.get(ch) || 0) + 1);
                          for (const ch of b) {
                            const n = aChars.get(ch) || 0;
                            if (n > 0) { common++; aChars.set(ch, n - 1); }
                          }
                          const similarity = maxLen > 0 ? common / maxLen : 1;
                          if (similarity < 0.7) isStale = true;
                        }
                      }
                    } catch { /* ignore drift detection errors */ }
                  }

                  return (
                    <div key={comment.id} className={`rounded-2xl border p-3 ${comment.resolved ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20' : isStale ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-medium text-white">
                          {(comment.user?.firstName?.[0] || '') + (comment.user?.lastName?.[0] || '')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {comment.user?.firstName} {comment.user?.lastName}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-slate-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                            {comment.resolved && (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/50 dark:text-green-300">
                                Resolved
                              </span>
                            )}
                            {isStale && !comment.resolved && (
                              <span
                                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                                title="The anchored text has changed since this comment was written"
                              >
                                Stale · text changed
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{comment.content}</p>

                          {anchorText && (
                            <button
                              type="button"
                              onClick={() => handleJumpToCommentAnchor(comment.anchorPos)}
                              className="mt-2 flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/70 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-violet-800 dark:hover:bg-violet-950/20"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                  Anchored text
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                  {anchorText}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300">
                                Jump
                              </span>
                            </button>
                          )}

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => setReplyTarget(replyTarget === comment.id ? null : comment.id)}
                              className="text-xs text-violet-600 hover:underline dark:text-violet-400"
                            >
                              Reply
                            </button>
                            {hasAnchor && !anchorText && (
                              <button
                                type="button"
                                onClick={() => handleJumpToCommentAnchor(comment.anchorPos)}
                                className="text-xs text-slate-500 hover:underline dark:text-slate-400"
                              >
                                Jump to text
                              </button>
                            )}
                            {!comment.resolved && (
                              <button
                                onClick={() => handleResolveComment(comment.id, true)}
                                className="flex items-center gap-0.5 text-xs text-green-600 hover:underline dark:text-green-400"
                              >
                                <Check className="h-3 w-3" /> Resolve
                              </button>
                            )}
                            {!comment.resolved && (
                              <button
                                onClick={() => {
                                  setActiveTab('assistant');
                                  setShowDesktopSidebar(true);
                                  const quotedText = anchorText ? `\n\nAnchored text:\n"""\n${anchorText}\n"""` : '';
                                  sendAiChatMessage(`A reviewer left this comment on a ${contractTypeKey.toLowerCase()} draft:\n\n"${comment.content}"${quotedText}\n\nPropose concrete redline wording that addresses the comment. Quote the current clause and show the revised version side-by-side.`);
                                }}
                                className="flex items-center gap-0.5 text-xs text-violet-600 hover:underline dark:text-violet-400"
                                title="Ask AI to draft a fix for this comment"
                              >
                                <Sparkles className="h-3 w-3" /> Draft fix
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>

                          {replyTarget === comment.id && (
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
                                placeholder="Write a reply..."
                                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                              />
                              <button
                                onClick={() => handleReply(comment.id)}
                                disabled={!replyContent.trim()}
                                className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700 disabled:opacity-50"
                              >
                                Send
                              </button>
                            </div>
                          )}

                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3 dark:border-slate-600">
                              {comment.replies.map((reply: ApiComment) => (
                                <div key={reply.id} className="text-xs">
                                  <span className="font-medium text-gray-800 dark:text-slate-200">
                                    {reply.user?.firstName} {reply.user?.lastName}
                                  </span>
                                  <span className="ml-2 text-gray-400 dark:text-slate-500">
                                    {new Date(reply.createdAt).toLocaleString()}
                                  </span>
                                  <p className="mt-0.5 text-gray-600 dark:text-slate-300">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className={sidebarSectionClass}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Version history</h3>
                <button
                  onClick={handleOpenDiff}
                  disabled={versions.length < 1}
                  className="flex items-center gap-1 text-sm text-violet-600 transition-colors hover:text-violet-700 disabled:opacity-40 dark:text-violet-400 dark:hover:text-violet-300"
                  aria-label="Compare versions"
                >
                  <GitBranch className="h-4 w-4" />
                  Compare
                </button>
              </div>

              {versions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <History className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No versions yet</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Save the draft to start version history.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`rounded-2xl border p-3 transition-colors ${
                        index === 0 ? 'border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-slate-100">v{version.version}</span>
                            {version.label && (
                              <span className={`rounded px-1.5 py-0.5 text-xs ${
                                index === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {version.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                            {version.user?.firstName} {version.user?.lastName}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                            {new Date(version.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {version.changeSummary && (
                          <div className="max-w-[120px] truncate text-xs text-gray-500 dark:text-slate-400">{version.changeSummary}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {approvalHistory.length > 0 && (
              <section className={sidebarSectionClass}>
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  Approval history
                </h4>
                <div className="space-y-2">
                  {approvalHistory.map((entry, idx) => (
                    <div
                      key={`approval-${idx}`}
                      className={`rounded-2xl border p-3 text-xs ${
                        entry.action === 'APPROVED'
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
                          : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {entry.action === 'APPROVED' ? (
                          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`font-medium ${
                          entry.action === 'APPROVED' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                        }`}>
                          {entry.action === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </span>
                        <span className="ml-auto text-gray-400 dark:text-slate-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {(entry.comment || entry.reason) && (
                        <p className="mt-1 pl-6 text-gray-600 dark:text-slate-300">
                          {entry.comment || entry.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Clause Library Tab */}
        {activeTab === 'clauses' && (
          <div id="panel-clauses" role="tabpanel" aria-labelledby="tab-clauses" className={sidebarPanelClass}>
            <section className={sidebarSectionClass}>
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Structure blocks</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Drag or insert common contract sections without leaving the draft.
                </p>
              </div>

              <div className="grid gap-2">
                {availableStructureBlocks.map((block) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(event) => handleSnippetDragStart(event, {
                      kind: 'clause',
                      label: block.title,
                      plainText: stripHtml(block.html),
                      html: block.html,
                      sourceLabel: 'Studio block',
                      confidence: 0.96,
                      detail: `${block.category} template`,
                    })}
                    onDragEnd={handleSnippetDragEnd}
                    className="cursor-grab rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{block.title}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                            {block.category}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Studio block
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {block.description}
                        </p>
                        {block.contractTypes && block.contractTypes.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Built for {block.contractTypes.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                          <GripVertical className="h-3 w-3" />
                          Drag
                        </span>
                        <button
                          type="button"
                          onClick={() => handleInsertStructureBlock(block)}
                          className={`${draftingSecondaryButtonClass} px-3 py-2 text-xs text-violet-700 dark:text-violet-300`}
                        >
                          Insert
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sidebarSectionClass}>
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">Find clauses</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Search the library and narrow results before dragging or inserting language.
                </p>
              </div>

              <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  placeholder="Search clauses..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <select
                value={clauseCategory}
                onChange={(e) => setClauseCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Categories</option>
                <option value="liability">Liability</option>
                <option value="indemnification">Indemnification</option>
                <option value="termination">Termination</option>
                <option value="ip">Intellectual Property</option>
                <option value="confidentiality">Confidentiality</option>
                <option value="payment">Payment Terms</option>
                <option value="governance">Governance</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            </section>

            {isLoadingClauses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : clauses.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No clauses found</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">
                  {clauseSearch ? `No results for "${clauseSearch}". Try a different search term.` : 'Try changing your category filter or search above.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clauses.map((clause) => (
                  <div
                    key={clause.id}
                    draggable
                    onDragStart={(event) => handleSnippetDragStart(event, {
                      kind: 'clause',
                      label: clause.title,
                      plainText: stripHtml(clause.content),
                      html: clause.content.startsWith('<') ? clause.content : `<p>${clause.content}</p>`,
                      sourceLabel: clause.isStandard ? 'Standard clause library' : 'Clause library',
                      detail: `${clause.category} · used ${clause.usageCount} times`,
                    })}
                    onDragEnd={handleSnippetDragEnd}
                    className="cursor-grab rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-violet-300 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:border-violet-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{clause.title}</h5>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            <GripVertical className="h-3 w-3" />
                            Drag
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                            {clause.category}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {clause.isStandard ? 'Standard clause' : 'Library clause'}
                          </span>
                          {clause.riskLevel && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(clause.riskLevel)}`}>
                              {clause.riskLevel}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          Used {clause.usageCount} times
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {clause.content?.slice(0, 120)}...
                        </p>
                      </div>
                      <button
                        onClick={() => handleInsertClause(clause)}
                        className={`${draftingSecondaryButtonClass} min-h-[40px] min-w-[40px] flex-shrink-0 rounded-xl px-0 text-violet-700 dark:text-violet-300`}
                        title="Insert clause into document"
                        aria-label={`Insert ${clause.title} clause`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {clauses.length >= 30 && (
                  <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-2">
                    Showing first 30 results — refine your search to find specific clauses
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`min-h-screen bg-[linear-gradient(180deg,#f7f5ef_0%,#f2eee4_100%)] dark:bg-slate-900 ${isResizingSidebar ? 'cursor-col-resize select-none' : ''}`}>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/88 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-800/88">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Left: save status + risk badges */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : autosaveFailed ? (
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800"
                    title="Auto-save failed. Click to retry."
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Save failed — retry</span>
                  </button>
                ) : lastSaved ? (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Saved {formatTimeSince(lastSaved)}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Not saved</span>
                  </>
                )}
              </div>

              {/* Draft status badge */}
              <div className="h-4 w-px bg-gray-200 dark:bg-slate-600" />
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  draftStatus === 'FINALIZED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                    : draftStatus === 'APPROVED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                      : draftStatus === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'
                        : draftStatus === 'IN_REVIEW' || draftStatus === 'PENDING_APPROVAL'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                }`}
                title={`Draft status: ${draftStatus.replace('_', ' ').toLowerCase()}`}
              >
                {draftStatus.replace('_', ' ')}
              </span>

              {/* Risk Summary Badges */}
              {(riskSummary.critical > 0 || riskSummary.high > 0) && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('review');
                      setShowDesktopSidebar(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-700/60"
                  >
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      riskSummary.critical > 0
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                        : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                    }`}>
                      {riskSummary.critical > 0 ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {priorityRiskCount} flagged
                    </span>
                  </button>
                </>
              )}

              {/* Lock Indicator */}
              {lockInfo.isLocked && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600" />
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" />
                    <span className="hidden sm:inline">Locked{lockInfo.lockedBy ? ` by ${lockInfo.lockedBy}` : ''}</span>
                  </span>
                </>
              )}

              {/* Draft Status Badge */}
              {draftId && draftStatus !== 'DRAFT' && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('review');
                      setShowDesktopSidebar(true);
                    }}
                    className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:brightness-95 ${
                      draftStatus === 'FINALIZED' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                      draftStatus === 'IN_REVIEW' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                      draftStatus === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                      draftStatus === 'PENDING_APPROVAL' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                      'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                    }`}
                  >
                    {draftStatus === 'FINALIZED' && <CheckCircle2 className="h-3 w-3" />}
                    {draftStatus.replace('_', ' ')}
                  </button>
                </>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className={`lg:hidden ${headerAccentButtonClass}`}
                aria-label="Open assistant panel"
              >
                <Brain className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => {
                  if (showDesktopSidebar) {
                    setShowDesktopSidebar(false);
                    return;
                  }
                  setActiveTab('assistant');
                  setShowDesktopSidebar(true);
                }}
                className={`hidden lg:inline-flex ${headerActionButtonClass}`}
                aria-label={showDesktopSidebar ? 'Hide side panel' : 'Open side panel'}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>{showDesktopSidebar ? 'Hide panel' : 'Assistant'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSectionJump(true)}
                className={`hidden md:inline-flex ${headerActionButtonClass}`}
                aria-label="Jump to section"
                title="Jump to section (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Jump</span>
                <kbd className="hidden lg:inline ml-1 rounded bg-slate-200/70 dark:bg-slate-700/70 px-1 py-px text-[9px] font-mono text-slate-500 dark:text-slate-400">⌘K</kbd>
              </button>

              {rationales.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRationalePanel(true)}
                  className={`hidden md:inline-flex ${headerActionButtonClass}`}
                  aria-label="Negotiation rationales"
                  title="Saved negotiation rationales"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Rationales</span>
                  <span className="ml-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-semibold px-1.5 py-px dark:bg-sky-900/50 dark:text-sky-300">
                    {rationales.length}
                  </span>
                </button>
              )}

              <div className="hidden min-h-[40px] items-center rounded-xl bg-gray-100/95 p-1 dark:bg-slate-700/95 md:flex" role="radiogroup" aria-label="Draft workspace mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={workspaceMode === 'draft'}
                  onClick={() => setWorkspaceMode('draft')}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    workspaceMode === 'draft'
                      ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Draft
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={workspaceMode === 'negotiate'}
                  onClick={() => setWorkspaceMode('negotiate')}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    workspaceMode === 'negotiate'
                      ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Negotiate
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex min-h-[40px] items-center rounded-xl bg-gray-100/95 p-1 dark:bg-slate-700/95" role="radiogroup" aria-label="Editor mode">
                <button
                  onClick={() => { if (draftStatus !== 'FINALIZED') setIsEditing(true); }}
                  disabled={draftStatus === 'FINALIZED'}
                  role="radio"
                  aria-checked={isEditing}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  role="radio"
                  aria-checked={!isEditing}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    !isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>

              {/* Export quick-access (was only in Ctrl+Shift+E menu) */}
              <button
                onClick={() => handleExportDOCX()}
                disabled={isExporting || !editor}
                className={`${headerActionButtonClass} disabled:opacity-50`}
                title="Export as DOCX"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* Actions dropdown — save, export, utilities */}
              <div className="relative">
                <button
                  onClick={() => { setShowActionsMenu(v => !v); }}
                  className={headerActionButtonClass}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">More</span>
                </button>
                {showActionsMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                    <button
                      onClick={() => { handleSaveRef.current(); setShowActionsMenu(false); }}
                      disabled={isSaving}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 text-violet-500" />
                      Save now
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-slate-700" />

                    <button
                      onClick={() => { handleExportPDF(); setShowActionsMenu(false); }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-red-500" />
                      Export as PDF
                    </button>
                    <button
                      onClick={() => { handleExportDOCX(); setShowActionsMenu(false); }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-blue-500" />
                      Export as DOCX
                    </button>

                    {/* Re-edit template variables (only when {{vars}} remain in content) */}
                    {editor && /\{\{[^}]+\}\}/.test(editor.getText()) && (
                      <button
                        onClick={() => {
                          const content = editor.getHTML();
                          window.dispatchEvent(new CustomEvent('contigo:re-edit-variables', { detail: { content } }));
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        Re-edit variables
                      </button>
                    )}

                    <div className="my-1 border-t border-gray-100 dark:border-slate-700" />

                    {/* Lock */}
                    {draftId && (
                      <button
                        onClick={() => { handleLock(lockInfo.isLocked ? 'unlock' : 'lock'); setShowActionsMenu(false); }}
                        disabled={isLocking}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {lockInfo.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {lockInfo.isLocked ? 'Unlock document' : 'Lock for editing'}
                      </button>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[22px] border border-slate-200/80 bg-white/82 px-3 py-2.5 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/82" role="toolbar" aria-label="Document formatting toolbar">
              <div className={editorToolbarGroupClass} role="group" aria-label="History">
                <button
                  onClick={handleUndo}
                  disabled={!editor?.can().undo()}
                  className={`${editorToolbarButtonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={editor?.can().undo() ? 'Undo (Ctrl+Z) — history available' : 'Nothing to undo'}
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!editor?.can().redo()}
                  className={`${editorToolbarButtonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={editor?.can().redo() ? 'Redo (Ctrl+Shift+Z) — redo available' : 'Nothing to redo'}
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <div className={editorToolbarGroupClass} role="group" aria-label="Text formatting">
                <button onClick={() => insertFormatting('bold')} className={`${editorToolbarButtonClass} ${editor?.isActive('bold') ? editorToolbarButtonActiveClass : ''}`} title="Bold" aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </button>
                <button onClick={() => insertFormatting('italic')} className={`${editorToolbarButtonClass} ${editor?.isActive('italic') ? editorToolbarButtonActiveClass : ''}`} title="Italic" aria-label="Italic">
                  <Italic className="h-4 w-4" />
                </button>
              </div>
              <div className={editorToolbarGroupClass} role="group" aria-label="Headings">
                <button onClick={() => insertFormatting('h1')} className={`${editorToolbarButtonClass} ${editor?.isActive('heading', { level: 1 }) ? editorToolbarButtonActiveClass : ''}`} title="Heading 1" aria-label="Heading 1">
                  <Heading1 className="h-4 w-4" />
                </button>
              </div>
              <div className={editorToolbarGroupClass} role="group" aria-label="Block elements">
                <button onClick={() => insertFormatting('list')} className={`${editorToolbarButtonClass} ${editor?.isActive('bulletList') ? editorToolbarButtonActiveClass : ''}`} title="List" aria-label="List">
                  <List className="h-4 w-4" />
                </button>
                <button onClick={handleClearFormatting} className={editorToolbarButtonClass} title="Clear formatting" aria-label="Clear formatting">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 7V4h16v3M5 20h6M13 4L8 20M16 15l5 5m0-5l-5 5" /></svg>
                </button>
                <button onClick={() => setShowFindReplace(true)} className={editorToolbarButtonClass} title="Find & Replace (Ctrl+H)" aria-label="Find and replace">
                  <Search className="h-4 w-4" />
                </button>
              </div>

              <div className={editorToolbarGroupClass} role="group" aria-label="Help">
                <button
                  type="button"
                  onClick={() => setShowHelpCheatsheet(true)}
                  className={editorToolbarButtonClass}
                  title="Drafting cheatsheet (shortcuts & tips)"
                  aria-label="Open drafting help cheatsheet"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </button>
                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className={`${editorToolbarButtonClass} ${focusMode ? editorToolbarButtonActiveClass : ''}`}
                  title={focusMode ? 'Exit focus mode' : 'Enter focus mode (hides sidebar)'}
                  aria-label="Toggle focus mode"
                  aria-pressed={focusMode}
                >
                  {focusMode ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 9V3H3m18 6V3h-6M9 15v6H3m18-6v6h-6" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>
                  )}
                </button>
              </div>

              <div className="flex-1" />

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                {isLoadingSuggestions && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking draft
                  </span>
                )}
                {!isLoadingSuggestions && suggestions.length > 0 && (
                  <span className="hidden rounded-full bg-slate-100/90 px-3 py-1.5 font-semibold tabular-nums text-slate-600 dark:bg-slate-900/80 dark:text-slate-200 sm:inline">
                    {suggestions.length} suggestions
                  </span>
                )}
                <span className="hidden rounded-full bg-slate-100/90 px-3 py-1.5 font-semibold text-slate-600 dark:bg-slate-900/80 dark:text-slate-200 md:inline">
                  {workspaceMode === 'negotiate' ? 'Negotiation mode active' : 'Drafting mode active'}
                </span>
                <span className="hidden rounded-full bg-slate-100/90 px-3 py-1.5 font-medium text-slate-500 dark:bg-slate-900/80 dark:text-slate-300 xl:inline">
                  Type / for blocks or AI actions
                </span>
                <span className="hidden rounded-full bg-slate-100/90 px-3 py-1.5 font-medium text-slate-500 dark:bg-slate-900/80 dark:text-slate-300 2xl:inline">
                  Ctrl+/ opens Assistant
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative mx-auto flex w-full max-w-[1820px] gap-4 px-3 pb-6 pt-4 md:gap-6 md:px-5 lg:px-6 xl:gap-8 xl:px-8">
        {/* Editor */}
        <div className="min-w-0 flex-1">
          <div className={`${editorCanvasMaxWidthClass} mx-auto`}>
            {workflowContext && (
              <div className="mb-4 rounded-[28px] border border-violet-200/80 bg-[linear-gradient(135deg,rgba(245,243,255,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_24px_60px_-42px_rgba(109,40,217,0.4)] dark:border-violet-900/60 dark:bg-[linear-gradient(135deg,rgba(76,29,149,0.16),rgba(15,23,42,0.94))]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700/75 dark:text-violet-300/80">
                      {isRenewalWorkflow ? <RefreshCw className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}
                      <span>{workflowContext.label || (isRenewalWorkflow ? 'Renewal studio' : 'Amendment studio')}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-100">
                      {workflowContext.sourceTitle
                        ? `${isRenewalWorkflow ? 'Deep editing for' : 'Working from'} ${workflowContext.sourceTitle}`
                        : isRenewalWorkflow
                          ? 'Deep editing for this renewal'
                          : 'Shared drafting context'}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300/85">
                      {isRenewalWorkflow
                        ? 'Keep the renewal wizard for dates, value changes, and approval routing. Use the shared drafting studio here for high-judgment clause rewrites, negotiation posture, and final document polish.'
                        : 'This document is using the shared drafting studio so the highest-value editing and AI assistance stay consolidated in one place.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workflowContext.returnPath && workflowContext.returnLabel && (
                      <button
                        type="button"
                        onClick={() => router.push(workflowContext.returnPath || '/')}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-violet-200 bg-white/95 px-3.5 py-2 text-sm font-semibold text-violet-700 shadow-sm transition-colors hover:bg-violet-50 dark:border-violet-900/60 dark:bg-slate-900/80 dark:text-violet-200 dark:hover:bg-violet-950/25"
                      >
                        <ArrowRight className="h-4 w-4" />
                        {workflowContext.returnLabel}
                      </button>
                    )}
                    {workflowContext.sourcePath && (
                      <button
                        type="button"
                        onClick={() => router.push(workflowContext.sourcePath || '/')}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-4 w-4" />
                        {workflowContext.sourceLabel || 'Open source contract'}
                      </button>
                    )}
                  </div>
                </div>

                {((workflowContext.summaryItems?.length || 0) > 0 || workflowContext.notes) && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                    {(workflowContext.summaryItems?.length || 0) > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {workflowContext.summaryItems?.map((item) => (
                          <div
                            key={`${item.label}-${item.value}`}
                            className="rounded-2xl border border-white/80 bg-white/88 px-3.5 py-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{item.label}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {workflowContext.notes && (
                      <div className="rounded-2xl border border-violet-200/80 bg-violet-50/70 px-4 py-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/75 dark:text-violet-300/75">Working note</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200/85">{workflowContext.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Document Content */}
            <div className="relative">
              <div
                ref={editorSurfaceRef}
                className={`relative overflow-hidden min-h-[600px] rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.98))] ${
                  isEditing ? 'focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent' : ''
                }`}
                onKeyDown={handleKeyDown}
                onDragEnter={handleEditorDragEnter}
                onDragOver={handleEditorDragOver}
                onDragLeave={handleEditorDragLeave}
                onDrop={handleEditorDrop}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.85),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_28%),linear-gradient(180deg,rgba(30,41,59,0.55),rgba(15,23,42,0))]" />
                <div className="relative z-10 px-5 pb-5 pt-6 md:px-10 md:pb-10 md:pt-8 xl:px-12 xl:pb-12">
                  <div className="mx-auto max-w-[48rem]">
                    <div className="mb-8 border-b border-slate-200/80 pb-6 dark:border-slate-700/80 md:mb-10 md:pb-8">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className={editorEyebrowClass}>Document canvas</p>
                          {isEditing && draftStatus !== 'FINALIZED' ? (
                            <input
                              type="text"
                              value={draftTitle}
                              onChange={(event) => {
                                hasEditedTitleRef.current = true;
                                setDraftTitle(event.target.value);
                              }}
                              onBlur={commitDraftTitle}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  event.currentTarget.blur();
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  revertDraftTitle();
                                  event.currentTarget.blur();
                                }
                              }}
                              placeholder={`${contractType} Contract`}
                              aria-label="Draft title"
                              className="mt-2 w-full bg-transparent text-[clamp(1.75rem,2.8vw,2.45rem)] font-semibold tracking-[-0.045em] text-slate-900 outline-none placeholder:text-slate-300 focus:text-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:text-white"
                            />
                          ) : (
                            <h2 className="mt-2 text-[clamp(1.75rem,2.8vw,2.45rem)] font-semibold tracking-[-0.045em] text-slate-900 dark:text-slate-100">
                              {documentCanvasTitle}
                            </h2>
                          )}
                          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                            {documentCanvasSummary}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:max-w-[18rem] lg:justify-end">
                          <span className={editorMetaPillClass}>{isEditing ? 'Editing live' : 'Preview mode'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const input = window.prompt('Set a word-count goal (0 to clear):', wordGoal > 0 ? String(wordGoal) : '');
                              if (input === null) return;
                              const n = parseInt(input.trim(), 10);
                              if (input.trim() === '' || n === 0) setWordGoalPersistent(0);
                              else if (Number.isFinite(n) && n > 0) setWordGoalPersistent(n);
                              else toast.error('Enter a positive number');
                            }}
                            className={`${editorMetaPillClass} hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer`}
                            title={wordGoal > 0 ? `Goal: ${wordGoal} words · click to change` : 'Click to set a word-count goal'}
                          >
                            {wordGoal > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="tabular-nums">{documentWordCount}/{wordGoal}</span>
                                <span className="inline-block h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <span
                                    className={`block h-full transition-all ${documentWordCount >= wordGoal ? 'bg-emerald-500' : 'bg-violet-500'}`}
                                    style={{ width: `${Math.min(100, Math.round((documentWordCount / wordGoal) * 100))}%` }}
                                  />
                                </span>
                                {documentWordCount >= wordGoal && <span className="text-emerald-600 dark:text-emerald-400">✓</span>}
                              </span>
                            ) : (
                              documentWordCount > 0 ? `${documentWordCount} words` : 'Blank draft'
                            )}
                          </button>
                          <span className={editorMetaPillClass}>{outlineSections.length > 0 ? `${outlineSections.length} sections` : 'No sections yet'}</span>
                          {documentReadMinutes > 0 && (
                            <span className={editorMetaPillClass}>{documentReadMinutes} min read</span>
                          )}
                          {selectionStats.words > 0 && (
                            <span className={`${editorMetaPillClass} bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800`}>
                              Selection: {selectionStats.words} word{selectionStats.words === 1 ? '' : 's'} · {selectionStats.chars} char{selectionStats.chars === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {editor ? (
                      <div className="relative">
                        {draftStatus === 'FINALIZED' && (
                          <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                            <div className="flex items-start gap-3">
                              <Lock className="h-4 w-4 text-emerald-700 dark:text-emerald-300 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                                  This draft is finalized — read-only
                                </div>
                                <div className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                                  A signed contract was created from this draft. To make further changes, create an amendment.
                                </div>
                              </div>
                              {createdContractId && (
                                <button
                                  onClick={() => router.push(`/contracts/${createdContractId}`)}
                                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1"
                                >
                                  View contract <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {visibleNextActionPill && (
                          <div className={`mb-3 rounded-xl border px-4 py-2.5 ${
                            visibleNextActionPill.tone === 'rose' ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40' :
                            visibleNextActionPill.tone === 'amber' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40' :
                            visibleNextActionPill.tone === 'blue' ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40' :
                            visibleNextActionPill.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' :
                            'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40'
                          }`}>
                            <div className="flex items-center gap-3">
                              {visibleNextActionPill.icon === 'alert' ? <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" /> :
                               visibleNextActionPill.icon === 'shield' ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" /> :
                               visibleNextActionPill.icon === 'chat' ? <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" /> :
                               <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-semibold ${
                                  visibleNextActionPill.tone === 'rose' ? 'text-rose-900 dark:text-rose-200' :
                                  visibleNextActionPill.tone === 'amber' ? 'text-amber-900 dark:text-amber-200' :
                                  visibleNextActionPill.tone === 'blue' ? 'text-blue-900 dark:text-blue-200' :
                                  visibleNextActionPill.tone === 'emerald' ? 'text-emerald-900 dark:text-emerald-200' :
                                  'text-violet-900 dark:text-violet-200'
                                }`}>
                                  Next best move · {visibleNextActionPill.label}
                                </div>
                                <div className={`text-[11px] mt-0.5 ${
                                  visibleNextActionPill.tone === 'rose' ? 'text-rose-700 dark:text-rose-300' :
                                  visibleNextActionPill.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' :
                                  visibleNextActionPill.tone === 'blue' ? 'text-blue-700 dark:text-blue-300' :
                                  visibleNextActionPill.tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' :
                                  'text-violet-700 dark:text-violet-300'
                                }`}>
                                  {visibleNextActionPill.hint}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('assistant');
                                  setShowDesktopSidebar(true);
                                  sendAiChatMessage(visibleNextActionPill.prompt);
                                }}
                                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                                  visibleNextActionPill.tone === 'rose' ? 'bg-rose-600 text-white hover:bg-rose-700' :
                                  visibleNextActionPill.tone === 'amber' ? 'bg-amber-600 text-white hover:bg-amber-700' :
                                  visibleNextActionPill.tone === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                                  visibleNextActionPill.tone === 'emerald' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                                  'bg-violet-600 text-white hover:bg-violet-700'
                                }`}
                              >
                                <Sparkles className="h-3 w-3" />
                                {visibleNextActionPill.cta}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDismissedNextAction(visibleNextActionPill.id)}
                                className="shrink-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs"
                                title="Dismiss this suggestion"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        {unreviewedConflicts.length > 0 && !dismissedConflictBanner && (
                          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                  Possible clause conflicts detected
                                </div>
                                <ul className="mt-1 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                                  {unreviewedConflicts.map((c, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="mt-0.5 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                                      <span className="flex-1">{c}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveTab('assistant');
                                          setShowDesktopSidebar(true);
                                          sendAiChatMessage(`A ${contractTypeKey.toLowerCase()} draft has this conflict: "${c}". Review the document, quote the exact conflicting clauses, and propose a concrete resolution with suggested wording that removes the conflict while preserving intent.`);
                                        }}
                                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                                        title="Ask AI to propose a fix"
                                      >
                                        <Sparkles className="h-2.5 w-2.5" /> Resolve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleConflictReviewed(c)}
                                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
                                        title="Mark as reviewed (saved per draft)"
                                      >
                                        <CheckCircle2 className="h-2.5 w-2.5" /> Reviewed
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDismissedConflictBanner(true)}
                                className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 text-xs"
                                title="Dismiss for this session"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        <EditorContent editor={editor} />
                        {/* Empty-state action overlay: visible only on blank draft */}
                        {documentWordCount === 0 && isEditing && (
                          <div className="mt-6 flex justify-center">
                            <div className="w-full max-w-xl rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-sm dark:border-violet-800/50 dark:from-slate-900 dark:to-violet-950/30">
                              <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-violet-100 p-2 dark:bg-violet-900/50">
                                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Start your draft</p>
                                  <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
                                    Pick a starting point — or just begin typing. Type <kbd className="rounded bg-white px-1 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">/</kbd> anywhere to insert a block.
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        editor.chain().focus().insertContent('<h1>Contract Title</h1><p></p>').run();
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-violet-950/40"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-violet-600" /> Start blank
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTab('assistant');
                                        setShowDesktopSidebar(true);
                                        const prompt = `Draft a standard ${contractTypeKey.toLowerCase()} for me — include parties, scope/services, commercial terms, term & termination, confidentiality, liability, governing law, and signature blocks. Use clear headings and numbered sections.`;
                                        sendAiChatMessage(prompt);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" /> Ask AI to draft
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTab('assistant');
                                        setShowDesktopSidebar(true);
                                        sendAiChatMessage(`Produce a concise outline (as a numbered list of section headings only, no body copy) for a standard ${contractTypeKey.toLowerCase()}. I will fill in each section myself.`);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-violet-950/40"
                                    >
                                      <BookOpen className="h-3.5 w-3.5 text-violet-600" /> Outline only
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowHelpCheatsheet(true)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      Show shortcuts
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex min-h-[550px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isEditing && selectionToolbar && (
                    <motion.div
                      key="selection-toolbar"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute z-20 w-[340px]"
                      style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setShowInlineCommentComposer((value) => !value);
                              setShowSlashMenu(false);
                            }}
                            className={`${draftingInlineButtonClass} text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Comment
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectionAssistantAction(`Rewrite this selected text so it is clearer, more concise, and contract-ready:\n\n${selectionToolbar.text}`)}
                            className={`${draftingInlineButtonClass} text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40`}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Rewrite
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectionAssistantAction(`Review this selected contract text for legal risk, ambiguity, and negotiation issues:\n\n${selectionToolbar.text}`)}
                            className={`${draftingInlineButtonClass} text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40`}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Review
                          </button>
                          {workspaceMode === 'negotiate' && (
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleNegotiationAssistantAction('fallback')}
                              className={`${draftingInlineButtonClass} text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40`}
                            >
                              <Scale className="h-3.5 w-3.5" />
                              Counter
                            </button>
                          )}
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => { setShowRationaleComposer(true); setRationaleDraft(''); }}
                            className={`${draftingInlineButtonClass} text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40`}
                            title="Record why this wording was accepted"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Rationale
                          </button>
                        </div>

                        {showRationaleComposer && (
                          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                            <p className="line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                              {selectionToolbar.text}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={rationaleDraft}
                                onChange={(e) => setRationaleDraft(e.target.value)}
                                placeholder="Why did we accept this wording?"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && rationaleDraft.trim()) {
                                    const quote = selectionToolbar.text.slice(0, 240);
                                    const next = [
                                      { id: `${Date.now()}`, quote, note: rationaleDraft.trim(), at: Date.now() },
                                      ...rationales,
                                    ].slice(0, 100);
                                    persistRationales(next);
                                    setShowRationaleComposer(false);
                                    setRationaleDraft('');
                                    toast.success('Rationale saved for this draft');
                                  } else if (e.key === 'Escape') {
                                    setShowRationaleComposer(false);
                                    setRationaleDraft('');
                                  }
                                }}
                                className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-800 focus:border-sky-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (!rationaleDraft.trim()) return;
                                  const quote = selectionToolbar.text.slice(0, 240);
                                  const next = [
                                    { id: `${Date.now()}`, quote, note: rationaleDraft.trim(), at: Date.now() },
                                    ...rationales,
                                  ].slice(0, 100);
                                  persistRationales(next);
                                  setShowRationaleComposer(false);
                                  setRationaleDraft('');
                                  toast.success('Rationale saved for this draft');
                                }}
                                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                                disabled={!rationaleDraft.trim()}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}

                        {showInlineCommentComposer && (
                          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                            <p className="line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                              {selectionToolbar.text}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={inlineCommentDraft}
                                onChange={(event) => setInlineCommentDraft(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && void handleInlineCommentCreate()}
                                placeholder="Add an anchored comment..."
                                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => void handleInlineCommentCreate()}
                                disabled={!inlineCommentDraft.trim()}
                                className={`${draftingVioletButtonClass} rounded-lg px-3 text-xs`}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isEditing && selectedSuggestionData && (selectedSuggestionData.originalText || selectedSuggestionData.triggerText) && (
                    <motion.div
                      key="inline-suggestion-diff"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-6 top-20 z-20 hidden w-[380px] 2xl:w-[420px] xl:block"
                    >
                      <div className="rounded-2xl border border-violet-200 bg-white/96 p-3 shadow-2xl backdrop-blur dark:border-violet-800 dark:bg-slate-900/96">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">
                              Inline AI proposal
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {selectedSuggestionData.explanation}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSuggestion(null)}
                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            aria-label="Dismiss inline proposal"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {getSuggestionSourceLabel(selectedSuggestionData.source.type)}
                          </span>
                          {formatConfidenceLabel(selectedSuggestionData.source.confidence || selectedSuggestionData.confidence) && (
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getConfidenceColor(selectedSuggestionData.source.confidence || selectedSuggestionData.confidence)}`}>
                              {formatConfidenceLabel(selectedSuggestionData.source.confidence || selectedSuggestionData.confidence)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3">
                          <InlineDiffPreview
                            before={selectedSuggestionData.originalText || selectedSuggestionData.triggerText}
                            after={selectedSuggestionData.suggestedText}
                          />
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => applySuggestion(selectedSuggestionData)}
                            className={`${draftingVioletButtonClass} flex-1 text-xs`}
                          >
                            Accept change
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSuggestion(null)}
                            className={`${draftingSecondaryButtonClass} flex-1 text-xs`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {heatmapMarkers.length > 0 && (
                  <div className="pointer-events-none absolute bottom-8 right-3 top-24 z-10 hidden xl:flex flex-col items-center">
                    <div className="pointer-events-auto mb-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                      Heatmap
                    </div>
                    <div className="pointer-events-auto relative h-full w-4 rounded-full bg-slate-100/90 shadow-inner dark:bg-slate-700/80">
                      {heatmapMarkers.map((marker) => {
                        const markerClasses = marker.tone === 'critical'
                          ? 'bg-red-500'
                          : marker.tone === 'high'
                            ? 'bg-orange-500'
                            : marker.tone === 'medium'
                              ? 'bg-yellow-500'
                              : marker.tone === 'low'
                                ? 'bg-emerald-500'
                                : 'bg-violet-500';

                        return (
                          <button
                            key={marker.id}
                            type="button"
                            title={`${marker.label}: ${marker.detail}`}
                            onClick={() => {
                              focusDraftRange(marker.from, marker.to);
                              setSelectedHeatmapMarkerId(marker.id);
                              setActiveTab('review');
                              setShowDesktopSidebar(true);
                            }}
                            className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform hover:scale-110 dark:border-slate-900 ${markerClasses} ${selectedHeatmapMarkerId === marker.id ? 'ring-2 ring-violet-300 dark:ring-violet-700' : ''}`}
                            style={{ top: `${marker.topPercent}%` }}
                            aria-label={`${marker.label}: ${marker.detail}`}
                          />
                        );
                      })}
                    </div>
                    <div className="pointer-events-auto mt-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                      {heatmapMarkers.length} markers
                    </div>
                  </div>
                )}

                {inlineRiskChips.length > 0 && (
                  <div className="pointer-events-none absolute inset-y-0 right-4 top-24 z-10 hidden lg:block xl:right-10">
                    {inlineRiskChips.map((chip) => {
                      const toneClasses = chip.risk.riskLevel === 'critical'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                        : chip.risk.riskLevel === 'high'
                          ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
                          : chip.risk.riskLevel === 'medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';

                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleFocusRisk(chip.risk)}
                          title={`${chip.risk.category}: ${chip.risk.explanation}`}
                          className={`pointer-events-auto absolute right-0 flex max-w-[12rem] -translate-y-1/2 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-transform hover:-translate-x-0.5 ${toneClasses} ${selectedHeatmapMarkerId === `risk-${chip.risk.id}` ? 'ring-2 ring-violet-300 dark:ring-violet-700' : ''}`}
                          style={{ top: chip.top }}
                        >
                          {chip.risk.riskLevel === 'critical' ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Shield className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{chip.risk.category || 'Risk'}</span>
                          {chip.extraCount > 0 && (
                            <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                              +{chip.extraCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <AnimatePresence>
                  {isEditorDropActive && (
                    <motion.div
                      key="editor-drop-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-violet-300/80 bg-violet-50/35 dark:border-violet-600/80 dark:bg-violet-950/20"
                    >
                      {dropIndicator ? (
                        <>
                          <motion.div
                            layout={false}
                            className="absolute h-0.5 rounded-full bg-violet-500 shadow-[0_0_0_1px_rgba(255,255,255,0.9)] dark:bg-violet-300"
                            style={{ top: dropIndicator.top, left: dropIndicator.left, width: dropIndicator.width }}
                          />
                          <div
                            className="absolute rounded-full bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-lg dark:bg-slate-900 dark:text-violet-300"
                            style={{ top: Math.max(12, dropIndicator.top - 34), left: dropIndicator.left }}
                          >
                            {draggedSnippetLabel ? `Drop ${draggedSnippetLabel} here` : 'Drop here'}
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-x-0 top-6 flex justify-center">
                          <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-lg dark:bg-slate-900 dark:text-violet-300">
                            {draggedSnippetLabel ? `Move ${draggedSnippetLabel} into the draft` : 'Drop to insert into the draft'}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isEditing && showSlashMenu && (
                    <motion.div
                      key="slash-command-menu"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute z-20 w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                      style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
                    >
                      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <Zap className="h-3.5 w-3.5 text-violet-500" />
                          Slash commands
                          {slashQuery && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              /{slashQuery}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          Insert a structure block or send the selection to AI.
                        </p>
                      </div>

                      {filteredSlashCommands.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                          No command matches that shortcut.
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto py-1">
                          {filteredSlashCommands.map((command, index) => (
                            <button
                              key={command.id}
                              type="button"
                              onClick={() => handleApplySlashCommand(command)}
                              onMouseEnter={() => setSelectedSlashIndex(index)}
                              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                                index === selectedSlashIndex
                                  ? 'bg-violet-50 dark:bg-violet-950/40'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className={`mt-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                command.kind === 'block'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              }`}>
                                {command.kind === 'block' ? 'Block' : 'AI'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{command.label}</span>
                                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                    {command.kind === 'block' ? 'Insert block' : 'Ask AI'}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                  {command.description}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Enter to apply. Esc to close.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Auto-completion Popup */}
              <AnimatePresence>
                {showCompletionPopup && autoCompletions.length > 0 && (
                  <motion.div key="completion-popup"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-20 w-[calc(100%-2rem)] md:w-auto max-w-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                    style={{ top: completionPopupPos.top, left: Math.max(16, completionPopupPos.left) }}
                    role="listbox"
                    aria-label="Auto-complete suggestions"
                  >
                    <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Auto-complete suggestions</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Tab to accept</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {autoCompletions.map((completion, index) => (
                        <button
                          key={completion.id}
                          role="option"
                          aria-selected={index === selectedCompletionIndex}
                          onClick={() => applyCompletion(completion)}
                          className={`w-full px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0 ${
                            index === selectedCompletionIndex ? 'bg-violet-50 dark:bg-violet-900/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 px-1.5 py-0.5 rounded text-xs ${
                              completion.source === 'library' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' :
                              completion.source === 'historical' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
                            }`}>
                              {completion.source}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-slate-100 line-clamp-2">{completion.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {Math.round(completion.matchScore * 100)}% match
                                </span>
                                {completion.riskLevel && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(completion.riskLevel)}`}>
                                    {completion.riskLevel} risk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Desktop) */}
        {showDesktopSidebar && !focusMode && (
          <div className="hidden h-[calc(100vh-112px)] shrink-0 self-start lg:sticky lg:top-[88px] lg:flex">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize assistant panel"
              aria-valuemin={DESKTOP_SIDEBAR_MIN_WIDTH}
              aria-valuemax={DESKTOP_SIDEBAR_MAX_WIDTH}
              aria-valuenow={desktopSidebarWidth}
              tabIndex={0}
              onPointerDown={handleDesktopSidebarResizeStart}
              onKeyDown={handleDesktopSidebarResizeKeyDown}
              onDoubleClick={() => setClampedDesktopSidebarWidth(DESKTOP_SIDEBAR_DEFAULT_WIDTH)}
              className="group flex h-full w-4 cursor-col-resize touch-none items-center justify-center outline-none"
              title="Drag to resize the assistant panel. Double-click to reset."
            >
              <div className={`flex h-24 w-2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-400 shadow-sm transition-all duration-150 group-hover:border-violet-200 group-hover:text-violet-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-500 dark:group-hover:border-violet-800 dark:group-hover:text-violet-300 ${isResizingSidebar ? 'border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-300' : ''}`}>
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
            <div
              className="h-[calc(100vh-112px)] overflow-hidden rounded-[28px] border border-white/80 bg-white/84 shadow-[0_32px_90px_-56px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-800/88"
              style={{ width: desktopSidebarWidth }}
            >
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {showMobileSidebar && (
            <>
              <motion.div
                key="sidebar-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              />
              <motion.div
                key="sidebar-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 z-50 w-[85vw] max-w-[440px] border-l border-gray-200 bg-white/96 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/96 lg:hidden"
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">Assistant</h3>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                  </button>
                </div>
                <div className="h-[calc(100vh-56px)] min-h-0">
                  {renderSidebarContent()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Approval / Rejection Modal ── */}
      <AnimatePresence>
        {showApprovalModal && (
          <motion.div
            key="approval-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowApprovalModal(null)}
          >
            <motion.div
              key="approval-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {showApprovalModal === 'approve' ? 'Approve Draft' : showApprovalModal === 'reject' ? 'Reject Draft' : 'Submit for Review'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                {showApprovalModal === 'approve'
                  ? 'Are you sure you want to approve this draft? You may add an optional comment.'
                  : showApprovalModal === 'reject'
                  ? 'Please provide a reason for rejection.'
                  : 'Once submitted, the draft will be locked for review. Reviewers will be able to approve or request changes.'}
              </p>
              {showApprovalModal !== 'submit_review' && (
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={showApprovalModal === 'approve' ? 'Optional approval comment...' : 'Reason for rejection...'}
                rows={4}
                className={`w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 ${showApprovalModal === 'approve' ? 'focus:ring-green-500' : 'focus:ring-red-500'} resize-none`}
              />
              )}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setShowApprovalModal(null); setApprovalComment(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {showApprovalModal === 'approve' ? (
                  <button
                    onClick={() => { handleApprove(); }}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                ) : showApprovalModal === 'reject' ? (
                  <button
                    onClick={() => { handleReject(); }}
                    disabled={!approvalComment.trim()}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : (
                  <button
                    onClick={() => { handleStatusChange('IN_REVIEW'); setShowApprovalModal(null); }}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Submit for Review
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Version Diff Overlay ── */}
      <AnimatePresence>
        {showDiffView && diffVersions.length > 0 && (
          <motion.div
            key="diff-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              key="diff-panel"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-[1600px] max-h-[90vh] overflow-auto"
            >
              <VersionDiffView
                versions={diffVersions}
                onClose={() => setShowDiffView(false)}
                onRestore={async (version) => {
                  if (!editor) return;
                  try {
                    // Save current state first as a new version so nothing is lost
                    await handleSaveRef.current();
                    // Replace editor content with the restored version
                    editor.commands.setContent(version.content || '<p></p>');
                    setContentVersion((v) => v + 1);
                    // Persist as a new version (the restore itself becomes a save event)
                    await handleSaveRef.current();
                    // Refresh version list and close
                    await fetchVersions();
                    setShowDiffView(false);
                    toast.success(`Restored v${version.version}`, {
                      description: 'A new version was created from the restore.',
                    });
                  } catch (err) {
                    toast.error('Failed to restore version', {
                      description: err instanceof Error ? err.message : 'Please try again.',
                    });
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Negotiation Rationales Modal ── */}
      <AnimatePresence>
        {showRationalePanel && (
          <motion.div
            key="rationale-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowRationalePanel(false)}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
          >
            <motion.div
              key="rationale-panel"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Negotiation rationales</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Why each accepted clause was chosen — saved per draft. {rationales.length} recorded.
                  </div>
                </div>
                <button onClick={() => setShowRationalePanel(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
                {rationales.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No rationales yet. Select text in the draft and click &ldquo;Rationale&rdquo; to record why the wording was accepted.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {rationales.map((r) => (
                      <li key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <blockquote className="border-l-2 border-sky-400 pl-2 text-[12px] italic text-slate-600 dark:text-slate-300">
                          {r.quote}{r.quote.length >= 240 ? '…' : ''}
                        </blockquote>
                        <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">{r.note}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                          <span>{new Date(r.at).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => persistRationales(rationales.filter((x) => x.id !== r.id))}
                            className="text-rose-500 hover:text-rose-700 dark:text-rose-400"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {rationales.length > 0 && (
                <div className="flex justify-end border-t border-slate-200 px-4 py-2 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Clear all rationales?',
                        description: `All ${rationales.length} rationales for this draft will be removed.`,
                        confirmText: 'Clear all',
                        destructive: true,
                        variant: 'danger',
                      });
                      if (ok) persistRationales([]);
                    }}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-800 dark:text-rose-400"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section Jump (Ctrl+K) Modal ── */}
      <AnimatePresence>
        {showSectionJump && (
          <motion.div
            key="section-jump-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-24 px-4"
            onClick={() => { setShowSectionJump(false); setSectionJumpQuery(''); }}
          >
            <motion.div
              key="section-jump-card"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <input
                  autoFocus
                  value={sectionJumpQuery}
                  onChange={(e) => { setSectionJumpQuery(e.target.value); setSectionJumpIndex(0); }}
                  onKeyDown={(e) => {
                    const q = sectionJumpQuery.trim().toLowerCase();
                    const filtered = q ? outlineSections.filter(s => s.title.toLowerCase().includes(q)) : outlineSections;
                    if (e.key === 'Escape') { setShowSectionJump(false); setSectionJumpQuery(''); setSectionJumpIndex(0); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); setSectionJumpIndex(i => Math.min(filtered.length - 1, i + 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSectionJumpIndex(i => Math.max(0, i - 1)); }
                    else if (e.key === 'Enter') {
                      const match = filtered[sectionJumpIndex] || filtered[0];
                      if (match) {
                        handleFocusOutlineSection(match);
                        setShowSectionJump(false);
                        setSectionJumpQuery('');
                        setSectionJumpIndex(0);
                      }
                    }
                  }}
                  placeholder="Jump to section… (↑↓ navigate, ↵ jump, Esc close)"
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none px-2 py-1.5"
                />
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {(() => {
                  const q = sectionJumpQuery.trim().toLowerCase();
                  const filtered = q ? outlineSections.filter(s => s.title.toLowerCase().includes(q)) : outlineSections;
                  if (filtered.length === 0) {
                    return (
                      <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        {outlineSections.length === 0 ? 'No sections yet. Add a heading to get started.' : 'No sections match.'}
                      </div>
                    );
                  }
                  return filtered.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseEnter={() => setSectionJumpIndex(idx)}
                      onClick={() => { handleFocusOutlineSection(s); setShowSectionJump(false); setSectionJumpQuery(''); setSectionJumpIndex(0); }}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-800 dark:text-slate-100 ${idx === sectionJumpIndex ? 'bg-violet-100 dark:bg-violet-900/50' : 'hover:bg-violet-50 dark:hover:bg-violet-900/30'}`}
                    >
                      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 w-6">H{s.level}</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  ));
                })()}
              </div>
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                <kbd className="rounded bg-white dark:bg-slate-800 px-1 py-0.5 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">↑↓</kbd> nav · <kbd className="rounded bg-white dark:bg-slate-800 px-1 py-0.5 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">↵</kbd> jump · <kbd className="rounded bg-white dark:bg-slate-800 px-1 py-0.5 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Esc</kbd> close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Find & Replace (Ctrl+H) Modal ── */}
      <AnimatePresence>
        {showFindReplace && (
          <motion.div
            key="find-replace-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 right-6 z-[100] w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Find & Replace</span>
                <button
                  type="button"
                  onClick={() => setShowFindReplace(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm"
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 space-y-2">
                <input
                  autoFocus
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); findNext(); }
                    else if (e.key === 'Escape') setShowFindReplace(false);
                  }}
                  placeholder="Find…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
                />
                <input
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
                    else if (e.key === 'Escape') setShowFindReplace(false);
                  }}
                  placeholder="Replace with…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
                />
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={findCaseSensitive}
                    onChange={(e) => setFindCaseSensitive(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Case sensitive
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={findNext}
                    disabled={!findQuery}
                    className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Find next
                  </button>
                  <button
                    type="button"
                    onClick={replaceOne}
                    disabled={!findQuery}
                    className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={replaceAll}
                    disabled={!findQuery}
                    className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 px-2 py-1.5 text-xs font-medium text-white"
                  >
                    Replace all
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drafting Cheatsheet Modal ── */}
      <AnimatePresence>
        {showHelpCheatsheet && (
          <motion.div
            key="help-cheatsheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowHelpCheatsheet(false)}
          >
            <motion.div
              key="help-cheatsheet-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Drafting cheatsheet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Shortcuts, slash commands, and tips to draft faster
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpCheatsheet(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
                  aria-label="Close cheatsheet"
                >
                  ×
                </button>
              </div>
              <div className="p-5 max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Keyboard shortcuts</h4>
                  <ul className="space-y-1.5 text-sm">
                    {[
                      ['/', 'Open slash menu for blocks & AI'],
                      ['Ctrl + K', 'Jump to section'],
                      ['Ctrl + H', 'Find & replace'],
                      ['Ctrl + /', 'Jump to AI assistant'],
                      ['Alt + ↑ / ↓', 'Reorder outline sections'],
                      ['Ctrl + B / I', 'Bold / italic'],
                      ['Ctrl + Z', 'Undo'],
                      ['Ctrl + Shift + Z', 'Redo'],
                      ['Tab', 'Indent / accept autocomplete'],
                      ['Esc', 'Close menus and popovers'],
                    ].map(([key, desc]) => (
                      <li key={key} className="flex items-start gap-2">
                        <kbd className="shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">{key}</kbd>
                        <span className="text-slate-700 dark:text-slate-300">{desc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Slash commands</h4>
                  <ul className="space-y-1.5 text-sm">
                    {[
                      ['/parties', 'Insert a parties & purpose section'],
                      ['/definitions', 'Insert a definitions section'],
                      ['/fallback', 'Ask AI for a fallback clause package'],
                      ['/summary', 'Ask AI what is missing in the draft'],
                    ].map(([cmd, desc]) => (
                      <li key={cmd} className="flex items-start gap-2">
                        <code className="shrink-0 rounded bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 font-mono text-[11px] text-violet-700 dark:text-violet-300">{cmd}</code>
                        <span className="text-slate-700 dark:text-slate-300">{desc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="md:col-span-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Workflow tips</h4>
                  <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <li>• Select text before clicking an AI action to rewrite just that selection.</li>
                    <li>• Hover any outline section to duplicate or delete it.</li>
                    <li>• AI proposals show an <strong>Applied</strong> badge after you insert them — re-apply anytime.</li>
                    <li>• <strong>Reject</strong> preserves the proposal in the chat so you can review it later.</li>
                    <li>• Switch between <strong>Draft</strong> and <strong>Negotiate</strong> modes in the header to change AI posture.</li>
                  </ul>
                </section>
              </div>
              <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowHelpCheatsheet(false)}
                  className={`${draftingPrimaryButtonClass} text-sm`}
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CopilotDraftingCanvas;
