"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Upload, Search, Filter, RefreshCcw, Eye, Copy, Loader2, Pause, Play, Clock, CheckCircle2, XCircle, X, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';
import { API_BASE_URL } from '@/lib/config';
import { tenantHeaders } from '@/lib/tenant';
import { FilterBar, type FilterValue } from '@/components/ui/filter-bar';

type Contract = { id: string; name: string; status: string; updatedAt?: string; archived?: boolean };
type Overview = { summary?: string; parties?: string[]; startDate?: string; terminationDate?: string; type?: string; tcv?: number };

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // first-load only
  const [loadingBg, setLoadingBg] = useState<boolean>(false); // background refresh indicator
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; kind?: 'success'|'error' } | null>(null);
  const [q, setQ] = useState('');
  // Initialize with a stable default, then hydrate from localStorage after mount to avoid SSR mismatch
  const [showFilters, setShowFilters] = useState<boolean>(false);
  useEffect(() => { try { window.localStorage.setItem('contracts.showFilters', showFilters ? '1' : '0'); } catch {} }, [showFilters]);
  const [filters, setFilters] = useState<FilterValue>({});
  // Debounced search term for better UX
  const [qDebounced, setQDebounced] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState<{ open: boolean; url?: string; type?: string; name?: string }>(() => ({ open: false }));
  const [ask, setAsk] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [askRes, setAskRes] = useState<any | null>(null);
  const [sourcesModal, setSourcesModal] = useState<{ open: boolean; items: any[]; title?: string }>({ open: false, items: [] });
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<{ open: boolean; action?: 'reprocess' | 'archive' | 'delete' | 'unarchive'; ids?: string[] }>(() => ({ open: false }));
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number; errors: number }>({ running: false, done: 0, total: 0, errors: 0 });

  const prevHashRef = useRef<string>('');
  const overviewCacheRef = useRef<Map<string, { updatedAt?: string }>>(new Map());
  const hasActiveRef = useRef<boolean>(false);
  const lastManualRefreshAtRef = useRef<number>(0);

  const load = async (opts?: { initial?: boolean; background?: boolean }) => {
    try {
      if (opts?.initial) setLoading(true); else setLoadingBg(true);
      const r = await fetch(`${API_BASE_URL}/api/contracts`, { headers: tenantHeaders() });
      if (r.ok) {
        const raw = await r.json();
        const base: Contract[] = Array.isArray(raw) ? raw : (raw?.items || []);
        // Track whether any contract is in an active/processing state for adaptive polling
        hasActiveRef.current = base.some((c: any) => ['UPLOADED','PROCESSING','IN_PROGRESS'].includes(String(c.status || '').toUpperCase()));
        // Fetch overview for each to enrich list (best-effort)
        // Only fetch overview on initial load or when updatedAt changed or missing
        const enriched = await Promise.all(base.map(async (c) => {
          const prev = overviewCacheRef.current.get(c.id);
          const shouldFetchOv = opts?.initial || !prev || (prev.updatedAt !== c.updatedAt);
          if (!shouldFetchOv) return c as any; // keep lightweight
          try {
            const a = await fetch(`${API_BASE_URL}/api/contracts/${c.id}/artifacts/overview.json`, { headers: tenantHeaders() });
            if (!a.ok) return c as any;
            const ov = (await a.json()) as Overview;
            overviewCacheRef.current.set(c.id, { updatedAt: c.updatedAt });
            return { ...c, __overview: ov } as any;
          } catch { return c as any; }
        }));
        // Avoid state churn if nothing meaningful changed
        const hash = JSON.stringify(enriched.map((c: any) => ({ id: c.id, name: c.name, status: c.status, updatedAt: c.updatedAt })));
        if (hash !== prevHashRef.current) {
          prevHashRef.current = hash;
          setContracts(enriched as any);
        }
        setLastUpdatedAt(Date.now());
      }
    } catch (e) {
      console.debug('Failed to load contracts:', e);
    } finally {
      if (opts?.initial) setLoading(false);
      setLoadingBg(false);
    }
  };
  // Load autoRefresh preference once
  useEffect(() => {
    try { const v = window.localStorage.getItem('contracts.autoRefresh'); if (v !== null) setAutoRefresh(v === '1'); } catch {}
  }, []);
  // Persist selectedIds in session
  useEffect(() => {
    try { const raw = window.sessionStorage.getItem('contracts.selectedIds'); if (raw) setSelectedIds(new Set(JSON.parse(raw))); } catch {}
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('contracts.selectedIds', JSON.stringify(Array.from(selectedIds))); } catch {}
  }, [selectedIds]);
  // Adaptive background refresh: fast while processing, slow when idle; can be toggled off
  useEffect(() => {
    let alive = true;
    let timer: any;
    const tick = async (first = false) => {
      await load({ initial: first, background: !first });
      if (!alive) return;
      const delay = autoRefresh ? (hasActiveRef.current ? 4000 : 25000) : null;
      if (delay != null) timer = setTimeout(() => tick(false), delay);
    };
    tick(true);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [autoRefresh]);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    // persist autoRefresh preference
    try { window.localStorage.setItem('contracts.autoRefresh', autoRefresh ? '1' : '0'); } catch {}
  }, [autoRefresh]);
  useEffect(() => {
    if (!toast) return; const id = setTimeout(() => setToast(null), 2500); return () => clearTimeout(id);
  }, [toast]);

  // (Removed duplicate polling effect)

  // Persist filters and search in session
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('contracts.filters');
      if (saved) setFilters(JSON.parse(saved));
      const qs = window.sessionStorage.getItem('contracts.q');
      if (qs) { setQ(qs); setQDebounced(qs); }
    } catch {}
  }, []);
  useEffect(() => { try { window.sessionStorage.setItem('contracts.filters', JSON.stringify(filters||{})); } catch {} }, [filters]);
  useEffect(() => { try { window.sessionStorage.setItem('contracts.q', q); } catch {} }, [q]);
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q), 200);
    return () => clearTimeout(id);
  }, [q]);

  // Detect recent batch upload and show CTA once
  const [showBatchCta, setShowBatchCta] = useState<{ count: number } | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ ids: string[]; done: number; total: number; pct: number } | null>(null);
  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem('batchUploadedCount');
      const idsRaw = window.sessionStorage.getItem('batchUploadedDocIds');
      if (v) {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n > 1) setShowBatchCta({ count: n });
        window.sessionStorage.removeItem('batchUploadedCount');
      }
      if (idsRaw) {
        const ids = JSON.parse(idsRaw) as string[];
        if (Array.isArray(ids) && ids.length > 1) setBatchProgress({ ids, done: 0, total: ids.length, pct: 0 });
        window.sessionStorage.removeItem('batchUploadedDocIds');
      }
    } catch {}
  }, []);

  // Poll per-contract status for recent batch to show progress until complete
  useEffect(() => {
    if (!batchProgress || batchProgress.ids.length === 0) return;
    let alive = true;
    const poll = async () => {
      try {
        const results = await Promise.all(batchProgress.ids.map(async (id) => {
          try {
            const r = await fetch(`${API_BASE_URL}/api/contracts/${id}/status`, { headers: tenantHeaders() });
            if (!r.ok) return { id, state: 'unknown' } as any;
            const s = await r.json();
            return { id, state: s?.status || 'unknown' } as any;
          } catch { return { id, state: 'unknown' } as any; }
        }));
        if (!alive) return;
        const done = results.filter(x => {
          const s = String(x.state).toLowerCase();
          return s === 'completed' || s === 'failed';
        }).length;
        const pct = Math.round((done / Math.max(1, batchProgress.total || 1)) * 100);
        setBatchProgress(bp => bp ? { ...bp, done, pct } : null);
        if (done >= (batchProgress.total || 0)) {
          setTimeout(() => setBatchProgress(null), 2500);
          return;
        }
      } catch {}
      if (alive) setTimeout(poll, 3000);
    };
    poll();
    return () => { alive = false; };
  }, [batchProgress?.total]);

  // Lightweight heuristics to infer client/supplier/type from overview and filename
  const deriveMeta = (c: any) => {
    const ov: any = c.__overview || {};
    const parties: string[] = Array.isArray(ov.parties) ? ov.parties : [];
    let inferredClient = '';
    let inferredSupplier = '';
    if (parties.length) {
      const clientLike = parties.find(p => /client\b/i.test(p));
      const supplierLike = parties.find(p => /supplier\b/i.test(p));
      if (clientLike) inferredClient = clientLike.replace(/\(.*?\)/g, '').trim();
      if (supplierLike) inferredSupplier = supplierLike.replace(/\(.*?\)/g, '').trim();
      // Fallback ordering
      if (!inferredClient && parties[0]) inferredClient = parties[0].replace(/\(.*?\)/g, '').trim();
      if (!inferredSupplier && parties[1]) inferredSupplier = parties[1].replace(/\(.*?\)/g, '').trim();
    }
    let inferredType: string | undefined = ov.type;
    if (!inferredType) {
      const nm = (c.name || '').toLowerCase();
      if (/(^|\b)msa\b|master service/i.test(nm)) inferredType = 'MSA';
      else if (/\bsow\b|statement of work/i.test(nm)) inferredType = 'SOW';
      else if (/\bpo\b|purchase order/i.test(nm)) inferredType = 'PO';
      else if (/order form/i.test(nm)) inferredType = 'Order Form';
    }
    return { parties, client: inferredClient, supplier: inferredSupplier, type: inferredType || 'Unknown' };
  };

  const CURATED_TYPES = [
    'Non-Disclosure Agreement (NDA) / Confidentiality Agreement (CA)',
    'Master Services Agreement (MSA)',
    'Statement of Work (SOW)',
    'Work Order (WO) / Work Authorization',
    'Engagement Letter',
    'Purchase Order (PO)',
    'Service Level Agreement (SLA)'
  ];
  const CURATED_CATEGORIES = [
    'Consulting (6003)',
    'Business Process Outsourcing (BPO) (6013)',
    'Contractors (6014)',
    'HR Services (6005)',
    'Legal Services (6007)',
    'Insurances (6011)',
    'Translation Services (6006)'
  ];
  const deriveCategory = (c: any): string | undefined => {
    const nm = String(c.name || '').toLowerCase();
    if (/consult/i.test(nm)) return 'Consulting (6003)';
    if (/bpo|outsourc/i.test(nm)) return 'Business Process Outsourcing (BPO) (6013)';
    if (/contractor|freelance/i.test(nm)) return 'Contractors (6014)';
    if (/hr|payroll|recruit/i.test(nm)) return 'HR Services (6005)';
    if (/legal|law|attorney/i.test(nm)) return 'Legal Services (6007)';
    if (/insur/i.test(nm)) return 'Insurances (6011)';
    if (/translat|localiz/i.test(nm)) return 'Translation Services (6006)';
    return undefined;
  };

  const optionSets = useMemo(() => {
    const clients = new Set<string>();
    const suppliers = new Set<string>();
    const types = new Set<string>();
    const statuses = new Set<string>();
    const categories = new Set<string>();
    for (const c of contracts as any[]) {
      const meta = deriveMeta(c);
      if (meta.client) clients.add(meta.client);
      if (meta.supplier) suppliers.add(meta.supplier);
      if (meta.type) types.add(meta.type);
      const cat = deriveCategory(c);
      if (cat) categories.add(cat);
      const st = (c as any).status;
      if (st) statuses.add(st);
    }
    return {
      clients: Array.from(clients).sort(),
      suppliers: Array.from(suppliers).sort(),
      types: CURATED_TYPES,
      statuses: Array.from(statuses).sort(),
      categories: CURATED_CATEGORIES,
    };
  }, [contracts]);

  const normalizeType = (t?: string): string => {
    if (!t) return 'Unknown';
    const s = t.toLowerCase();
    if (/(nda|confidential)/.test(s)) return 'Non-Disclosure Agreement (NDA) / Confidentiality Agreement (CA)';
    if (/(msa|master\s+services?)/.test(s)) return 'Master Services Agreement (MSA)';
    if (/(sow|statement\s+of\s+work)/.test(s)) return 'Statement of Work (SOW)';
    if (/(work\s+order|wo|authorization)/.test(s)) return 'Work Order (WO) / Work Authorization';
    if (/engagement\s+letter/.test(s)) return 'Engagement Letter';
    if (/(po|purchase\s+order)/.test(s)) return 'Purchase Order (PO)';
    if (/(sla|service\s+level\s+agreement)/.test(s)) return 'Service Level Agreement (SLA)';
    return t;
  };
  const mapStatus = (st?: string): 'Executed' | 'Ongoing' | string => {
    const s = String(st || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'EXECUTED' || s === 'DONE') return 'Executed';
    if (s === 'PROCESSING' || s === 'UPLOADED' || s === 'DRAFT' || s === 'IN_PROGRESS') return 'Ongoing';
    return st || '';
  };
  const has = (arr?: string | string[], val?: string) => {
    if (!arr || (Array.isArray(arr) && arr.length === 0) || !val) return true; // no filter => pass
    const list = Array.isArray(arr) ? arr : [arr];
    return list.includes(val);
  };
  const filtered = useMemo(() => {
    const term = qDebounced.trim().toLowerCase();
    return (contracts as any[]).filter(c => {
      // text search
      const matchesQ = !term || c.name?.toLowerCase().includes(term) || c.id.toLowerCase().includes(term);
      if (!matchesQ) return false;
      const meta = deriveMeta(c);
      // Supplier and client
      if (!has(filters.supplier, meta.supplier)) return false;
      if (!has(filters.client, meta.client)) return false;
      // Type (normalize to curated labels)
      const normType = normalizeType(meta.type);
      if (!has(filters.type, normType)) return false;
      // Status mapping
      const humanStatus = mapStatus(c.status);
      if (!has(filters.status, humanStatus)) return false;
      // Category derived heuristically
      const cat = deriveCategory(c);
      if (!has(filters.category, cat)) return false;
      return true;
    });
  }, [contracts, qDebounced, filters]);

  const onPick = () => fileInput.current?.click();
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
  await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form, headers: tenantHeaders() });
    e.target.value = '';
    load();
  };

  const reanalyze = async (docId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/contracts/${docId}/reanalyze`, { method: 'POST', headers: tenantHeaders() });
      setToast({ message: 'Re-process triggered' });
      load({ background: true });
    } catch {}
  };

  const openViewer = async (docId: string) => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/file`, { headers: tenantHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      setViewer({ open: true, url: data.url, type: data.contentType, name: data.name });
    } catch {}
  };

  const hintChips = [
    { label: 'Notice Period', q: 'SOWs with notice > 60 days' },
    { label: 'GDPR', q: 'contracts missing a GDPR clause' },
    { label: 'Rate Cards', q: "what's Deloitte blended daily rate vs market P75" },
    { label: 'Expiring Soon', q: 'contracts expiring in 90 days' },
    { label: 'Benchmark', q: 'market p75 by role' },
  ];

  const runAsk = async () => {
    const q = ask.trim();
    if (!q) return;
    setAskBusy(true); setAskErr(null);
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/query`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ q }) });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setAskRes(data);
    } catch (e: any) {
      setAskErr(e?.message || 'Query failed');
    } finally {
      setAskBusy(false);
    }
  };

  // Status tabs and counts
  const counts = useMemo(() => {
    const out: Record<string, number> = { All: 0, Executed: 0, Ongoing: 0 };
    for (const c of contracts as any[]) {
      out.All++;
      const st = mapStatus((c as any).status);
      if (st === 'Executed') out.Executed++; else out.Ongoing++;
    }
    return out;
  }, [contracts]);
  const [activeTab, setActiveTab] = useState<'All' | 'Executed' | 'Ongoing'>('All');
  useEffect(() => {
    try { window.localStorage.setItem('contracts.activeTab', activeTab); } catch {}
  }, [activeTab]);
  // Hydrate toggles after mount to keep server and client markup in sync
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('contracts.showFilters');
      if (v !== null) setShowFilters(v === '1');
    } catch {}
    try {
      const t = window.localStorage.getItem('contracts.activeTab') as 'All' | 'Executed' | 'Ongoing' | null;
      if (t) setActiveTab(t);
    } catch {}
  }, []);
  const visibleContracts = useMemo(() => (
    filtered.filter(c => activeTab==='All' ? true : mapStatus((c as any).status)===activeTab)
  ), [filtered, activeTab]);

  const isSelected = (id: string) => selectedIds.has(id);
  const toggleSelect = (id: string, next?: boolean) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      const shouldSelect = typeof next === 'boolean' ? next : !n.has(id);
      if (shouldSelect) n.add(id); else n.delete(id);
      return n;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(visibleContracts.map((c:any)=>c.id)));
  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map((c:any)=>c.id)));

  const bulkReprocess = async (idsArg?: string[]) => {
    const ids = idsArg ?? Array.from(selectedIds);
    if (ids.length === 0) return;
    setConfirmBulk({ open: false });
    setBulk({ running: true, done: 0, total: ids.length, errors: 0 });
    try {
    let errs = 0;
      for (const id of ids) {
        try {
          await fetch(`${API_BASE_URL}/api/contracts/${id}/reanalyze`, { method: 'POST', headers: tenantHeaders() });
        } catch {
      errs++;
      setBulk(b => ({ ...b, errors: b.errors + 1 }));
        } finally {
          setBulk(b => ({ ...b, done: b.done + 1 }));
        }
      }
      await load();
      // Keep selection but you can clear after run
      clearSelection();
    setToast({ message: `Re-process queued for ${ids.length - errs} item(s)${errs? ` · ${errs} error(s)` : ''}`, kind: errs? 'error':'success' });
    } finally {
      setBulk(b => ({ ...b, running: false }));
    }
  };

  const bulkArchive = async (idsArg?: string[]) => {
    const ids = idsArg ?? Array.from(selectedIds);
    if (ids.length === 0) return;
    setConfirmBulk({ open: false });
    setBulk({ running: true, done: 0, total: ids.length, errors: 0 });
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/bulk-archive`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error(await r.text());
      await load();
      clearSelection();
  setToast({ message: `Archived ${ids.length} item(s)`, kind: 'success' });
    } catch {
      setBulk(b => ({ ...b, errors: b.errors + 1 }));
  setToast({ message: 'Bulk archive failed', kind: 'error' });
    } finally {
      setBulk(b => ({ ...b, running: false, done: b.total }));
    }
  };

  const bulkUnarchive = async (idsArg?: string[]) => {
    const ids = idsArg ?? Array.from(selectedIds);
    if (ids.length === 0) return;
    setConfirmBulk({ open: false });
    setBulk({ running: true, done: 0, total: ids.length, errors: 0 });
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/bulk-unarchive`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error(await r.text());
      await load();
      clearSelection();
      setToast({ message: `Unarchived ${ids.length} item(s)`, kind: 'success' });
    } catch {
      setBulk(b => ({ ...b, errors: b.errors + 1 }));
      setToast({ message: 'Bulk unarchive failed', kind: 'error' });
    } finally {
      setBulk(b => ({ ...b, running: false, done: b.total }));
    }
  };

  const bulkDelete = async (idsArg?: string[]) => {
    const ids = idsArg ?? Array.from(selectedIds);
    if (ids.length === 0) return;
    setConfirmBulk({ open: false });
    setBulk({ running: true, done: 0, total: ids.length, errors: 0 });
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/bulk-delete`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error(await r.text());
  // Optimistically remove deleted items from UI
  setContracts(prev => prev.filter(c => !ids.includes((c as any).id)));
      await load();
      clearSelection();
  setToast({ message: `Deleted ${ids.length} item(s)`, kind: 'success' });
    } catch {
      setBulk(b => ({ ...b, errors: b.errors + 1 }));
  setToast({ message: 'Bulk delete failed', kind: 'error' });
    } finally {
      setBulk(b => ({ ...b, running: false, done: b.total }));
    }
  };

  return (
    <div className="space-y-6">
  <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <div className="flex items-center justify-between">
          <div>
    <div className="mb-2"><BackButton hrefFallback="/" /></div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contracts</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Manage and analyze your contract portfolio</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50"
              title="Toggle filters"
              aria-label="Toggle filters"
              onClick={() => setShowFilters(v => !v)}
            >
              <Filter className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center text-sm text-gray-600 dark:text-gray-300 rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden h-9">
              <button
                onClick={()=> setAutoRefresh(v=>!v)}
                className={`px-3 h-9 inline-flex items-center gap-2 ${autoRefresh? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}
                title="Toggle auto-refresh"
              >
                {autoRefresh ? <Play className="w-4 h-4"/> : <Pause className="w-4 h-4"/>}
                {autoRefresh? 'Auto' : 'Paused'}
              </button>
              <button
                onClick={()=> { const now = Date.now(); if (loadingBg || (now - lastManualRefreshAtRef.current) < 1000) return; lastManualRefreshAtRef.current = now; load({ background: true }); }}
                className="px-3 h-9 inline-flex items-center gap-2 border-l border-gray-200 dark:border-gray-700"
                title="Refresh now"
              >
                <RefreshCcw className={`w-4 h-4 ${loadingBg? 'animate-spin' : ''}`} />
                Now
              </button>
            </div>
            <span className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
            <button
              className="hidden sm:inline-flex items-center h-9 px-3 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-sm"
              onClick={() => setConfirmBulk({ open: true, action: 'delete', ids: filtered.map((c:any)=>c.id) })}
              disabled={filtered.length === 0}
              title="Delete all filtered contracts"
              aria-label="Delete all filtered contracts"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete All Filtered
            </button>
            <button
              className="inline-flex items-center h-9 px-3 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
              onClick={onPick}
              title="Upload Contract"
              aria-label="Upload Contract"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Contract
            </button>
            <input ref={fileInput} type="file" className="hidden" onChange={onUpload} />
          </div>
        </div>
      </div>
  <div className="flex items-center justify-between text-xs text-gray-500">
        <div>Showing {visibleContracts.length} of {filtered.length} results</div>
        <div className="flex items-center gap-2">
          {loadingBg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Clock className="w-3.5 h-3.5" />
          <span>{mounted && lastUpdatedAt ? `Updated ${Math.max(1, Math.round((Date.now()-lastUpdatedAt)/1000))}s ago` : 'Updated —'}</span>
        </div>
      </div>

  <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="icon-16 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search contracts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 border rounded-lg p-1 bg-white dark:bg-gray-900">
        {(['All','Executed','Ongoing'] as const).map(t => (
          <button key={t} onClick={()=>setActiveTab(t)} className={`px-3 py-1.5 text-sm rounded-md ${activeTab===t? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {t} <span className="ml-1 text-[11px] opacity-70">{counts[t]}</span>
          </button>
        ))}
      </div>

  {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-indigo-50 border-indigo-200 text-indigo-800">
          <div className="text-sm font-medium">{selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
      <button onClick={clearSelection} className="text-xs px-2 py-1 rounded border" title="Clear selection" aria-label="Clear selection">Clear</button>
    <button onClick={selectAllVisible} className="text-xs px-2 py-1 rounded border" title="Select all results in current view" aria-label="Select all results in current view">Select all in view ({visibleContracts.length})</button>
    <button onClick={selectAllFiltered} className="text-xs px-2 py-1 rounded border" title="Select all filtered results" aria-label="Select all filtered results">Select all filtered ({filtered.length})</button>
    <button onClick={()=> setConfirmBulk({ open: true, action: 'reprocess' })} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" disabled={bulk.running} title="Re-process selected contracts">Re-process Selected{bulk.running ? '…' : ''}</button>
    <button onClick={()=> setConfirmBulk({ open: true, action: 'archive' })} className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700" disabled={bulk.running} title="Archive selected contracts">Archive Selected</button>
    <button onClick={()=> setConfirmBulk({ open: true, action: 'unarchive' })} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700" disabled={bulk.running} title="Unarchive selected contracts">Unarchive Selected</button>
  <button onClick={()=> setConfirmBulk({ open: true, action: 'delete' })} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700" disabled={bulk.running} title="Delete selected contracts">Delete Selected</button>
          </div>
        </div>
      )}

      {showBatchCta && (
        <div className="rounded-lg border p-3 bg-indigo-50 border-indigo-200 text-indigo-800 flex items-center justify-between">
          <div className="text-sm">{showBatchCta.count} contracts uploaded. Processing will continue in the background.</div>
          <Link href="/upload" className="text-sm px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">Upload more</Link>
        </div>
      )}
      {batchProgress && (
        <div className="rounded-lg border p-3 bg-amber-50 border-amber-200 text-amber-800 flex items-center justify-between">
          <div className="text-sm">Analyzing batch… {batchProgress.done}/{batchProgress.total} completed</div>
          <div className="flex items-center gap-2 min-w-[160px]">
            <div className="h-2 flex-1 bg-amber-100 rounded">
              <div className="h-2 bg-amber-500 rounded" style={{ inlineSize: `${batchProgress.pct}%` }} />
            </div>
            <div className="w-10 text-right text-xs">{batchProgress.pct}%</div>
          </div>
        </div>
      )}

      {/* Ask Bar */
      }
      <div className="rounded-lg border p-4 bg-white dark:bg-gray-900">
          <div className="flex items-center space-x-3">
          <input
            value={ask}
            onChange={e=>setAsk(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); runAsk(); } }}
            placeholder="Ask your contracts (e.g., ‘SOWs with notice > 60 days’)"
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button onClick={runAsk} disabled={askBusy || ask.trim()===''} className={`px-3 py-2 rounded text-sm ${askBusy || ask.trim()===''? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`} aria-label="Run Ask" title="Run Ask">{askBusy ? 'Asking…' : 'Ask'}</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {hintChips.map(h => (
            <button key={h.label} onClick={()=>{ setAsk(h.q); setTimeout(()=> runAsk(), 0); }} className="text-xs px-2 py-1 rounded-full border hover:bg-gray-50" title={`Ask: ${h.q}`}>{h.label}</button>
          ))}
        </div>
        <div className="mt-4">
          {!askBusy && !askRes && !askErr && (
            <div className="text-sm text-gray-500">Try: ‘contracts expiring in 90 days’</div>
          )}
          {askBusy && (
            <div className="text-sm text-gray-500">Loading…</div>
          )}
          {askErr && (
            <div className="text-sm text-red-600">{askErr}. <span className="text-gray-500">Refine query.</span></div>
          )}
          {askRes && (
            <div className="space-y-3">
              {askRes.kind === 'metrics' && Array.isArray(askRes.metrics) && (
                <>
                  {askRes.metrics.length === 0 ? (
                    <div className="text-sm text-gray-500">No metrics found.</div>
                  ) : (
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
                </>
              )}
              {askRes.kind === 'table' && Array.isArray(askRes.rows) && (
                <>
                  {askRes.rows.length === 0 ? (
                    <div className="text-sm text-gray-500">No results.</div>
                  ) : (
                    <div className="overflow-x-auto rounded border">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {askRes.columns?.map((c:any) => (<th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-600">{c.label}</th>))}
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Sources</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
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
                </>
              )}
              {askRes.kind === 'findings' && Array.isArray(askRes.findings) && (
                <>
                  {askRes.findings.length === 0 ? (
                    <div className="text-sm text-gray-500">No findings.</div>
                  ) : (
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sources Modal */}
      {sourcesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[92vw] max-w-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium truncate">{sourcesModal.title || 'Sources'}</div>
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

      {/* Show badges even when controls are collapsed */}
  <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
        {showFilters ? (
          <FilterBar options={optionSets as any} value={filters as any} onChange={setFilters as any} mode="dropdowns" />
        ) : (
          <FilterBar options={optionSets as any} value={filters as any} onChange={setFilters as any} hideControls showBadges />
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="rounded-lg border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3"/>
              <div className="mt-2 h-3 bg-gray-200 rounded w-1/3"/>
              <div className="mt-4 h-24 bg-gray-100 rounded"/>
            </div>
          ))}
        </div>
      ) : filtered.filter(c => activeTab==='All' ? true : mapStatus((c as any).status)===activeTab).length === 0 ? (
        <div className="card-premium rounded-2xl p-8 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Contract Management</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Upload and manage your contracts here.</p>
          <button className="btn btn-primary" onClick={onPick}><Upload className="icon-16 mr-2" />Upload Your First Contract</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleContracts.map(c => {
            const ov: any = (c as any).__overview;
            const meta = deriveMeta(c as any);
            return (
              <Link key={c.id} href={`/contracts/${c.id}`} className={`block rounded-lg border p-4 hover:shadow-sm transition relative ${isSelected(c.id)?'ring-2 ring-indigo-400 border-indigo-300 bg-indigo-50/40':''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0 gap-2">
                    <input
                      type="checkbox"
                      aria-label="Select contract"
                      checked={isSelected(c.id)}
                      onChange={e => { e.preventDefault(); e.stopPropagation(); toggleSelect(c.id, e.target.checked); }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="font-medium truncate mr-2">{c.name}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${c.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'PROCESSING' || c.status === 'UPLOADED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{c.status}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span className="truncate mr-2">{c.id}</span>
                  {c.updatedAt && (
                    <span className="text-gray-400 whitespace-nowrap">
                      Updated {mounted ? new Date(c.updatedAt).toLocaleString() : new Date(c.updatedAt).toISOString()}
                    </span>
                  )}
                </div>
                {/* CTA row */}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(c.id); }} className="inline-flex items-center text-xs px-2 py-1 rounded border" aria-label="Copy contract ID" title="Copy contract ID">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy ID
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); openViewer(c.id); }} className="inline-flex items-center text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200" aria-label="View contract" title="View contract">
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.preventDefault(); reanalyze(c.id); }} className="inline-flex items-center text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200" aria-label="Re-process contract" title="Re-process contract">
                      <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Re-process
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setConfirmBulk({ open: true, action: 'delete', ids: [c.id] }); }}
                      className="inline-flex items-center text-xs px-2 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                      aria-label="Delete contract"
                      title="Delete contract"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </button>
                  </div>
                </div>
                {ov && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {ov.startDate && <div><span className="text-gray-500">Start:</span> <span className="text-gray-900">{ov.startDate}</span></div>}
                    {ov.terminationDate && <div><span className="text-gray-500">End:</span> <span className="text-gray-900">{ov.terminationDate}</span></div>}
                    {Array.isArray(ov.parties) && ov.parties.length>0 && <div className="col-span-2"><span className="text-gray-500">Parties:</span> <span className="text-gray-900">{ov.parties.join(' · ')}</span></div>}
                    {meta.type && <div><span className="text-gray-500">Type:</span> <span className="text-gray-900">{meta.type}</span></div>}
                    {(meta.client || meta.supplier) && <div className="col-span-2"><span className="text-gray-500">Client/Supplier:</span> <span className="text-gray-900">{meta.client || '—'} / {meta.supplier || '—'}</span></div>}
                    {typeof ov.tcv === 'number' && <div><span className="text-gray-500">TCV:</span> <span className="text-gray-900">${'{'}ov.tcv.toLocaleString(){'}'}</span></div>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Confirm Bulk Modal */}
      {confirmBulk.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[92vw] max-w-md flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-medium">
              {(() => { const count = confirmBulk.ids ? confirmBulk.ids.length : selectedIds.size; return (
                confirmBulk.action === 'archive' ? `Archive ${count} selected?` :
                confirmBulk.action === 'unarchive' ? `Unarchive ${count} selected?` :
                confirmBulk.action === 'delete' ? `Delete ${count} selected?` :
                `Re-process ${count} selected?`
              ); })()}
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
              {confirmBulk.action === 'archive' ? 'This will hide selected contracts from default views (soft archive).' :
               confirmBulk.action === 'unarchive' ? 'This will restore visibility for archived contracts.' :
               confirmBulk.action === 'delete' ? 'This will permanently remove the selected contract(s), including extracted rate cards and related artifacts. This action cannot be undone.' :
               'This will trigger re-analysis for all selected contracts.'}
            </div>
            <div className="p-3 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
              <button onClick={()=> setConfirmBulk({ open:false })} className="text-sm px-3 py-1.5 rounded border">Cancel</button>
              <button onClick={()=>{
                const ids = confirmBulk.ids;
                if (confirmBulk.action === 'archive') return bulkArchive(ids);
                if (confirmBulk.action === 'unarchive') return bulkUnarchive(ids);
                if (confirmBulk.action === 'delete') return bulkDelete(ids);
                return bulkReprocess(ids);
              }} disabled={bulk.running} className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700">{bulk.running? 'Processing…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Progress Toast */}
      {bulk.running && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg shadow-lg bg-white border p-3 text-sm">
          Re-processing… {bulk.done}/{bulk.total}{bulk.errors? ` · errors: ${bulk.errors}`: ''}
        </div>
      )}
      {/* Viewer Modal */}
      {viewer.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewer({ open: false })}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[92vw] h-[88vh] flex flex-col" onClick={(e)=> e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium truncate">{viewer.name || 'Contract'}</div>
              <div className="flex items-center gap-2">
                {viewer.url && (
                  <a href={viewer.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Open in new tab</a>
                )}
                <button onClick={() => setViewer({ open: false })} className="text-sm px-2 py-1 rounded border">Close</button>
              </div>
            </div>
            <div className="flex-1">
              {viewer.type === 'application/pdf' && viewer.url ? (
                <iframe src={viewer.url} className="w-full h-full" title="Contract PDF Viewer" />
              ) : viewer.url ? (
                <div className="flex items-center justify-center h-full">
                  <a href={viewer.url} target="_blank" rel="noreferrer" className="btn btn-primary">Download File</a>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">Unable to load file.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-card toast */}
      {toast && (
        <div className={`fixed bottom-20 right-4 z-50 rounded-lg shadow-lg border p-3 pl-3 pr-2 text-sm inline-flex items-center gap-2 ${toast.kind==='error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-900'}`}>
          {toast.kind==='error' ? <XCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          <span>{toast.message}</span>
          <button className="ml-2 p-1 rounded hover:bg-black/5" onClick={()=> setToast(null)} aria-label="Dismiss toast"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}
