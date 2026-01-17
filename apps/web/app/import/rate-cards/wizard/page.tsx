'use client';

import { useState } from 'react';
import { RateCardUploadZone } from '@/components/import/RateCardUploadZone';
import { ColumnMappingInterface } from '@/components/import/ColumnMappingInterface';
import { ValidationReview } from '@/components/import/ValidationReview';
import { ImportService } from '@/lib/import/import-service';
import type { ImportResult, ImportProgress } from '@/lib/import/import-service';
import type { MatchResult } from '@/lib/import/fuzzy-matcher';

type WizardStep = 'upload' | 'mapping' | 'validation' | 'complete';

export default function ImportWizardPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    if (!file) return;
    
    setUploadedFile(file);
    setIsProcessing(true);

    try {
      // Process the import
      const result = await ImportService.previewImport(file, {
        useAI: false, // Set to true if AI API key is available
      });

      setImportResult(result);

      if (result.success && result.mappings) {
        setCurrentStep('mapping');
      }
    } catch (error: unknown) {
      alert('Failed to process file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingConfirm = () => {
    if (importResult?.validationResult) {
      setCurrentStep('validation');
    }
  };

  const handleValidationApprove = async () => {
    setIsProcessing(true);

    try {
      // TODO: Save to database
      // For now, just move to complete step
      setCurrentStep('complete');
    } catch {
      alert('Failed to save import');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidationReject = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setImportResult(null);
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setImportResult(null);
    setProgress(null);
  };

  const steps = [
    { id: 'upload', label: 'Upload File', icon: '📤' },
    { id: 'mapping', label: 'Map Columns', icon: '🔗' },
    { id: 'validation', label: 'Validate Data', icon: '✓' },
    { id: 'complete', label: 'Complete', icon: '🎉' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isComplete = index < currentStepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-2xl
                        ${isActive ? 'bg-blue-600 text-white' : ''}
                        ${isComplete ? 'bg-green-600 text-white' : ''}
                        ${!isActive && !isComplete ? 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400' : ''}
                      `}
                    >
                      {isComplete ? '✓' : step.icon}
                    </div>
                    <p className={`
                      mt-2 text-sm font-medium
                      ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}
                      ${isComplete ? 'text-green-600 dark:text-green-400' : ''}
                      ${!isActive && !isComplete ? 'text-gray-600 dark:text-slate-400' : ''}
                    `}>
                      {step.label}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      flex-1 h-1 mx-4
                      ${isComplete ? 'bg-green-600' : 'bg-gray-200 dark:bg-slate-700'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 p-8">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Import Rate Card</h1>
                <p className="mt-2 text-gray-600 dark:text-slate-400">
                  Upload your rate card file to begin the import process
                </p>
              </div>

              <RateCardUploadZone
                onUploadComplete={(jobIds) => {
                  // File uploaded, now process it
                }}
                maxFiles={1}
                tenantId="default-tenant"
              />

              {/* Or use file picker */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Or select a file directly:</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload([e.target.files[0]]);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 dark:text-slate-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    dark:file:bg-blue-900/50 dark:file:text-blue-300
                    hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
                  aria-label="Select rate card file to import"
                />
              </div>

              {isProcessing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  <p className="mt-4 text-gray-600 dark:text-slate-400">Processing file...</p>
                </div>
              )}
            </div>
          )}

          {/* Mapping Step */}
          {currentStep === 'mapping' && importResult && (
            <ColumnMappingInterface
              headers={importResult.parseResult?.sheets?.[0]?.headers || []}
              sampleRows={importResult.parseResult?.sheets?.[0]?.rows.slice(0, 5) || []}
              initialMappings={importResult.mappings || []}
              onMappingsChange={(mappings) => {
                // Update mappings in result
                if (importResult) {
                  setImportResult({ ...importResult, mappings });
                }
              }}
              onConfirm={handleMappingConfirm}
              onCancel={handleStartOver}
            />
          )}

          {/* Validation Step */}
          {currentStep === 'validation' && importResult?.validationResult && (
            <ValidationReview
              validationResult={importResult.validationResult}
              onApprove={handleValidationApprove}
              onReject={handleValidationReject}
            />
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="text-center py-12 space-y-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Import Complete!</h2>
              <p className="text-gray-600 dark:text-slate-400">
                Your rate card has been successfully imported and is now available for benchmarking.
              </p>

              {importResult && (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6 max-w-md mx-auto">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">Import Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Rows Imported:</span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{importResult.transformedData?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Columns Mapped:</span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{importResult.mappings?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Job ID:</span>
                      <span className="font-mono text-xs text-gray-900 dark:text-slate-100">{importResult.jobId}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleStartOver}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Import Another File
                </button>
                <a
                  href="/contracts"
                  className="px-6 py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium"
                >
                  View Contracts
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
