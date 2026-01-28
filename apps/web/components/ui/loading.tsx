import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Brain, Activity } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  )
}

interface PageLoadingProps {
  title?: string
  description?: string
  type?: 'default' | 'ai' | 'processing'
}

export function PageLoading({ 
  title = 'Loading...', 
  description = 'Please wait while we load the content',
  type = 'default'
}: PageLoadingProps) {
  const getIcon = () => {
    switch (type) {
      case 'ai':
        return <Brain className="w-12 h-12 text-violet-600 animate-pulse" />
      case 'processing':
        return <Activity className="w-12 h-12 text-green-600 animate-pulse" />
      default:
        return <LoadingSpinner size="lg" className="text-violet-600" />
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            {getIcon()}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </CardContent>
      </Card>
    </div>
  )
}

interface InlineLoadingProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export function InlineLoading({ text = 'Loading...', size = 'sm' }: InlineLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <LoadingSpinner size={size} />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export default LoadingSpinner