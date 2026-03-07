/**
 * Shared types for all use cases
 */

export type UseCaseCategory = 'quick-wins' | 'scalable' | 'differentiating' | 'client-facing'

export interface UseCaseMetrics {
  roi: string
  savings: string
  timeToValue: string
  complexity: 'Low' | 'Medium' | 'High'
}

export interface MetricItem {
  label: string
  value: string
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'orange'
}

export interface DemoStep {
  id: number
  title: string
  description: string
  duration?: number
}

export interface ExportOption {
  format: 'pdf' | 'excel' | 'powerpoint'
  label: string
  icon: string
}

export interface TimelineItem {
  week: number
  milestone: string
  status?: 'completed' | 'in-progress' | 'pending'
}

export interface SuccessMetric {
  label: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
}

export interface CaseStudy {
  client: string
  challenge: string
  solution: string
  results: string[]
}

export interface UseCaseHeroProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: UseCaseCategory
  metrics: UseCaseMetrics
}

export interface BeforeAfterProps {
  before: MetricItem[]
  after: MetricItem[]
  highlights?: string[]
}

export interface ResultsDisplayProps {
  results: any
  insights: string[]
  recommendations: string[]
  exportOptions?: ExportOption[]
}

export interface BusinessImpactProps {
  roi: number
  timeline: TimelineItem[]
  successMetrics: SuccessMetric[]
  caseStudy?: CaseStudy
}

export interface UseCaseCTAProps {
  primaryAction: {
    label: string
    onClick: () => void
  }
  secondaryAction: {
    label: string
    onClick: () => void
  }
  downloadAction: {
    label: string
    onClick: () => void
  }
}