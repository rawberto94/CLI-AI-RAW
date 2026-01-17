'use client'

import React, { Component, ReactNode, ErrorInfo } from 'react'
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
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="py-6 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h4 className="text-sm font-semibold text-red-800 mb-1">
                {this.props.sectionName 
                  ? `Failed to load ${this.props.sectionName}`
                  : 'Something went wrong'
                }
              </h4>
              <p className="text-xs text-red-600 mb-4 max-w-xs mx-auto">
                This section encountered an error but the rest of the page is still available.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="border-red-200 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
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
