'use client';

import React, { ReactNode, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Loading Component
// ============================================================================

interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = 'Loading...', className }: PageLoadingProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-[400px] gap-4',
      className
    )}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="h-8 w-8 text-violet-600" />
      </motion.div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Error Fallback
// ============================================================================

interface PageErrorProps {
  error: Error;
  reset: () => void;
  title?: string;
  message?: string;
}

export function PageError({ 
  error, 
  reset, 
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.'
}: PageErrorProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-left overflow-auto max-w-lg">
            {error.message}
          </pre>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </motion.div>
  );
}

// ============================================================================
// Page Container
// ============================================================================

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  showHeader?: boolean;
}

export function PageContainer({
  children,
  title,
  description,
  actions,
  className,
  contentClassName,
  showHeader = true,
}: PageContainerProps) {
  return (
    <div className={cn('min-h-screen', className)}>
      {showHeader && (title || description || actions) && (
        <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-16 lg:top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-4">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </div>
        </header>
      )}
      <main 
        id="main-content" 
        className={cn('max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6', contentClassName)}
        role="main"
        aria-label={title || 'Main content'}
      >
        {children}
      </main>
    </div>
  );
}

// ============================================================================
// Page Wrapper with Error Boundary and Suspense
// ============================================================================

interface PageWrapperProps {
  children: ReactNode;
  loading?: ReactNode;
  loadingMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  fallback?: ReactNode;
}

export function PageWrapper({
  children,
  loading,
  loadingMessage,
  errorTitle,
  errorMessage,
  fallback,
}: PageWrapperProps) {
  const loadingFallback = loading || <PageLoading message={loadingMessage} />;

  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        fallback || (
          <PageError 
            error={error} 
            reset={reset} 
            title={errorTitle}
            message={errorMessage}
          />
        )
      )}
      level="page"
    >
      <Suspense fallback={loadingFallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// ============================================================================
// Full Page Component
// ============================================================================

interface FullPageProps extends PageContainerProps, Omit<PageWrapperProps, 'children'> {
  children: ReactNode;
}

/**
 * Full page component with error boundary, suspense, and container
 * 
 * @example
 * ```tsx
 * <FullPage 
 *   title="Dashboard" 
 *   description="Your overview"
 *   loadingMessage="Loading dashboard..."
 * >
 *   <DashboardContent />
 * </FullPage>
 * ```
 */
export function FullPage({
  children,
  loading,
  loadingMessage,
  errorTitle,
  errorMessage,
  fallback,
  ...containerProps
}: FullPageProps) {
  return (
    <PageContainer {...containerProps}>
      <PageWrapper
        loading={loading}
        loadingMessage={loadingMessage}
        errorTitle={errorTitle}
        errorMessage={errorMessage}
        fallback={fallback}
      >
        {children}
      </PageWrapper>
    </PageContainer>
  );
}

export default FullPage;
