'use client';

import { useState } from 'react';
import type { ValidationResult, ValidationIssue } from '@/lib/import/data-validator';

interface ValidationReviewProps {
  validationResult: ValidationResult;
  onApprove: () => void;
  onReject: () => void;
  onFixIssue?: (rowNumber: number, field: string, newValue: any) => void;
}

export function ValidationReview({
  validationResult,
  onApprove,
  onReject,
  onFixIssue,
}: ValidationReviewProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filteredIssues = validationResult.issues.filter(issue => {
    if (filter === 'all') return true;
    return issue.severity === filter;
  });

  const toggleRow = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  // Group issues by row
  const issuesByRow = new Map<number, ValidationIssue[]>();
  for (const issue of filteredIssues) {
    const existing = issuesByRow.get(issue.rowNumber) || [];
    existing.push(issue);
    issuesByRow.set(issue.rowNumber, existing);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Validation Results</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review data quality issues before importing
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Rows</p>
          <p className="text-3xl font-bold text-gray-900">{validationResult.summary.totalRows}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Valid Rows</p>
          <p className="text-3xl font-bold text-green-600">{validationResult.summary.validRows}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">Errors</p>
          <p className="text-3xl font-bold text-red-600">{validationResult.summary.errorCount}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">Warnings</p>
          <p className="text-3xl font-bold text-yellow-600">{validationResult.summary.warningCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'error', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 font-medium border-b-2 transition-colors
              ${filter === f
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                {validationResult.issues.filter(i => i.severity === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {filter === 'all' ? 'No issues found! ✓' : `No ${filter}s found`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(issuesByRow.entries()).map(([rowNumber, issues]) => {
            const isExpanded = expandedRows.has(rowNumber);
            const hasError = issues.some(i => i.severity === 'error');

            return (
              <div
                key={rowNumber}
                className={`
                  border rounded-lg overflow-hidden
                  ${hasError ? 'border-red-200' : 'border-gray-200'}
                `}
              >
                {/* Row Header */}
                <button
                  onClick={() => toggleRow(rowNumber)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">Row {rowNumber}</span>
                    <span className="text-sm text-gray-600">
                      {issues.length} issue{issues.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1">
                      {issues.map((issue, i) => (
                        <span
                          key={`${issue.field}-${issue.severity}-${i}`}
                          className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(issue.severity)}`}
                        >
                          {getSeverityIcon(issue.severity)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-gray-400">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {/* Issue Details */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-gray-50 border-t space-y-3">
                    {issues.map((issue, i) => (
                      <div
                        key={`detail-${issue.field}-${issue.severity}-${i}`}
                        className={`p-3 border rounded ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">
                              {getSeverityIcon(issue.severity)} {issue.field}
                            </p>
                            <p className="text-sm mt-1">{issue.message}</p>
                            {issue.value !== undefined && (
                              <p className="text-xs mt-1 opacity-75">
                                Value: {String(issue.value)}
                              </p>
                            )}
                            {issue.suggestion && (
                              <p className="text-xs mt-2 font-medium">
                                💡 {issue.suggestion}
                              </p>
                            )}
                          </div>
                          {onFixIssue && issue.severity === 'error' && (
                            <button
                              onClick={() => onFixIssue(rowNumber, issue.field, null)}
                              className="ml-4 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
                            >
                              Fix
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          onClick={onApprove}
          disabled={validationResult.summary.errorCount > 0}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {validationResult.summary.errorCount > 0
            ? `Cannot Approve (${validationResult.summary.errorCount} errors)`
            : 'Approve & Import'}
        </button>
        <button
          onClick={onReject}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Reject
        </button>
      </div>

      {/* Help Text */}
      {validationResult.summary.errorCount > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
          <p className="text-sm text-violet-900">
            <strong>Note:</strong> You must fix all errors before importing. Warnings can be ignored if acceptable.
          </p>
        </div>
      )}
    </div>
  );
}

// Auto-generated default export
export default ValidationReview;
