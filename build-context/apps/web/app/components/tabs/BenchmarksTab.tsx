'use client';

import React from 'react';

interface BenchmarksTabProps {
  items: {
    metric: string;
    current: string | number;
    p50: number;
    p75: number;
    p90: number;
  }[];
}

export function BenchmarksTab({ items }: BenchmarksTabProps) {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Benchmark Analysis</h3>
      <p className="text-gray-500">Benchmarks: {items.length} items</p>
    </div>
  );
}

export default BenchmarksTab;
