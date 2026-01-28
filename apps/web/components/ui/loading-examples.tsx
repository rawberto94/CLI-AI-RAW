/**
 * Loading States Examples
 * Demonstrates usage of various loading components
 */

'use client';

import React, { useState } from 'react';
import {
  LoadingSpinner,
  InlineLoading,
  PageLoading,
  ContractListSkeleton,
  RateCardTableSkeleton,
  DashboardSkeleton,
  FormSkeleton,
  OperationProgress,
  LoadingButton,
  OverlayLoading,
  CardLoading,
} from './loading-states';
import { useLoadingState, useMultiOperationLoading } from '@/hooks/useLoadingState';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// Example: Button with Loading State
// ============================================================================

export function ButtonLoadingExample() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleClick = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Operation completed successfully!');
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Button Loading States</h3>
      <div className="flex gap-3">
        <LoadingButton
          loading={loading}
          loadingText="Saving..."
          onClick={handleClick}
          className="bg-violet-600 text-white"
        >
          Save Changes
        </LoadingButton>
        
        <LoadingButton
          loading={loading}
          onClick={handleClick}
          className="border border-gray-300"
        >
          {loading ? <InlineLoading text="Processing" size="xs" /> : 'Process'}
        </LoadingButton>
      </div>
    </div>
  );
}

// ============================================================================
// Example: Page Loading with Progress
// ============================================================================

export function PageLoadingExample() {
  const { isLoading, progress, currentStep, executeWithLoading } = useLoadingState({
    trackProgress: true,
  });

  const loadData = async () => {
    await executeWithLoading(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
      },
      [
        'Fetching contracts...',
        'Processing data...',
        'Applying filters...',
        'Rendering results...',
      ]
    );
  };

  if (isLoading) {
    return (
      <PageLoading
        title="Loading Contracts"
        description={currentStep || 'Please wait...'}
        variant="data"
        showProgress
        progress={progress}
      />
    );
  }

  return (
    <div>
      <button
        onClick={loadData}
        className="px-4 py-2 bg-violet-600 text-white rounded-lg"
      >
        Load Data
      </button>
    </div>
  );
}

// ============================================================================
// Example: Skeleton Screens
// ============================================================================

export function SkeletonExample() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'contracts' | 'rates' | 'dashboard' | 'form'>('contracts');

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [view]);

  const renderSkeleton = () => {
    switch (view) {
      case 'contracts':
        return <ContractListSkeleton />;
      case 'rates':
        return <RateCardTableSkeleton />;
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'form':
        return <FormSkeleton />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => { setView('contracts'); setLoading(true); }}
          className="px-3 py-1 border rounded"
        >
          Contracts
        </button>
        <button
          onClick={() => { setView('rates'); setLoading(true); }}
          className="px-3 py-1 border rounded"
        >
          Rate Cards
        </button>
        <button
          onClick={() => { setView('dashboard'); setLoading(true); }}
          className="px-3 py-1 border rounded"
        >
          Dashboard
        </button>
        <button
          onClick={() => { setView('form'); setLoading(true); }}
          className="px-3 py-1 border rounded"
        >
          Form
        </button>
      </div>

      {loading ? renderSkeleton() : <div className="p-8 text-center">Content Loaded!</div>}
    </div>
  );
}

// ============================================================================
// Example: Operation Progress
// ============================================================================

export function OperationProgressExample() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [isRunning, setIsRunning] = useState(false);

  const runOperation = async () => {
    setIsRunning(true);
    setProgress(0);

    const steps = [
      { name: 'Uploading file...', duration: 1000 },
      { name: 'Extracting text...', duration: 1500 },
      { name: 'Analyzing content...', duration: 2000 },
      { name: 'Generating artifacts...', duration: 1500 },
      { name: 'Finalizing...', duration: 500 },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      setCurrentStep(step.name);
      setProgress(((i + 1) / steps.length) * 100);
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={runOperation}
        disabled={isRunning}
        className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
      >
        {isRunning ? 'Processing...' : 'Start Operation'}
      </button>

      {isRunning && (
        <OperationProgress
          operation="Processing Contract"
          progress={progress}
          currentStep={currentStep}
          totalSteps={5}
          currentStepNumber={Math.ceil((progress / 100) * 5)}
          estimatedTime={Math.ceil((100 - progress) / 10)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Example: Multi-Operation Loading
// ============================================================================

export function MultiOperationExample() {
  const {
    operations,
    addOperation,
    startOperation,
    updateOperationProgress,
    completeOperation,
    getOverallProgress,
  } = useMultiOperationLoading();

  const startMultipleOperations = () => {
    const ops = [
      { id: '1', name: 'Upload Contract A' },
      { id: '2', name: 'Upload Contract B' },
      { id: '3', name: 'Upload Contract C' },
    ];

    ops.forEach(op => {
      addOperation(op.id, op.name);
      startOperation(op.id);

      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        updateOperationProgress(op.id, progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          completeOperation(op.id);
        }
      }, 300);
    });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={startMultipleOperations}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg"
      >
        Start Multiple Operations
      </button>

      {operations.length > 0 && (
        <div className="space-y-3">
          <div className="font-semibold">
            Overall Progress: {Math.round(getOverallProgress())}%
          </div>
          {operations.map(op => (
            <OperationProgress
              key={op.id}
              operation={op.name}
              progress={op.progress}
              currentStep={op.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example: Overlay Loading
// ============================================================================

export function OverlayLoadingExample() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [progress, setProgress] = useState(0);

  const triggerOverlay = () => {
    setShowOverlay(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowOverlay(false);
          return 0;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="relative min-h-[300px] border rounded-lg p-6">
      <h3 className="font-semibold mb-4">Content Area</h3>
      <button
        onClick={triggerOverlay}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg"
      >
        Trigger Overlay
      </button>

      {showOverlay && (
        <OverlayLoading
          message="Processing your request..."
          progress={progress}
          showProgress
        />
      )}
    </div>
  );
}
