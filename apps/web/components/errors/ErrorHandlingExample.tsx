/**
 * Error Handling Example Component
 * Demonstrates how to use the global error handling system
 */

'use client';

import { useState } from 'react';
import { useApiCall } from '@/hooks/useApiCall';
import { ErrorAlert } from './ErrorAlert';
import { LoadingState } from '../feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ErrorHandlingExample() {
  const [simulateError, setSimulateError] = useState<'none' | 'network' | 'server' | 'validation'>('none');
  
  const { data, error, loading, execute, reset } = useApiCall({
    maxRetries: 3,
    showErrorToast: true,
    showSuccessToast: true,
    successMessage: 'Data loaded successfully!',
  });

  const loadData = async () => {
    await execute(async () => {
      // Simulate different error types
      if (simulateError === 'network') {
        throw new Error('Network request failed');
      }
      if (simulateError === 'server') {
        throw new Error('500 Internal Server Error');
      }
      if (simulateError === 'validation') {
        throw new Error('Validation failed: Invalid input');
      }
      
      // Simulate successful API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { message: 'Success!', timestamp: new Date().toISOString() };
    });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Error Handling System Demo</CardTitle>
        <CardDescription>
          Test the global error handling system with different error scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Simulate Error Type:</label>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={simulateError === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSimulateError('none')}
            >
              No Error
            </Button>
            <Button
              variant={simulateError === 'network' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSimulateError('network')}
            >
              Network Error
            </Button>
            <Button
              variant={simulateError === 'server' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSimulateError('server')}
            >
              Server Error
            </Button>
            <Button
              variant={simulateError === 'validation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSimulateError('validation')}
            >
              Validation Error
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={loadData} disabled={loading}>
            Load Data
          </Button>
          {(data || error) && (
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>

        {loading && <LoadingState message="Loading data..." />}

        {error && (
          <ErrorAlert
            error={error}
            title="Failed to load data"
            onRetry={loadData}
            onDismiss={reset}
            showDetails={true}
          />
        )}

        {data && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-medium text-green-900">Success!</p>
            <pre className="mt-2 text-xs text-green-800">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-md">
          <h4 className="text-sm font-semibold text-violet-900 mb-2">
            Features Demonstrated:
          </h4>
          <ul className="text-sm text-violet-800 space-y-1 list-disc list-inside">
            <li>Automatic retry logic with exponential backoff</li>
            <li>User-friendly error messages</li>
            <li>Loading states</li>
            <li>Error alerts with retry functionality</li>
            <li>Toast notifications</li>
            <li>Error logging to monitoring service</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
