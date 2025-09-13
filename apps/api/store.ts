import type { z } from 'zod';
import { IngestionArtifactV1Schema, ClausesArtifactV1Schema, OverviewArtifactV1Schema, RatesArtifactV1Schema, RiskArtifactV1Schema, ComplianceArtifactV1Schema, BenchmarkArtifactV1Schema, ReportArtifactV1Schema } from '../../packages/schemas/src';
import fs from 'fs';
import path from 'path';
import { matchRole, reloadNormalizationDicts, addRoleAlias, getNormalizationState, matchSupplier } from './normalization/matcher';

export type IngestionArtifact = z.infer<typeof IngestionArtifactV1Schema>;
export type ClausesArtifact = z.infer<typeof ClausesArtifactV1Schema>;
export type OverviewArtifact = z.infer<typeof OverviewArtifactV1Schema>;
export type RatesArtifact = z.infer<typeof RatesArtifactV1Schema>;
export type RiskArtifact = z.infer<typeof RiskArtifactV1Schema>;
export type ComplianceArtifact = z.infer<typeof ComplianceArtifactV1Schema>;
export type BenchmarkArtifact = z.infer<typeof BenchmarkArtifactV1Schema>;
export type ReportArtifact = z.infer<typeof ReportArtifactV1Schema>;

export type ArtifactBundle = {
  ingestion?: IngestionArtifact;
  overview?: OverviewArtifact;
  clauses?: ClausesArtifact;
  rates?: RatesArtifact;
  risk?: RiskArtifact;
  compliance?: ComplianceArtifact;
  benchmark?: BenchmarkArtifact;
  report?: ReportArtifact;
};

const store = new Map<string, ArtifactBundle>();
const contracts = new Map<string, Contract>();
// App-wide events log (lightweight)
export type AppEvent = {
  id: string;
  ts: string;
  kind: string;
  by?: string;
  docId?: string;
  meta?: Record<string, any>;
};
const appEvents: AppEvent[] = [];
// Tenants (lightweight in-memory with disk persistence)
export type Tenant = {
  id: string;
  name: string;
  domain: string;
  active?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
const tenants = new Map<string, Tenant>();
// Idempotency index: content hash -> docId
const idempotIndex = new Map<string, string>();
// Templates repository (in-memory with disk persistence)
export type Template = {
  id: string;
  name: string;
  storagePath?: string;
  contentType?: string;
  text?: string; // extracted plain text for seeding into drafts
  clientId?: string;
  lob?: string; // line of business
  tags?: string[];
  // versioning
  version?: number; // defaults to 1
  parentId?: string; // if this is a version derived from another template
  changeNote?: string;
  // multi-tenant isolation (best-effort)
  tenantId?: string;
  createdAt: string; // ISO string for simplicity
  updatedAt: string;
};
const templates = new Map<string, Template>();
// Negotiation state per contract
type Party = 'client' | 'supplier' | 'ai';
export type Range = { start: number; end: number };
export type Anchor = Range & { textHash?: string; before?: string; after?: string };
export type NegotiationComment = {
  id: string;
  author: Party;
  channel: 'client' | 'supplier' | 'shared';
  text: string;
  range?: Anchor;
  status: 'open' | 'resolved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  // Optional actor for resolution; kept optional to avoid breaking existing data
  resolvedBy?: Party;
};
export type NegotiationHighlight = {
  id: string;
  author: Party;
  color: string; // e.g., '#f59e0b'
  note?: string;
  range: Anchor;
  createdAt: string;
  status?: 'open' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
};
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'needs-approval' | 'approved';
export type SuggestionPatch = {
  // Either positional or textual patch
  start?: number;
  end?: number;
  text?: string;
  from?: string;
  to?: string;
};
export type NegotiationSuggestion = {
  id: string;
  createdAt: string;
  createdBy: Party;
  type: 'change' | 'policy' | 'benchmark';
  message: string;
  range?: Anchor;
  patch?: SuggestionPatch;
  status: SuggestionStatus;
  approverRole?: 'Procurement' | 'Legal' | 'Finance' | 'Risk';
  approvedBy?: string;
  approvedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  highlightId?: string;
};
export type NegotiationEvent = {
  id: string;
  ts: string;
  by: Party | 'system';
  kind:
    | 'init'
    | 'content.update'
    | 'comment.add'
    | 'highlight.add'
  | 'highlight.approve'
    | 'suggestion.add'
    | 'suggestion.resolve'
    | 'suggestion.approve'
    | 'share.start'
    | 'baseline.lock';
  data?: any;
};
export type NegotiationState = {
  docId: string;
  content: string;
  version: number;
  baselineLocked: boolean;
  sharedWithSupplier: boolean;
  participants?: { client?: string; supplier?: string };
  // Negotiation metadata for drafting context
  meta?: {
    contractType?: 'MSA' | 'SOW' | 'LOI' | 'Secondment' | string;
    clientId?: string;
    supplierId?: string;
    policyPackId?: string;
  };
  comments: NegotiationComment[];
  highlights: NegotiationHighlight[];
  suggestions: NegotiationSuggestion[];
  audit: NegotiationEvent[];
  tasks?: Array<{ id: string; title: string; status: 'open'|'in-progress'|'done'; assignee?: string; dueDate?: string; relatedSuggestionId?: string; createdAt: string }>;
  // Optional content snapshots for diffing/restore
  snapshots?: Array<{ id: string; createdAt: string; author: Party | 'system'; label?: string; content: string; version: number }>;
};
const negotiations = new Map<string, NegotiationState>();
// Manual rate cards repository (not tied to a specific contract)
type ManualRate = {
  id: string;
  // Optional: tie this manual record to a specific contract doc (for overrides)
  docId?: string;
  supplierId?: string;
  role?: string;
  seniority?: string;
  currency?: string;
  uom?: string;
  amount?: number;
  dailyUsd?: number;
  country?: string;
  lineOfService?: string;
  // Optional: original extracted text snippet to anchor overrides more precisely
  sourceLine?: string;
  source?: 'manual' | 'import' | 'override';
  createdAt: string;
};
const manualRates: ManualRate[] = [];
// Pending (to-review) rate cards before approval into repository
export type PendingRate = {
  id: string;
  // Proposed record fields (same shape as ManualRate without createdAt auto)
  docId?: string;
  supplierId?: string;
  role?: string;
  seniority?: string;
  currency?: string;
  uom?: string;
  amount?: number;
  dailyUsd?: number;
  country?: string;
  lineOfService?: string;
  sourceLine?: string;
  source?: 'manual' | 'import' | 'override';
  createdAt: string;
  // Submission meta
  submittedBy?: string;
  submittedFrom?: 'ui' | 'csv' | 'api';
  // Validation meta
  validationErrors: string[];
  status: 'pending' | 'approved' | 'rejected';
};
const pendingRates: PendingRate[] = [];

// --- Persistence (optional JSON on disk) ---
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'tmp');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
// Control whether to hydrate demo data (artifacts/templates/etc.) from disk.
// Default to false to avoid stale placeholder artifacts in real runs.
const HYDRATE_DEMO = (process.env.API_HYDRATE_DEMO || 'false') === 'true';

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* noop */ }
}

