/**
 * Unit Tests for ErrorBoundary Component
 * Tests for components/error-boundary/ErrorBoundary.tsx
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Content renders successfully</div>;
};

// We need to test the error boundary separately since it catches errors
describe('ErrorBoundary', () => {
  // Suppress console.error during tests since we're testing error scenarios
  const originalError = console.error;
  beforeEach(() => {
    console.error = jest.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  describe('ErrorBoundary class component', () => {
    it('should render children when no error occurs', async () => {
      // Dynamic import to avoid module resolution issues
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Content renders successfully')).toBeInTheDocument();
    });

    it('should render fallback UI when error occurs', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should use custom fallback when provided', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      render(
        <ErrorBoundary fallback={<div>Custom error UI</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      const onError = jest.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should allow retry after error', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      // Start with an error
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      
      // Re-render with no error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );
      
      expect(screen.getByText('Content renders successfully')).toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', async () => {
      const { withErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      const SafeComponent = () => <div>Safe content</div>;
      const WrappedComponent = withErrorBoundary(SafeComponent);
      
      render(<WrappedComponent />);
      
      expect(screen.getByText('Safe content')).toBeInTheDocument();
    });

    it('should catch errors from wrapped component', async () => {
      const { withErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      const UnsafeComponent = () => {
        throw new Error('Component error');
      };
      const WrappedComponent = withErrorBoundary(UnsafeComponent);
      
      render(<WrappedComponent />);
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should pass through props to wrapped component', async () => {
      const { withErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      interface TestProps {
        message: string;
      }
      
      const PropsComponent = ({ message }: TestProps) => <div>{message}</div>;
      const WrappedComponent = withErrorBoundary(PropsComponent);
      
      render(<WrappedComponent message="Hello from props" />);
      
      expect(screen.getByText('Hello from props')).toBeInTheDocument();
    });

    it('should use custom fallback in HOC', async () => {
      const { withErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      const UnsafeComponent = () => {
        throw new Error('Component error');
      };
      const WrappedComponent = withErrorBoundary(UnsafeComponent, {
        fallback: <div>HOC custom fallback</div>,
      });
      
      render(<WrappedComponent />);
      
      expect(screen.getByText('HOC custom fallback')).toBeInTheDocument();
    });
  });

  describe('Error state display', () => {
    it('should show error details in development', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      // Set NODE_ENV to development temporarily
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      render(
        <ErrorBoundary showDetails={true}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error message should be visible
      expect(screen.getByText(/Test error/i)).toBeInTheDocument();
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production by default', async () => {
      const { ErrorBoundary } = await import('@/components/error-boundary/ErrorBoundary');
      
      // Set NODE_ENV to production temporarily
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error title should be visible
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });
});
