'use client';

import React from 'react';

interface FinancialsTabProps {
  summary: {
    totalRoles: number;
    outliers: number;
    medianDelta: string;
    currencies: string;
  };
  roles: any;
}

export function FinancialsTab({ summary, roles: _roles }: FinancialsTabProps) {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Financial Analysis</h3>
      <p className="text-gray-500">Total Roles: {summary.totalRoles}, Outliers: {summary.outliers}</p>
    </div>
  );
}

export default FinancialsTab;
