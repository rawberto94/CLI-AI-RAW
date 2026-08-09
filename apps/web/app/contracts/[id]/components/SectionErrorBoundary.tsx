'use client'

import React, { Component, ReactNode, ErrorInfo as _ErrorInfo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface SectionErrorBoundaryProps {
  children: ReactNode
  sectionName?: string
  fallback?: ReactNode
  onReset?: () => void
}

interface SectionErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Lightweight error boundary for page sections.
 * Catches errors in child components without crashing the entire page.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch() {
    // Error boundary caught an error - silently handled
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden rounded-xl border border-red-200 bg-red-50/40 shadow-sm">
            <CardContent className="py-7 text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="mb-1 text-sm font-semibold leading-5 text-red-800">
                {this.props.sectionName 
                  ? `Failed to load ${this.props.sectionName}`
                  : 'Something went wrong'
                }
              </h4>
              <p className="mx-auto mb-4 max-w-xs text-xs font-medium leading-4 text-red-600">
                This section encountered an error but the rest of the page is still available.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="h-8 border-red-200 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Try again
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )
    }

    return this.props.children
  }
}

/**
 * Wrapper component for function component usage
 */
export function withSectionErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionName?: string
) {
  return function WithSectionErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary sectionName={sectionName}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    )
  }
}
