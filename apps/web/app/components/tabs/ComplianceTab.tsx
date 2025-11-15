'use client';

import React from 'react';

interface ComplianceTabProps {
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failures: number;
  };
  findings: any;
}

export function ComplianceTab({ summary, findings }: ComplianceTabProps) {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Compliance Analysis</h3>
      <p className="text-gray-500">Total Checks: {summary.totalChecks}, Passed: {summary.passed}</p>
    </div>
  );
}

export default ComplianceTab;
