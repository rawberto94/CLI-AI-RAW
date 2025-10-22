'use client';

import React from 'react';

export function CostSavingsDashboardWidget() {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Cost Savings Opportunities</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Potential Savings</span>
          <span className="text-xl font-bold text-green-600">$0</span>
        </div>
        <p className="text-sm text-gray-500">Upload contracts to analyze savings opportunities</p>
      </div>
    </div>
  );
}

export default CostSavingsDashboardWidget;
