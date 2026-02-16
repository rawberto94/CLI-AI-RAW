'use client';

import { useState } from 'react';
import { Globe, DollarSign } from 'lucide-react';

interface PPPAdjustmentToggleProps {
  onToggle: (enabled: boolean) => void;
  defaultEnabled?: boolean;
}

export function PPPAdjustmentToggle({
  onToggle,
  defaultEnabled = false,
}: PPPAdjustmentToggleProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  const handleToggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    onToggle(newValue);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-violet-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div className="flex items-center gap-2">
        {enabled ? (
          <Globe className="w-4 h-4 text-violet-600" />
        ) : (
          <DollarSign className="w-4 h-4 text-gray-600" />
        )}
        <div>
          <div className="text-sm font-medium text-gray-900">
            {enabled ? 'PPP-Adjusted View' : 'Nominal View'}
          </div>
          <div className="text-xs text-gray-500">
            {enabled
              ? 'Rates adjusted for cost-of-living differences'
              : 'Rates shown at face value'}
          </div>
        </div>
      </div>
    </div>
  );
}
