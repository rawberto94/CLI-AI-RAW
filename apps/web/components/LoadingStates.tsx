"use client";

/**
 * Loading State Components
 * 
 * Skeleton loaders and loading indicators for various UI patterns.
 * 
 * @example
 * // Basic skeleton
 * <Skeleton className="h-4 w-32" />
 * 
 * @example
 * // Card skeleton
 * <CardSkeleton />
 * 
 * @example
 * // Table skeleton
 * <TableSkeleton rows={5} columns={4} />
 */

import { cn } from "@/lib/utils";

// ============================================================================
// Base Skeleton
// ============================================================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  /** Animation variant */
  variant?: "pulse" | "wave" | "none";
  /** Shape variant */
  shape?: "rectangle" | "circle" | "text";
}

export function Skeleton({
  className,
  variant = "pulse",
  shape = "rectangle",
  ...props
}: SkeletonProps) {
  return (
    <div
      {...props}
      className={cn(
        "bg-gray-200 dark:bg-gray-700",
        variant === "pulse" && "animate-pulse",
        variant === "wave" && "animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]",
        shape === "circle" && "rounded-full",
        shape === "text" && "rounded h-4",
        shape === "rectangle" && "rounded",
        className
      )}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Text Skeleton
// ============================================================================

interface TextSkeletonProps {
  /** Number of lines */
  lines?: number;
  /** Width of the last line (percentage) */
  lastLineWidth?: string;
  className?: string;
}

export function TextSkeleton({ lines = 3, lastLineWidth = "60%", className }: TextSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{
            width: i === lines - 1 ? lastLineWidth : "100%",
          }}
          shape="text"
        />
      ))}
    </div>
  );
}

// ============================================================================
// Avatar Skeleton
// ============================================================================

interface AvatarSkeletonProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AvatarSkeleton({ size = "md", className }: AvatarSkeletonProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return <Skeleton className={cn(sizeClasses[size], className)} shape="circle" />;
}

// ============================================================================
// Button Skeleton
// ============================================================================

interface ButtonSkeletonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ButtonSkeleton({ size = "md", className }: ButtonSkeletonProps) {
  const sizeClasses = {
    sm: "h-8 w-20",
    md: "h-10 w-24",
    lg: "h-12 w-28",
  };

  return <Skeleton className={cn(sizeClasses[size], "rounded-lg", className)} />;
}

// ============================================================================
// Card Skeleton
// ============================================================================

interface CardSkeletonProps {
  /** Show image placeholder */
  hasImage?: boolean;
  /** Show avatar */
  hasAvatar?: boolean;
  /** Number of text lines */
  lines?: number;
  className?: string;
}

export function CardSkeleton({
  hasImage = false,
  hasAvatar = false,
  lines = 3,
  className,
}: CardSkeletonProps) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow p-4", className)}>
      {hasImage && <Skeleton className="h-48 w-full mb-4 rounded-lg" />}
      
      <div className="flex items-start gap-3">
        {hasAvatar && <AvatarSkeleton />}
        
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" shape="text" />
          <TextSkeleton lines={lines} />
        </div>
      </div>
      
      <div className="mt-4 flex gap-2">
        <ButtonSkeleton size="sm" />
        <ButtonSkeleton size="sm" />
      </div>
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header row */
  hasHeader?: boolean;
  /** Column widths (optional) */
  columnWidths?: string[];
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  hasHeader = true,
  columnWidths,
  className,
}: TableSkeletonProps) {
  const defaultWidths = Array(columns).fill("100%");
  const widths = columnWidths || defaultWidths;

  return (
    <div className={cn("w-full", className)}>
      <table className="w-full">
        {hasHeader && (
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4" style={{ width: "80%" }} shape="text" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-100 dark:border-gray-800"
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-4">
                  <Skeleton
                    className="h-4"
                    style={{ width: widths[colIndex] }}
                    shape="text"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

interface ListSkeletonProps {
  /** Number of items */
  items?: number;
  /** Show avatar/icon */
  hasAvatar?: boolean;
  /** Show secondary text */
  hasSecondary?: boolean;
  className?: string;
}

export function ListSkeleton({
  items = 5,
  hasAvatar = true,
  hasSecondary = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          {hasAvatar && <AvatarSkeleton size="md" />}
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" shape="text" />
            {hasSecondary && <Skeleton className="h-3 w-1/2" shape="text" />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

interface FormSkeletonProps {
  /** Number of fields */
  fields?: number;
  /** Show submit button */
  hasSubmit?: boolean;
  className?: string;
}

export function FormSkeleton({
  fields = 4,
  hasSubmit = true,
  className,
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" shape="text" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      {hasSubmit && (
        <div className="flex gap-3 pt-4">
          <ButtonSkeleton size="lg" />
          <Skeleton className="h-12 w-24 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats Card Skeleton
// ============================================================================

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" shape="text" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" shape="text" />
      <Skeleton className="h-3 w-16" shape="text" />
    </div>
  );
}

// ============================================================================
// Page Header Skeleton
// ============================================================================

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-8", className)}>
      <Skeleton className="h-8 w-64 mb-2" shape="text" />
      <Skeleton className="h-4 w-96" shape="text" />
    </div>
  );
}

// ============================================================================
// Contract Card Skeleton (Domain-specific)
// ============================================================================

export function ContractCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow p-6", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" shape="text" />
          <Skeleton className="h-4 w-32" shape="text" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Skeleton className="h-3 w-16 mb-1" shape="text" />
          <Skeleton className="h-4 w-24" shape="text" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" shape="text" />
          <Skeleton className="h-4 w-24" shape="text" />
        </div>
      </div>
      
      <div className="flex gap-2">
        <ButtonSkeleton size="sm" />
        <ButtonSkeleton size="sm" />
      </div>
    </div>
  );
}

// ============================================================================
// Rate Card Skeleton (Domain-specific)
// ============================================================================

export function RateCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow", className)}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" shape="text" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <TableSkeleton rows={4} columns={5} hasHeader />
    </div>
  );
}

// ============================================================================
// Loading Spinner
// ============================================================================

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <svg
      className={cn(
        "animate-spin text-blue-600 dark:text-blue-400",
        sizeClasses[size],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// Full Page Loading
// ============================================================================

interface FullPageLoadingProps {
  message?: string;
  className?: string;
}

export function FullPageLoading({ message = "Loading...", className }: FullPageLoadingProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" />
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

// ============================================================================
// Inline Loading
// ============================================================================

interface InlineLoadingProps {
  message?: string;
  className?: string;
}

export function InlineLoading({ message, className }: InlineLoadingProps) {
  return (
    <div
      className={cn("flex items-center gap-2 text-gray-600 dark:text-gray-400", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

// ============================================================================
// Loading Overlay
// ============================================================================

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ visible, message, className }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] z-10 rounded-lg",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="md" />
      {message && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Skeleton;