function persist() {
  try {
    ensureDir();
    const data = {
      contracts: Array.from(contracts.entries()),
      store: Array.from(store.entries()),
      manualRates,
  pendingRates,
  negotiations: Array.from(negotiations.entries()),
  templates: Array.from(templates.entries()),
  appEvents,
  idempotIndex: Array.from(idempotIndex.entries()),
  tenants: Array.from(tenants.entries()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // best-effort persistence only
  }
}

function hydrate() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as { contracts?: [string, Contract][], store?: [string, ArtifactBundle][], manualRates?: ManualRate[], pendingRates?: PendingRate[], negotiations?: [string, NegotiationState][], templates?: [string, Template][], appEvents?: AppEvent[], idempotIndex?: [string, string][], tenants?: [string, Tenant][] };
    if (parsed.contracts) {
      for (const [k, v] of parsed.contracts) contracts.set(k, {
        ...v,
        // revive dates if stringified
        createdAt: new Date(v.createdAt as unknown as string),
        updatedAt: new Date(v.updatedAt as unknown as string),
      });
    }
    // Only hydrate artifact bundles when explicitly enabled
    if (HYDRATE_DEMO && parsed.store) {
      for (const [k, v] of parsed.store) store.set(k, v);
    }
    if (parsed.manualRates && Array.isArray(parsed.manualRates)) {
      manualRates.splice(0, manualRates.length, ...parsed.manualRates);
    }
    if (parsed.pendingRates && Array.isArray(parsed.pendingRates)) {
      pendingRates.splice(0, pendingRates.length, ...parsed.pendingRates);
    }
    if (HYDRATE_DEMO && parsed.negotiations && Array.isArray(parsed.negotiations)) {
      negotiations.clear();
      for (const [k, v] of parsed.negotiations) negotiations.set(k, v);
    }
    if (HYDRATE_DEMO && parsed.templates && Array.isArray(parsed.templates)) {
      templates.clear();
      for (const [k, v] of parsed.templates) templates.set(k, v);
    }
    if (HYDRATE_DEMO && Array.isArray(parsed.appEvents)) {
      appEvents.splice(0, appEvents.length, ...parsed.appEvents);
    }
    if (HYDRATE_DEMO && Array.isArray(parsed.idempotIndex)) {
      idempotIndex.clear();
      for (const [k, v] of parsed.idempotIndex) idempotIndex.set(k, v);
    }
    if (Array.isArray(parsed.tenants)) {
      tenants.clear();
      for (const [k, v] of parsed.tenants) tenants.set(k, v);
    }
  } catch {
    // ignore hydration errors
  }
}

hydrate();

export function saveArtifacts(docId: string, bundle: ArtifactBundle) {
  store.set(docId, { ...(store.get(docId) || {}), ...bundle });
  persist();
}

export function getArtifacts(docId: string): ArtifactBundle | undefined {
  return store.get(docId);
}

// Simple run/status tracking for demo orchestration
export type RunState = {
  runId: string;
  docId: string;
  createdAt: number;
  state: 'queued' | 'running' | 'completed' | 'failed';
  stages: Record<
    'ingestion' | 'overview' | 'clauses' | 'rates' | 'compliance' | 'benchmark' | 'risk' | 'report',
    { ready: boolean; error?: string; artifactUrl?: string }
  >;
};

const runs = new Map<string, RunState>(); // key: docId (one active run per doc for demo)

export function createRun(docId: string): RunState {
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const base = {
    ready: false as const,
    error: undefined as string | undefined,
    artifactUrl: undefined as string | undefined,
  };
  const run: RunState = {
    runId,
    docId,
    createdAt: Date.now(),
    state: 'queued',
    stages: {
      ingestion: { ...base },
      overview: { ...base },
      clauses: { ...base },
      rates: { ...base },
      compliance: { ...base },
      benchmark: { ...base },
      risk: { ...base },
      report: { ...base },
    },
  };
  runs.set(docId, run);
  return run;
}

export function getRun(docId: string): RunState | undefined {
  return runs.get(docId);
}

export function markStage(docId: string, stage: keyof RunState['stages'], ready: boolean, error?: string) {
  const run = runs.get(docId);
  if (!run) return;
  run.stages[stage].ready = ready;
  run.stages[stage].error = error;
  const urlByStage: Record<string, string> = {
    ingestion: `/api/contracts/${docId}/artifacts/ingestion.json`,
    overview: `/api/contracts/${docId}/artifacts/overview.json`,
    clauses: `/api/contracts/${docId}/artifacts/clauses.json`,
    rates: `/api/contracts/${docId}/artifacts/rates.json`,
    compliance: `/api/contracts/${docId}/artifacts/compliance.json`,
    benchmark: `/api/contracts/${docId}/artifacts/benchmark.json`,
    risk: `/api/contracts/${docId}/artifacts/risk.json`,
    report: `/api/contracts/${docId}/report.pdf`,
  };
  run.stages[stage].artifactUrl = ready ? urlByStage[stage] : undefined;
  // Mark overall state
  // Treat 'report' as optional for completion: complete when all core stages are ready.
  const coreStagesReady = Object.entries(run.stages)
    .filter(([k]) => k !== 'report')
    .every(([, s]) => s.ready);
  run.state = error ? 'failed' : coreStagesReady ? 'completed' : 'running';
}

export function getSection(docId: string, section: keyof ArtifactBundle) {
  const a = store.get(docId) || {};
  return (a as any)[section];
}

