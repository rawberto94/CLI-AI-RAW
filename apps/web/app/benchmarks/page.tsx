'use client';

import { useEffect, useMemo, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { 
  Percent, 
  Upload, 
  Database, 
  AlertTriangle, 
  MapPin, 
  Globe2, 
  History, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { tenantHeaders } from '@/lib/tenant';
import { BackButton } from '@/components/ui/back-button';
import { MultiSelect } from '@/components/ui/multi-select';
import RoleBenchmarks from './RoleBenchmarks';

type Row = { role: string; p50: number | null; p75: number | null; p90: number | null; avg: number | null; n: number; country?: string; lineOfService?: string };
type FlatRate = { docId: string; role?: string; dailyUsd?: number; currency?: string; uom?: string; country?: string; lineOfService?: string; sourceLine?: string };
type Contract = { id: string; name: string; status?: string };
type Overview = { parties?: string[] };

export default function BenchmarksPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'explorer' | 'uploads' | 'mappings'>('overview');
  const [showNormalize, setShowNormalize] = useState<Record<string, boolean>>({});
  const [normalizeCache, setNormalizeCache] = useState<Record<string, { role?: any; supplier?: any }>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [repo, setRepo] = useState<(FlatRate & { id?: string })[]>([]);
  // Pagination for Rate Cards Repository
  const [repoPage, setRepoPage] = useState(1);
  const [repoTotal, setRepoTotal] = useState(0);
  const [repoPageSize, setRepoPageSize] = useState(10);
  const [repoTotalPages, setRepoTotalPages] = useState(1);
  // Multi-select filters
  const [filters, setFilters] = useState({
    doc: [] as string[],
    role: [] as string[],
    originalRole: [] as string[],
    supplier: [] as string[],
    currency: [] as string[],
    uom: [] as string[],
    country: [] as string[],
    lineOfService: [] as string[],
    dailyUsdMin: '',
    dailyUsdMax: '',
  });
  const [quickSearch, setQuickSearch] = useState('');
  const [stats, setStats] = useState<{ total: number; roles: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role?: string; dailyUsd?: string; currency?: string; uom?: string; country?: string; lineOfService?: string; seniority?: string }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<null | { parsed: number; unique: number; existing: number; toAdd: number; sample: any[]; filename: string }>(null);
  const [contracts, setContracts] = useState<(Contract & { __overview?: Overview })[]>([]);
  // Pending rates state
  type PendingRate = { id: string; createdAt: string; docId?: string; supplierId?: string; role?: string; seniority?: string; currency?: string; uom?: string; amount?: number; dailyUsd?: number; country?: string; lineOfService?: string; sourceLine?: string; source?: 'manual'|'import'|'override'; submittedBy?: string; submittedFrom?: 'ui'|'csv'|'api'; validationErrors: string[]; status: 'pending'|'approved'|'rejected' };
  const [pending, setPending] = useState<PendingRate[]>([]);
  const [pendingEditingId, setPendingEditingId] = useState<string | null>(null);
  const [pendingEditForm, setPendingEditForm] = useState<{ role?: string; dailyUsd?: string; amount?: string; currency?: string; uom?: string; country?: string; lineOfService?: string; seniority?: string } & Record<string, any>>({});
  const [pendingSelected, setPendingSelected] = useState<Record<string, boolean>>({});
  const [pendingEditErrors, setPendingEditErrors] = useState<Record<string, string[]>>({});

  const validatePendingLocal = useCallback((r: { role?: string; currency?: string; uom?: string; amount?: any; dailyUsd?: any }) => {
    const errs: string[] = [];
    const role = (r.role || '').toString().trim();
    const currency = (r.currency || '').toString().trim().toUpperCase();
    const uom = (r.uom || '').toString().trim().toLowerCase();
    const hasAmount = r.amount !== undefined && r.amount !== '' && !Number.isNaN(Number(r.amount));
    const hasDailyUsd = r.dailyUsd !== undefined && r.dailyUsd !== '' && !Number.isNaN(Number(r.dailyUsd));
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
  }, []);
  // Portfolio Ask chatbar state
  const [ask, setAsk] = useState('market p75 by role');
  const [askBusy, setAskBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [askRes, setAskRes] = useState<any | null>(null);
  const [askShowPlan, setAskShowPlan] = useState(false);
  const [sourcesModal, setSourcesModal] = useState<{ open: boolean; items: any[]; title?: string }>({ open: false, items: [] });
  const runAsk = useCallback(async () => {
    const q = ask.trim();
    if (!q) return;
    setAskBusy(true); setAskErr(null);
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/query`, { method:'POST', headers: tenantHeaders({ 'content-type':'application/json' }), body: JSON.stringify({ q, showPlan: askShowPlan }) });
      if (!r.ok) throw new Error(await r.text());
      setAskRes(await r.json());
    } catch (e:any) {
      setAskErr(e?.message || 'Query failed');
    } finally {
      setAskBusy(false);
    }
  }, [ask]);
  const downloadTemplate = useCallback(() => {
    // Align with repository fields, including Original Role (sourceLine)
    const header = ['role','sourceLine','seniority','currency','uom','amount','dailyUsd','country','lineOfService'].join(',');
    const sample = ['Consultant','Senior Consultant','Senior','USD','Day','650','','UK','Consulting'].join(',');
    const csv = header + '\n' + sample + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ratecards-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // (moved below filteredRepo)

  const [form, setForm] = useState({
    // Align with repository columns
    docId: 'manual',
    role: '', // Std role
    sourceLine: '', // Original Role
    seniority: '',
    amount: '' as string,
    uom: 'Day',
    currency: 'USD',
    dailyUsd: '' as string,
    country: '',
  lineOfService: '',
  supplier: '',
  });

  const fetchAll = useCallback(async () => {
    try {
      const [r, rr, cc, pp] = await Promise.all([
  fetch(`${API_BASE_URL}/api/benchmarks`, { headers: tenantHeaders() }),
  fetch(`${API_BASE_URL}/api/ratecards?page=${repoPage}`, { headers: tenantHeaders() }),
  fetch(`${API_BASE_URL}/api/contracts`, { headers: tenantHeaders() }),
  fetch(`${API_BASE_URL}/api/ratecards/pending`, { headers: tenantHeaders() }),
      ]);
      if (r.ok) {
        const j = await r.json();
        setRows(j.items || []);
        setStats({ total: j.total || 0, roles: j.roles || 0 });
      }
      if (rr.ok) {
        const jj = await rr.json();
        setRepo(jj.items || []);
        setRepoTotal(jj.total || 0);
        setRepoPageSize(jj.pageSize || 10);
        setRepoTotalPages(jj.totalPages || 1);
      }
  if (cc?.ok) {
        const list = await cc.json();
        // Enrich with overview to infer supplier
        const enriched = await Promise.all((list || []).map(async (ct: Contract) => {
          try {
            const a = await fetch(`${API_BASE_URL}/api/contracts/${ct.id}/artifacts/overview.json`);
            if (!a.ok) return ct as any;
            const ov = (await a.json()) as Overview;
            return { ...ct, __overview: ov } as any;
          } catch {
            return ct as any;
          }
        }));
        setContracts(enriched || []);
      }
      if (pp?.ok) {
        const pj = await pp.json();
        setPending(pj.items || []);
      }
    } catch {
      // ignore
    }
  }, [repoPage]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 4000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Build dropdown options from current repo/contract data
  const options = useMemo(() => {
    const docs = new Set<string>();
    const roles = new Set<string>();
    const originals = new Set<string>();
    const currencies = new Set<string>(['USD','EUR','GBP']);
    const uoms = new Set<string>(['Hour','Day','Month','Year']);
    const countries = new Set<string>();
    const los = new Set<string>();
    const suppliers = new Set<string>();

    docs.add('manual');
    (repo || []).forEach((r) => {
      if (r.docId) docs.add(r.docId);
      if (r.role) roles.add(r.role);
      if (r.sourceLine) originals.add(r.sourceLine);
      if (r.currency) currencies.add(String(r.currency).toUpperCase());
      if (r.uom) uoms.add(r.uom);
      if (r.country) countries.add(r.country);
      if (r.lineOfService) los.add(r.lineOfService);
    });

    // Derive supplier names similar to UI render
    const supplierMap = new Map<string, string>();
    (contracts as any[]).forEach((c) => {
      const ov: Overview | undefined = (c as any).__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const inferredSupplier = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
      if (inferredSupplier) supplierMap.set(c.id, inferredSupplier);
    });
    (repo || []).forEach((r) => {
      if (r.docId === 'manual') suppliers.add('Manual');
      else suppliers.add(supplierMap.get(r.docId) || 'Unknown');
    });

    const sortAlpha = (a: string, b: string) => a.localeCompare(b);
    const toSorted = (s: Set<string>) => Array.from(s).filter(Boolean).sort(sortAlpha);
  return {
      docs: toSorted(docs),
      roles: toSorted(roles),
      originals: toSorted(originals),
      currencies: toSorted(currencies),
      uoms: toSorted(uoms),
      countries: toSorted(countries),
      los: toSorted(los),
      suppliers: toSorted(suppliers),
    };
  }, [repo, contracts]);

  const submitManual = async () => {
    if (!form.role.trim()) return;
    const payload: any = {
      role: form.role.trim(),
      seniority: form.seniority?.trim() || undefined,
      currency: form.currency,
      uom: form.uom,
      country: form.country?.trim() || undefined,
      lineOfService: form.lineOfService?.trim() || undefined,
    };
    const amt = form.amount.trim();
    const dusd = form.dailyUsd.trim();
    if (dusd) payload.dailyUsd = Number(dusd);
    if (amt) payload.amount = Number(amt);
    if (!payload.dailyUsd && !payload.amount) return; // need at least one

    // If user selected a specific doc, create a doc-specific override; otherwise create a manual rate
    const useOverride = form.docId && form.docId !== 'manual';
    try {
      setSaving(true);
      setError(null);
      // Route new entries into Pending for validation before storage
      const body = {
        ...payload,
        docId: useOverride ? form.docId : undefined,
        sourceLine: form.sourceLine?.trim() || undefined,
        source: useOverride ? 'override' : 'manual',
        submittedFrom: 'ui',
        submittedBy: 'user',
        // Best-effort supplier normalization: when manual (no doc), allow user to type supplier name
        // The backend will attempt to normalize supplierId as well
        supplierId: undefined as any,
      };
      if (!useOverride && form.supplier?.trim()) {
        try {
          const r = await fetch(`${API_BASE_URL}/api/normalize/supplier/preview`, { method:'POST', headers: tenantHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ name: form.supplier.trim() }) });
          if (r.ok) {
            const j = await r.json();
            const top = Array.isArray(j?.matches) ? j.matches[0] : null;
            if (top && j.status === 'auto') body.supplierId = top.id;
          }
        } catch {}
      }
      // Validate-only first
  const r1 = await fetch(`${API_BASE_URL}/api/ratecards/pending`, { method:'POST', headers: tenantHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ ...body, validateOnly: true }) });
      const j1 = await r1.json().catch(()=>({}));
      if (!r1.ok || (j1 && j1.errors && j1.errors.length)) {
        setError(j1?.errors?.join(', ') || 'Validation failed');
        return;
      }
      // Create pending
  const res = await fetch(`${API_BASE_URL}/api/ratecards/pending`, { method:'POST', headers: tenantHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify(body) });
      if (res.ok) {
        setShowAdd(false);
        setForm({ docId: 'manual', role: '', sourceLine: '', seniority: '', amount: '', uom: 'Day', currency: 'USD', dailyUsd: '', country: '', lineOfService: '', supplier: '' });
        await fetchAll();
        setActiveTab('pending');
      } else {
        let msg = 'Failed to save rate';
        try { const j = await res.json(); msg = j?.error || msg; } catch {}
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async (file: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      setImporting(true);
      setError(null);
      // First do a dry-run to preview
  const res = await fetch(`${API_BASE_URL}/api/ratecards/import?dryRun=1&dedupe=1`, { method: 'POST', body: fd, headers: tenantHeaders() });
      if (res.ok) {
        const j = await res.json();
        setPreview({ ...j, filename: file.name });
      } else {
        let msg = 'Failed to parse CSV';
        try { const j = await res.json(); msg = j?.error || msg; } catch {}
        setError(msg);
      }
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async (file?: File) => {
    // Use the current input file again for real import with dedupe
    const f = file || (fileInputRef.current?.files?.[0] || null);
    if (!f) { setPreview(null); return; }
    const fd = new FormData();
    fd.append('file', f);
    setImporting(true);
    try {
      // Send to pending for validation before approval
  const res = await fetch(`${API_BASE_URL}/api/ratecards/import?dedupe=1&to=pending`, { method: 'POST', body: fd, headers: tenantHeaders() });
      if (res.ok) {
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchAll();
        setActiveTab('pending');
      } else {
        let msg = 'Failed to import CSV';
        try { const j = await res.json(); msg = j?.error || msg; } catch {}
        setError(msg);
      }
    } finally {
      setImporting(false);
    }
  };

  const filteredRepo = useMemo(() => {
    const f = {
      doc: filters.doc.map((v) => v.toLowerCase()),
      role: filters.role.map((v) => v.toLowerCase()),
      originalRole: filters.originalRole.map((v) => v.toLowerCase()),
      supplier: filters.supplier.map((v) => v.toLowerCase()),
      currency: filters.currency.map((v) => v.toLowerCase()),
      uom: filters.uom.map((v) => v.toLowerCase()),
      country: filters.country.map((v) => v.toLowerCase()),
      lineOfService: filters.lineOfService.map((v) => v.toLowerCase()),
      min: filters.dailyUsdMin.trim(),
      max: filters.dailyUsdMax.trim(),
    };
  const q = quickSearch.trim().toLowerCase();
    const minVal = f.min ? Number(f.min) : undefined;
    const maxVal = f.max ? Number(f.max) : undefined;
    // Build a supplier map for accurate matching
    const supplierMap = new Map<string, string>();
    (contracts as any[]).forEach((c) => {
      const ov: Overview | undefined = (c as any).__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const inferredSupplier = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
      if (inferredSupplier) supplierMap.set(c.id, inferredSupplier);
    });
    return repo.filter((item) => {
      const docVal = (item.docId || '').toLowerCase();
      const roleVal = (item.role || '').toLowerCase();
      const origVal = (item.sourceLine || '').toLowerCase();
      const supplierLabel = item.docId === 'manual' ? 'manual' : (supplierMap.get(item.docId)?.toLowerCase() || 'unknown');
      const currVal = (item.currency || '').toLowerCase();
      const uomVal = (item.uom || '').toLowerCase();
      const countryVal = (item.country || '').toLowerCase();
      const losVal = (item.lineOfService || '').toLowerCase();

      const docOk = f.doc.length === 0 || f.doc.some((v) => docVal.includes(v));
      const roleOk = f.role.length === 0 || f.role.some((v) => roleVal.includes(v));
      const origOk = f.originalRole.length === 0 || f.originalRole.some((v) => origVal.includes(v));
      const supplierOk = f.supplier.length === 0 || f.supplier.includes(supplierLabel);
      const currOk = f.currency.length === 0 || f.currency.includes(currVal);
      const uomOk = f.uom.length === 0 || f.uom.includes(uomVal);
      const countryOk = f.country.length === 0 || f.country.some((v) => countryVal.includes(v));
      const losOk = f.lineOfService.length === 0 || f.lineOfService.some((v) => losVal.includes(v));
      const quickOk = !q || docVal.includes(q) || roleVal.includes(q) || origVal.includes(q) || supplierLabel.includes(q) || currVal.includes(q) || uomVal.includes(q) || countryVal.includes(q) || losVal.includes(q);
      const val = item.dailyUsd;
      const minOk = minVal == null || (typeof val === 'number' && val >= minVal);
      const maxOk = maxVal == null || (typeof val === 'number' && val <= maxVal);
      return docOk && roleOk && origOk && supplierOk && currOk && uomOk && countryOk && losOk && minOk && maxOk && quickOk;
    });
  }, [repo, filters, contracts, quickSearch]);

  // Download a live example CSV from current filters (first 100 rows)
  const downloadExampleFromFilters = useCallback(() => {
    const header = ['role','sourceLine','seniority','currency','uom','amount','dailyUsd','country','lineOfService'];
    const rows = filteredRepo.slice(0, 100).map((r) => [
      r.role ?? '',
      r.sourceLine ?? '',
      '', // seniority not tracked on repo rows currently
      r.currency ?? '',
      r.uom ?? '',
      '', // amount is not persisted for derived rows
      r.dailyUsd != null ? String(r.dailyUsd) : '',
      r.country ?? '',
      r.lineOfService ?? ''
    ]);
    const csv = [header.join(','), ...rows.map(cols => cols.map(v=> String(v).replaceAll('\n',' ').replaceAll(',',' ')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ratecards-example.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredRepo]);

  // Benchmarks filtered by current filters (role, country, lineOfService)
  const filteredBench = useMemo(() => {
    const rsel = new Set(filters.role.map(v => v.toLowerCase()));
    const csel = new Set(filters.country.map(v => v.toLowerCase()));
    const lsel = new Set(filters.lineOfService.map(v => v.toLowerCase()));
    return rows.filter((row) => {
      const roleOk = rsel.size === 0 || rsel.has((row.role || '').toLowerCase());
      const countryOk = csel.size === 0 || csel.has((row.country || 'unknown').toLowerCase());
      const losOk = lsel.size === 0 || lsel.has((row.lineOfService || 'unknown').toLowerCase());
      return roleOk && countryOk && losOk;
    });
  }, [rows, filters]);

  const exportFilteredRepoCsv = useCallback(() => {
    const header = ['docId','role','sourceLine','seniority','currency','uom','amount','dailyUsd','country','lineOfService'];
    const rowsCsv = filteredRepo.map((r) => [
      r.docId ?? '',
      r.role ?? '',
      r.sourceLine ?? '',
      '',
      r.currency ?? '',
      r.uom ?? '',
      '',
      r.dailyUsd != null ? String(r.dailyUsd) : '',
      r.country ?? '',
      r.lineOfService ?? ''
    ]);
    const csv = [header.join(','), ...rowsCsv.map(cols => cols.map(v=> String(v).replaceAll('\n',' ').replaceAll(',',' ')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ratecards-repository.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredRepo]);

  const exportFilteredBenchCsv = useCallback(() => {
    const header = ['role','country','lineOfService','p50','p75','p90','n'];
    const rowsCsv = filteredBench.map((b) => [
      b.role,
      b.country ?? '',
      b.lineOfService ?? '',
      b.p50 ?? '',
      b.p75 ?? '',
      b.p90 ?? '',
      b.n ?? ''
    ]);
    const csv = [header.join(','), ...rowsCsv.map(cols => cols.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-benchmarks.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredBench]);

  const activeFilters = useMemo(() => {
    const { doc, role, originalRole, supplier, currency, uom, country, lineOfService, dailyUsdMin, dailyUsdMax } = filters as any;
    const base = [doc.length, role.length, originalRole.length, supplier.length, currency.length, uom.length, country.length, lineOfService.length, dailyUsdMin, dailyUsdMax].filter((v) => (Array.isArray(v) ? v.length : v && String(v).trim() !== '')).length;
    return base + (quickSearch.trim() ? 1 : 0);
  }, [filters, quickSearch]);

  // Sorting state for repository and explorer tables
  const [repoSort] = useState<{ key: 'docId'|'role'|'sourceLine'|'supplier'|'dailyUsd'|'currency'|'uom'|'country'|'lineOfService'; dir: 'asc'|'desc' } | null>(null); // setter unused
  const [groupSort, setGroupSort] = useState<{ key: 'group'|'count'|'avg'|'median'|'min'|'max'; dir: 'asc'|'desc' }>({ key: 'group', dir: 'asc' });

  // Helper to infer supplier label for a doc
  const supplierLabelFor = useCallback((docId?: string) => {
    if (!docId) return '';
    if (docId === 'manual') return 'Manual';
    const ov = contracts.find(c=>c.id===docId)?.__overview as Overview | undefined;
    const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
    const supplierLike = parties.find((p) => /supplier\b/i.test(p));
    const inferredSupplier = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
    return inferredSupplier || 'Unknown';
  }, [contracts]);

  // Apply sorting to filtered repository (optional: only if repoSort set)
  const sortedRepo = useMemo(() => {
    if (!repoSort) return filteredRepo;
    const dir = repoSort.dir === 'asc' ? 1 : -1;
    const key = repoSort.key;
    const getVal = (r: any) => {
      if (key === 'supplier') return supplierLabelFor(r.docId);
      return r[key];
    };
    return [...filteredRepo].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filteredRepo, repoSort, supplierLabelFor]);

  const deleteItem = useCallback(async (id?: string) => {
    if (!id) return;
  const res = await fetch(`${API_BASE_URL}/api/ratecards/${id}`, { method: 'DELETE', headers: tenantHeaders() });
    if (res.ok) {
      await fetchAll();
    }
  }, [fetchAll]);

  const rowKey = useCallback((r: FlatRate & { id?: string }) => (
    r.id || `${r.docId}::${r.role || ''}::${r.country || ''}::${r.lineOfService || ''}::${r.sourceLine || ''}`
  ), []);

  const startEdit = (r: (FlatRate & { id?: string })) => {
    // For doc-derived rows without id, use a synthetic key to track editing state
    const eid = rowKey(r);
    setEditingId(eid);
    setEditForm({
      role: r.role || '',
      dailyUsd: r.dailyUsd != null ? String(r.dailyUsd) : '',
      currency: r.currency || 'USD',
      uom: r.uom || 'Day',
      country: r.country || '',
      lineOfService: r.lineOfService || '',
      seniority: '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editingId) return;
    // Find the row being edited to know if it's manual/override (has id) or doc-derived (no id)
    const row = filteredRepo.find((r) => r.id === editingId) || filteredRepo.find((r) => `${r.docId}::${r.role || ''}::${r.country || ''}::${r.lineOfService || ''}::${r.sourceLine || ''}` === editingId);
    if (!row) { setEditingId(null); setEditForm({}); return; }
    const payload: any = {
      role: (editForm.role || '').trim() || undefined,
      dailyUsd: editForm.dailyUsd && editForm.dailyUsd.trim() ? Number(editForm.dailyUsd) : undefined,
      currency: editForm.currency || undefined,
      uom: editForm.uom || undefined,
      country: editForm.country || undefined,
      lineOfService: editForm.lineOfService || undefined,
      seniority: editForm.seniority || undefined,
    };
    let ok = false;
    if (row.id) {
      // Update existing manual/import/override
  const res = await fetch(`${API_BASE_URL}/api/ratecards/${row.id}`, { method: 'PUT', headers: tenantHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
      ok = res.ok;
    } else {
      // Create override for doc-derived row
      const body = {
        ...payload,
        docId: row.docId,
        sourceLine: row.sourceLine,
        source: 'override',
      };
  const res = await fetch(`${API_BASE_URL}/api/ratecards/override`, { method: 'POST', headers: tenantHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      ok = res.ok;
    }
    if (ok) {
      setEditingId(null);
      setEditForm({});
      await fetchAll();
    }
  };

  // Infer supplier by contract parties (best-effort)
  const supplierByDocId = useMemo(() => {
    const map = new Map<string, string>();
    (contracts as any[]).forEach((c) => {
      const ov: Overview | undefined = c.__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const inferredSupplier = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
      if (inferredSupplier) map.set(c.id, inferredSupplier);
    });
    return map;
  }, [contracts]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Header */}
    <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
      <div className="mb-2"><BackButton hrefFallback="/" /></div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <Percent className="w-7 h-7 mr-3 text-indigo-600" />
                Rate Cards Benchmarking
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Market dataset for benchmarking client rates</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/benchmarks/compare" className="bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                <span>Compare</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
              <button onClick={() => setShowAdd((s) => !s)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                <Upload className="w-4 h-4" />
                <span>{showAdd ? 'Close' : 'Add rate manually'}</span>
              </button>
              <label className="cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm">
                Import CSV
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && importCsv(e.target.files[0])} disabled={importing} />
              </label>
              <button onClick={downloadTemplate} className="text-sm underline text-gray-600 dark:text-gray-300">Download template</button>
              <button onClick={downloadExampleFromFilters} className="text-sm underline text-gray-600 dark:text-gray-300">Download example CSV</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">CSV must include role and either dailyUsd OR amount + uom + currency. Optional: sourceLine (original role text), seniority, country, lineOfService.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Globe2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Roles Covered</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.roles ?? 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Regions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">45</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Observations</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total ?? 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <History className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Median Trend</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">+2.3%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ask the Repository */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-4">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Ask the Rate Cards Repository</div>
            <div className="flex items-center gap-2">
              <input value={ask} onChange={(e)=>setAsk(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); runAsk(); } }} placeholder="e.g., market p75 by role" className="flex-1 border rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" />
              <button onClick={runAsk} disabled={askBusy || ask.trim()===''} className={`px-3 py-2 rounded text-sm ${askBusy || ask.trim()===''? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{askBusy?'Asking…' : 'Ask'}</button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={askShowPlan} onChange={(e)=>setAskShowPlan(e.target.checked)} /> Show plan</label>
              <div className="flex flex-wrap gap-2">
              {['market p75 by role','avg daily rate by supplier','p50 by country','SOWs with notice > 60 days'].map((h)=> (
                <button key={h} onClick={()=>setAsk(h)} className="text-xs px-2 py-1 rounded-full border hover:bg-gray-50 dark:hover:bg-gray-900/30">{h}</button>
              ))}
              </div>
            </div>
            <div className="mt-3">
              {!askBusy && !askRes && !askErr && <div className="text-sm text-gray-500">Try: ‘market p75 by role’</div>}
              {askBusy && <div className="text-sm text-gray-500">Loading…</div>}
              {askErr && <div className="text-sm text-red-600">{askErr}. <span className="text-gray-500">Refine query.</span></div>}
              {askRes && (
                <div className="space-y-3">
                  {askShowPlan && askRes.debug?.plan && (
                    <details className="text-xs bg-gray-50 border rounded p-2"><summary className="cursor-pointer">Debug plan</summary><pre className="whitespace-pre-wrap break-words">{JSON.stringify(askRes.debug.plan, null, 2)}</pre></details>
                  )}
                  {askRes.kind === 'metrics' && Array.isArray(askRes.metrics) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {askRes.metrics.map((m:any, i:number) => (
                        <div key={i} className="rounded border p-3">
                          <div className="text-xs text-gray-500">{m.label}</div>
                          <div className="text-lg font-semibold">{m.value}{m.unit? ` ${m.unit}`:''}</div>
                          <div className="text-[11px] text-gray-400 mt-1">Provenance: {Array.isArray(m.provenance)? m.provenance.map((p:any)=>p.clauseId?`Clause ${p.clauseId}`:p.policyId?`${p.policyId}`:p.section).slice(0,3).join(' · '):''} <button className="ml-2 text-indigo-600" onClick={()=> setSourcesModal({ open:true, items: m.provenance || [], title: 'Metric sources' })}>View sources</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {askRes.kind === 'table' && Array.isArray(askRes.rows) && (
                    <div className="overflow-x-auto rounded border">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                          <tr>
                            {askRes.columns?.map((c:any) => (<th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">{c.label}</th>))}
                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Sources</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {askRes.rows.map((r:any, i:number) => (
                            <tr key={i}>
                              {askRes.columns?.map((c:any) => (<td key={c.key} className="px-3 py-2">{String(r[c.key] ?? '')}</td>))}
                              <td className="px-3 py-2 text-[11px] text-gray-500">{Array.isArray(r.provenance)? r.provenance.slice(0,3).map((p:any)=>p.page?`p. ${p.page}`:p.clauseId?`Clause ${p.clauseId}`:p.section).join(' · '): ''} <button className="ml-2 text-indigo-600" onClick={()=> setSourcesModal({ open:true, items: r.provenance || [], title: 'Row sources' })}>View sources</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {askRes.kind === 'findings' && Array.isArray(askRes.findings) && (
                    <div className="space-y-2">
                      {askRes.findings.map((f:any, i:number)=> (
                        <div key={i} className="rounded border p-3">
                          <div className="text-sm font-medium">{f.title}</div>
                          {f.description && <div className="text-xs text-gray-600">{f.description}</div>}
                          <div className="text-[11px] text-gray-400 mt-1">Provenance: {Array.isArray(f.provenance)? f.provenance.map((p:any)=>p.page?`p. ${p.page}`:p.clauseId?`Clause ${p.clauseId}`:p.section).slice(0,3).join(' · '): ''} <button className="ml-2 text-indigo-600" onClick={()=> setSourcesModal({ open:true, items: f.provenance || [], title: 'Finding sources' })}>View sources</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sources Modal */}
        {sourcesModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[92vw] max-w-2xl max-h-[88vh] flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm font-medium">{sourcesModal.title || 'Sources'}</div>
                <button onClick={()=> setSourcesModal({ open:false, items: [] })} className="text-sm px-2 py-1 rounded border">Close</button>
              </div>
              <div className="p-4 overflow-y-auto text-sm">
                {(!sourcesModal.items || sourcesModal.items.length===0) ? (
                  <div className="text-gray-500">No sources available.</div>
                ) : (
                  <ul className="space-y-2">
                    {sourcesModal.items.map((s:any, i:number)=> (
                      <li key={i} className="rounded border p-2">
                        <div className="text-xs text-gray-500">{s.docId ? `Contract: ${s.docId}`: ''} {s.page? ` · p. ${s.page}`: ''} {s.clauseId? ` · Clause ${s.clauseId}`: ''} {s.section? ` · ${s.section}`: ''}</div>
                        {s.snippet && <div className="mt-1 text-gray-800">{s.snippet}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              {[
                { id: 'overview', label: 'Overview', icon: Globe2 },
                { id: 'pending', label: 'Pending', icon: AlertTriangle },
                { id: 'explorer', label: 'Explorer', icon: Database },
                { id: 'uploads', label: 'Uploads', icon: Upload },
                { id: 'mappings', label: 'Mappings', icon: MapPin }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            {preview && (
              <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white">Import preview: {preview.filename}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Parsed: {preview.parsed} • Unique: {preview.unique} • Existing: {preview.existing} • To add: {preview.toAdd}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreview(null)} className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600">Cancel</button>
                    <button onClick={() => confirmImport()} className="px-3 py-2 text-sm rounded bg-indigo-600 text-white disabled:opacity-60" disabled={importing || preview.toAdd === 0}>Confirm import</button>
                  </div>
                </div>
                {preview.sample && preview.sample.length > 0 && (
                  <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          {['role','sourceLine','seniority','currency','uom','amount','dailyUsd','country','lineOfService'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {preview.sample.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm">{r.role || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.sourceLine || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.seniority || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.currency || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.uom || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.amount ?? '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.dailyUsd ?? '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.country || '-'}</td>
                            <td className="px-4 py-2 text-sm">{r.lineOfService || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Benchmarks (USD/day)</h2>
                <RoleBenchmarks />

                {showAdd && (
                  <div className="mt-6 mb-6 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Add Rate Card</h3>
                    {error && (
                      <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Doc</label>
                        <select value={form.docId} onChange={(e)=>setForm(f=>({ ...f, docId: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                          <option value="manual">manual</option>
                          {contracts.map((c)=> (
                            <option key={c.id} value={c.id}>{c.id}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-gray-500">Select a contract to attach (creates an override), or keep manual.</p>
                      </div>
                      {!form.docId || form.docId === 'manual' ? (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Supplier (manual)</label>
                          <input value={form.supplier} onChange={(e)=>setForm(f=>({ ...f, supplier: e.target.value }))} placeholder="e.g., Deloitte" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                          <p className="mt-1 text-[10px] text-gray-500">Optional. We'll try to map to a canonical supplier.</p>
                        </div>
                      ) : null}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Role</label>
                        <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Consultant" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Original Role</label>
                        <input value={form.sourceLine} onChange={(e)=>setForm(f=>({ ...f, sourceLine: e.target.value }))} placeholder="Original role text from doc" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Seniority</label>
                        <input value={form.seniority} onChange={(e) => setForm((f) => ({ ...f, seniority: e.target.value }))} placeholder="Senior" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Amount</label>
                          <input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="600" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">UoM</label>
                          <select value={form.uom} onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                            <option>Hour</option>
                            <option>Day</option>
                            <option>Month</option>
                            <option>Year</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Currency</label>
                          <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                            <option>USD</option>
                            <option>EUR</option>
                            <option>GBP</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Daily USD (optional)</label>
                        <input inputMode="decimal" value={form.dailyUsd} onChange={(e) => setForm((f) => ({ ...f, dailyUsd: e.target.value }))} placeholder="650" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Country</label>
                        <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="UK" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Line of Service</label>
                        <input value={form.lineOfService} onChange={(e) => setForm((f) => ({ ...f, lineOfService: e.target.value }))} placeholder="Consulting" className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button disabled={saving || !form.role.trim()} onClick={submitManual} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm">
                        {saving ? 'Saving…' : 'Save rate'}
                      </button>
                    </div>
                  </div>
                )}

                <h3 className="text-md font-semibold text-gray-900 dark:text-white mt-8 mb-3">Rate Cards Repository</h3>
                <div className="mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-gray-600 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">Filters {activeFilters > 0 ? `(${activeFilters})` : ''}</div>
                    {/* Redesigned, pill-style multi-selects */}
                    {/* Import MultiSelect lazily to avoid SSR issues */}
                    <div className="ml-auto flex items-center gap-2">
                      <input
                        value={quickSearch}
                        onChange={(e)=>setQuickSearch(e.target.value)}
                        placeholder="Quick search… (role, supplier, country, LoS)"
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm w-64"
                      />
                    </div>
                  </div>
                  <FilterControls options={options} filters={filters} setFilters={setFilters} />
                </div>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="w-28 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Doc</th>
                        <th className="w-40 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Std role</th>
                        <th className="w-56 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Original Role</th>
                        <th className="w-36 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Supplier</th>
                        <th className="w-28 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Daily USD</th>
                        <th className="w-24 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Currency</th>
                        <th className="w-20 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">UoM</th>
                        <th className="w-32 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Country</th>
                        <th className="w-56 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Line of Service</th>
                        <th className="w-36 px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {sortedRepo.map((r, i) => (
                        <tr key={`${r.docId}-${i}`}>
                          <td className="px-4 py-2 text-sm truncate">
                            {r.docId === 'manual' ? (
                              <span className="text-gray-500">manual</span>
                            ) : (
                              <a className="text-indigo-600 hover:underline" href={`/contracts/${r.docId}`}>{r.docId}</a>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <input value={editForm.role || ''} onChange={(e)=>setEditForm(f=>({ ...f, role: e.target.value }))} className="w-40 px-2 py-1 border rounded text-sm" />
                            ) : (
                              r.role || '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate max-w-xs" title={r.sourceLine || ''}>{r.sourceLine || '-'}</td>
                          <td className="px-4 py-2 text-sm truncate">{r.docId === 'manual' ? 'Manual' : (supplierByDocId.get(r.docId) || 'Unknown')}</td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <input inputMode="decimal" value={editForm.dailyUsd || ''} onChange={(e)=>setEditForm(f=>({ ...f, dailyUsd: e.target.value }))} className="w-24 px-2 py-1 border rounded text-sm" />
                            ) : (
                              r.dailyUsd ?? '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <select value={editForm.currency || 'USD'} onChange={(e)=>setEditForm(f=>({ ...f, currency: e.target.value }))} className="px-2 py-1 border rounded text-sm">
                                <option>USD</option>
                                <option>EUR</option>
                                <option>GBP</option>
                              </select>
                            ) : (
                              r.currency || '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <select value={editForm.uom || 'Day'} onChange={(e)=>setEditForm(f=>({ ...f, uom: e.target.value }))} className="px-2 py-1 border rounded text-sm">
                                <option>Hour</option>
                                <option>Day</option>
                                <option>Month</option>
                                <option>Year</option>
                              </select>
                            ) : (
                              r.uom || '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <input value={editForm.country || ''} onChange={(e)=>setEditForm(f=>({ ...f, country: e.target.value }))} className="w-28 px-2 py-1 border rounded text-sm" />
                            ) : (
                              r.country || 'Unknown'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {editingId === rowKey(r as any) ? (
                              <input value={editForm.lineOfService || ''} onChange={(e)=>setEditForm(f=>({ ...f, lineOfService: e.target.value }))} className="w-40 px-2 py-1 border rounded text-sm" />
                            ) : (
                              r.lineOfService || 'Unknown'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {editingId === rowKey(r as any) ? (
                              <div className="flex items-center gap-2">
                                <button onClick={saveEdit} className="text-green-600 hover:underline text-xs">Save</button>
                                <button onClick={cancelEdit} className="text-gray-600 hover:underline text-xs">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEdit(r)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                                {r.id && (
                                  <button onClick={() => deleteItem(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {sortedRepo.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No rate cards match filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination controls */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Page {repoPage} of {repoTotalPages} • Showing {Math.min(repoPageSize, sortedRepo.length)} of {repoTotal} items
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded border text-xs disabled:opacity-50"
                      disabled={repoPage <= 1}
                      onClick={() => setRepoPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="px-3 py-1 rounded border text-xs disabled:opacity-50"
                      disabled={repoPage >= repoTotalPages}
                      onClick={() => setRepoPage((p) => Math.min(repoTotalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Export panel */}
                <div className="mt-6 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Export</h4>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <ExportTabs filteredRepoCount={filteredRepo.length} onExportRepo={exportFilteredRepoCsv} onExportBench={exportFilteredBenchCsv} filters={filters} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pending' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Pending rate cards</h2>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-600 dark:text-gray-300">Validate, edit, and approve items before they enter the repository.</p>
                  <div className="flex items-center gap-2">
                    <button onClick={async()=>{ const r = await fetch(`${API_BASE_URL}/api/ratecards/pending/approveAllValid`, { method:'POST' }); if (r.ok) { await fetchAll(); } }} className="text-xs px-3 py-1 rounded border border-gray-300 dark:border-gray-600">Approve all valid</button>
                    <button onClick={async()=>{ const ids = Object.entries(pendingSelected).filter(([,v])=>v).map(([k])=>k); if (!ids.length) return; const r = await fetch(`${API_BASE_URL}/api/ratecards/pending/rejectSelected`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ids }) }); if (r.ok) { setPendingSelected({}); await fetchAll(); } }} className="text-xs px-3 py-1 rounded border border-red-300 text-red-700">Reject selected</button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="w-8 px-2 py-2 text-left text-xs font-semibold"><input type="checkbox" aria-label="Select all" onChange={(e)=>{ const v = e.target.checked; const next: Record<string, boolean> = {}; pending.forEach(p=>{ next[p.id]=v; }); setPendingSelected(next); }} checked={pending.length>0 && pending.every(p=>pendingSelected[p.id])} /></th>
                        <th className="w-28 px-4 py-2 text-left text-xs font-semibold">Doc</th>
                        <th className="w-40 px-4 py-2 text-left text-xs font-semibold">Std role</th>
                        <th className="w-24 px-4 py-2 text-left text-xs font-semibold">Daily USD</th>
                        <th className="w-24 px-4 py-2 text-left text-xs font-semibold">Amount</th>
                        <th className="w-24 px-4 py-2 text-left text-xs font-semibold">Currency</th>
                        <th className="w-20 px-4 py-2 text-left text-xs font-semibold">UoM</th>
                        <th className="w-28 px-4 py-2 text-left text-xs font-semibold">Country</th>
                        <th className="w-40 px-4 py-2 text-left text-xs font-semibold">Line of Service</th>
                        <th className="w-28 px-4 py-2 text-left text-xs font-semibold">Submitted</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold">Errors</th>
                        <th className="w-36 px-4 py-2 text-left text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pending.map((p) => (
                        <tr key={p.id}>
                          <td className="px-2 py-2 text-sm"><input type="checkbox" checked={!!pendingSelected[p.id]} onChange={(e)=> setPendingSelected(s=>({ ...s, [p.id]: e.target.checked }))} /></td>
                          <td className="px-4 py-2 text-sm truncate">{p.docId || 'manual'}</td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <div>
                                <input value={pendingEditForm.role ?? p.role ?? ''} onChange={(e)=>setPendingEditForm(f=>({ ...f, role: e.target.value }))} className={`w-40 px-2 py-1 border rounded text-sm ${p.validationErrors?.some(e=>e.includes('role')) ? 'border-red-500' : ''}`} />
                                {p.validationErrors?.some(e=>e.includes('role')) && (<div className="text-xs text-red-600 mt-1">Role is required</div>)}
                              </div>
                            ) : (
                              <div>
                                <div>{p.role || '-'}</div>
                                <button
                                  className="mt-1 text-[11px] text-indigo-600 hover:underline"
                                  onClick={async()=>{
                                    setShowNormalize(s=>({ ...s, [p.id]: !s[p.id] }));
                                    if (!normalizeCache[p.id] && p.role) {
                                      try {
                                        const r = await fetch(`${API_BASE_URL}/api/normalize/role/preview`, { method:'POST', headers: tenantHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ role: p.role, hints: [p.lineOfService].filter(Boolean) })});
                                        const rj = await r.json();
                                        setNormalizeCache(c=>({ ...c, [p.id]: { role: rj } }));
                                      } catch {}
                                    }
                                  }}
                                >{showNormalize[p.id] ? 'Hide normalize' : 'Normalize'}</button>
                                {showNormalize[p.id] && (
                                  <div className="mt-2 p-2 border rounded bg-gray-50 dark:bg-gray-900/40">
                                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Role suggestions</div>
                                    {!normalizeCache[p.id]?.role ? (
                                      <div className="text-xs text-gray-500">No suggestions</div>
                                    ) : (
                                      <ul className="mt-1 space-y-1">
                                        {(normalizeCache[p.id]!.role.matches || []).slice(0,3).map((m: any) => (
                                          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                                            <div>
                                              <span className="font-medium">{m.canonicalName}</span>
                                              <span className="ml-2 text-gray-500">{Math.round((m.score||0)*100)}%</span>
                                            </div>
                                            <button
                                              className="text-[11px] px-2 py-0.5 border rounded"
                                              onClick={async()=>{
                                                try {
                                                  await fetch(`${API_BASE_URL}/api/normalize/role/alias`, { method:'POST', headers: tenantHeaders({ 'Content-Type':'application/json' }), body: JSON.stringify({ raw: p.role, roleId: m.id }) });
                                                  await fetch(`${API_BASE_URL}/api/ratecards/pending/${p.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ role: m.canonicalName }) });
                                                  await fetchAll();
                                                } catch {}
                                              }}
                                            >Approve alias</button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div className="mt-3">
                                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Supplier</div>
                                      {!normalizeCache[p.id]?.supplier ? (
                                        <button
                                          className="text-[11px] underline"
                                          onClick={async()=>{
                                            try {
                                              // Best-effort infer from overview parties
                                              let ctxName = '';
                                              try {
                                                const ovRes = await fetch(`${API_BASE_URL}/api/contracts/${p.docId}/artifacts/overview.json`, { headers: tenantHeaders() });
                                                if (ovRes.ok) {
                                                  const ov = await ovRes.json();
                                                  const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
                                                  const supplierLike = parties.find((x: string)=>/supplier\b/i.test(x));
                                                  ctxName = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g,'').trim();
                                                }
                                              } catch {}
                                              const r = await fetch(`${API_BASE_URL}/api/normalize/supplier/preview`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name: ctxName }) });
                                              if (r.ok) {
                                                const rj = await r.json();
                                                setNormalizeCache(c=>({ ...c, [p.id]: { ...(c[p.id]||{}), supplier: rj } }));
                                              }
                                            } catch {}
                                          }}
                                        >Preview supplier</button>
                                      ) : (
                                        <ul className="mt-1 space-y-1">
                                          {(normalizeCache[p.id]!.supplier.matches || []).slice(0,3).map((m: any) => (
                                            <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                                              <div>
                                                <span className="font-medium">{m.canonicalName}</span>
                                                <span className="ml-2 text-gray-500">{Math.round((m.score||0)*100)}%</span>
                                              </div>
                                              <button
                                                className="text-[11px] px-2 py-0.5 border rounded"
                                                onClick={async()=>{
                                                  try {
                                                    await fetch(`${API_BASE_URL}/api/ratecards/pending/${p.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ supplierId: m.id }) });
                                                    // also record alias from context for future
                                                    try {
                                                      const ovRes = await fetch(`${API_BASE_URL}/api/contracts/${p.docId}/artifacts/overview.json`);
                                                      if (ovRes.ok) {
                                                        const ov = await ovRes.json();
                                                        const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
                                                        const supplierLike = parties.find((x: string)=>/supplier\\b/i.test(x));
                                                        const ctxName = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g,'').trim();
                                                        if (ctxName) {
                                                          await fetch(`${API_BASE_URL}/api/normalize/supplier/alias`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ raw: ctxName, supplierId: m.id }) });
                                                        }
                                                      }
                                                    } catch {}
                                                    await fetchAll();
                                                  } catch {}
                                                }}
                                              >Approve supplier</button>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <div>
                                <input inputMode="decimal" value={pendingEditForm.dailyUsd ?? (p.dailyUsd != null ? String(p.dailyUsd) : '')} onChange={(e)=>{
                                  const next = { ...pendingEditForm, dailyUsd: e.target.value };
                                  setPendingEditForm(next);
                                  const errs = validatePendingLocal({ role: next.role ?? p.role, currency: next.currency ?? p.currency, uom: next.uom ?? p.uom, amount: next.amount ?? p.amount, dailyUsd: next.dailyUsd ?? p.dailyUsd });
                                  setPendingEditErrors((m)=>({ ...m, [p.id]: errs }));
                                }} className={`w-24 px-2 py-1 border rounded text-sm ${(pendingEditErrors[p.id] || p.validationErrors)?.some(e=>e.includes('dailyUsd')||e.includes('one of amount')) ? 'border-red-500' : ''}`} />
                                {(pendingEditErrors[p.id] || p.validationErrors)?.some(e=>e.includes('one of amount')) && (<div className="text-xs text-red-600 mt-1">Provide amount or dailyUsd</div>)}
                              </div>
                            ) : (
                              p.dailyUsd ?? '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <div>
                                <input inputMode="decimal" value={pendingEditForm.amount ?? (p.amount != null ? String(p.amount) : '')} onChange={(e)=>{
                                  const next = { ...pendingEditForm, amount: e.target.value };
                                  setPendingEditForm(next);
                                  const errs = validatePendingLocal({ role: next.role ?? p.role, currency: next.currency ?? p.currency, uom: next.uom ?? p.uom, amount: next.amount ?? p.amount, dailyUsd: next.dailyUsd ?? p.dailyUsd });
                                  setPendingEditErrors((m)=>({ ...m, [p.id]: errs }));
                                }} className={`w-24 px-2 py-1 border rounded text-sm ${(pendingEditErrors[p.id] || p.validationErrors)?.some(e=>e.includes('amount must be')) ? 'border-red-500' : ''}`} />
                              </div>
                            ) : (
                              p.amount ?? '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <select value={pendingEditForm.currency ?? (p.currency || 'USD')} onChange={(e)=>{
                                const next = { ...pendingEditForm, currency: e.target.value };
                                setPendingEditForm(next);
                                const errs = validatePendingLocal({ role: next.role ?? p.role, currency: next.currency ?? p.currency, uom: next.uom ?? p.uom, amount: next.amount ?? p.amount, dailyUsd: next.dailyUsd ?? p.dailyUsd });
                                setPendingEditErrors((m)=>({ ...m, [p.id]: errs }));
                              }} className={`px-2 py-1 border rounded text-sm ${(pendingEditErrors[p.id] || p.validationErrors)?.some(e=>e.includes('currency')) ? 'border-red-500' : ''}`}>
                                <option>USD</option>
                                <option>EUR</option>
                                <option>GBP</option>
                              </select>
                            ) : (
                              p.currency || '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <select value={pendingEditForm.uom ?? (p.uom || 'Day')} onChange={(e)=>{
                                const next = { ...pendingEditForm, uom: e.target.value };
                                setPendingEditForm(next);
                                const errs = validatePendingLocal({ role: next.role ?? p.role, currency: next.currency ?? p.currency, uom: next.uom ?? p.uom, amount: next.amount ?? p.amount, dailyUsd: next.dailyUsd ?? p.dailyUsd });
                                setPendingEditErrors((m)=>({ ...m, [p.id]: errs }));
                              }} className={`px-2 py-1 border rounded text-sm ${(pendingEditErrors[p.id] || p.validationErrors)?.some(e=>e.includes('uom')) ? 'border-red-500' : ''}`}>
                                <option>Hour</option>
                                <option>Day</option>
                                <option>Month</option>
                                <option>Year</option>
                              </select>
                            ) : (
                              p.uom || '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <input value={pendingEditForm.country ?? (p.country || '')} onChange={(e)=>setPendingEditForm(f=>({ ...f, country: e.target.value }))} className="w-28 px-2 py-1 border rounded text-sm" />
                            ) : (
                              p.country || 'Unknown'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm truncate">
                            {pendingEditingId === p.id ? (
                              <input value={pendingEditForm.lineOfService ?? (p.lineOfService || '')} onChange={(e)=>setPendingEditForm(f=>({ ...f, lineOfService: e.target.value }))} className="w-40 px-2 py-1 border rounded text-sm" />
                            ) : (
                              p.lineOfService || 'Unknown'
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs truncate">
                            <div className="flex flex-col">
                              <span>{p.submittedBy || '-'}</span>
                              <span className="text-gray-500">{p.submittedFrom || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {(!p.validationErrors || p.validationErrors.length===0) ? (
                              <span className="inline-flex items-center text-emerald-700">No errors</span>
                            ) : (
                              <ul className="list-disc pl-4 text-red-600 space-y-0.5">
                                {p.validationErrors.map((e, i)=>(<li key={i}>{e}</li>))}
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {pendingEditingId === p.id ? (
                              <div className="flex items-center gap-2">
                                <button onClick={async()=>{
                                  const body = {
                                    role: pendingEditForm.role ?? p.role,
                                    dailyUsd: pendingEditForm.dailyUsd ? Number(pendingEditForm.dailyUsd) : p.dailyUsd,
                                    amount: pendingEditForm.amount ? Number(pendingEditForm.amount) : p.amount,
                                    currency: pendingEditForm.currency ?? p.currency,
                                    uom: pendingEditForm.uom ?? p.uom,
                                    country: pendingEditForm.country ?? p.country,
                                    lineOfService: pendingEditForm.lineOfService ?? p.lineOfService,
                                  };
                                  // Local inline validation; prevent save if errors present
                                  const errs = validatePendingLocal({ role: body.role, currency: body.currency, uom: body.uom, amount: body.amount, dailyUsd: body.dailyUsd });
                                  setPendingEditErrors((m)=>({ ...m, [p.id]: errs }));
                                  if (errs.length) return;
                                  const res = await fetch(`${API_BASE_URL}/api/ratecards/pending/${p.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
                                  if (res.ok) { setPendingEditingId(null); setPendingEditForm({}); setPendingEditErrors(m=>{ const n={...m}; delete n[p.id]; return n; }); await fetchAll(); }
                                }} className="text-green-600 hover:underline text-xs">Save</button>
                                <button onClick={()=>{ setPendingEditingId(null); setPendingEditForm({}); setPendingEditErrors(m=>{ const n={...m}; delete n[p.id]; return n; }); }} className="text-gray-600 hover:underline text-xs">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={()=>{ setPendingEditingId(p.id); setPendingEditForm({}); }} className="text-indigo-600 hover:underline text-xs">Edit</button>
                                <button onClick={async()=>{ const r = await fetch(`${API_BASE_URL}/api/ratecards/pending/${p.id}/approve`, { method:'POST' }); if (r.ok) { await fetchAll(); } }} disabled={!!(p.validationErrors && p.validationErrors.length)} className={`text-xs ${p.validationErrors?.length? 'text-gray-400 cursor-not-allowed' : 'text-emerald-700 hover:underline'}`}>Approve</button>
                                <button onClick={async()=>{ const r = await fetch(`${API_BASE_URL}/api/ratecards/pending/${p.id}/reject`, { method:'POST' }); if (r.ok) { await fetchAll(); } }} className="text-red-600 hover:underline text-xs">Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {pending.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No pending items.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'explorer' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Explorer</h2>
                <Explorer
                  data={sortedRepo}
                  supplierLabelFor={supplierLabelFor}
                  groupSort={groupSort}
                  setGroupSort={setGroupSort}
                />
              </div>
            )}
            
            {activeTab === 'uploads' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upload History</h2>
                <p className="text-gray-600 dark:text-gray-400">Upload management coming soon...</p>
              </div>
            )}
            
            {activeTab === 'mappings' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Mappings</h2>
                <p className="text-gray-600 dark:text-gray-400">Role mapping tool coming soon...</p>
              </div>
            )}
          </div>
    </div>
  </div>
  );
}

// Inline filter controls component to keep file self-contained
function FilterControls({ options, filters, setFilters }: {
  options: { docs: string[]; roles: string[]; originals: string[]; currencies: string[]; uoms: string[]; countries: string[]; los: string[]; suppliers: string[] };
  filters: { doc: string[]; role: string[]; originalRole: string[]; supplier: string[]; currency: string[]; uom: string[]; country: string[]; lineOfService: string[]; dailyUsdMin: string; dailyUsdMax: string };
  setFilters: Dispatch<SetStateAction<{ doc: string[]; role: string[]; originalRole: string[]; supplier: string[]; currency: string[]; uom: string[]; country: string[]; lineOfService: string[]; dailyUsdMin: string; dailyUsdMax: string }>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect label="Doc" options={options.docs} selected={filters.doc} onChange={(v)=>setFilters((f)=>({ ...f, doc: v }))} />
      <MultiSelect label="Std role" options={options.roles} selected={filters.role} onChange={(v)=>setFilters((f)=>({ ...f, role: v }))} className="min-w-[180px]" />
      <MultiSelect label="Original role" options={options.originals} selected={filters.originalRole} onChange={(v)=>setFilters((f)=>({ ...f, originalRole: v }))} className="min-w-[220px]" />
      <MultiSelect label="Supplier" options={options.suppliers} selected={filters.supplier} onChange={(v)=>setFilters((f)=>({ ...f, supplier: v }))} />
      <MultiSelect label="Currency" options={options.currencies} selected={filters.currency} onChange={(v)=>setFilters((f)=>({ ...f, currency: v }))} />
      <MultiSelect label="UoM" options={options.uoms} selected={filters.uom} onChange={(v)=>setFilters((f)=>({ ...f, uom: v }))} />
      <MultiSelect label="Country" options={options.countries} selected={filters.country} onChange={(v)=>setFilters((f)=>({ ...f, country: v }))} />
      <MultiSelect label="Line of service" options={options.los} selected={filters.lineOfService} onChange={(v)=>setFilters((f)=>({ ...f, lineOfService: v }))} className="min-w-[200px]" />
      <div className="flex items-center gap-2 ml-auto">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-0.5">Min USD/day</label>
          <select value={filters.dailyUsdMin} onChange={(e)=>setFilters(f=>({ ...f, dailyUsdMin: e.target.value }))} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">Any</option>
            {['50','100','150','200','300','400','500','800'].map((v)=> (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-300 mb-0.5">Max USD/day</label>
          <select value={filters.dailyUsdMax} onChange={(e)=>setFilters(f=>({ ...f, dailyUsdMax: e.target.value }))} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">Any</option>
            {['100','150','200','300','400','500','800','1000'].map((v)=> (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
  <button onClick={()=>setFilters({ doc:[], role:[], originalRole:[], supplier:[], currency:[], uom:[], country:[], lineOfService:[], dailyUsdMin:'', dailyUsdMax:'' })} className="mt-5 inline-flex items-center px-2.5 py-1 rounded-full border text-xs text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30">Clear</button>
      </div>
    </div>
  );
}

// Simple tabs component to export filtered repository or benchmarks, and jump to Compare
function ExportTabs({ filteredRepoCount, onExportRepo, onExportBench, filters }: {
  filteredRepoCount: number;
  onExportRepo: () => void;
  onExportBench: () => void;
  filters: { role: string[]; country: string[]; lineOfService: string[] } & Record<string, any>;
}) {
  const [tab, setTab] = useState<'repo' | 'bench'>('repo');
  const qs = useMemo(() => {
    try {
      const sp = new URLSearchParams();
      (filters.role || []).forEach((v: string) => sp.append('role', v));
      (filters.country || []).forEach((v: string) => sp.append('country', v));
      (filters.lineOfService || []).forEach((v: string) => sp.append('lineOfService', v));
      const s = sp.toString();
      return s ? `?${s}` : '';
    } catch { return ''; }
  }, [filters]);

  return (
    <div className="w-full">
      <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
        <button onClick={() => setTab('repo')} className={`px-3 py-2 text-sm ${tab==='repo' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900'}`}>Rate cards repository</button>
        <button onClick={() => setTab('bench')} className={`px-3 py-2 text-sm ${tab==='bench' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900'}`}>Benchmarks</button>
      </div>

      {tab === 'repo' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="text-xs text-gray-600 dark:text-gray-300">{filteredRepoCount} items match your filters.</div>
          <button onClick={onExportRepo} className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600">Export repository CSV</button>
          <Link href={`/benchmarks/compare${qs}`} className="text-sm underline text-indigo-600">Open Compare</Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="text-xs text-gray-600 dark:text-gray-300">Exports market percentile table based on your current role/country/LoS filters.</div>
          <button onClick={onExportBench} className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600">Export benchmarks CSV</button>
          <Link href={`/benchmarks/compare${qs}`} className="text-sm underline text-indigo-600">Open Compare</Link>
        </div>
      )}
    </div>
  );
}


// Explorer: group-by and aggregate view for repository
function Explorer({ data, supplierLabelFor, groupSort, setGroupSort }: {
  data: (FlatRate & { id?: string })[];
  supplierLabelFor: (docId?: string) => string;
  groupSort: { key: 'group'|'count'|'avg'|'median'|'min'|'max'; dir: 'asc'|'desc' };
  setGroupSort: Dispatch<SetStateAction<{ key: 'group'|'count'|'avg'|'median'|'min'|'max'; dir: 'asc'|'desc' }>>;
}) {
  const [groupBy, setGroupBy] = useState<'role'|'supplier'|'country'|'lineOfService'|'currency'|'uom'|'docId'>('role');

  const groups = useMemo(() => {
    const m = new Map<string, number[]>();
    const push = (k: string, v?: number) => {
      if (!k) k = 'Unknown';
      if (!m.has(k)) m.set(k, []);
      if (typeof v === 'number' && !Number.isNaN(v)) m.get(k)!.push(v);
    };
    for (const r of data) {
      const k = groupBy === 'supplier' ? supplierLabelFor(r.docId) : String((r as any)[groupBy] || 'Unknown');
      push(k, r.dailyUsd);
    }
    const stats = Array.from(m.entries()).map(([k, arr]) => {
      const sorted = [...arr].sort((a,b)=>a-b);
      const n = arr.length;
      const sum = arr.reduce((a,b)=>a+b, 0);
      const avg = n ? sum / n : 0;
      const median = n ? (n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1] + sorted[n/2]) / 2) : 0;
      const min = n ? sorted[0] : 0;
      const max = n ? sorted[n-1] : 0;
      return { group: k, count: n, avg, median, min, max };
    });
    // sort
    const dir = groupSort.dir === 'asc' ? 1 : -1;
    const key = groupSort.key;
    return stats.sort((a: any, b: any) => {
      const va = a[key]; const vb = b[key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [data, groupBy, supplierLabelFor, groupSort]);

  const header = (label: string, key: 'group'|'count'|'avg'|'median'|'min'|'max') => (
    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
      <button
        className="inline-flex items-center gap-1 hover:underline"
        onClick={()=> setGroupSort((s)=> ({ key, dir: s.key===key && s.dir==='asc' ? 'desc' : 'asc' }))}
      >
        {label}
        {groupSort.key===key ? <span className="text-[10px]">{groupSort.dir==='asc'?'▲':'▼'}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-3 flex items-center gap-3">
        <div className="text-sm text-gray-700 dark:text-gray-200">Group by</div>
        <select value={groupBy} onChange={(e)=> setGroupBy(e.target.value as any)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
          <option value="role">Std role</option>
          <option value="supplier">Supplier</option>
          <option value="country">Country</option>
          <option value="lineOfService">Line of service</option>
          <option value="currency">Currency</option>
          <option value="uom">UoM</option>
          <option value="docId">Doc</option>
        </select>
        <div className="ml-auto text-xs text-gray-500">{data.length} rows</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              {header('Group', 'group')}
              {header('Count', 'count')}
              {header('Avg USD/day', 'avg')}
              {header('Median USD/day', 'median')}
              {header('Min', 'min')}
              {header('Max', 'max')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {groups.map((g)=> (
              <tr key={g.group}>
                <td className="px-4 py-2 text-sm truncate">{g.group}</td>
                <td className="px-4 py-2 text-sm">{g.count}</td>
                <td className="px-4 py-2 text-sm">{g.avg ? Math.round(g.avg) : '-'}</td>
                <td className="px-4 py-2 text-sm">{g.median ? Math.round(g.median) : '-'}</td>
                <td className="px-4 py-2 text-sm">{g.min ? Math.round(g.min) : '-'}</td>
                <td className="px-4 py-2 text-sm">{g.max ? Math.round(g.max) : '-'}</td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No data.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

