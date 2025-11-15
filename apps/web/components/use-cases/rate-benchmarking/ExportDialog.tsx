/**
 * Export Dialog Component Stub
 */

import React from 'react';

export interface ExportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  data?: any;
}

export function ExportDialog({ open, onOpenChange, data }: ExportDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Export Data</h3>
        <div className="space-y-4">
          <button className="w-full px-4 py-2 border rounded hover:bg-gray-50">
            Export as CSV
          </button>
          <button className="w-full px-4 py-2 border rounded hover:bg-gray-50">
            Export as Excel
          </button>
          <button className="w-full px-4 py-2 border rounded hover:bg-gray-50">
            Export as PDF
          </button>
        </div>
        <button 
          onClick={() => onOpenChange?.(false)}
          className="mt-4 w-full px-4 py-2 bg-gray-200 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ExportDialog;
