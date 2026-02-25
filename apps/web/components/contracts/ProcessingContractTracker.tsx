"use client";

import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertCircle } from "lucide-react";
import type { Contract } from "@/hooks/use-queries";

// ── Constants ──────────────────────────────────────────────────────────────────
/** After this many ms the banner self-dismisses regardless (safety net). */
const MAX_BANNER_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
/** Delay before a resolved row exits (lets user read "Ready" label). */
const RESOLVE_ANIMATION_MS = 2_000;

// ── Props ──────────────────────────────────────────────────────────────────────
interface ProcessingContractTrackerProps {
  contracts: Contract[];
  onContractComplete?: (contractId: string) => void;
  onRetry?: (contractId: string) => void;
  onDismiss?: (contractId: string) => void;
}

/**
 * Enterprise-grade processing tracker.
 *
 * Self-contained lifecycle:
 *  - Renders nothing when no contracts are processing.
 *  - Mounts with slide-down animation when processing starts.
 *  - Individual rows animate in/out.
 *  - Entire banner unmounts with slide-up when all processing is done.
 *
 * Safety nets:
 *  - Hard max lifetime (5 min) — auto-dismisses regardless.
 *  - Dismissed IDs persisted in ref so they never re-appear.
 *  - Handles API switching status from "processing" → "completed" between polls.
 */
export const ProcessingContractTracker = memo(function ProcessingContractTracker({
  contracts,
  onContractComplete,
  onDismiss,
}: ProcessingContractTrackerProps) {
  // ── Refs ──
  const dismissedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bannerMountRef = useRef<number | null>(null);
  const maxLifetimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──
  const [, bump] = useState(0);
  const [forceDismissed, setForceDismissed] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  // ── Derived ──
  const processingContracts = useMemo(
    () =>
      contracts.filter(
        (c) => c.status === "processing" && !dismissedRef.current.has(c.id),
      ),
    [contracts],
  );

  const activeResolving = useMemo(
    () =>
      contracts.filter(
        (c) =>
          c.status !== "processing" &&
          resolvingIds.has(c.id) &&
          !dismissedRef.current.has(c.id),
      ),
    [contracts, resolvingIds],
  );

  const visibleContracts = useMemo(
    () => [...processingContracts, ...activeResolving],
    [processingContracts, activeResolving],
  );

  const hasSomethingToShow = visibleContracts.length > 0 && !forceDismissed;

  // ── Dismiss a single contract ──
  const dismissContract = useCallback(
    (id: string) => {
      if (dismissedRef.current.has(id)) return;
      dismissedRef.current.add(id);
      timerRef.current.delete(id);
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onContractComplete?.(id);
      onDismiss?.(id);
      bump((n) => n + 1);
    },
    [onContractComplete, onDismiss],
  );

  // ── Detect contracts whose status changed from processing → completed ──
  const prevProcessingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentProcessingIds = new Set(
      contracts.filter((c) => c.status === "processing").map((c) => c.id),
    );

    for (const id of prevProcessingIdsRef.current) {
      if (
        !currentProcessingIds.has(id) &&
        !dismissedRef.current.has(id) &&
        !resolvingIds.has(id)
      ) {
        setResolvingIds((prev) => new Set(prev).add(id));
        const timer = setTimeout(() => dismissContract(id), RESOLVE_ANIMATION_MS);
        timerRef.current.set(id, timer);
      }
    }

    prevProcessingIdsRef.current = currentProcessingIds;
  }, [contracts, resolvingIds, dismissContract]);

  // ── Auto-dismiss autoResolved / 100% contracts ──
  useEffect(() => {
    for (const c of processingContracts) {
      const shouldResolve =
        c.processing?.autoResolved ||
        (c.processing?.progress ?? 0) >= 100 ||
        c.processing?.stale;

      if (
        shouldResolve &&
        !dismissedRef.current.has(c.id) &&
        !timerRef.current.has(c.id)
      ) {
        const id = c.id;
        const timer = setTimeout(() => dismissContract(id), RESOLVE_ANIMATION_MS);
        timerRef.current.set(id, timer);
      }
    }
  }, [processingContracts, dismissContract]);

  // ── Hard max lifetime safety net ──
  useEffect(() => {
    if (hasSomethingToShow && !bannerMountRef.current) {
      bannerMountRef.current = Date.now();
      maxLifetimeTimerRef.current = setTimeout(() => {
        setForceDismissed(true);
        for (const c of visibleContracts) {
          dismissContract(c.id);
        }
      }, MAX_BANNER_LIFETIME_MS);
    }

    if (!hasSomethingToShow && bannerMountRef.current) {
      bannerMountRef.current = null;
      if (maxLifetimeTimerRef.current) {
        clearTimeout(maxLifetimeTimerRef.current);
        maxLifetimeTimerRef.current = null;
      }
      setForceDismissed(false);
    }

    return () => {
      if (maxLifetimeTimerRef.current) {
        clearTimeout(maxLifetimeTimerRef.current);
      }
    };
  }, [hasSomethingToShow]);

  // ── Cleanup timers on unmount ──
  useEffect(() => {
    return () => {
      timerRef.current.forEach((t) => clearTimeout(t));
      timerRef.current.clear();
    };
  }, []);

  // ── Aggregate progress ──
  const avgProgress =
    processingContracts.length > 0
      ? Math.round(
          processingContracts.reduce((sum, c) => sum + (c.processing?.progress ?? 0), 0) /
            processingContracts.length,
        )
      : 100;

  const isLongRunning = bannerMountRef.current
    ? Date.now() - bannerMountRef.current > 120_000
    : false;

  // ── Render ──
  return (
    <AnimatePresence>
      {hasSomethingToShow && (
        <motion.div
          key="processing-tracker"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card className="bg-slate-50 border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="py-4 px-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800">
                  <Activity className="h-4 w-4 text-white" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 border border-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800">
                    {processingContracts.length === 0
                      ? "Finishing up\u2026"
                      : processingContracts.length === 1
                        ? "Setting up your contract\u2026"
                        : `Setting up ${processingContracts.length} contracts\u2026`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isLongRunning
                      ? "Taking longer than expected \u2014 will complete shortly"
                      : "This usually takes a moment"}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500 tabular-nums">
                  {avgProgress}%
                </span>
              </div>

              {/* Aggregate progress bar */}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-slate-600 to-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${avgProgress}%` }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                />
              </div>

              {/* Long-running info */}
              {isLongRunning && (
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded bg-amber-50 border border-amber-100">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">
                    Processing is taking longer than usual. The contract will be available shortly.
                  </span>
                </div>
              )}

              {/* Per-contract rows */}
              <AnimatePresence mode="popLayout">
                {visibleContracts.slice(0, 4).map((contract) => {
                  const isResolving =
                    resolvingIds.has(contract.id) ||
                    contract.processing?.autoResolved ||
                    contract.status !== "processing";

                  return (
                    <motion.div
                      key={contract.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-2.5 py-1.5 text-sm"
                    >
                      {isResolving ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                      )}
                      <span className="flex-1 truncate text-slate-700">
                        {contract.title}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {isResolving
                          ? "Ready"
                          : contract.processing?.currentStage || "Analyzing\u2026"}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {visibleContracts.length > 4 && (
                <p className="text-xs text-slate-400 text-center mt-1">
                  +{visibleContracts.length - 4} more
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
