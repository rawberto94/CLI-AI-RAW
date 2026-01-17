'use client';

import { useState } from 'react';
import { RateCardUploadZone } from '@/components/import/RateCardUploadZone';

export default function RateCardImportPage() {
  const [uploadedJobs, setUploadedJobs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleUploadComplete = (jobIds: string[]) => {
    setUploadedJobs((prev) => [...prev, ...jobIds]);
    // Upload complete - process job IDs
  };

  const handleUploadError = (errorMessages: string[]) => {
    setErrors((prev) => [...prev, ...errorMessages]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            Import Rate Cards
          </h1>
          <p className="mt-2 text-gray-600 dark:text-slate-400">
            Upload supplier rate cards in Excel, CSV, or PDF format for automated processing
          </p>
        </div>

        {/* Upload Zone */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6 mb-6">
          <RateCardUploadZone
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            maxFiles={10}
            tenantId="default-tenant"
          />
        </div>

        {/* Success Messages */}
        {uploadedJobs.length > 0 && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-green-900 dark:text-green-300 mb-2">
              ✓ Files Uploaded Successfully
            </h3>
            <p className="text-sm text-green-700 dark:text-green-400 mb-3">
              {uploadedJobs.length} file(s) have been uploaded and are being processed.
            </p>
            <div className="space-y-1">
              {uploadedJobs.map((jobId, index) => (
                <div key={jobId} className="text-sm text-green-600 dark:text-green-400">
                  Job {index + 1}: {jobId}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-red-900 dark:text-red-300 mb-2">
              ✗ Upload Errors
            </h3>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              ))}
            </div>
            <button
              onClick={() => setErrors([])}
              className="mt-3 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Clear Errors
            </button>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-1">Excel Files</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              .xlsx and .xls formats with automatic sheet detection
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <div className="text-3xl mb-2">📄</div>
            <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-1">CSV Files</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Comma, semicolon, or tab-delimited formats
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <div className="text-3xl mb-2">📕</div>
            <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-1">PDF Files</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              OCR-powered extraction from scanned documents
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
            How It Works
          </h2>
          <ol className="space-y-3 text-gray-600 dark:text-slate-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span>
                <strong className="text-gray-900 dark:text-slate-100">Upload Files:</strong> Drag and drop or select rate card files
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span>
                <strong className="text-gray-900 dark:text-slate-100">Automatic Processing:</strong> Our system extracts and validates the data
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span>
                <strong className="text-gray-900 dark:text-slate-100">Review & Approve:</strong> Check the mapped data and approve for import
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </span>
              <span>
                <strong className="text-gray-900 dark:text-slate-100">Ready to Use:</strong> Normalized rates are available for benchmarking
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
