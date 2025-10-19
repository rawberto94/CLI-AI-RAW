'use client'

import React from 'react'
import { 
  FileText, 
  Upload, 
  Search, 
  Filter,
  Database,
  FileSpreadsheet,
  AlertCircle,
  Inbox,
  Calendar,
  Users,
  DollarSign,
  Shield,
  Network,
  TrendingUp,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ============================================================================
// TYPES
// ============================================================================

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  illustration?: React.ReactNode
}

// ============================================================================
// BASE EMPTY STATE COMPONENT
// ============================================================================

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  illustration
}) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        {illustration || (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-gray-600 max-w-md mb-6">
          {description}
        </p>
        
        {action && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
            >
              {action.label}
            </Button>
            
            {secondaryAction && (
              <Button
                onClick={secondaryAction.onClick}
                variant="outline"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SPECIFIC EMPTY STATES
// ============================================================================

export const NoContractsEmptyState: React.FC<{
  onUpload: () => void
  onViewSample?: () => void
}> = ({ onUpload, onViewSample }) => {
  return (
    <EmptyState
      icon={FileText}
      title="No contracts yet"
      description="Upload your first contract to start analyzing with AI-powered insights. We support PDF, DOCX, and TXT files up to 100MB."
      action={{
        label: 'Upload Contract',
        onClick: onUpload
      }}
      secondaryAction={onViewSample ? {
        label: 'View Sample',
        onClick: onViewSample
      } : undefined}
    />
  )
}

export const NoSearchResultsEmptyState: React.FC<{
  query: string
  onClearFilters?: () => void
}> = ({ query, onClearFilters }) => {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any contracts matching "${query}". Try adjusting your search terms or filters.`}
      action={onClearFilters ? {
        label: 'Clear Filters',
        onClick: onClearFilters,
        variant: 'outline'
      } : undefined}
    />
  )
}

export const NoFilterResultsEmptyState: React.FC<{
  onClearFilters: () => void
}> = ({ onClearFilters }) => {
  return (
    <EmptyState
      icon={Filter}
      title="No matches found"
      description="No contracts match your current filters. Try adjusting or clearing your filters to see more results."
      action={{
        label: 'Clear All Filters',
        onClick: onClearFilters,
        variant: 'outline'
      }}
    />
  )
}

export const NoRateCardsEmptyState: React.FC<{
  onImport: () => void
  onViewGuide?: () => void
}> = ({ onImport, onViewGuide }) => {
  return (
    <EmptyState
      icon={FileSpreadsheet}
      title="No rate cards imported"
      description="Import your first rate card to start benchmarking against market data and identifying savings opportunities."
      action={{
        label: 'Import Rate Card',
        onClick: onImport
      }}
      secondaryAction={onViewGuide ? {
        label: 'View Import Guide',
        onClick: onViewGuide
      } : undefined}
    />
  )
}

export const NoUpcomingRenewalsEmptyState: React.FC = () => {
  return (
    <EmptyState
      icon={Calendar}
      title="No upcoming renewals"
      description="Great news! You don't have any contracts expiring in the next 90 days. We'll notify you when renewals are approaching."
    />
  )
}

export const NoSuppliersEmptyState: React.FC<{
  onAddSupplier?: () => void
}> = ({ onAddSupplier }) => {
  return (
    <EmptyState
      icon={Users}
      title="No suppliers found"
      description="Start tracking supplier performance and relationships by uploading contracts or adding suppliers manually."
      action={onAddSupplier ? {
        label: 'Add Supplier',
        onClick: onAddSupplier
      } : undefined}
    />
  )
}

export const NoSavingsOpportunitiesEmptyState: React.FC = () => {
  return (
    <EmptyState
      icon={DollarSign}
      title="No savings opportunities identified"
      description="We haven't found any immediate savings opportunities. Upload more contracts or rate cards to get comprehensive analysis."
    />
  )
}

export const NoComplianceIssuesEmptyState: React.FC = () => {
  return (
    <EmptyState
      icon={Shield}
      title="No compliance issues found"
      description="Excellent! All your contracts are compliant with GDPR, CCPA, and SOX regulations. We'll continue monitoring for any changes."
      illustration={
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-green-600" />
        </div>
      }
    />
  )
}

export const ErrorEmptyState: React.FC<{
  title?: string
  description?: string
  onRetry?: () => void
}> = ({ 
  title = 'Something went wrong',
  description = 'We encountered an error loading this data. Please try again or contact support if the problem persists.',
  onRetry
}) => {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={onRetry ? {
        label: 'Try Again',
        onClick: onRetry,
        variant: 'outline'
      } : undefined}
      illustration={
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
      }
    />
  )
}

export const NoDataEmptyState: React.FC<{
  title?: string
  description?: string
}> = ({ 
  title = 'No data available',
  description = 'There is no data to display at this time. Check back later or upload some contracts to get started.'
}) => {
  return (
    <EmptyState
      icon={Database}
      title={title}
      description={description}
    />
  )
}

export const NoAnalyticsDataEmptyState: React.FC<{
  onUploadContract: () => void
}> = ({ onUploadContract }) => {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Not enough data for analytics"
      description="Upload more contracts to unlock powerful analytics and insights. We need at least 3 contracts to generate meaningful analysis."
      action={{
        label: 'Upload Contracts',
        onClick: onUploadContract
      }}
    />
  )
}

export const NoUseCaseDataEmptyState: React.FC<{
  useCaseName: string
  onGetStarted: () => void
}> = ({ useCaseName, onGetStarted }) => {
  return (
    <EmptyState
      icon={Sparkles}
      title={`Start using ${useCaseName}`}
      description="This use case requires some initial setup. Follow our guided wizard to get started in just a few minutes."
      action={{
        label: 'Get Started',
        onClick: onGetStarted
      }}
    />
  )
}

export const NoCrossContractDataEmptyState: React.FC<{
  onUploadMore: () => void
}> = ({ onUploadMore }) => {
  return (
    <EmptyState
      icon={Network}
      title="Need more contracts for cross-contract analysis"
      description="Cross-contract intelligence requires at least 5 contracts to identify patterns and relationships. Upload more contracts to unlock this feature."
      action={{
        label: 'Upload More Contracts',
        onClick: onUploadMore
      }}
    />
  )
}

// ============================================================================
// EMPTY STATE WITH ILLUSTRATION
// ============================================================================

export const IllustratedEmptyState: React.FC<{
  title: string
  description: string
  imageSrc?: string
  action?: {
    label: string
    onClick: () => void
  }
}> = ({ title, description, imageSrc, action }) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        {imageSrc && (
          <img 
            src={imageSrc} 
            alt={title}
            className="w-64 h-64 object-contain mb-6 opacity-80"
          />
        )}
        
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-gray-600 max-w-lg mb-6">
          {description}
        </p>
        
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  EmptyState,
  NoContractsEmptyState,
  NoSearchResultsEmptyState,
  NoFilterResultsEmptyState,
  NoRateCardsEmptyState,
  NoUpcomingRenewalsEmptyState,
  NoSuppliersEmptyState,
  NoSavingsOpportunitiesEmptyState,
  NoComplianceIssuesEmptyState,
  ErrorEmptyState,
  NoDataEmptyState,
  NoAnalyticsDataEmptyState,
  NoUseCaseDataEmptyState,
  NoCrossContractDataEmptyState,
  IllustratedEmptyState
}
