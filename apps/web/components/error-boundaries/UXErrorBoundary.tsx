'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Generic Error Boundary for UX Components
 */
export class UXErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.componentName || 'component'}:`, error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700">
              {this.props.componentName 
                ? `The ${this.props.componentName} encountered an error and couldn't be displayed.`
                : 'This component encountered an error and couldn't be displayed.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-white rounded p-3 border border-red-200">
                <p className="text-xs font-mono text-red-800 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer font-semibold mb-1">
                      Stack trace
                    </summary>
                    <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleReset}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleGoHome}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * Onboarding Error Boundary
 */
export function OnboardingErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <UXErrorBoundary
      componentName="Onboarding Wizard"
      onError={(error, errorInfo) => {
        // Log to analytics
        console.error('Onboarding error:', error, errorInfo)
      }}
    >
      {children}
    </UXErrorBoundary>
  )
}

/**
 * Dashboard Widget Error Boundary
 */
export function DashboardWidgetErrorBoundary({ 
  children, 
  widgetName 
}: { 
  children: ReactNode
  widgetName?: string 
}) {
  return (
    <UXErrorBoundary
      componentName={widgetName ? `${widgetName} Widget` : 'Dashboard Widget'}
      fallback={
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                This widget couldn't be loaded. Try refreshing the page.
              </span>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </UXErrorBoundary>
  )
}

/**
 * Progress Tracker Error Boundary
 */
export function ProgressTrackerErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <UXErrorBoundary
      componentName="Progress Tracker"
      fallback={
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  Progress tracking unavailable
                </span>
              </div>
              <p className="text-xs text-yellow-700">
                Your upload is still processing in the background. Check back in a moment.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </UXErrorBoundary>
  )
}

/**
 * Help System Error Boundary
 */
export function HelpSystemErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <UXErrorBoundary
      componentName="Help System"
      fallback={
        <div className="p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm text-gray-600">
            Help content is temporarily unavailable. Please try again later.
          </p>
        </div>
      }
    >
      {children}
    </UXErrorBoundary>
  )
}