// Simple in-memory contracts store for demo mode (no DB)
export type Contract = {
  id: string;
  name: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  storagePath?: string;
  clientId?: string; // optional client owning this contract
  supplierId?: string; // canonical supplier ID
  // multi-tenant isolation (best-effort)
  tenantId?: string;
  // soft-archive flag
  archived?: boolean;
};

export function addContract(c: Contract) {
  contracts.set(c.id, c);
  persist();
}

export function updateContract(id: string, patch: Partial<Contract>) {
  const curr = contracts.get(id);
  if (!curr) return;
  const next = { ...curr, ...patch, updatedAt: patch.updatedAt ?? new Date() };
  contracts.set(id, next);
  persist();
}

export function getContract(id: string, tenantId?: string): Contract | undefined {
  const contract = contracts.get(id);
  if (!contract) return undefined;
  if (tenantId && (contract.tenantId || 'demo') !== tenantId) {
    return undefined;
  }
  return contract;
}

export function listContracts(tenantId?: string, opts: { archived?: boolean } = {}): Contract[] {
  let items = Array.from(contracts.values());
  if (tenantId) {
    items = items.filter(c => (c.tenantId || 'demo') === tenantId);
  }
  // default to not showing archived
  const showArchived = opts.archived === true;
  items = items.filter(c => (c.archived || false) === showArchived);

  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// --- App events helpers ---
export function addAppEvent(e: Omit<AppEvent, 'id' | 'ts'> & { id?: string; ts?: string }) {
  const rec: AppEvent = {
    id: e.id || `ae-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: e.ts || new Date().toISOString(),
    kind: e.kind,
    by: e.by,
    docId: e.docId,
    meta: e.meta,
  };
  appEvents.push(rec);
  // Trim to last 5000 events to avoid unbounded growth
  if (appEvents.length > 5000) appEvents.splice(0, appEvents.length - 5000);
  persist();
  return rec;
}

export function listAppEvents(limit = 200): AppEvent[] {
  const n = Math.max(1, Math.min(2000, limit));
  return appEvents.slice(-n).reverse();
}

// --- Idempotency helpers ---
export function findDocByContentHash(contentHash: string): string | undefined {
  return idempotIndex.get(contentHash);
}

export function rememberDocContentHash(docId: string, contentHash: string) {
  idempotIndex.set(contentHash, docId);
  persist();
}

// Utilities for aggregation and listing
export function listDocIds(): string[] {
  return Array.from(store.keys());
}

export function getAllBundles(): Array<{ docId: string; bundle: ArtifactBundle }> {
  return Array.from(store.entries()).map(([docId, bundle]) => ({ docId, bundle }));
}

// --- Templates API (in-memory) ---
export function addTemplate(t: Template) {
  // default versioning fields
  const rec: Template = {
    version: 1,
    ...t,
  };
  if (!rec.version || rec.version < 1) rec.version = 1;
  templates.set(rec.id, rec);
  persist();
}

export function updateTemplate(id: string, patch: Partial<Template>) {
  const curr = templates.get(id);
  if (!curr) return;
  const next = { ...curr, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
  templates.set(id, next);
  persist();
}

export function listTemplates(): Template[] {
  return Array.from(templates.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getTemplate(id: string): Template | undefined {
  return templates.get(id);
}

export function listTemplateHistory(id: string): Template[] {
  // Collect this template and all descendants in the chain
  const base = templates.get(id);
  if (!base) return [];
  const chain: Template[] = [];
  // Walk backwards to the root
  let curr: Template | undefined = base;
  while (curr) {
    chain.push(curr);
    if (!curr.parentId) break;
    curr = templates.get(curr.parentId);
  }
  // Sort ascending by version if present, otherwise by updatedAt asc
  return chain
    .slice()
    .sort((a, b) => (a.version || 1) - (b.version || 1) || new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

// --- Tenant management (in-memory) ---
export function listTenants(): Tenant[] {
  return Array.from(tenants.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function addTenant(data: { name: string; domain: string; active?: boolean }): Tenant {
  const now = new Date().toISOString();
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rec: Tenant = {
    id,
    name: data.name,
    domain: data.domain,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  tenants.set(id, rec);
  persist();
  return rec;
}

export function getTenant(id: string): Tenant | undefined {
  return tenants.get(id);
}

export function updateTenant(id: string, patch: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Tenant | undefined {
  const curr = tenants.get(id);
  if (!curr) return undefined;
  const next: Tenant = { ...curr, ...patch, updatedAt: new Date().toISOString() };
  tenants.set(id, next);
  persist();
  return next;
}

export function deleteTenant(id: string): boolean {
  const ok = tenants.delete(id);
  persist();
  return ok;
}

export function createTemplateVersion(id: string, patch: Partial<Template>): Template | undefined {
  const base = templates.get(id);
  if (!base) return undefined;
  const nextId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const now = new Date().toISOString();
  const rec: Template = {
    ...base,
    id: nextId,
    name: patch.name ?? base.name,
    text: patch.text ?? base.text,
    tags: patch.tags ?? base.tags,
    lob: patch.lob ?? base.lob,
    clientId: patch.clientId ?? base.clientId,
    tenantId: patch.tenantId ?? base.tenantId,
    version: (base.version || 1) + 1,
    parentId: base.id,
    changeNote: patch.changeNote,
    createdAt: now,
    updatedAt: now,
  };
  templates.set(rec.id, rec);
  persist();
  return rec;
}

export function getAllRates(): Array<{ docId: string; role?: string; dailyUsd?: number; currency?: string; uom?: string; raw?: any }>{
  // 1) Collect extracted doc rates
  const docRates: Array<{ docId: string; role?: string; dailyUsd?: number; currency?: string; uom?: string; raw?: any }> = [];
  // Cache inferred supplierId per doc
  const supplierIdByDoc = new Map<string, string | undefined>();
  for (const [docId, bundle] of store.entries()) {
    const rates = (bundle as any)?.rates?.rates as any[] | undefined;
    if (!rates) continue;
    // Try to infer supplierId from overview parties once per doc
    if (!supplierIdByDoc.has(docId)) {
      try {
        const parties: string[] = Array.isArray((bundle as any)?.overview?.parties) ? (bundle as any).overview.parties : [];
        const supplierLike = parties.find((p) => /supplier\b/i.test(p));
        const inferredName = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
        if (inferredName) {
          const m = matchSupplier(inferredName);
          if (m.status === 'auto' && m.selectedId) supplierIdByDoc.set(docId, m.selectedId);
          else supplierIdByDoc.set(docId, undefined);
        } else {
          supplierIdByDoc.set(docId, undefined);
        }
      } catch {
        supplierIdByDoc.set(docId, undefined);
      }
    }
    for (const r of rates) {
      const supplierId = supplierIdByDoc.get(docId);
      // attach inferred supplierId into raw for downstream grouping/filters
      const raw = supplierId ? { ...r, supplierId } : r;
      docRates.push({ docId, role: r.role || r.rateName, dailyUsd: r.dailyUsd ?? r.value, currency: r.currency, uom: r.uom, raw });
    }
  }

  // 2) Partition manual rates: overrides (target specific docs) vs general (manual/import)
  const overrides = manualRates.filter((m) => m.source === 'override' && m.docId);
  const general = manualRates.filter((m) => !(m.source === 'override' && m.docId));

  // Helper to build a fuzzy key for matching rows
  const keyFor = (docId: string, raw: any, role?: string, country?: string, lineOfService?: string, sourceLine?: string) => {
    const kDoc = (docId || '').toLowerCase();
    const kLine = (sourceLine || raw?.sourceLine || '').toLowerCase();
    const kRole = ((role || raw?.role || raw?.rateName) || '').toLowerCase();
    const kCountry = ((country || raw?.country) || '').toLowerCase();
    const kLos = ((lineOfService || raw?.lineOfService || raw?.los) || '').toLowerCase();
    // Prefer matching by sourceLine when available; otherwise fallback to tuple
    return `${kDoc}::${kLine || `${kRole}::${kCountry}::${kLos}`}`;
  };

  // Build override map keyed to extracted rows
  const overrideMap = new Map<string, ManualRate>();
  for (const m of overrides) {
    const k = keyFor(m.docId!, undefined as any, m.role, m.country, m.lineOfService, m.sourceLine);
    overrideMap.set(k, m);
  }

  // 3) Apply overrides onto extracted doc rates, substituting values and injecting an id for editability
  const mergedDocRates = docRates.map((row) => {
    const key = keyFor(row.docId, row.raw, row.role, row.raw?.country, row.raw?.lineOfService || row.raw?.los, row.raw?.sourceLine);
    const ov = overrideMap.get(key);
    if (!ov) return row;
    return {
      docId: row.docId,
      // keep supplierId from override if present
      // role & numeric fields can be overridden
      role: ov.role ?? row.role,
      dailyUsd: ov.dailyUsd ?? row.dailyUsd,
      currency: ov.currency ?? row.currency,
      uom: ov.uom ?? row.uom,
      raw: {
        ...row.raw,
        // carry through context fields for display
        country: ov.country ?? row.raw?.country,
        lineOfService: ov.lineOfService ?? (row.raw?.lineOfService || row.raw?.los),
        sourceLine: ov.sourceLine ?? row.raw?.sourceLine,
        supplierId: ov.supplierId ?? row.raw?.supplierId,
        // critical: surface an id so UI can PUT/DELETE later
        id: ov.id,
        overrideOf: {
          role: row.role,
          dailyUsd: row.dailyUsd,
          currency: row.currency,
          uom: row.uom,
        },
      },
    };
  });

  // 4) Include general manual/imported rates under pseudo-docId 'manual'
  const manualOut = general.map((m) => ({
    docId: 'manual',
    role: m.role,
    dailyUsd: m.dailyUsd,
    currency: m.currency,
    uom: m.uom,
    raw: { ...m },
  }));

  return [...mergedDocRates, ...manualOut];
}

export function addManualRate(r: Omit<ManualRate, 'id' | 'createdAt'> & { id?: string }) {
  // Prevent exact duplicates for the same docId + role + country + lineOfService + dailyUsd + currency + uom
  const exists = manualRates.find(m =>
    (m.docId || '') === (r.docId || '') &&
    (m.role || '').toLowerCase() === String(r.role || '').toLowerCase() &&
    String(m.country || '').toLowerCase() === String(r.country || '').toLowerCase() &&
    String(m.lineOfService || '').toLowerCase() === String(r.lineOfService || '').toLowerCase() &&
    Number(m.dailyUsd ?? 0) === Number((r as any).dailyUsd ?? 0) &&
    String(m.currency || '').toUpperCase() === String(r.currency || '').toUpperCase() &&
    String(m.uom || '').toLowerCase() === String(r.uom || '').toLowerCase()
  );
  if (exists) return exists;
  const id = r.id || `mr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const rec: ManualRate = { id, createdAt: new Date().toISOString(), ...r } as ManualRate;
  manualRates.push(rec);
  persist();
  return rec;
}

export function bulkAddManualRates(rows: Array<Omit<ManualRate, 'id' | 'createdAt'>>) {
  const added: ManualRate[] = [];
  for (const r of rows) {
    const exists = manualRates.find(m =>
      (m.docId || '') === (r.docId || '') &&
      (m.role || '').toLowerCase() === String(r.role || '').toLowerCase() &&
      String(m.country || '').toLowerCase() === String(r.country || '').toLowerCase() &&
      String(m.lineOfService || '').toLowerCase() === String(r.lineOfService || '').toLowerCase() &&
      Number(m.dailyUsd ?? 0) === Number((r as any).dailyUsd ?? 0) &&
      String(m.currency || '').toUpperCase() === String(r.currency || '').toUpperCase() &&
      String(m.uom || '').toLowerCase() === String(r.uom || '').toLowerCase()
    );
    if (exists) { continue; }
    const rec: ManualRate = { id: `mr-${Date.now()}-${Math.random().toString(36).slice(2,8)}` , createdAt: new Date().toISOString(), ...r } as ManualRate;
    manualRates.push(rec);
    added.push(rec);
  }
  persist();
  return added;
}

export function listManualRates() {
  return manualRates.slice();
}

export function deleteManualRate(id: string): boolean {
  const idx = manualRates.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  manualRates.splice(idx, 1);
  persist();
  return true;
}

export function updateManualRate(id: string, patch: Partial<Omit<ManualRate, 'id' | 'createdAt'>>) : boolean {
  const idx = manualRates.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  manualRates[idx] = { ...manualRates[idx], ...patch } as any;
  persist();
  return true;
}

// ---- Pending Rate Validation & Workflow ----
// Lightweight validation (no zod import dependency here to keep store simple)
export function validatePendingRateShape(r: Partial<Omit<ManualRate, 'id' | 'createdAt'>>): string[] {
  const errs: string[] = [];
  const role = (r.role || '').toString().trim();
  const currency = (r.currency || '').toString().trim().toUpperCase();
  const uom = (r.uom || '').toString().trim().toLowerCase();
  const hasAmount = typeof r.amount === 'number' && !Number.isNaN(r.amount);
  const hasDailyUsd = typeof r.dailyUsd === 'number' && !Number.isNaN(r.dailyUsd);
  if (!role) errs.push('role is required');
  if (!currency) errs.push('currency is required');
  if (!uom) errs.push('uom is required');
  if (!hasAmount && !hasDailyUsd) errs.push('one of amount or dailyUsd is required');
  if (currency && !/^[A-Z]{3}$/.test(currency)) errs.push('currency must be 3-letter code');
  if (uom && !['day','hour','week','month','year','daily','hourly'].includes(uom)) errs.push('uom must be day/hour/week/month/year');
  const amt = hasAmount ? Number(r.amount) : undefined;
  const dusd = hasDailyUsd ? Number(r.dailyUsd) : undefined;
  if (amt !== undefined && amt < 0) errs.push('amount must be >= 0');
  if (dusd !== undefined && dusd < 0) errs.push('dailyUsd must be >= 0');
  return errs;
}

export function listPendingRates(): PendingRate[] {
  return pendingRates.slice();
}

export function addPendingRate(r: Partial<Omit<ManualRate, 'id' | 'createdAt'>> & { id?: string, source?: ManualRate['source'], submittedBy?: string, submittedFrom?: 'ui' | 'csv' | 'api' }): PendingRate {
  const id = r.id || `pr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const errors = validatePendingRateShape(r);
  // Attempt role normalization (non-blocking)
  let normRole = r.role;
  try {
    if (r.role) {
      const m = matchRole(r.role, r.lineOfService ? [r.lineOfService] : undefined);
      if (m.status === 'auto' && m.selectedId) {
        // Replace role with canonical name
        const top = m.matches.find((x) => x.id === m.selectedId);
        if (top) normRole = top.canonicalName;
      }
    }
  } catch {
    // ignore normalization errors
  }
  // Attempt supplier normalization (best-effort)
  let normSupplierId: string | undefined = r.supplierId;
  try {
    if (!normSupplierId && r.docId) {
      const ov: any = getSection(r.docId, 'overview');
      const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const inferredName = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
      if (inferredName) {
        const m = matchSupplier(inferredName);
        if (m.status === 'auto' && m.selectedId) normSupplierId = m.selectedId;
      }
    }
  } catch {
    // ignore supplier normalization errors
  }
  const rec: PendingRate = {
    id,
    createdAt: new Date().toISOString(),
    docId: r.docId,
    supplierId: normSupplierId,
    role: normRole,
    seniority: r.seniority,
    currency: r.currency?.toUpperCase(),
    uom: r.uom?.toLowerCase(),
    amount: typeof r.amount === 'number' ? r.amount : undefined,
    dailyUsd: typeof r.dailyUsd === 'number' ? r.dailyUsd : undefined,
    country: r.country,
    lineOfService: r.lineOfService,
    sourceLine: r.sourceLine,
    source: r.source || 'manual',
  submittedBy: r.submittedBy,
  submittedFrom: r.submittedFrom,
    validationErrors: errors,
    status: 'pending',
  };
  pendingRates.push(rec);
  persist();
  return rec;
}

export function bulkAddPendingRates(rows: Array<Partial<Omit<ManualRate, 'id' | 'createdAt'>> & { source?: ManualRate['source'], submittedBy?: string, submittedFrom?: 'ui' | 'csv' | 'api' }>): PendingRate[] {
  const added: PendingRate[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = [
      String(r.docId || '' ).toLowerCase(),
      String(r.role || '').toLowerCase(),
      String(r.country || '').toLowerCase(),
      String(r.lineOfService || '').toLowerCase(),
      String(r.currency || '').toUpperCase(),
      String(r.uom || '').toLowerCase(),
      String(typeof r.dailyUsd === 'number' ? r.dailyUsd : r.dailyUsd ?? ''),
      String(typeof r.amount === 'number' ? r.amount : r.amount ?? ''),
      String((r as any).sourceLine || '')
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(addPendingRate(r));
  }
  return added;
}

export function updatePendingRate(id: string, patch: Partial<Omit<PendingRate, 'id' | 'createdAt' | 'validationErrors' | 'status'>>): PendingRate | undefined {
  const idx = pendingRates.findIndex(p => p.id === id);
  if (idx === -1) return undefined;
  const next = { ...pendingRates[idx], ...patch } as PendingRate;
  // Re-validate after edit
  const errs = validatePendingRateShape(next);
  next.validationErrors = errs;
  pendingRates[idx] = next;
  persist();
  return next;
}

export function deletePendingRate(id: string): boolean {
  const idx = pendingRates.findIndex(p => p.id === id);
  if (idx === -1) return false;
  pendingRates.splice(idx, 1);
  persist();
  return true;
}

export function approvePendingRate(id: string): { approved?: ManualRate; error?: string } {
  const idx = pendingRates.findIndex(p => p.id === id);
  if (idx === -1) return { error: 'not-found' };
  const rec = pendingRates[idx];
  if (rec.validationErrors.length) return { error: 'invalid' };
  // Move into manualRates
  const created = addManualRate({
    id: undefined,
    source: rec.source || 'manual',
    docId: rec.docId,
  supplierId: rec.supplierId,
    role: rec.role,
    seniority: rec.seniority,
    currency: rec.currency,
    uom: rec.uom,
    amount: rec.amount,
    dailyUsd: rec.dailyUsd,
    country: rec.country,
    lineOfService: rec.lineOfService,
    sourceLine: rec.sourceLine,
  });
  // Mark and remove from pending
  pendingRates.splice(idx, 1);
  persist();
  return { approved: created };
}

export function rejectPendingRate(id: string): boolean {
  return deletePendingRate(id);
}

export function approveAllValidPending(): { total: number; approved: number; invalid: number } {
  const total = pendingRates.length;
  let approved = 0;
  // Work on a shallow copy of ids to avoid index shifts while mutating
  const ids = pendingRates.map(p => p.id);
  for (const id of ids) {
    const rec = pendingRates.find(p => p.id === id);
    if (!rec) continue;
    // Ensure validation reflects latest shape
    const errs = validatePendingRateShape(rec);
    rec.validationErrors = errs;
    if (errs.length === 0) {
      const res = approvePendingRate(id);
      if (res.approved) approved += 1;
    }
  }
  const invalid = Math.max(0, total - approved);
  return { total, approved, invalid };
}

export function bulkRejectPending(ids: string[]): { rejected: number; notFound: number } {
  let rejected = 0;
  let notFound = 0;
  for (const id of ids) {
    const ok = rejectPendingRate(id);
    if (ok) rejected += 1; else notFound += 1;
  }
  return { rejected, notFound };
}

// --- Normalization admin helpers (re-export for routes) ---
export const normalization = {
  reload: reloadNormalizationDicts,
  addRoleAlias,
  state: getNormalizationState,
};

// ---- Negotiation helpers ----
export function getNegotiation(docId: string): NegotiationState | undefined {
  return negotiations.get(docId);
}

export function initNegotiation(docId: string, baseline: string, participants?: { client?: string; supplier?: string }): NegotiationState {
  const s: NegotiationState = {
    docId,
    content: baseline || '',
    version: 1,
    baselineLocked: false,
    sharedWithSupplier: false,
    participants,
  meta: {},
    comments: [],
    highlights: [],
    suggestions: [],
    audit: [
      { id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by: 'system', kind: 'init', data: { participants } },
    ],
  };
  negotiations.set(docId, s);
  persist();
  try { addAppEvent({ kind: 'negotiate.init', docId, meta: { participants } }); } catch {}
  return s;
}

export function updateNegotiationContent(docId: string, content: string, by: Party): NegotiationState | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  // Attempt re-anchor highlights/comments using simple context search
  const prev = s.content;
  s.content = content;
  s.version += 1;
  try {
    const reanchor = (a?: Anchor): Anchor | undefined => {
      if (!a) return undefined;
      // Direct fallback if same span exists
      const snippet = prev.slice(a.start, a.end);
      const idx = content.indexOf(snippet);
      if (snippet && idx !== -1) return { ...a, start: idx, end: idx + snippet.length };
      // Try using before/after anchors
      const beforeIdx = a.before ? content.indexOf(a.before) : -1;
      const afterIdx = a.after ? content.indexOf(a.after) : -1;
      if (beforeIdx !== -1 && afterIdx !== -1 && afterIdx > beforeIdx) {
        return { ...a, start: beforeIdx + (a.before?.length || 0), end: afterIdx };
      }
      return a; // as-is if not found
    };
    s.highlights = s.highlights.map(h => ({ ...h, range: reanchor(h.range) || h.range }));
    s.comments = s.comments.map(c => ({ ...c, range: reanchor(c.range) }));
    s.suggestions = s.suggestions.map(g => ({ ...g, range: reanchor(g.range) }));
  } catch {}
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by, kind: 'content.update' });
  persist();
  try { addAppEvent({ kind: 'negotiate.content.update', docId, by }); } catch {}
  return s;
}

export function updateNegotiationMeta(docId: string, patch: NonNullable<NegotiationState['meta']>): NegotiationState | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  s.meta = { ...(s.meta || {}), ...(patch || {}) };
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by: 'system', kind: 'content.update', data: { meta: s.meta } });
  persist();
  try { addAppEvent({ kind: 'negotiate.meta.update', docId, meta: { meta: s.meta } }); } catch {}
  return s;
}

export function addComment(docId: string, c: Omit<NegotiationComment, 'id' | 'createdAt' | 'status'> & { status?: NegotiationComment['status'] }): NegotiationComment | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  // Decorate anchor with context
  const anchor = c.range ? { ...c.range } as Anchor : undefined;
  if (anchor) {
    anchor.before = s.content.slice(Math.max(0, anchor.start - 20), anchor.start);
    anchor.after = s.content.slice(anchor.end, Math.min(s.content.length, anchor.end + 20));
    anchor.textHash = (s.content.slice(anchor.start, anchor.end) || '').slice(0, 256);
  }
  const rec: NegotiationComment = {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    createdAt: new Date().toISOString(),
    status: c.status ?? 'open',
    author: c.author,
    channel: c.channel,
    text: c.text,
  range: anchor,
  };
  s.comments.push(rec);
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: rec.createdAt, by: c.author, kind: 'comment.add', data: { id: rec.id } });
  persist();
  try { addAppEvent({ kind: 'negotiate.comment.add', docId, by: c.author, meta: { id: rec.id } }); } catch {}
  return rec;
}

export function updateCommentStatus(docId: string, commentId: string, status: 'open' | 'resolved' | 'rejected', by: Party): NegotiationComment | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const c = s.comments.find(x => x.id === commentId);
  if (!c) return undefined;
  c.status = status;
  if (status === 'resolved') {
    c.resolvedAt = new Date().toISOString();
    c.resolvedBy = by;
  } else if (status === 'open') {
    delete c.resolvedAt;
    delete c.resolvedBy;
  }
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by, kind: 'comment.add', data: { id: c.id, status } });
  persist();
  try { addAppEvent({ kind: 'negotiate.comment.status', docId, by, meta: { id: c.id, status } }); } catch {}
  return c;
}

export function addHighlight(docId: string, h: Omit<NegotiationHighlight, 'id' | 'createdAt'>): NegotiationHighlight | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const anchor: Anchor = { ...h.range } as any;
  anchor.before = s.content.slice(Math.max(0, anchor.start - 20), anchor.start);
  anchor.after = s.content.slice(anchor.end, Math.min(s.content.length, anchor.end + 20));
  anchor.textHash = (s.content.slice(anchor.start, anchor.end) || '').slice(0, 256);
  const rec: NegotiationHighlight = { id: `h-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, createdAt: new Date().toISOString(), status: 'open', ...h, range: anchor };
  s.highlights.push(rec);
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: rec.createdAt, by: h.author, kind: 'highlight.add', data: { id: rec.id } });
  persist();
  try { addAppEvent({ kind: 'negotiate.highlight.add', docId, by: h.author, meta: { id: rec.id } }); } catch {}
  return rec;
}

