"use client";

/**
 * Conditional Components
 * 
 * Utility components for conditional rendering patterns.
 */

import React, { ReactNode, ReactElement } from "react";
import { createPortal } from "react-dom";

// ============================================================================
// ConditionalWrapper Component
// ============================================================================

export interface ConditionalWrapperProps {
  /** Condition to determine if wrapper should be applied */
  condition: boolean;
  /** Wrapper function that receives children */
  wrapper: (children: ReactNode) => ReactElement;
  /** Children to conditionally wrap */
  children: ReactNode;
}

/**
 * Conditionally wraps children with a wrapper component.
 * 
 * @example
 * ```tsx
 * <ConditionalWrapper
 *   condition={hasLink}
 *   wrapper={(children) => <Link href={url}>{children}</Link>}
 * >
 *   <Button>Click me</Button>
 * </ConditionalWrapper>
 * ```
 */
export function ConditionalWrapper({
  condition,
  wrapper,
  children,
}: ConditionalWrapperProps): ReactElement {
  return condition ? wrapper(children) : <>{children}</>;
}

// ============================================================================
// Show Component
// ============================================================================

export interface ShowProps {
  /** Condition to show children */
  when: boolean | undefined | null;
  /** Fallback content when condition is false */
  fallback?: ReactNode;
  /** Children to show when condition is true */
  children: ReactNode;
}

/**
 * Conditionally renders children based on a condition.
 * More readable alternative to ternary operators.
 * 
 * @example
 * ```tsx
 * <Show when={isLoading} fallback={<Content />}>
 *   <LoadingSpinner />
 * </Show>
 * ```
 */
export function Show({ when, fallback = null, children }: ShowProps): ReactElement {
  return <>{when ? children : fallback}</>;
}

// ============================================================================
// Switch/Match Components
// ============================================================================

export interface MatchProps<T> {
  /** Value to match against */
  when: T;
  /** Children to render when matched */
  children: ReactNode;
}

export interface SwitchProps<T> {
  /** Value to match */
  value: T;
  /** Match components as children */
  children: ReactNode;
  /** Default content when no match */
  fallback?: ReactNode;
}

/**
 * Match component for use with Switch.
 */
export function Match<T>({ children }: MatchProps<T>): ReactElement {
  return <>{children}</>;
}

/**
 * Switch component for multiple condition rendering.
 * 
 * @example
 * ```tsx
 * <Switch value={status} fallback={<DefaultStatus />}>
 *   <Match when="loading"><LoadingSpinner /></Match>
 *   <Match when="error"><ErrorMessage /></Match>
 *   <Match when="success"><SuccessMessage /></Match>
 * </Switch>
 * ```
 */
export function Switch<T>({ value, children, fallback = null }: SwitchProps<T>): ReactElement {
  const childArray = React.Children.toArray(children);
  
  for (const child of childArray) {
    if (React.isValidElement<MatchProps<T>>(child) && child.props.when === value) {
      return <>{child.props.children}</>;
    }
  }
  
  return <>{fallback}</>;
}

// ============================================================================
// For Component
// ============================================================================

export interface ForProps<T> {
  /** Array to iterate over */
  each: T[] | undefined | null;
  /** Render function for each item */
  children: (item: T, index: number) => ReactNode;
  /** Fallback when array is empty or undefined */
  fallback?: ReactNode;
}

/**
 * Iterates over an array and renders children for each item.
 * Cleaner alternative to .map() with built-in empty state.
 * 
 * @example
 * ```tsx
 * <For each={items} fallback={<EmptyState />}>
 *   {(item, index) => <ItemCard key={item.id} item={item} />}
 * </For>
 * ```
 */
export function For<T>({ each, children, fallback = null }: ForProps<T>): ReactElement {
  if (!each || each.length === 0) {
    return <>{fallback}</>;
  }

  return <>{each.map((item, index) => children(item, index))}</>;
}

// ============================================================================
// ErrorBoundary Wrapper Component
// ============================================================================

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorBoundaryProps {
  /** Fallback component to render on error */
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Children */
  children: ReactNode;
}

/**
 * Error boundary component for graceful error handling.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;
      
      if (typeof fallback === "function") {
        return fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }
      
      return fallback ?? (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <h3 className="text-red-800 font-medium">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">{this.state.error.message}</p>
          <button
            onClick={this.resetError}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Portal Component
// ============================================================================

export interface PortalProps {
  /** Target container (selector or element) */
  container?: string | Element | null;
  /** Children to render in portal */
  children: ReactNode;
}

/**
 * Renders children in a portal to a different DOM node.
 * 
 * @example
 * ```tsx
 * <Portal container="#modal-root">
 *   <Modal />
 * </Portal>
 * ```
 */
export function Portal({ container, children }: PortalProps): ReactElement | null {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  let target: Element | null = null;

  if (typeof container === "string") {
    target = document.querySelector(container);
  } else if (container instanceof Element) {
    target = container;
  } else {
    target = document.body;
  }

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}

// ============================================================================
// Suspense Wrapper with Fallback
// ============================================================================

export interface SuspenseWithFallbackProps {
  /** Fallback component */
  fallback?: ReactNode;
  /** Children (should contain lazy components) */
  children: ReactNode;
}

/**
 * Suspense wrapper with a default loading fallback.
 */
export function SuspenseWithFallback({
  fallback,
  children,
}: SuspenseWithFallbackProps): ReactElement {
  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <React.Suspense fallback={fallback ?? defaultFallback}>
      {children}
    </React.Suspense>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ConditionalWrapper;
