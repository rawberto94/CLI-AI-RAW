"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "./multi-select";

export type FilterValue = {
  client?: string | string[];
  supplier?: string | string[];
  type?: string | string[];
  status?: string | string[];
  category?: string | string[];
};

export function FilterBar({
  options,
  value,
  onChange,
  className,
  showBadges = true,
  hideControls = false,
  mode = "chips",
}: {
  options: { clients?: string[]; suppliers?: string[]; types?: string[]; statuses?: string[]; categories?: string[] };
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  className?: string;
  showBadges?: boolean;
  hideControls?: boolean;
  mode?: "chips" | "dropdowns";
}) {
  const clear = () => onChange({});
  const { clients = [], suppliers = [], types = [], statuses = [], categories = [] } = options;

  const toArray = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []);
  const setArray = (key: keyof FilterValue) => (vals: string[]) => onChange({ ...value, [key]: vals.length ? vals : undefined });

  return (
    <div className={cn("space-y-3", className)}>
      {!hideControls && (
        mode === "dropdowns" ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Client */}
            {clients.length > 0 && (
              <MultiSelect label="Client" options={clients} selected={toArray(value.client)} onChange={setArray("client")} />
            )}
            {/* Supplier */}
            <MultiSelect label="Supplier" options={suppliers} selected={toArray(value.supplier)} onChange={setArray("supplier")} />
            {/* Type */}
            <MultiSelect label="Type of contract" options={types} selected={toArray(value.type)} onChange={setArray("type")} />
            {/* Status */}
            <MultiSelect label="Status" options={statuses} selected={toArray(value.status)} onChange={setArray("status")} />
            {/* Category */}
            <MultiSelect label="Category" options={categories} selected={toArray(value.category)} onChange={setArray("category")} />
            <button onClick={clear} className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600">Clear</button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Supplier chips */}
            <div>
              <div className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Supplier</div>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                {suppliers.length === 0 ? (
                  <div className="text-xs text-gray-400">No suppliers detected</div>
                ) : suppliers.map((s) => (
                  <button
                    key={s}
                    onClick={() => onChange({ ...value, supplier: (value as any).supplier === s ? undefined : s })}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border",
                      (value as any).supplier === s ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Type chips */}
            <div>
              <div className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type of contract</div>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ ...value, type: (value as any).type === t ? undefined : t })}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border",
                      (value as any).type === t ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status chips */}
            <div>
              <div className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
              <div className="flex flex-wrap gap-2">
                {statuses.map((st) => (
                  <button
                    key={st}
                    onClick={() => onChange({ ...value, status: (value as any).status === st ? undefined : st })}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border",
                      (value as any).status === st ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Category chips */}
            <div>
              <div className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onChange({ ...value, category: (value as any).category === cat ? undefined : cat })}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border",
                      (value as any).category === cat ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {showBadges && (
        <div className="flex flex-wrap items-center gap-2">
          {(value.client || value.supplier || value.type || value.status || value.category) && (
            <button
              onClick={clear}
              className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Clear filters
            </button>
          )}
          {toArray(value.client).length > 0 && (
            <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-700">Client: {toArray(value.client).join(", ")}</span>
          )}
          {toArray(value.supplier).length > 0 && (
            <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-700">Supplier: {toArray(value.supplier).join(", ")}</span>
          )}
          {toArray(value.type).length > 0 && (
            <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-700">Type: {toArray(value.type).join(", ")}</span>
          )}
          {toArray(value.status).length > 0 && (
            <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-700">Status: {toArray(value.status).join(", ")}</span>
          )}
          {toArray(value.category).length > 0 && (
            <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-700">Category: {toArray(value.category).join(", ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
