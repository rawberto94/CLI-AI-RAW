import fs from 'fs';
import path from 'path';
import { RoleCanonical, SupplierCanonical, NormalizationMatch, RoleAlias, SupplierAlias } from './types';

// Base paths relative to this file location to avoid process.cwd() issues during tests
const ROOT = path.resolve(__dirname);
const DICTS_DIR = path.join(ROOT, 'dicts');
const STATE_FILE = path.join(ROOT, 'state.json');

type State = {
  roleAliases: RoleAlias[];
  supplierAliases: SupplierAlias[];
};

function ensureState(): State {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      const init: State = { roleAliases: [], supplierAliases: [] };
      fs.mkdirSync(ROOT, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(init, null, 2), 'utf8');
      return init;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw) as State;
  } catch {
    return { roleAliases: [], supplierAliases: [] };
  }
}

function saveState(s: State) {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
  } catch {
    // noop
  }
}

function loadJson<T = unknown>(file: string): T | undefined {
  try {
    const p = path.join(DICTS_DIR, file);
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

// Simple helpers
function normalizeStr(s?: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSetScore(a: string, b: string): number {
  const as = new Set(normalizeStr(a).split(/\s+/).filter(Boolean));
  const bs = new Set(normalizeStr(b).split(/\s+/).filter(Boolean));
  if (!as.size || !bs.size) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  const union = new Set([...as, ...bs]).size;
  return inter / union; // Jaccard
}

function lcsScore(a: string, b: string): number {
  // normalized longest common subsequence length / max len
  const s1 = normalizeStr(a);
  const s2 = normalizeStr(b);
  const n = s1.length;
  const m = s2.length;
  if (!n || !m) return 0;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const l = dp[n][m];
  return l / Math.max(n, m);
}

// Lightweight Jaro–Winkler
function jaroWinkler(a: string, b: string): number {
  const s1 = normalizeStr(a);
  const s2 = normalizeStr(b);
  const mDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  let m = 0, t = 0;
  const s1Flags = new Array(s1.length).fill(false);
  const s2Flags = new Array(s2.length).fill(false);
  for (let i=0; i<s1.length; i++) {
    const start = Math.max(0, i - mDist);
    const end = Math.min(i + mDist + 1, s2.length);
    for (let j=start; j<end; j++) {
      if (!s2Flags[j] && s1[i] === s2[j]) { s1Flags[i] = true; s2Flags[j] = true; m++; break; }
    }
  }
  if (m === 0) return 0;
  let k = 0;
  for (let i=0; i<s1.length; i++) {
    if (s1Flags[i]) {
      while (!s2Flags[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
  }
  t = t / 2;
  const jaro = (m / s1.length + m / s2.length + (m - t) / m) / 3;
  // Winkler prefix scale
  let l = 0; while (l < 4 && l < s1.length && l < s2.length && s1[l] === s2[l]) l++;
  const p = 0.1;
  return jaro + l * p * (1 - jaro);
}

function scoreText(a: string, b: string): { tokenSet: number; lcs: number; jw: number; composite: number } {
  const tokenSet = tokenSetScore(a, b);
  const lcs = lcsScore(a, b);
  const jw = jaroWinkler(a, b);
  // weighted composite
  const composite = 0.45 * tokenSet + 0.25 * lcs + 0.3 * jw;
  return { tokenSet, lcs, jw, composite };
}

function topMatches<T>(query: string, items: T[], getText: (x: T) => string, contextBoost?: (x: T) => number): Array<{ item: T; score: number; breakdown: { tokenSet: number; lcs: number; jw?: number; contextBoost?: number } }> {
  const arr = items.map((it) => {
    const breakdown = scoreText(query, getText(it));
    const boost = contextBoost ? contextBoost(it) : 0;
    const score = breakdown.composite + boost;
    return { item: it, score, breakdown: { tokenSet: breakdown.tokenSet, lcs: breakdown.lcs, jw: breakdown.jw, contextBoost: boost || undefined } };
  });
  arr.sort((a, b) => b.score - a.score);
  return arr.slice(0, 5);
}

let ROLES: RoleCanonical[] = [];
let SUPPLIERS: SupplierCanonical[] = [];

function loadDicts() {
  const roles = loadJson<RoleCanonical[]>('roles.json') || [];
  const suppliers = loadJson<SupplierCanonical[]>('suppliers.json') || [];
  ROLES = roles;
  SUPPLIERS = suppliers;
}

loadDicts();

export function reloadNormalizationDicts() {
  loadDicts();
}

// Admin import: replace dicts and/or state
export function importNormalization(data: { roles?: RoleCanonical[]; suppliers?: SupplierCanonical[]; state?: Partial<State> }) {
  try {
    fs.mkdirSync(DICTS_DIR, { recursive: true });
    if (Array.isArray(data.roles)) fs.writeFileSync(path.join(DICTS_DIR, 'roles.json'), JSON.stringify(data.roles, null, 2), 'utf8');
    if (Array.isArray(data.suppliers)) fs.writeFileSync(path.join(DICTS_DIR, 'suppliers.json'), JSON.stringify(data.suppliers, null, 2), 'utf8');
  } catch {}
  if (data.state && typeof data.state === 'object') {
    const curr = ensureState();
    const next: State = {
      roleAliases: Array.isArray(data.state.roleAliases) ? data.state.roleAliases as RoleAlias[] : curr.roleAliases,
      supplierAliases: Array.isArray(data.state.supplierAliases) ? data.state.supplierAliases as SupplierAlias[] : curr.supplierAliases,
    };
    saveState(next);
  }
  // reload into memory
  loadDicts();
}

export function matchRole(rawRole: string, capabilityHints?: string[]): NormalizationMatch {
  const q = rawRole || '';
  const state = ensureState();
  // Known alias shortcut
  const ra = state.roleAliases.find((a) => normalizeStr(a.rawRole) === normalizeStr(q));
  if (ra) {
    const role = ROLES.find((r) => r.roleId === ra.roleId);
    if (role) {
      return {
        type: 'role',
        rawValue: q,
        status: ra.autoMapped ? 'auto' : 'review',
        selectedId: role.roleId,
        matches: [
          {
            id: role.roleId,
            canonicalName: role.canonicalRole,
            score: ra.confidence,
            scoreBreakdown: { jaroWinkler: 0, tokenSet: 1, phonetic: 0, contextBoost: 0 },
            evidence: ['alias'],
          },
        ],
      };
    }
  }

  const capabilitySet = new Set((capabilityHints || []).map(normalizeStr));
  const results = topMatches(q, ROLES, (r) => r.canonicalRole, (r) => {
    // small boost if any capability intersects
    if (!r.capability || r.capability.length === 0) return 0;
    const inter = r.capability.map(normalizeStr).filter((c) => capabilitySet.has(c)).length;
    return inter > 0 ? Math.min(0.1 * inter, 0.3) : 0;
  });

  const matches = results.map((r) => ({
    id: r.item.roleId,
    canonicalName: r.item.canonicalRole,
    score: Number(r.score.toFixed(3)),
  scoreBreakdown: { jaroWinkler: Number((r.breakdown.jw||0).toFixed(3)), tokenSet: Number(r.breakdown.tokenSet.toFixed(3)), phonetic: 0, contextBoost: r.breakdown.contextBoost },
    evidence: [],
  }));

  let status: NormalizationMatch['status'] = 'unmapped';
  let selectedId: string | undefined;
  const top = matches[0];
  if (top) {
    if (top.score >= 0.92) { status = 'auto'; selectedId = top.id; }
    else if (top.score >= 0.8) { status = 'review'; }
  }

  return { type: 'role', rawValue: q, matches, status, selectedId };
}

export function matchSupplier(name: string, domainOrCountry?: string): NormalizationMatch {
  const q = name || '';
  const state = ensureState();
  // Alias fast-path
  const sa = state.supplierAliases.find((a) => normalizeStr(a.aliasText) === normalizeStr(q));
  if (sa) {
    const s = SUPPLIERS.find((x) => x.supplierId === sa.supplierId);
    if (s) {
      return {
        type: 'supplier', rawValue: q, status: sa.autoMapped ? 'auto' : 'review', selectedId: s.supplierId,
        matches: [{ id: s.supplierId, canonicalName: s.canonicalName, score: sa.confidence, scoreBreakdown: { jaroWinkler: 0, tokenSet: 1, phonetic: 0, contextBoost: 0 }, evidence: ['alias'] }],
      };
    }
  }

  const normQ = normalizeStr(q);
  const results = topMatches(q, SUPPLIERS, (s) => s.canonicalName, (s) => {
    // small boost if domain/country intersects
    const d = normalizeStr(domainOrCountry || '');
    const candidates = [
      ...(s.domains || []).map(normalizeStr),
      ...(s.countryCodes || []).map(normalizeStr),
      ...(s.aka || []).map(normalizeStr),
    ];
    return d && candidates.includes(d) ? 0.15 : (s.aka.map(normalizeStr).includes(normQ) ? 0.25 : 0);
  });

  const matches = results.map((r) => ({
    id: r.item.supplierId,
    canonicalName: r.item.canonicalName,
    score: Number(r.score.toFixed(3)),
  scoreBreakdown: { jaroWinkler: Number((r.breakdown.jw||0).toFixed(3)), tokenSet: Number(r.breakdown.tokenSet.toFixed(3)), phonetic: 0, contextBoost: r.breakdown.contextBoost },
    evidence: [],
  }));

  let status: NormalizationMatch['status'] = 'unmapped';
  let selectedId: string | undefined;
  const top = matches[0];
  if (top) {
    if (top.score >= 0.93) { status = 'auto'; selectedId = top.id; }
    else if (top.score >= 0.82) { status = 'review'; }
  }

  return { type: 'supplier', rawValue: q, matches, status, selectedId };
}

export function addRoleAlias(rawRole: string, roleId: string, approvedBy?: string, autoMapped = false, confidence = 0.99): RoleAlias {
  const s = ensureState();
  const rec: RoleAlias = {
    id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rawRole,
    capabilityHint: [],
    roleId,
    confidence,
    approvedBy,
    createdAt: new Date().toISOString(),
    autoMapped,
  };
  s.roleAliases.push(rec);
  saveState(s);
  return rec;
}

export function addSupplierAlias(aliasText: string, supplierId: string, approvedBy?: string, autoMapped = false, confidence = 0.99): SupplierAlias {
  const s = ensureState();
  const rec: SupplierAlias = {
    id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    aliasText,
    supplierId,
    confidence,
    approvedBy,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    autoMapped,
  };
  s.supplierAliases.push(rec);
  saveState(s);
  return rec;
}

export function getNormalizationState(): State {
  return ensureState();
}