export function approveHighlight(docId: string, id: string, by: Party): NegotiationHighlight | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const h = s.highlights.find(x => x.id === id);
  if (!h) return undefined;
  h.status = 'approved';
  h.approvedBy = by;
  h.approvedAt = new Date().toISOString();
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: h.approvedAt!, by, kind: 'highlight.approve', data: { id } });
  persist();
  try { addAppEvent({ kind: 'negotiate.highlight.approve', docId, by, meta: { id } }); } catch {}
  return h;
}

function simplePolicyGate(message: string, patch?: SuggestionPatch): { approverRole?: NegotiationSuggestion['approverRole'] } {
  const m = message.toLowerCase();
  // Payment terms > 30 days => Procurement
  const dayMatch = m.match(/(\d{2,3})\s*day/);
  if (/(payment|payable)/.test(m) && dayMatch) {
    const days = parseInt(dayMatch[1] || '0', 10);
    if (days > 30) return { approverRole: 'Procurement' };
  }
  // Unlimited liability or very high caps => Legal
  if (m.includes('unlimited liability') || m.includes('unlimited') || /liabilit(y|ies)/.test(m)) {
    return { approverRole: 'Legal' };
  }
  return {};
}

export function addSuggestion(docId: string, sIn: Omit<NegotiationSuggestion, 'id' | 'createdAt' | 'status' | 'approvedBy' | 'approvedAt' | 'resolvedBy' | 'resolvedAt' | 'highlightId'> & { approverRole?: NegotiationSuggestion['approverRole'] }): NegotiationSuggestion | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  // Allow explicit approverRole (UI-driven) or infer via gate
  const gate = sIn.approverRole ? { approverRole: sIn.approverRole } : simplePolicyGate(sIn.message, sIn.patch);
  // Try to resolve a range if not provided
  let resolvedRange: Anchor | undefined = sIn.range as any;
  if (!resolvedRange && sIn.patch) {
    const { start, end, from } = sIn.patch;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      resolvedRange = { start, end, before: s.content.slice(Math.max(0, start - 20), start), after: s.content.slice(end, Math.min(s.content.length, end + 20)), textHash: (s.content.slice(start, end) || '').slice(0,256) } as Anchor;
    } else if (typeof from === 'string' && from.length > 0) {
      const idx = s.content.indexOf(from);
      if (idx !== -1) {
        const start2 = idx, end2 = idx + from.length;
        resolvedRange = { start: start2, end: end2, before: s.content.slice(Math.max(0, start2 - 20), start2), after: s.content.slice(end2, Math.min(s.content.length, end2 + 20)), textHash: (s.content.slice(start2, end2) || '').slice(0,256) } as Anchor;
      }
    }
  }
  const rec: NegotiationSuggestion = {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    createdAt: new Date().toISOString(),
    createdBy: sIn.createdBy,
    type: sIn.type,
    message: sIn.message,
    range: resolvedRange,
    patch: sIn.patch,
    status: gate.approverRole ? 'needs-approval' : 'pending',
    approverRole: gate.approverRole,
  };
  s.suggestions.push(rec);
  // Auto-highlight needs-approval ranges
  if (rec.status === 'needs-approval' && rec.range) {
    const hl: NegotiationHighlight = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      author: 'ai',
      color: '#fee2e2', // red-100
      note: rec.approverRole ? `Needs ${rec.approverRole} approval` : 'Needs approval',
      range: rec.range,
      createdAt: new Date().toISOString(),
    };
    s.highlights.push(hl);
    rec.highlightId = hl.id;
  }
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: rec.createdAt, by: sIn.createdBy, kind: 'suggestion.add', data: { id: rec.id } });
  persist();
  try { addAppEvent({ kind: 'negotiate.suggestion.add', docId, by: sIn.createdBy, meta: { id: rec.id, approverRole: rec.approverRole, status: rec.status } }); } catch {}
  return rec;
}

