'use client';

import { useState } from 'react';
import type { MatchResult } from '@/lib/import/fuzzy-matcher';

interface ColumnMappingInterfaceProps {
  headers: string[];
  sampleRows: Record<string, any>[];
  initialMappings: MatchResult[];
  onMappingsChange: (mappings: MatchResult[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const STANDARD_FIELDS = [
  { name: 'role', label: 'Role / Position', required: true },
  { name: 'seniority', label: 'Seniority Level', required: false },
  { name: 'rate', label: 'Rate / Price', required: true },
  { name: 'currency', label: 'Currency', required: false },
  { name: 'period', label: 'Rate Period', required: false },
  { name: 'location', label: 'Location', required: false },
  { name: 'serviceLine', label: 'Service Line', required: false },
  { name: 'skills', label: 'Skills', required: false },
  { name: 'experience', label: 'Experience', required: false },
];

export function ColumnMappingInterface({
  headers,
  sampleRows,
  initialMappings,
  onMappingsChange,
  onConfirm,
  onCancel,
}: ColumnMappingInterfaceProps) {
  const [mappings, setMappings] = useState<MatchResult[]>(initialMappings);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    const newMappings = mappings.filter(m => m.sourceColumn !== sourceColumn);
    
    if (targetField !== 'none') {
      newMappings.push({
        sourceColumn,
        targetField,
        confidence: 1.0,
        method: 'manual' as 'exact' | 'pattern' | 'fuzzy' | 'synonym',
      });
    }

    setMappings(newMappings);
    onMappingsChange(newMappings);
  };

  const getMappingForColumn = (column: string): string => {
    const mapping = mappings.find(m => m.sourceColumn === column);
    return mapping?.targetField || 'none';
  };

  const getMappingForField = (field: string): string | undefined => {
    const mapping = mappings.find(m => m.targetField === field);
    return mapping?.sourceColumn;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const missingRequired = STANDARD_FIELDS
    .filter(f => f.required && !mappings.some(m => m.targetField === f.name))
    .map(f => f.label);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Map Columns</h2>
        <p className="mt-1 text-sm text-gray-600">
          Match your spreadsheet columns to standard fields
        </p>
      </div>

      {/* Missing Required Fields Warning */}
      {missingRequired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-900">Missing Required Fields</h3>
          <p className="text-sm text-red-700 mt-1">
            Please map the following required fields: {missingRequired.join(', ')}
          </p>
        </div>
      )}

      {/* Mapping Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Columns */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Your Columns</h3>
          <div className="space-y-2">
            {headers.map((header) => {
              const mapping = mappings.find(m => m.sourceColumn === header);
              const isSelected = selectedColumn === header;

              return (
                <div
                  key={header}
                  onClick={() => setSelectedColumn(header)}
                  className={`
                    p-4 border rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{header}</p>
                      {mapping && (
                        <p className="text-sm text-gray-600 mt-1">
                          → {STANDARD_FIELDS.find(f => f.name === mapping.targetField)?.label}
                          <span className={`ml-2 ${getConfidenceColor(mapping.confidence)}`}>
                            ({Math.round(mapping.confidence * 100)}%)
                          </span>
                        </p>
                      )}
                      
                      {/* Sample Data */}
                      <div className="mt-2 text-xs text-gray-500">
                        Sample: {sampleRows.slice(0, 2).map(row => String(row[header] || '')).join(', ')}
                      </div>
                    </div>

                    <select
                      value={getMappingForColumn(header)}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-4 px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="none">Don&apos;t map</option>
                      {STANDARD_FIELDS.map((field) => (
                        <option key={field.name} value={field.name}>
                          {field.label} {field.required && '*'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Fields */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Standard Fields</h3>
          <div className="space-y-2">
            {STANDARD_FIELDS.map((field) => {
              const sourceColumn = getMappingForField(field.name);
              const isMapped = !!sourceColumn;

              return (
                <div
                  key={field.name}
                  className={`
                    p-4 border rounded-lg
                    ${isMapped ? 'border-green-200 bg-green-50' : 'border-gray-200'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {isMapped ? (
                        <p className="text-sm text-green-700 mt-1">
                          ✓ Mapped from: {sourceColumn}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">
                          Not mapped
                        </p>
                      )}
                    </div>

                    {isMapped && (
                      <button
                        onClick={() => handleMappingChange(sourceColumn, 'none')}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Mapping Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Total Columns</p>
            <p className="text-2xl font-bold text-gray-900">{headers.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Mapped</p>
            <p className="text-2xl font-bold text-green-600">{mappings.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Unmapped</p>
            <p className="text-2xl font-bold text-gray-400">{headers.length - mappings.length}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onConfirm}
          disabled={missingRequired.length > 0}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Confirm Mapping
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ColumnMappingInterface;
