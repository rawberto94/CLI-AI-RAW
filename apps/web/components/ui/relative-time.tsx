"use client";

/**
 * RelativeTime Component
 * 
 * Displays relative time (e.g., "5 minutes ago") with optional auto-updating.
 * Uses the formatRelativeTime utility for consistency.
 */

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatDateTime, formatDate } from "@/lib/utils/formatters";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface RelativeTimeProps {
  /** Date to display */
  date: Date | string | number;
  /** Auto-update interval in ms (0 to disable) */
  updateInterval?: number;
  /** Show clock icon */
  showIcon?: boolean;
  /** Show full date in tooltip */
  showTooltip?: boolean;
  /** Use short format */
  short?: boolean;
  /** Custom prefix */
  prefix?: string;
  /** Custom suffix (replaces "ago") */
  suffix?: string;
  /** Additional className */
  className?: string;
  /** Live update (re-renders when time changes) */
  live?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getShortRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo`;
  return `${Math.floor(diffDay / 365)}y`;
}

function getUpdateInterval(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);

  // Update more frequently for recent times
  if (diffMin < 1) return 10000; // Every 10 seconds for "just now"
  if (diffMin < 60) return 30000; // Every 30 seconds for minutes
  if (diffMin < 1440) return 60000; // Every minute for hours
  return 3600000; // Every hour for days+
}

// ============================================================================
// RelativeTime Component
// ============================================================================

export function RelativeTime({
  date,
  updateInterval,
  showIcon = false,
  showTooltip = true,
  short = false,
  prefix,
  suffix,
  className,
  live = true,
}: RelativeTimeProps) {
  const dateObj = useMemo(() => {
    if (date instanceof Date) return date;
    if (typeof date === "number") return new Date(date);
    return new Date(date);
  }, [date]);

  const [, setTick] = useState(0);

  // Calculate effective update interval
  const effectiveInterval = updateInterval ?? (live ? getUpdateInterval(dateObj) : 0);

  useEffect(() => {
    if (effectiveInterval <= 0) return;

    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, effectiveInterval);

    return () => clearInterval(timer);
  }, [effectiveInterval]);

  const relativeText = short
    ? getShortRelativeTime(dateObj)
    : formatRelativeTime(dateObj);

  const displayText = [prefix, relativeText, suffix].filter(Boolean).join(" ");
  const fullDateTime = formatDateTime(dateObj);

  const timeElement = (
    <time
      dateTime={dateObj.toISOString()}
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1",
        className
      )}
    >
      {showIcon && <Clock className="h-3 w-3" />}
      {displayText}
    </time>
  );

  if (!showTooltip) {
    return timeElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{timeElement}</TooltipTrigger>
        <TooltipContent>
          <p>{fullDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// TimeAgo Component - Simpler alias
// ============================================================================

export interface TimeAgoProps {
  date: Date | string | number;
  className?: string;
  short?: boolean;
  live?: boolean;
}

export function TimeAgo({ date, className, short, live = true }: TimeAgoProps) {
  return (
    <RelativeTime
      date={date}
      short={short}
      live={live}
      className={className}
    />
  );
}

// ============================================================================
// DateDisplay Component - Full date with relative time tooltip
// ============================================================================

export interface DateDisplayProps {
  date: Date | string | number;
  /** Show relative time inline */
  showRelative?: boolean;
  /** Format (date, datetime, relative) */
  format?: "date" | "datetime" | "relative";
  /** Additional className */
  className?: string;
}

export function DateDisplay({
  date,
  showRelative = true,
  format = "date",
  className,
}: DateDisplayProps) {
  const dateObj = useMemo(() => {
    if (date instanceof Date) return date;
    if (typeof date === "number") return new Date(date);
    return new Date(date);
  }, [date]);

  let displayText: string;
  let tooltipText: string;

  switch (format) {
    case "datetime":
      displayText = formatDateTime(dateObj);
      tooltipText = showRelative ? formatRelativeTime(dateObj) : "";
      break;
    case "relative":
      displayText = formatRelativeTime(dateObj);
      tooltipText = formatDateTime(dateObj);
      break;
    case "date":
    default:
      displayText = formatDate(dateObj);
      tooltipText = showRelative ? formatRelativeTime(dateObj) : formatDateTime(dateObj);
  }

  const element = (
    <time dateTime={dateObj.toISOString()} className={className}>
      {displayText}
    </time>
  );

  if (!tooltipText) {
    return element;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Countdown Component
// ============================================================================

export interface CountdownProps {
  /** Target date */
  targetDate: Date | string | number;
  /** Text when countdown reaches zero */
  completedText?: string;
  /** Callback when countdown completes */
  onComplete?: () => void;
  /** Additional className */
  className?: string;
  /** Show days, hours, minutes, seconds */
  showUnits?: ("days" | "hours" | "minutes" | "seconds")[];
}

export function Countdown({
  targetDate,
  completedText = "Completed",
  onComplete,
  className,
  showUnits = ["days", "hours", "minutes", "seconds"],
}: CountdownProps) {
  const target = useMemo(() => {
    if (targetDate instanceof Date) return targetDate;
    if (typeof targetDate === "number") return new Date(targetDate);
    return new Date(targetDate);
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(target));

  function calculateTimeLeft(targetDate: Date) {
    const diff = targetDate.getTime() - new Date().getTime();
    if (diff <= 0) return null;

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target);
      setTimeLeft(newTimeLeft);
      if (!newTimeLeft) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [target, onComplete]);

  if (!timeLeft) {
    return <span className={className}>{completedText}</span>;
  }

  const parts: string[] = [];
  if (showUnits.includes("days") && timeLeft.days > 0) {
    parts.push(`${timeLeft.days}d`);
  }
  if (showUnits.includes("hours") && (timeLeft.hours > 0 || parts.length > 0)) {
    parts.push(`${timeLeft.hours}h`);
  }
  if (showUnits.includes("minutes") && (timeLeft.minutes > 0 || parts.length > 0)) {
    parts.push(`${timeLeft.minutes}m`);
  }
  if (showUnits.includes("seconds")) {
    parts.push(`${timeLeft.seconds}s`);
  }

  return (
    <span className={cn("font-mono", className)}>
      {parts.join(" ")}
    </span>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default RelativeTime;