export function approveSuggestion(docId: string, suggestionId: string, by: string, role: NonNullable<NegotiationSuggestion['approverRole']>): NegotiationSuggestion | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const idx = s.suggestions.findIndex(x => x.id === suggestionId);
  if (idx === -1) return undefined;
  const sug = s.suggestions[idx];
  if (sug.status !== 'needs-approval') return sug;
  if (sug.approverRole && sug.approverRole !== role) return sug;
  sug.status = 'approved';
  sug.approvedBy = by;
  sug.approvedAt = new Date().toISOString();
  // Remove auto highlight if any
  if (sug.highlightId) {
    const hi = s.highlights.findIndex(h => h.id === sug.highlightId);
    if (hi !== -1) s.highlights.splice(hi, 1);
    delete sug.highlightId;
  }
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: sug.approvedAt, by: 'system', kind: 'suggestion.approve', data: { id: sug.id, by, role } });
  persist();
  try { addAppEvent({ kind: 'negotiate.suggestion.approve', docId, by, meta: { id: sug.id, role } }); } catch {}
  return sug;
}

export function resolveSuggestion(docId: string, suggestionId: string, action: 'accept' | 'reject', by: Party): NegotiationSuggestion | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const idx = s.suggestions.findIndex(x => x.id === suggestionId);
  if (idx === -1) return undefined;
  const sug = s.suggestions[idx];
  if (action === 'reject') {
    sug.status = 'rejected';
  } else {
    // If needs-approval and not approved, do not accept
    if (sug.status === 'needs-approval') {
      return sug;
    }
    sug.status = 'accepted';
    // Apply patch to content if provided
    if (sug.patch) {
      const { start, end, text, from, to } = sug.patch;
      if (typeof start === 'number' && typeof end === 'number') {
        s.content = s.content.slice(0, start) + (text ?? '') + s.content.slice(end);
        s.version += 1;
      } else if (typeof from === 'string' && typeof to === 'string' && from.length > 0) {
        const idx2 = s.content.indexOf(from);
        if (idx2 !== -1) {
          s.content = s.content.slice(0, idx2) + to + s.content.slice(idx2 + from.length);
          s.version += 1;
        }
      }
    }
  }
  sug.resolvedBy = by;
  sug.resolvedAt = new Date().toISOString();
  // Remove auto highlight if any
  if (sug.highlightId) {
    const hi = s.highlights.findIndex(h => h.id === sug.highlightId);
    if (hi !== -1) s.highlights.splice(hi, 1);
    delete sug.highlightId;
  }
  s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: sug.resolvedAt, by, kind: 'suggestion.resolve', data: { id: sug.id, action } });
  persist();
  try { addAppEvent({ kind: 'negotiate.suggestion.resolve', docId, by, meta: { id: sug.id, action } }); } catch {}
  return sug;
}

