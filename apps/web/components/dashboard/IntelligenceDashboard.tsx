'use client';

import React from 'react';

export function IntelligenceDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Contracts</h3>
          <p className="text-2xl font-bold mt-2">Loading...</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-500">Active Processing</h3>
          <p className="text-2xl font-bold mt-2">Loading...</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-500">Insights Generated</h3>
          <p className="text-2xl font-bold mt-2">Loading...</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
          <p className="text-2xl font-bold mt-2">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default IntelligenceDashboard;
