/**
 * Global Error Fallback Component
 * Enhanced error UI for global error boundary with better UX
 */

'use client';

import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GlobalErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function GlobalErrorFallback({ error, reset }: GlobalErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReportError = () => {
    const subject = encodeURIComponent(`Error Report: ${errorId}`);
    const body = encodeURIComponent(
      `Error ID: ${errorId}\n\nError Message: ${error.message}\n\nPlease describe what you were doing when this error occurred:\n\n`
    );
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 text-destructive mb-2">
            <AlertTriangle className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Error ID: {errorId}</p>
            </div>
          </div>
          <CardDescription className="text-base">
            We encountered an unexpected error. Don&apos;t worry, your data is safe. 
            Please try one of the options below to continue.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Our team has been automatically notified and is working on a fix. 
              If this problem persists, please contact support with the error ID above.
            </AlertDescription>
          </Alert>

          {isDevelopment && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Development Error Details:
              </p>
              <p className="text-sm font-mono text-gray-700 break-all mb-2">
                {error.message}
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800 font-medium">
                    View Stack Trace
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-60 p-2 bg-white rounded border border-gray-200">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              What can you do?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Try refreshing the page</li>
              <li>Go back to the home page</li>
              <li>Clear your browser cache and cookies</li>
              <li>Contact support if the problem persists</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={reset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={handleReload}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
          <Button
            variant="outline"
            onClick={handleGoHome}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
          <Button
            variant="ghost"
            onClick={handleReportError}
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Report Error
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