export function listNegotiationTasks(docId: string) {
  const s = negotiations.get(docId);
  if (!s) return { approvals: [] as NegotiationSuggestion[], tasks: [] as any[] };
  return { approvals: s.suggestions.filter(x => x.status === 'needs-approval'), tasks: s.tasks || [] };
}

export function getNegotiationAudit(docId: string): NegotiationEvent[] {
  const s = negotiations.get(docId);
  if (!s) return [];
  return s.audit.slice().reverse();
}

export function addTask(docId: string, title: string, opts?: { assignee?: string; dueDate?: string; relatedSuggestionId?: string }) {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const t = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title, status: 'open' as const, assignee: opts?.assignee, dueDate: opts?.dueDate, relatedSuggestionId: opts?.relatedSuggestionId, createdAt: new Date().toISOString() };
  s.tasks = s.tasks || [];
  s.tasks.push(t);
  persist();
  try { addAppEvent({ kind: 'task.add', docId, meta: { id: t.id, title } }); } catch {}
  return t;
}

export function updateTask(docId: string, id: string, patch: Partial<{ title: string; status: 'open'|'in-progress'|'done'; assignee?: string; dueDate?: string }>) {
  const s = negotiations.get(docId);
  if (!s || !s.tasks) return undefined;
  const i = s.tasks.findIndex(x => x.id === id);
  if (i === -1) return undefined;
  s.tasks[i] = { ...s.tasks[i], ...patch } as any;
  persist();
  try { addAppEvent({ kind: 'task.update', docId, meta: { id, patch } }); } catch {}
  return s.tasks[i];
}

