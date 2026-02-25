'use client';

/**
 * MobileContractComparison
 *
 * A touch-optimised, swipeable contract comparison view designed for
 * mobile / tablet screens. Instead of a side-by-side table,
 * contracts are displayed as stackable cards the user can swipe through,
 * with a persistent difference summary at the bottom.
 *
 * Enterprise UX Readiness priority: mobile complex views.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  FileText,
  DollarSign,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle2,
  X,
  Download,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  type Comparison,
  type Difference,
  getDifferenceColor,
  getSeverityColor,
  createComparison,
} from '@/lib/contracts/comparison';
import { type Contract } from '@/lib/contracts/contracts-data-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileContractComparisonProps {
  contracts: Contract[];
  onClose: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  if (val instanceof Date) return val.toLocaleDateString();
  return String(val);
}

function severityIcon(severity: Difference['severity']) {
  switch (severity) {
    case 'high':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'medium':
      return <BarChart3 className="w-4 h-4 text-amber-500" />;
    case 'low':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Swipeable contract card showing key metadata.
 */
function ContractCard({
  contract,
  index,
  total,
}: {
  contract: Contract;
  index: number;
  total: number;
}) {
  const statusColors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    ACTIVE: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
    EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <Card className="border-2 border-border/60 shadow-lg h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {index + 1} / {total}
          </Badge>
          <Badge className={cn('text-xs', statusColors[contract.status ?? ''] ?? 'bg-muted')}>
            {contract.status ?? 'Unknown'}
          </Badge>
        </div>
        <CardTitle className="text-lg leading-tight mt-2 line-clamp-2">
          {contract.contractTitle || contract.originalName || 'Untitled Contract'}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {/* Parties */}
        <MetaRow icon={<FileText className="w-4 h-4" />} label="Client" value={contract.clientName} />
        <MetaRow icon={<FileText className="w-4 h-4" />} label="Supplier" value={contract.supplierName} />

        {/* Financial */}
        <MetaRow
          icon={<DollarSign className="w-4 h-4" />}
          label="Value"
          value={
            contract.totalValue != null
              ? `${contract.currency ?? 'USD'} ${contract.totalValue.toLocaleString()}`
              : undefined
          }
        />

        {/* Dates */}
        <MetaRow
          icon={<Calendar className="w-4 h-4" />}
          label="Effective"
          value={
            contract.effectiveDate
              ? new Date(contract.effectiveDate).toLocaleDateString()
              : undefined
          }
        />
        <MetaRow
          icon={<Calendar className="w-4 h-4" />}
          label="Expires"
          value={
            contract.expirationDate
              ? new Date(contract.expirationDate).toLocaleDateString()
              : undefined
          }
        />

        {/* Risk / Compliance */}
        <MetaRow
          icon={<Shield className="w-4 h-4" />}
          label="Risk"
          value={contract.riskLevel ?? (contract as Record<string, unknown>).riskScore as string | undefined}
        />
        <MetaRow
          icon={<Shield className="w-4 h-4" />}
          label="Type"
          value={contract.contractType}
        />
      </CardContent>
    </Card>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium w-20 shrink-0">{label}</span>
      <span className="text-muted-foreground truncate">{formatValue(value)}</span>
    </div>
  );
}

/**
 * Difference list shown below the cards.
 */
