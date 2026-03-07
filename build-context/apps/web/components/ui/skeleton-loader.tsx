/**
 * Skeleton Loader Component
 * Animated placeholder for loading content
 */

"use client";

import React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  className = "",
  rounded = true,
}: SkeletonProps) {
  const widthStyle = typeof width === "number" ? `${width}px` : width;
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse bg-gray-300 ${rounded ? "rounded" : ""} ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
    />
  );
}

export function SkeletonLoader() {
  return (
    <div className="space-y-3">
      <Skeleton width="60%" height="1.5rem" />
      <Skeleton width="100%" height="1rem" />
      <Skeleton width="80%" height="1rem" />
      <Skeleton width="90%" height="1rem" />
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="100%" height="2rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width="100%" height="3rem" />
          ))}
        </div>
      ))}
    </div>
  );
}