export function shareNegotiation(docId: string): NegotiationState | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  if (!s.sharedWithSupplier) {
    s.sharedWithSupplier = true;
    s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by: 'system', kind: 'share.start' });
    persist();
  try { addAppEvent({ kind: 'negotiate.share.start', docId }); } catch {}
  }
  return s;
}

export function lockBaseline(docId: string): NegotiationState | undefined {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  if (!s.baselineLocked) {
    s.baselineLocked = true;
    s.audit.push({ id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), by: 'system', kind: 'baseline.lock' });
    persist();
  try { addAppEvent({ kind: 'negotiate.baseline.lock', docId }); } catch {}
  }
  return s;
}

export function removeContract(id: string): { removed: boolean } {
  const existed = contracts.has(id);
  contracts.delete(id);
  // Remove artifacts bundle
  store.delete(id);
  // Remove run state
  runs.delete(id);
  // Remove negotiation state
  negotiations.delete(id);
  // Remove manual rates overrides tied to this doc
  for (let i = manualRates.length - 1; i >= 0; i--) {
    if (manualRates[i].docId === id) manualRates.splice(i, 1);
  }
  // Remove pending rates tied to this doc
  for (let i = pendingRates.length - 1; i >= 0; i--) {
    if (pendingRates[i].docId === id) pendingRates.splice(i, 1);
  }
  persist();
  return { removed: existed };
}