function DifferenceSummary({
  differences,
  expanded,
  onToggle,
}: {
  differences: Difference[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Difference[]>();
    for (const d of differences) {
      const key = d.severity;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [differences]);

  const counts = useMemo(
    () => ({
      high: grouped.get('high')?.length ?? 0,
      medium: grouped.get('medium')?.length ?? 0,
      low: grouped.get('low')?.length ?? 0,
    }),
    [grouped],
  );

  return (
    <div className="border-t border-border bg-card">
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
        aria-expanded={expanded}
        aria-controls="diff-summary-panel"
      >
        <div className="flex items-center gap-3">
          <span>Differences</span>
          {counts.high > 0 && (
            <Badge variant="destructive" className="text-xs">
              {counts.high} critical
            </Badge>
          )}
          {counts.medium > 0 && (
            <Badge variant="secondary" className="text-xs">
              {counts.medium} notable
            </Badge>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Difference list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id="diff-summary-panel"
            role="region"
            aria-label="Contract differences"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ScrollArea className="max-h-64 px-4 pb-4">
              <div className="space-y-2">
                {differences.map((diff) => (
                  <div
                    key={diff.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg p-3 text-sm',
                      diff.severity === 'high'
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : diff.severity === 'medium'
                          ? 'bg-amber-50 dark:bg-amber-950/30'
                          : 'bg-muted/50',
                    )}
                  >
                    {severityIcon(diff.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{diff.label}</div>
                      <div className="text-muted-foreground mt-0.5 space-x-2">
                        {diff.values.map((v, i) => (
                          <span key={i} className={cn(i > 0 && 'border-l pl-2 border-border')}>
                            {formatValue(v)}
                          </span>
                        ))}
                      </div>
                      {diff.description && (
                        <p className="text-xs text-muted-foreground mt-1">{diff.description}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-xs shrink-0', getDifferenceColor(diff.type))}
                    >
                      {diff.type}
                    </Badge>
                  </div>
                ))}
                {differences.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">
                    No significant differences found.
                  </p>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination dots
// ---------------------------------------------------------------------------

function Dots({
  count,
  active,
  onDotClick,
}: {
  count: number;
  active: number;
  onDotClick: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2" role="tablist" aria-label="Contract selector">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === active}
          aria-label={`Contract ${i + 1}`}
          onClick={() => onDotClick(i)}
          className={cn(
            'w-2.5 h-2.5 rounded-full transition-all duration-200',
            i === active
              ? 'bg-primary scale-125'
              : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MobileContractComparison({
  contracts,
  onClose,
  className,
}: MobileContractComparisonProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [diffExpanded, setDiffExpanded] = useState(false);
  const dragX = useMotionValue(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Compute comparison data
  const comparison = useMemo<Comparison | null>(() => {
    if (contracts.length < 2) return null;
    return createComparison(contracts);
  }, [contracts]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const swipedLeft =
        offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;
      const swipedRight =
        offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;

      if (swipedLeft && activeIndex < contracts.length - 1) {
        setActiveIndex((i) => i + 1);
      } else if (swipedRight && activeIndex > 0) {
        setActiveIndex((i) => i - 1);
      }
    },
    [activeIndex, contracts.length],
  );

  const handlePrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((i) => Math.min(contracts.length - 1, i + 1));
  }, [contracts.length]);

  // Background opacity driven by drag distance
  const bgOpacity = useTransform(dragX, [-200, 0, 200], [0.6, 1, 0.6]);

  if (contracts.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <FileText className="w-10 h-10" />
        <p>Select at least 2 contracts to compare.</p>
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col h-full bg-background', className)}
      ref={constraintsRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="text-base font-semibold">Contract Comparison</h2>
        <div className="flex items-center gap-1">
          {comparison && (
            <Badge variant="outline" className="text-xs">
              {Math.round(comparison.metrics.similarityScore)}% similar
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close comparison">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Swipeable card area */}
      <div className="flex-1 relative overflow-hidden px-4 py-4">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={activeIndex}
            style={{ opacity: bgOpacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -200, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full cursor-grab active:cursor-grabbing touch-pan-y"
          >
            <ContractCard
              contract={contracts[activeIndex]}
              index={activeIndex}
              total={contracts.length}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows (hidden on very small screens) */}
        {activeIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 shadow hidden sm:flex"
            onClick={handlePrev}
            aria-label="Previous contract"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        {activeIndex < contracts.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 shadow hidden sm:flex"
            onClick={handleNext}
            aria-label="Next contract"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Pagination dots */}
      <Dots count={contracts.length} active={activeIndex} onDotClick={setActiveIndex} />

      {/* Metrics summary bar */}
      {comparison && (
        <div className="grid grid-cols-3 gap-2 px-4 py-2 text-center text-xs">
          <div className="rounded-lg bg-muted/50 py-2">
            <div className="font-semibold text-foreground">
              {comparison.metrics.valueDifference > 0 ? '+' : ''}
              {comparison.metrics.valueDifference.toLocaleString()}
            </div>
            <div className="text-muted-foreground">Value Diff</div>
          </div>
          <div className="rounded-lg bg-muted/50 py-2">
            <div className="font-semibold text-foreground">
              {comparison.metrics.riskDifference > 0 ? '+' : ''}
              {comparison.metrics.riskDifference}
            </div>
            <div className="text-muted-foreground">Risk Diff</div>
          </div>
          <div className="rounded-lg bg-muted/50 py-2">
            <div className="font-semibold text-foreground">
              {comparison.metrics.keyDifferences.length}
            </div>
            <div className="text-muted-foreground">Key Diffs</div>
          </div>
        </div>
      )}

      {/* Expandable difference details */}
      {comparison && (
        <DifferenceSummary
          differences={comparison.differences}
          expanded={diffExpanded}
          onToggle={() => setDiffExpanded((e) => !e)}
        />
      )}
    </div>
  );
}

export default MobileContractComparison;
