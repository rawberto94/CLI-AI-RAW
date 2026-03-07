# Global Error Handling System

This directory contains the global error handling system components and utilities.

## Components

### GlobalErrorBoundary

Top-level error boundary that catches all React errors in the application. Automatically integrated in the root layout.

```tsx
import { GlobalErrorBoundary } from '@/components/errors/GlobalErrorBoundary';

<GlobalErrorBoundary>
  <App />
</GlobalErrorBoundary>
```

### ErrorBoundary

Component-level error boundary for catching errors in specific parts of the UI.

```tsx
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

<ErrorBoundary level="component">
  <MyComponent />
</ErrorBoundary>
```

### ErrorAlert

Inline error display component with retry functionality.

```tsx
import { ErrorAlert } from '@/components/errors/ErrorAlert';

<ErrorAlert
  error={error}
  title="Failed to load data"
  onRetry={handleRetry}
  onDismiss={handleDismiss}
  showDetails={true}
/>
```

### GlobalErrorFallback

Full-page error UI displayed when the global error boundary catches an error.

### ErrorFallback

Component-level error UI displayed when a component error boundary catches an error.

## Hooks

### useApiCall

Hook for making API calls with automatic retry logic and error handling.

```tsx
import { useApiCall } from '@/hooks/useApiCall';

function MyComponent() {
  const { data, error, loading, execute } = useApiCall({
    maxRetries: 3,
    showErrorToast: true,
    showSuccessToast: true,
    successMessage: 'Data loaded successfully',
  });

  const loadData = async () => {
    await execute(async () => {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    });
  };

  return (
    <div>
      {loading && <LoadingState />}
      {error && <ErrorAlert error={error} onRetry={loadData} />}
      {data && <DataDisplay data={data} />}
    </div>
  );
}
```

## API Error Handling

### withErrorHandling

Middleware wrapper for API routes that provides automatic error handling and logging.

```tsx
import { withErrorHandling, ValidationError } from '@/lib/api-error-handler';

async function handler(request: NextRequest) {
  // Your API logic here
  if (!isValid) {
    throw new ValidationError('Invalid input');
  }
  
  return NextResponse.json({ success: true });
}

export const GET = withErrorHandling(handler);
```

### Error Classes

Custom error classes for different error types:

- `ValidationError` - Input validation errors (400)
- `AuthenticationError` - Authentication required (401)
- `AuthorizationError` - Permission denied (403)
- `NotFoundError` - Resource not found (404)
- `ConflictError` - Resource conflict (409)
- `RateLimitError` - Rate limit exceeded (429)

### withRetry

Utility function for retrying async operations with exponential backoff.

```tsx
import { withRetry } from '@/lib/api-error-handler';

const result = await withRetry(
  async () => {
    return await fetchData();
  },
  3, // max attempts
  { endpoint: '/api/data', method: 'GET' }
);
```

## Monitoring

### Monitoring Service

Centralized monitoring service for logging errors, metrics, and traces.

```tsx
import { monitoringService } from '@/../../packages/data-orchestration/src/services/monitoring.service';

// Log error
monitoringService.logError(error, {
  component: 'MyComponent',
  action: 'loadData',
});

// Record metric
monitoringService.recordMetric('api.response_time', 150, {
  endpoint: '/api/data',
});

// Increment counter
monitoringService.incrementCounter('api.requests', {
  endpoint: '/api/data',
  status: '200',
});

// Trace operations
const trace = monitoringService.startTrace('data-load');
// ... do work
monitoringService.endTrace(trace);
```

## Best Practices

1. **Always use error boundaries** around major UI sections
2. **Use withErrorHandling** for all API routes
3. **Throw specific error types** (ValidationError, NotFoundError, etc.) instead of generic errors
4. **Provide user-friendly error messages** - don't expose technical details to users
5. **Log errors with context** - include relevant information for debugging
6. **Use retry logic** for transient failures (network errors, 5xx errors)
7. **Don't retry client errors** (4xx except 409) - they won't succeed on retry
8. **Show loading states** while operations are in progress
9. **Provide retry buttons** for failed operations
10. **Monitor error rates** and set up alerts for critical errors

## Error Flow

1. Error occurs in component or API route
2. Error is caught by error boundary or error handler
3. Error is logged to monitoring service
4. User-friendly error message is displayed
5. Retry logic is applied if appropriate
6. User can retry the operation or navigate away

## Testing

Test error handling by:

1. Simulating network failures
2. Throwing errors in components
3. Testing retry logic with transient failures
4. Verifying error messages are user-friendly
5. Checking error logging and monitoring
