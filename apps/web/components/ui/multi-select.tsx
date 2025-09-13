"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = string;

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  className,
  searchable = true,
  placeholder = "All",
}: {
  label: string;
  options: Option[];
  selected: Option[];
  onChange: (values: Option[]) => void;
  className?: string;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Esc
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return qq ? options.filter((o) => o.toLowerCase().includes(qq)) : options;
  }, [q, options]);

  const toggle = (opt: Option) => {
    if (selected.includes(opt)) onChange(selected.filter((v) => v !== opt));
    else onChange([...selected, opt]);
  };

  const selectAll = () => onChange(Array.from(options));
  const clearAll = () => onChange([]);

  const summary = selected.length > 0 ? `${selected.length} selected` : placeholder;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border",
          "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600",
          "hover:bg-gray-50 dark:hover:bg-gray-800/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-gray-500 dark:text-gray-400 text-xs">{label}</span>
        <span className="text-gray-900 dark:text-gray-100">{summary}</span>
        {selected.length > 0 && (
          <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-4 h-4 ml-1 text-gray-500" />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-40 mt-2 w-64 md:w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
        >
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {searchable && (
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${label.toLowerCase()}...`}
                    className="w-full pl-7 pr-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              )}
              <button
                onClick={clearAll}
                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Clear
              </button>
              <button
                onClick={selectAll}
                className="px-2 py-1 text-xs rounded bg-indigo-600 text-white"
              >
                All
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-500">No options</div>
            ) : (
              <ul role="listbox" className="p-1">
                {filtered.map((opt) => {
                  const active = selected.includes(opt);
                  return (
                    <li key={opt}>
                      <button
                        onClick={() => toggle(opt)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded text-sm",
                          active ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                        role="option"
                        aria-selected={active}
                        title={opt}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-4 h-4 rounded border",
                            active
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-gray-300 dark:border-gray-600"
                          )}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </span>
                        <span className="truncate" title={opt}>{opt}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selected.slice(0, 3).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {s}
                    <button onClick={() => toggle(s)} aria-label={`Remove ${s}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {selected.length > 3 && (
                  <span className="text-[11px] text-gray-500">+{selected.length - 3} more</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No selection</span>
            )}
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs rounded bg-gray-900 text-white dark:bg-white dark:text-gray-900">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
