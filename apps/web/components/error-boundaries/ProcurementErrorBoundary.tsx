'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw, Bug, FileText, Mail } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export class ProcurementErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to monitoring service
    this.logError(error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private logError = async (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    }

    try {
      // In production, send to error tracking service (Sentry, LogRocket, etc.)
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    // Also log to console for development
    console.error('Procurement Error Boundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  private handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString()
    }

    // In production, integrate with support ticketing system
    console.log('Error report:', errorReport)
    alert('Error report submitted. Support team has been notified.')
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Something went wrong</CardTitle>
              <p className="text-gray-600 mt-2">
                We encountered an unexpected error in the procurement platform. Our team has been automatically notified.
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error Details */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Error Details</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error ID:</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {this.state.errorId}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium">{new Date().toLocaleString()}</span>
                  </div>
                  {this.state.error && (
                    <div className="mt-3">
                      <span className="text-gray-600">Message:</span>
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-mono">
                        {this.state.error.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleReportError}>
                  <Mail className="w-4 h-4 mr-2" />
                  Report Issue
                </Button>
              </div>

              {/* Help Information */}
              <div className="text-center text-sm text-gray-500">
                <p>If the problem persists, please contact support with Error ID: {this.state.errorId}</p>
                <p className="mt-1">
                  <a href="/support" className="text-blue-600 hover:underline">
                    Contact Support
                  </a>
                  {' • '}
                  <a href="/status" className="text-blue-600 hover:underline">
                    System Status
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ProcurementErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ProcurementErrorBoundary>
    )
  }
}

// Hook for error reporting in functional components
export function useErrorReporting() {
  const reportError = (error: Error, context?: string) => {
    const errorData = {
      errorId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    }

    // Send to error tracking service
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorData)
    }).catch(logError => {
      console.error('Failed to report error:', logError)
    })

    console.error('Error reported:', error)
  }

  return { reportError }
}