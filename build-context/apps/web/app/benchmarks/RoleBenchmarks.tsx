"use client";

import React from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { API_BASE_URL } from "@/lib/config";

type Row = {
  group: string;
  n: number;
  avg: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  iqr: number;
  target: number;
  targetKey: string;
  gapVsTarget: number;
  savingsPct: number;
};

export default function RoleBenchmarks() {
  const [groupBy, setGroupBy] = React.useState<"role" | "role,country" | "role,supplier" | "role,los">("role");
  const [target, setTarget] = React.useState<"p50" | "p75" | "p90">("p75");
  const [filters, setFilters] = React.useState<{ supplier: string[]; country: string[]; los: string[]; role: string[] }>({ supplier: [], country: [], los: [], role: [] });
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchData = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ groupBy, target });
    for (const [k, vals] of Object.entries(filters)) {
      for (const v of vals) qs.append(k, v);
    }
    const res = await fetch(`${API_BASE_URL}/api/benchmarks/advanced?${qs.toString()}`);
    const json = await res.json();
    setRows(json.rows || []);
    setLoading(false);
  };

  const [filterOptions, setFilterOptions] = React.useState<{
    suppliers: string[];
    countries: string[];
    linesOfService: string[];
  }>({
    suppliers: ["Manual", "Unknown"],
    countries: ["US", "UK", "IN", "PL", "Unknown"],
    linesOfService: ["Consulting", "BPO", "Tech", "Unknown"],
  });

  // Fetch dynamic filter options from API
  React.useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/benchmarks/filter-options`);
        if (res.ok) {
          const data = await res.json();
          setFilterOptions({
            suppliers: data.suppliers?.length ? data.suppliers : filterOptions.suppliers,
            countries: data.countries?.length ? data.countries : filterOptions.countries,
            linesOfService: data.linesOfService?.length ? data.linesOfService : filterOptions.linesOfService,
          });
        }
      } catch {
        // Keep default options on error
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [groupBy, target, JSON.stringify(filters)]);

  const supplierOpts = filterOptions.suppliers;
  const countryOpts = filterOptions.countries;
  const losOpts = filterOptions.linesOfService;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded-md border px-2 py-1" value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
          <option value="role">Group: Std role</option>
          <option value="role,country">Group: Std role + Country</option>
          <option value="role,supplier">Group: Std role + Supplier</option>
          <option value="role,los">Group: Std role + Line of Service</option>
        </select>
        <select className="rounded-md border px-2 py-1" value={target} onChange={(e) => setTarget(e.target.value as any)}>
          <option value="p50">Target: P50</option>
          <option value="p75">Target: P75</option>
          <option value="p90">Target: P90</option>
        </select>

        <MultiSelect label="Supplier" options={supplierOpts} selected={filters.supplier} onChange={(v) => setFilters((f) => ({ ...f, supplier: v }))} />
        <MultiSelect label="Country" options={countryOpts} selected={filters.country} onChange={(v) => setFilters((f) => ({ ...f, country: v }))} />
        <MultiSelect label="Line of Service" options={losOpts} selected={filters.los} onChange={(v) => setFilters((f) => ({ ...f, los: v }))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr className="text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
              <th className="px-3 py-2 w-[28%]">Group</th>
              <th className="px-3 py-2 w-[7%]">N</th>
              <th className="px-3 py-2 w-[9%]">Avg</th>
              <th className="px-3 py-2 w-[9%]">P50</th>
              <th className="px-3 py-2 w-[9%]">P75</th>
              <th className="px-3 py-2 w-[9%]">P90</th>
              <th className="px-3 py-2 w-[10%]">Target</th>
              <th className="px-3 py-2 w-[10%]">Gap vs Target</th>
              <th className="px-3 py-2 w-[9%]">Savings %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4" colSpan={9}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4" colSpan={9}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.group} className="border-t border-gray-200 dark:border-gray-700 text-sm">
                  <td className="px-3 py-2 truncate">{r.group}</td>
                  <td className="px-3 py-2">{r.n}</td>
                  <td className="px-3 py-2">{Math.round(r.avg)}</td>
                  <td className="px-3 py-2">{Math.round(r.p50)}</td>
                  <td className="px-3 py-2">{Math.round(r.p75)}</td>
                  <td className="px-3 py-2">{Math.round(r.p90)}</td>
                  <td className="px-3 py-2">{r.targetKey.toUpperCase()} {Math.round(r.target)}</td>
                  <td className={`px-3 py-2 ${r.gapVsTarget > 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.round(r.gapVsTarget)}</td>
                  <td className="px-3 py-2">{Math.round(r.savingsPct * 100)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