export function bulkArchiveContracts(ids: string[]): { archived: number } {
  let archived = 0;
  for (const id of ids) {
    const curr = contracts.get(id);
    if (curr && !curr.archived) {
      contracts.set(id, { ...curr, archived: true, updatedAt: new Date() });
      archived++;
    }
  }
  persist();
  return { archived };
}

export function bulkDeleteContracts(ids: string[]): { removed: number } {
  let removed = 0;
  for (const id of ids) {
    const res = removeContract(id);
    if (res.removed) removed++;
  }
  return { removed };
}

export function bulkUnarchiveContracts(ids: string[]): { unarchived: number } {
  let unarchived = 0;
  for (const id of ids) {
    const curr = contracts.get(id);
    if (curr && curr.archived) {
      contracts.set(id, { ...curr, archived: false, updatedAt: new Date() });
      unarchived++;
    }
  }
  persist();
  return { unarchived };
}

// --- Snapshots & Diff helpers ---
export function createSnapshot(docId: string, author: Party | 'system', label?: string) {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  s.snapshots = s.snapshots || [];
  const rec = { id: `ss-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, createdAt: new Date().toISOString(), author, label, content: s.content, version: s.version };
  s.snapshots.push(rec);
  persist();
  try { addAppEvent({ kind: 'negotiate.snapshot.create', docId, by: author as any, meta: { id: rec.id, version: rec.version, label } }); } catch {}
  return rec;
}

export function listSnapshots(docId: string) {
  const s = negotiations.get(docId);
  if (!s || !s.snapshots) return [] as Array<{ id: string; createdAt: string; author: string; label?: string; version: number }>;
  return s.snapshots.map(x => ({ id: x.id, createdAt: x.createdAt, author: String(x.author), label: x.label, version: x.version }));
}

export function getSnapshot(docId: string, snapshotId: string) {
  const s = negotiations.get(docId);
  if (!s || !s.snapshots) return undefined;
  return s.snapshots.find(x => x.id === snapshotId);
}

export function diffSnapshot(docId: string, snapshotId: string) {
  const s = negotiations.get(docId);
  if (!s) return undefined;
  const snap = getSnapshot(docId, snapshotId);
  if (!snap) return undefined;
  const a = snap.content;
  const b = s.content;
  // simple diff: return changed ranges count and lengths
  function tokenize(str: string) {
    return str.split(/(\s+|\b)/).filter(t => t.length > 0);
  }
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0, j = 0;
  const segs: Array<{ type: 'eq'|'add'|'del'; text: string }> = [];
  while (i < n && j < m) {
    if (A[i] === B[j]) { segs.push({ type: 'eq', text: A[i++] }); j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { segs.push({ type: 'del', text: A[i++] }); }
    else { segs.push({ type: 'add', text: B[j++] }); }
  }
  while (i < n) segs.push({ type: 'del', text: A[i++] });
  while (j < m) segs.push({ type: 'add', text: B[j++] });
  const summary = {
    adds: segs.filter(s => s.type === 'add').length,
    dels: segs.filter(s => s.type === 'del').length,
    equals: segs.filter(s => s.type === 'eq').length,
  };
  return { snapshotId, fromVersion: snap.version, toVersion: s.version, summary };
}