"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Percent, CheckCircle2, ArrowDownRight, ArrowUpRight, Users, Building2, Filter, Download, SlidersHorizontal, ListChecks, ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { tenantHeaders } from "@/lib/tenant";
import { BackButton } from "@/components/ui/back-button";
import { FilterBar, type FilterValue } from "@/components/ui/filter-bar";

type Contract = { id: string; name: string; status: string };
type Overview = { parties?: string[]; type?: string };
type Rate = { role?: string; dailyUsd?: number; docId: string; currency?: string; uom?: string; country?: string; lineOfService?: string; id?: string };
type BenchRow = { role: string; p50: number | null; p75: number | null; p90: number | null };

export default function CompareRatesPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [bench, setBench] = useState<BenchRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterValue>({});
  // Reference selection state
  const [compareMode, setCompareMode] = useState<'market' | 'custom'>('market');
  const [marketTarget, setMarketTarget] = useState<'p50' | 'p75' | 'p90'>('p75');
  const [refQuery, setRefQuery] = useState({ role: '', country: '', lineOfService: '' });
  const [refSelected, setRefSelected] = useState<string[]>([]); // keys into rates repo items
  // UI clustering state
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [showSupplierMenu, setShowSupplierMenu] = useState(false);
  const [refFiltersOpen, setRefFiltersOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
  const cRes = await fetch(`${API_BASE_URL}/api/contracts`, { headers: tenantHeaders() });
  const cJson = cRes.ok ? (await cRes.json()) : [];
  const c = Array.isArray(cJson) ? cJson : (cJson?.items || []);
        // Enrich contracts with overview for party inference
        const enriched = await Promise.all((c || []).map(async (ct: Contract) => {
          try {
            const a = await fetch(`${API_BASE_URL}/api/contracts/${ct.id}/artifacts/overview.json`, { headers: tenantHeaders() });
            if (!a.ok) return ct as any;
            const ov = (await a.json()) as Overview;
            return { ...ct, __overview: ov } as any;
          } catch { return ct as any; }
        }));
        setContracts(enriched || []);
        const [r, b] = await Promise.all([
          fetch(`${API_BASE_URL}/api/ratecards`).then((x) => x.json()),
          fetch(`${API_BASE_URL}/api/benchmarks`).then((x) => x.json()),
        ]);
        setRates((r?.items || []) as Rate[]);
        setBench((b?.items || []) as BenchRow[]);
      } catch {}
    };
    load();
  }, []);

  const options = useMemo(() => {
    // Heuristic party inference using overview (same logic as Contracts, trimmed)
    const clients = new Set<string>();
    const suppliers = new Set<string>();
    const types = new Set<string>();
    const statuses = new Set<string>();
    for (const anyc of contracts as any[]) {
      const ov: Overview | undefined = anyc.__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      let inferredClient = '';
      let inferredSupplier = '';
      if (parties.length) {
        const clientLike = parties.find((p) => /client\b/i.test(p));
        const supplierLike = parties.find((p) => /supplier\b/i.test(p));
        if (clientLike) inferredClient = clientLike.replace(/\(.*?\)/g, '').trim();
        if (supplierLike) inferredSupplier = supplierLike.replace(/\(.*?\)/g, '').trim();
        if (!inferredClient && parties[0]) inferredClient = parties[0].replace(/\(.*?\)/g, '').trim();
        if (!inferredSupplier && parties[1]) inferredSupplier = parties[1].replace(/\(.*?\)/g, '').trim();
      }
      if (inferredClient) clients.add(inferredClient);
      if (inferredSupplier) suppliers.add(inferredSupplier);
      const nm = (anyc.name || '').toLowerCase();
      if (/(^|\b)msa\b|master service/i.test(nm)) types.add('MSA');
      else if (/\bsow\b|statement of work/i.test(nm)) types.add('SOW');
      else if (/\bpo\b|purchase order/i.test(nm)) types.add('PO');
      else if (/order form/i.test(nm)) types.add('Order Form');
      else types.add('Unknown');
      if (anyc.status) statuses.add(anyc.status);
    }
    return { clients: Array.from(clients).sort(), suppliers: Array.from(suppliers).sort(), types: Array.from(types).sort(), statuses: Array.from(statuses).sort() };
  }, [contracts]);

  // (unused) const contractMap = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);
  const ratesByDoc = useMemo(() => {
    const m = new Map<string, Rate[]>();
    for (const r of rates) {
      if (!r.docId || !r.role || !r.dailyUsd) continue;
      if (!m.has(r.docId)) m.set(r.docId, []);
      m.get(r.docId)!.push(r);
    }
    return m;
  }, [rates]);

  const benchByRole = useMemo(() => {
    const m = new Map<string, BenchRow>();
    for (const b of bench) m.set(b.role, b);
    return m;
  }, [bench]);

  const selectedRates = useMemo(() => selected.flatMap((id) => ratesByDoc.get(id) || []), [selected, ratesByDoc]);

  // Filter contracts by optional FilterBar selections (client/supplier/type/status)
  const filteredContracts = useMemo(() => {
    if (!filters || Object.keys(filters).length === 0) return contracts;
    return (contracts as any[]).filter((c) => {
      const ov: Overview | undefined = c.__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const clientLike = parties.find((p) => /client\b/i.test(p));
      const inferredSupplier = (supplierLike ? supplierLike : parties[1] || '').replace(/\(.*?\)/g, '').trim();
      const inferredClient = (clientLike ? clientLike : parties[0] || '').replace(/\(.*?\)/g, '').trim();
      const nm = (c.name || '').toLowerCase();
      const inferredType = (/(^|\b)msa\b|master service/i.test(nm)
        ? 'MSA'
        : /\bsow\b|statement of work/i.test(nm)
        ? 'SOW'
        : /\bpo\b|purchase order/i.test(nm)
        ? 'PO'
        : /order form/i.test(nm)
        ? 'Order Form'
        : 'Unknown');
      const okClient = !filters.client || inferredClient === filters.client;
      const okSupplier = !filters.supplier || inferredSupplier === filters.supplier;
      const okType = !filters.type || inferredType === filters.type;
      const okStatus = !filters.status || c.status === filters.status;
      return okClient && okSupplier && okType && okStatus;
    });
  }, [contracts, filters]);

  // Search within filtered contracts for dropdown
  const searchFilteredContracts = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    if (!q) return filteredContracts;
    return filteredContracts.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [filteredContracts, contractSearch]);

  // Build reference list filtered by role/country/los for custom selection
  const filteredRepoRates = useMemo(() => {
    const r = refQuery.role.toLowerCase();
    const c = refQuery.country.toLowerCase();
    const l = refQuery.lineOfService.toLowerCase();
    return rates.filter((it) => {
      const roleOk = !r || (it.role || '').toLowerCase().includes(r);
      const countryOk = !c || (it.country || 'Unknown').toLowerCase().includes(c);
      const losOk = !l || (it.lineOfService || 'Unknown').toLowerCase().includes(l);
      return roleOk && countryOk && losOk;
    });
  }, [rates, refQuery]);

  // Stable key generator for repo rows
  const rateKey = useCallback((it: Rate, idx: number) => `${it.id || ''}|${it.docId}|${it.role}|${it.dailyUsd}|${it.country || ''}|${it.lineOfService || ''}|${idx}`,[/* stable */]);

  // Aggregate reference average by role from selected repo items
  const refAvgByRole = useMemo(() => {
    if (compareMode !== 'custom') return new Map<string, number>();
    const m = new Map<string, number[]>();
    rates.forEach((it, idx) => {
      const key = rateKey(it, idx);
      if (!refSelected.includes(key)) return;
      if (!it.role || !it.dailyUsd) return;
      const arr = m.get(it.role) || [];
      arr.push(it.dailyUsd);
      m.set(it.role, arr);
    });
    const out = new Map<string, number>();
    m.forEach((arr, role) => {
      const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      out.set(role, avg);
    });
    return out;
  }, [compareMode, rates, refSelected, rateKey]);

  const roleRows = useMemo(() => {
    // Aggregate selected contracts by role; compare to selected target (market percentile or custom avg)
    const groups = new Map<string, number[]>();
    for (const r of selectedRates) {
      if (!r.role || !r.dailyUsd) continue;
      const k = r.role;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r.dailyUsd);
    }
    const rows = Array.from(groups.entries()).map(([role, arr]) => {
      const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      const b = benchByRole.get(role);
      const marketVal = marketTarget === 'p50' ? (b?.p50 ?? null) : marketTarget === 'p75' ? (b?.p75 ?? null) : (b?.p90 ?? null);
      const customRef = refAvgByRole.get(role) ?? null;
      const target = compareMode === 'market' ? marketVal : customRef;
      const gap = target != null ? Math.round(avg - target) : null;
      const savingsPct = target != null ? Math.round(((avg - target) / avg) * 100) : null;
      return { role, avg, p50: b?.p50 ?? null, p75: b?.p75 ?? null, p90: b?.p90 ?? null, refAvg: customRef, target, gap, savingsPct };
    }).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
    return rows;
  }, [selectedRates, benchByRole, compareMode, marketTarget, refAvgByRole]);

  const applySupplierPreset = useCallback((supplierName: string) => {
    // auto-select all contracts where inferred supplier matches
    const matches = (contracts as any[]).filter((c) => {
      const ov: Overview | undefined = c.__overview;
      const parties = Array.isArray(ov?.parties) ? ov!.parties! : [];
      const supplierLike = parties.find((p) => /supplier\b/i.test(p));
      const inferredSupplier = supplierLike ? supplierLike.replace(/\(.*?\)/g, '').trim() : parties[1]?.replace(/\(.*?\)/g, '').trim();
      return inferredSupplier?.toLowerCase().includes(supplierName.toLowerCase());
    }).map((c) => c.id);
    setSelected(matches);
  }, [contracts]);

  const exportCsv = () => {
    const header = compareMode === 'market'
      ? ['role','avgSelected','target','p50','p75','p90','gap','savingsPct']
      : ['role','avgSelected','refAvg','gap','savingsPct'];
    const rows = roleRows.map(r => compareMode === 'market'
      ? [r.role, r.avg ?? '', r.target ?? '', r.p50 ?? '', r.p75 ?? '', r.p90 ?? '', r.gap ?? '', r.savingsPct ?? '']
      : [r.role, r.avg ?? '', r.refAvg ?? '', r.gap ?? '', r.savingsPct ?? '']
    );
    const csv = [header.join(','), ...rows.map(cols => cols.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-gap-comparison.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2"><BackButton hrefFallback="/benchmarks" /></div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <Percent className="w-7 h-7 mr-3 text-indigo-600" />
                Compare Rate Cards
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select contracts (e.g., Deloitte across clients) and compare roles vs market percentiles to identify savings.</p>
            </div>
          </div>
        </div>

  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> 1) Pick contracts to compare
            </h3>
            <div className="text-xs text-gray-600 dark:text-gray-300">Selected: <span className="font-semibold">{selected.length}</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 relative">
            {/* Contract multi-select dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowContractPicker(v => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                aria-expanded={showContractPicker}
              >
                <ListChecks className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                {selected.length > 0 ? `${selected.length} selected` : 'Select contracts'}
                {showContractPicker ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </button>
              {showContractPicker && (
                <div className="absolute z-20 mt-2 w-96 max-w-[90vw] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                    <input
                      value={contractSearch}
                      onChange={(e)=>setContractSearch(e.target.value)}
                      placeholder="Search contracts..."
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {searchFilteredContracts.map((c) => {
                      const is = selected.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={is}
                            onChange={(e)=>{
                              setSelected((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id));
                            }}
                          />
                          <span className="truncate" title={c.name}>{c.name}</span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">{c.status || '—'}</span>
                        </label>
                      );
                    })}
                    {searchFilteredContracts.length === 0 && (
                      <div className="px-3 py-3 text-xs text-gray-500">No matches.</div>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(searchFilteredContracts.map((c)=>c.id))} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Select all</button>
                      <button onClick={() => setSelected([])} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Clear</button>
                    </div>
                    <button onClick={() => setShowContractPicker(false)} className="px-2 py-1 rounded bg-indigo-600 text-white">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier presets dropdown */}
            <div className="relative">
              <button
                onClick={()=> setShowSupplierMenu(v=>!v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                aria-expanded={showSupplierMenu}
              >
                <Building2 className="w-4 h-4 text-gray-700 dark:text-gray-300" /> Supplier presets
                {showSupplierMenu ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </button>
              {showSupplierMenu && (
                <div className="absolute z-20 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-72 overflow-auto">
                  {options.suppliers.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-500">No suppliers inferred.</div>
                  )}
                  {options.suppliers.map((s) => (
                    <button
                      key={s}
                      onClick={() => { applySupplierPreset(s); setShowSupplierMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <button onClick={() => setSelected(filteredContracts.map((c) => c.id))} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Select all visible
            </button>
            <button onClick={() => setSelected([])} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm">
              <X className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" /> 2) Filter visible contracts (optional)
          </h3>
          <FilterBar options={options} value={filters} onChange={setFilters} />
        </div>

        {/* Reference selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-indigo-600" /> 3) Choose comparison base</h3>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setCompareMode('market')} className={`px-3 py-2 text-sm inline-flex items-center gap-2 ${compareMode==='market' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900'}`}>
                <Percent className="w-4 h-4" /> Market
              </button>
              <button onClick={() => setCompareMode('custom')} className={`px-3 py-2 text-sm inline-flex items-center gap-2 ${compareMode==='custom' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-900'}`}>
                <ListChecks className="w-4 h-4" /> Custom rates
              </button>
            </div>
            {compareMode === 'market' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"><SlidersHorizontal className="w-4 h-4" /> Percentile:</span>
                <select value={marketTarget} onChange={(e)=>setMarketTarget(e.target.value as any)} className="px-2 py-1 border rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700">
                  <option value="p50">P50</option>
                  <option value="p75">P75</option>
                  <option value="p90">P90</option>
                </select>
              </div>
            )}
          </div>

          {compareMode === 'custom' && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <button onClick={()=> setRefFiltersOpen(v=>!v)} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700">
                  <Filter className="w-4 h-4" /> {refFiltersOpen ? 'Hide' : 'Show'} reference filters
                  {refFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => setRefSelected(filteredRepoRates.map((it, idx) => rateKey(it, idx)))} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Select all filtered</button>
                  <button onClick={() => setRefSelected([])} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Clear</button>
                </div>
              </div>
              {refFiltersOpen && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <input value={refQuery.role} onChange={(e)=>setRefQuery(q=>({...q, role: e.target.value}))} placeholder="Filter role" className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                  <input value={refQuery.country} onChange={(e)=>setRefQuery(q=>({...q, country: e.target.value}))} placeholder="Filter country" className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                  <input value={refQuery.lineOfService} onChange={(e)=>setRefQuery(q=>({...q, lineOfService: e.target.value}))} placeholder="Filter line of service" className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
                  <button onClick={() => setRefQuery({ role: '', country: '', lineOfService: '' })} className="text-xs text-gray-600 dark:text-gray-300 underline">Clear filters</button>
                </div>
              )}
              <div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold"><input type="checkbox" aria-label="Select all" onChange={(e)=>{
                        if (e.target.checked) setRefSelected(filteredRepoRates.map((it, idx) => rateKey(it, idx))); else setRefSelected([]);
                      }} /></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Doc</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Role</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Daily USD</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Country</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Line of Service</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredRepoRates.map((it, idx) => {
                      const key = rateKey(it, idx);
                      const checked = refSelected.includes(key);
                      return (
                        <tr key={key} className={checked ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}>
                          <td className="px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={(e)=>{
                            setRefSelected((prev)=> e.target.checked ? [...prev, key] : prev.filter(x=>x!==key));
                          }} /></td>
                          <td className="px-3 py-2 text-xs">{it.docId === 'manual' ? <span className="text-gray-500 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> manual</span> : <a className="text-indigo-600 hover:underline inline-flex items-center gap-1" href={`/contracts/${it.docId}`}><FileText className="w-3 h-3" /> {it.docId}</a>}</td>
                          <td className="px-3 py-2 text-sm">{it.role || '-'}</td>
                          <td className="px-3 py-2 text-sm">{it.dailyUsd ?? '-'}</td>
                          <td className="px-3 py-2 text-sm">{it.country || 'Unknown'}</td>
                          <td className="px-3 py-2 text-sm">{it.lineOfService || 'Unknown'}</td>
                        </tr>
                      );
                    })}
                    {filteredRepoRates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">No rates match filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Target per role is the average of selected reference rows.</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-600" /> 4) Role comparison and savings opportunities
          </h3>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Mode: <span className="font-medium">{compareMode === 'market' ? `Market (${marketTarget.toUpperCase()})` : 'Custom reference'}</span>
              {selected.length > 0 && <span className="ml-3">Across <span className="font-semibold">{selected.length}</span> contract(s)</span>}
            </div>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold">Avg (selected)</th>
                  {compareMode === 'market' ? (
                    <>
                      <th className="px-4 py-2 text-left text-xs font-semibold">P50</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold">P75</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold">P90</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold">Gap vs {marketTarget.toUpperCase()}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-left text-xs font-semibold">Ref Avg (custom)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold">Gap vs Ref</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-left text-xs font-semibold">Potential savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {roleRows.map((r) => {
                  const over = r.gap != null && r.gap > 0;
                  return (
                    <tr key={r.role} className={over ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                      <td className="px-4 py-2 text-sm font-medium">{r.role}</td>
                      <td className="px-4 py-2 text-sm">{r.avg ?? '-'}</td>
                      {compareMode === 'market' ? (
                        <>
                          <td className="px-4 py-2 text-sm">{r.p50 ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{r.p75 ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{r.p90 ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{r.gap != null ? (r.gap > 0 ? `+${r.gap}` : `${r.gap}`) : '-'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-sm">{r.refAvg ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{r.gap != null ? (r.gap > 0 ? `+${r.gap}` : `${r.gap}`) : '-'}</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-sm">
                        {r.savingsPct != null ? (
                          <span className={r.savingsPct > 0 ? 'text-red-600' : 'text-green-600'}>
                            {r.savingsPct > 0 ? <ArrowDownRight className="inline w-4 h-4 mr-1" /> : <ArrowUpRight className="inline w-4 h-4 mr-1" />}
                            {Math.abs(r.savingsPct)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
                {roleRows.length === 0 && (
                  <tr>
                    <td colSpan={compareMode === 'market' ? 7 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                      Select at least one contract to see comparison.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
            Suggestions:
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>Focus negotiations on roles with the largest positive gap vs selected target.</li>
              <li>Consider location/line-of-service adjustments where appropriate.</li>
              <li>Import additional market ratecards in Benchmarks → Uploads to enrich reference percentiles.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-sm">
          <Link href="/benchmarks" className="text-indigo-600 hover:underline inline-flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Back to Benchmarks
          </Link>
        </div>
      </div>
    </div>
  );
}
