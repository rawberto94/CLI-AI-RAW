'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CompactConnectionStatus } from '@/components/realtime/ConnectionStatusIndicator'
import { 
  LayoutDashboard,
  FileText,
  Search,
  BarChart3,
  Settings,
  Upload,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Briefcase,
  FileBarChart,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Import,
  CreditCard,
  Target,
  Shield,
  AlertTriangle
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description?: string
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Executive overview'
  },
  {
    name: 'Contracts',
    href: '/contracts',
    icon: FileText,
    description: 'Contract management',
    children: [
      {
        name: 'All Contracts',
        href: '/contracts',
        icon: FileText,
        description: 'View all contracts'
      },
      {
        name: 'Upload',
        href: '/upload',
        icon: Upload,
        description: 'Upload new contract'
      },
      {
        name: 'Processing',
        href: '/processing-status',
        icon: Activity,
        description: 'Monitor processing',
        badge: 'Live'
      },
      {
        name: 'Bulk Operations',
        href: '/contracts/bulk',
        icon: Briefcase,
        description: 'Bulk actions'
      }
    ]
  },
  {
    name: 'Rate Cards',
    href: '/rate-cards',
    icon: CreditCard,
    description: 'Rate benchmarking & analysis',
    children: [
      {
        name: 'Dashboard',
        href: '/rate-cards/dashboard',
        icon: LayoutDashboard,
        description: 'Executive dashboard'
      },
      {
        name: 'All Entries',
        href: '/rate-cards/entries',
        icon: FileText,
        description: 'View all rate cards'
      },
      {
        name: 'Benchmarking',
        href: '/rate-cards/benchmarking',
        icon: Target,
        description: 'Rate benchmarks'
      },
      {
        name: 'Suppliers',
        href: '/rate-cards/suppliers',
        icon: Users,
        description: 'Supplier scorecards'
      },
      {
        name: 'Opportunities',
        href: '/rate-cards/opportunities',
        icon: TrendingUp,
        description: 'Savings opportunities'
      },
      {
        name: 'Market Intelligence',
        href: '/rate-cards/market-intelligence',
        icon: BarChart3,
        description: 'Market insights'
      },
      {
        name: 'Baselines',
        href: '/rate-cards/baselines',
        icon: Target,
        description: 'Target rates'
      }
    ]
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Business intelligence',
    children: [
      {
        name: 'Overview',
        href: '/analytics',
        icon: BarChart3,
        description: 'Analytics hub'
      },
      {
        name: 'Procurement Intelligence',
        href: '/analytics/procurement',
        icon: Briefcase,
        description: 'Procurement insights'
      },
      {
        name: 'Cost Savings',
        href: '/analytics/savings',
        icon: DollarSign,
        description: 'Savings opportunities'
      },
      {
        name: 'Renewals Radar',
        href: '/analytics/renewals',
        icon: Calendar,
        description: 'Contract renewals'
      },
      {
        name: 'Supplier Performance',
        href: '/analytics/suppliers',
        icon: Users,
        description: 'Supplier analytics'
      },
      {
        name: 'Negotiation Prep',
        href: '/analytics/negotiation',
        icon: TrendingUp,
        description: 'Negotiation insights'
      }
    ]
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
    description: 'Find anything'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Configuration'
  }
]

export default function MainNavigation() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const isChildActive = (children?: NavigationItem[]) => {
    return children?.some(child => isActive(child.href))
  }

  return (
    <TooltipProvider>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          <span className="font-semibold text-gray-900">Contract Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <CompactConnectionStatus />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen transition-transform bg-white border-r border-gray-200 shadow-lg',
          'lg:translate-x-0 w-64',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-200">
          <FileText className="h-6 w-6 text-blue-600" />
          <span className="font-semibold text-gray-900">Contract Intelligence</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigationItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.name)
            const isItemActive = isActive(item.href)
            const hasActiveChild = isChildActive(item.children)

            return (
              <div key={item.name}>
                {hasChildren ? (
                  <>
                    <button
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-button`}
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        (isItemActive || hasActiveChild)
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {/* Children */}
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                              isActive(child.href)
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            )}
                          >
                            <child.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{child.name}</span>
                            {child.badge && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {child.badge}
                              </Badge>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-link`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isItemActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>Version</span>
              <span className="font-medium">2.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Real-time</span>
              <CompactConnectionStatus />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </TooltipProvider>
  )
}
