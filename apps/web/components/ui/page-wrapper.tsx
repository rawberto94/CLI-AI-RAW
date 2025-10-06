import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Share, RefreshCw, Filter } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageAction {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: 'default' | 'outline' | 'ghost'
  disabled?: boolean
}

interface PageWrapperProps {
  title: string
  description?: string
  icon?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  backButton?: {
    href: string
    label?: string
  }
  badges?: Array<{
    label: string
    variant?: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }>
  actions?: PageAction[]
  children: React.ReactNode
  className?: string
}

export function PageWrapper({
  title,
  description,
  icon,
  breadcrumbs,
  backButton,
  badges,
  actions,
  children,
  className = ''
}: PageWrapperProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {item.href ? (
                    <Link href={item.href} className="hover:text-gray-700">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-gray-900">{item.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Back Button */}
          {backButton && (
            <div className="mb-2">
              <Link href={backButton.href}>
                <Button variant="ghost" size="sm" className="p-0 h-auto text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {backButton.label || 'Back'}
                </Button>
              </Link>
            </div>
          )}

          {/* Title and Description */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              {icon}
              {title}
            </h1>
            {badges && badges.map((badge, index) => (
              <Badge 
                key={index} 
                variant={badge.variant || 'default'}
                className={badge.className}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
          
          {description && (
            <p className="text-gray-600">{description}</p>
          )}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-3">
            {actions.map((action, index) => (
              action.href ? (
                <Link key={index} href={action.href}>
                  <Button 
                    variant={action.variant || 'outline'} 
                    size="sm"
                    disabled={action.disabled}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </Button>
              )
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  )
}

// Common action presets
export const commonActions = {
  filter: {
    label: 'Filter',
    icon: <Filter className="w-4 h-4 mr-2" />,
    variant: 'outline' as const
  },
  refresh: {
    label: 'Refresh',
    icon: <RefreshCw className="w-4 h-4 mr-2" />,
    variant: 'outline' as const
  },
  download: {
    label: 'Download',
    icon: <Download className="w-4 h-4 mr-2" />,
    variant: 'outline' as const
  },
  share: {
    label: 'Share',
    icon: <Share className="w-4 h-4 mr-2" />,
    variant: 'outline' as const
  }
}

export default PageWrapper