"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../../lib/config";
import { tenantHeaders, getTenantId } from "../../../lib/tenant";
import { BackButton } from "@/components/ui/back-button";
import { FileDown, Sparkles, FileText, CheckCircle2, BarChart, Shield, Scale, AlertTriangle, Search } from "lucide-react";

type Contract = { id: string; name: string; status: string; clientId?: string; supplierId?: string };

type RunStage = { ready: boolean; error?: string; artifactUrl?: string };
type RunStatus = { state: "queued" | "running" | "completed" | "failed"; stages: Record<"ingestion" | "overview" | "clauses" | "rates" | "compliance" | "benchmark" | "risk" | "report", RunStage> };

export default function ContractPage({ params }: { params: { docId: string } }) {
  const { docId } = params;

  const [artifacts, setArtifacts] = useState<Record<string, any>>({});
  const [contract, setContract] = useState<Contract | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [presenceRes, contractRes, statusRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/contracts/${docId}/artifacts`, { headers: tenantHeaders() }),
        fetch(`${API_BASE_URL}/api/contracts/${docId}`, { headers: tenantHeaders() }),
        fetch(`${API_BASE_URL}/contracts/${docId}/status`, { headers: tenantHeaders() }),
      ]);

      // Contract + run status
      if (contractRes.ok) setContract(await contractRes.json());
      if (statusRes.ok) setRunStatus(await statusRes.json());

      // Load section JSONs, not just presence flags
      if (presenceRes.ok) {
        const presence = await presenceRes.json();
        const present: Record<string, boolean> = (presence?.present || {});
        const sections = [
          'ingestion', 'overview', 'clauses', 'rates', 'compliance', 'benchmark', 'risk', 'report',
        ] as const;

        const headers = tenantHeaders();
        const loads = await Promise.all(sections.map(async (sec) => {
          if (!present[sec]) return [sec, undefined] as const;
          try {
            const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/artifacts/${sec}.json`, { headers });
            if (!r.ok) return [sec, undefined] as const;
            return [sec, await r.json()] as const;
          } catch {
            return [sec, undefined] as const;
          }
        }));

        const loaded: Record<string, any> = {};
        for (const [k, v] of loads) loaded[k] = v;
        // Keep presence for debugging if needed
        loaded.present = present;
        setArtifacts(loaded);
      }
    } catch (e) {
      console.error("fetch error", e);
    }
  }, [docId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [fetchData]);

  const reportUrl = useMemo(() => {
    const r = (artifacts as any)?.report;
    return r?.storagePath ? `${API_BASE_URL}/contracts/${docId}/report.pdf` : undefined;
  }, [artifacts, docId]);

  const runAI = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/contracts/${docId}/reanalyze`, { method: "POST", headers: tenantHeaders() });
      await fetchData();
    } finally {
      setBusy(false);
    }
  }, [docId, fetchData]);

  const overview = (artifacts as any)?.overview || null;
  const [ragQ, setRagQ] = useState('');
  const [ragItems, setRagItems] = useState<any[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragErr, setRagErr] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState<boolean | null>(null);

  const tenantId = useMemo(() => getTenantId() || 'demo', []);

  const jumpToContext = useCallback((meta: any) => {
    try {
      const ids: string[] = [];
      if (meta && meta.page !== undefined && meta.page !== null) ids.push(`context-page-${meta.page}`);
      if (meta && meta.section) ids.push(`context-section-${String(meta.section).toLowerCase()}`);
      // Fallback to section anchors by heuristic
      ids.push('context-section-clauses');
      for (const id of ids) {
        const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
        if (el) {
          // If the anchor is inside a <details>, make sure it's open
          const parentDetails = el.closest('details');
          if (parentDetails && !parentDetails.open) parentDetails.open = true;
          // Smooth scroll
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Flash highlight for visual confirmation
          try {
            el.classList.add('ring-2', 'ring-emerald-400', 'rounded');
            setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400', 'rounded'), 1200);
          } catch {}
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  function highlight(text: string, q: string) {
    try {
      if (!text || !q) return text;
      const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, 'ig'));
      return (
        <>
          {parts.map((p, i) => (
            <span key={i} className={p.toLowerCase() === q.toLowerCase() ? 'bg-yellow-200' : undefined}>{p}</span>
          ))}
        </>
      );
    } catch {
      return text;
    }
  }

  const runRag = useCallback(async () => {
    setRagBusy(true);
    setRagErr(null);
    try {
      const url = `${API_BASE_URL}/api/rag/search?` + new URLSearchParams({ docId, q: ragQ || '' }).toString();
      const r = await fetch(url, { headers: tenantHeaders() });
      if (r.ok) {
        const data = await r.json();
        setRagEnabled(Boolean(data.enabled));
        setRagItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setRagItems([]);
        setRagErr(`Search failed (${r.status})`);
      }
    } catch {
      setRagItems([]);
      setRagErr('Network error');
    } finally {
      setRagBusy(false);
    }
  }, [docId, ragQ]);

  // Debounce auto-search on query change
  useEffect(() => {
    if (!ragQ.trim()) { setRagItems([]); return; }
    const t = setTimeout(() => { runRag(); }, 350);
    return () => clearTimeout(t);
  }, [ragQ, runRag]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-2"><BackButton hrefFallback="/contracts" /></div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-800">{contract?.name || "Contract"}</h1>
          {contract?.status && (
            <span className={`text-xs px-2 py-0.5 rounded border ${contract.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : contract.status === "PROCESSING" || contract.status === "UPLOADED" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{contract.status}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-500 mt-1">
          <span className="truncate">{docId}</span>
          <button type="button" onClick={() => navigator.clipboard.writeText(docId)} className="inline-flex items-center text-xs px-2 py-0.5 rounded border">Copy ID</button>
        </div>
        {runStatus && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className={`text-[11px] px-2 py-0.5 rounded border ${runStatus.state === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : runStatus.state === "failed" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>Run: {runStatus.state}</span>
            {(["ingestion", "overview", "clauses", "rates", "compliance", "benchmark", "risk"] as const).map((k) => {
              const s = runStatus.stages?.[k];
              const cls = s?.ready ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s?.error ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-700 border-gray-200";
              return <span key={k} className={`text-[11px] px-2 py-0.5 rounded border ${cls}`} title={s?.error || ""}>{k}</span>;
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={runAI} disabled={busy} className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${busy ? "bg-indigo-300 text-white cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
            <Sparkles className="h-5 w-5" />
            {busy ? "Running AI…" : "Generate AI"}
          </button>
          {reportUrl ? (
            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700">
              <FileDown className="h-5 w-5" /> Download Report
            </a>
          ) : (
            <button type="button" disabled aria-disabled className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-600 cursor-not-allowed">
              <FileDown className="h-5 w-5" /> Download Report
            </button>
          )}
        </div>
      </div>

      <details className="bg-white rounded-lg shadow-sm border border-gray-200">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <Search className="h-5 w-5 text-emerald-600" />
          <span className="text-base font-semibold text-gray-800">0. RAG Search</span>
        </summary>
        <div className="p-4 bg-gray-50 space-y-3">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-500">Tenant: <span className="font-mono">{tenantId}</span></div>
            <div className="flex gap-2 items-center">
              <input value={ragQ} onChange={e=>setRagQ(e.target.value)} placeholder="Ask a question about this contract…" className="flex-1 h-9 px-3 border rounded bg-white" />
              <button onClick={runRag} disabled={ragBusy || !ragQ.trim()} className={`px-3 h-9 rounded text-sm ${ragBusy? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{ragBusy? 'Searching…' : 'Search'}</button>
            </div>
            {ragEnabled === false && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">RAG is disabled on the server. Set RAG_ENABLED=true and restart the API.</div>
            )}
            {ragErr && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{ragErr}</div>
            )}
          </div>
          {ragBusy && (
            <div className="text-sm text-gray-500">Searching…</div>
          )}
          {!ragBusy && ragItems.length > 0 && (
            <div className="space-y-2">
              {ragItems.map((it, idx) => {
                const meta = (it.meta || it) as any;
                const src = [
                  meta.page !== undefined ? `page ${meta.page}` : null,
                  meta.section ? String(meta.section) : null,
                ].filter(Boolean).join(' · ');
                const text = it.text || it.chunk || '';
                return (
                  <div key={idx} className="p-3 rounded border bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">score: {typeof it.score==='number'? it.score.toFixed(3) : it.score ?? '-'}</div>
                      <div className="flex items-center gap-2">
                        {src && <div className="text-xs text-gray-500">{src}</div>}
                        <button type="button" onClick={() => jumpToContext(meta)} className="text-xs text-blue-600 hover:underline">jump</button>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap text-sm mt-1">{highlight(String(text), ragQ)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {!ragBusy && ragItems.length === 0 && !ragErr && (
            <div className="text-sm text-gray-500">No results. Tip: try keywords that appear in the document (e.g., “rate”, “payment terms”).</div>
          )}
        </div>
      </details>

  <details className="bg-white rounded-lg shadow-sm border border-gray-200" open id="context-section-overview">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <FileText className="h-5 w-5 text-blue-500" />
          <span className="text-base font-semibold text-gray-800">1. Overview</span>
        </summary>
        <div className="p-4 bg-gray-50 space-y-2 text-sm text-gray-700">
          {overview ? (
            <>
              {overview.summary && <p><span className="font-medium">Summary:</span> {overview.summary}</p>}
              {overview.scope && <p><span className="font-medium">Scope:</span> {overview.scope}</p>}
              {overview.paymentTerms && <p><span className="font-medium">Payment Terms:</span> {overview.paymentTerms}</p>}
              {Array.isArray(overview.parties) && overview.parties.length > 0 && (
                <p><span className="font-medium">Parties:</span> {overview.parties.join(" · ")}</p>
              )}
            </>
          ) : (
            <p className="text-gray-500">Not available.</p>
          )}
        </div>
      </details>

      <details className="bg-white rounded-lg shadow-sm border border-gray-200" id="context-section-clauses">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="text-base font-semibold text-gray-800">2. Clauses</span>
        </summary>
        <div className="p-4 bg-gray-50">
          {Array.isArray((artifacts as any)?.clauses?.clauses) && (artifacts as any).clauses.clauses.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Clause ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Text</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const seen = new Set<number | string>();
                    return ((artifacts as any).clauses.clauses as any[]).flatMap((c: any, i: number) => {
                      const rows: React.ReactNode[] = [];
                      if (c.page !== undefined && !seen.has(c.page)) {
                        seen.add(c.page);
                        rows.push(
                          <tr key={`anchor-${i}-${c.page}`}>
                            <td colSpan={3}>
                              <div id={`context-page-${c.page}`} />
                            </td>
                          </tr>
                        );
                      }
                      rows.push(
                        <tr key={i}>
                          <td className="px-3 py-2">{c.clauseId || '-'}</td>
                          <td className="px-3 py-2 whitespace-pre-wrap">{c.text || '-'}</td>
                          <td className="px-3 py-2">{c.page ?? '-'}</td>
                        </tr>
                      );
                      return rows;
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available.</p>
          )}
        </div>
      </details>

  <details className="bg-white rounded-lg shadow-sm border border-gray-200" id="context-section-rates">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <BarChart className="h-5 w-5 text-orange-500" />
          <span className="text-base font-semibold text-gray-800">3. Rates</span>
        </summary>
        <div className="p-4 bg-gray-50">
          {Array.isArray((artifacts as any)?.rates?.rates) && (artifacts as any).rates.rates.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Role</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Seniority</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Daily USD</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((artifacts as any).rates.rates as any[]).map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.role || r.pdfRole || '-'}</td>
                      <td className="px-3 py-2">{r.seniority || '-'}</td>
                      <td className="px-3 py-2">{r.amount ?? '-'}</td>
                      <td className="px-3 py-2">{r.dailyUsd ?? '-'}</td>
                      <td className="px-3 py-2">{r.country || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available.</p>
          )}
        </div>
      </details>

  <details className="bg-white rounded-lg shadow-sm border border-gray-200" id="context-section-compliance">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <Shield className="h-5 w-5 text-indigo-500" />
          <span className="text-base font-semibold text-gray-800">4. Compliance</span>
        </summary>
        <div className="p-4 bg-gray-50">
          {Array.isArray((artifacts as any)?.compliance?.compliance) && (artifacts as any).compliance.compliance.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Policy</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((artifacts as any).compliance.compliance as any[]).map((x: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{x.policyId || '-'}</td>
                      <td className="px-3 py-2">{x.status || '-'}</td>
                      <td className="px-3 py-2 whitespace-pre-wrap">{x.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available.</p>
          )}
        </div>
      </details>

  <details className="bg-white rounded-lg shadow-sm border border-gray-200" id="context-section-benchmark">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <Scale className="h-5 w-5 text-purple-500" />
          <span className="text-base font-semibold text-gray-800">5. Benchmark</span>
        </summary>
        <div className="p-4 bg-gray-50">
          {Array.isArray((artifacts as any)?.benchmark?.benchmarks) && (artifacts as any).benchmark.benchmarks.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Role</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Rate</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Percentile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((artifacts as any).benchmark.benchmarks as any[]).map((b: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{b.role || '-'}</td>
                      <td className="px-3 py-2">{b.rate ?? '-'}</td>
                      <td className="px-3 py-2">{b.percentile ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available.</p>
          )}
        </div>
      </details>

  <details className="bg-white rounded-lg shadow-sm border border-gray-200" id="context-section-risk">
        <summary className="cursor-pointer list-none p-4 flex items-center gap-3 border-b border-gray-100">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-base font-semibold text-gray-800">6. Risk Analysis</span>
        </summary>
        <div className="p-4 bg-gray-50">
          {Array.isArray((artifacts as any)?.risk?.risks) && (artifacts as any).risk.risks.length > 0 ? (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((artifacts as any).risk.risks as any[]).map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.riskType || '-'}</td>
                      <td className="px-3 py-2 whitespace-pre-wrap">{r.description || '-'}</td>
                      <td className="px-3 py-2">{r.severity || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available.</p>
          )}
        </div>
      </details>
    </div>
  );
}
