'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LayoutDashboard,
  FileText,
  Search,
  BarChart3,
  Settings,
  Upload,
  Activity,
  Shield,
  Zap,
  Brain,
  TrendingUp,
  Network,
  Menu,
  X,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import { AIBadge } from '@/components/ui/design-system'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description?: string
  isNew?: boolean
  isAI?: boolean
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview and key metrics'
  },
  {
    name: 'Use Cases',
    href: '/use-cases',
    icon: TrendingUp,
    badge: '7',
    description: 'Production-ready use cases',
    isNew: true
  },
  {
    name: 'Pilot Demo',
    href: '/pilot-demo',
    icon: Sparkles,
    description: 'Before vs After transformation',
    isNew: true,
    badge: 'Demo'
  },
  {
    name: 'Contracts',
    href: '/contracts',
    icon: FileText,
    description: 'Manage and analyze contracts',
    children: [
      {
        name: 'All Contracts',
        href: '/contracts',
        icon: FileText,
        description: 'View all contracts'
      },
      {
        name: 'Upload Contract',
        href: '/contracts/upload',
        icon: Upload,
        description: 'Upload new contract'
      },
      {
        name: 'Processing Status',
        href: '/processing-status',
        icon: Activity,
        description: 'Monitor processing jobs',
        badge: 'Live'
      }
    ]
  },
  {
    name: 'AI Intelligence',
    href: '/ai-intelligence',
    icon: Brain,
    isAI: true,
    description: 'AI-powered contract analysis',
    children: [
      {
        name: 'Integration Demo',
        href: '/integration-demo',
        icon: Network,
        description: 'Next-gen integration layer',
        isNew: true,
        isAI: true,
        badge: 'Live'
      },
      {
        name: 'Pilot Demo',
        href: '/pilot-demo',
        icon: Sparkles,
        description: 'Before vs After transformation',
        isNew: true,
        isAI: true
      },
      {
        name: 'CTO Demo',
        href: '/futuristic-contracts',
        icon: Zap,
        description: 'Executive AI demonstration',
        isNew: true,
        isAI: true
      },
      {
        name: 'BPO Revolution',
        href: '/bpo-demo',
        icon: TrendingUp,
        description: 'Procurement intelligence',
        isNew: true,
        isAI: true
      },
      {
        name: 'Cross-Contract Analysis',
        href: '/cross-contract-analysis',
        icon: BarChart3,
        description: 'Relationship discovery',
        isAI: true
      }
    ]
  },
  {
    name: 'Search & Discovery',
    href: '/search',
    icon: Search,
    description: 'Semantic contract search',
    children: [
      {
        name: 'Contract Search',
        href: '/search',
        icon: Search,
        description: 'Find contracts quickly'
      },
      {
        name: 'Advanced Filters',
        href: '/search/advanced',
        icon: Settings,
        description: 'Detailed search options'
      }
    ]
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Business insights and reports',
    children: [
      {
        name: 'Portfolio Overview',
        href: '/analytics/portfolio',
        icon: BarChart3,
        description: 'Contract portfolio metrics'
      },
      {
        name: 'Risk Analysis',
        href: '/analytics/risk',
        icon: Shield,
        description: 'Risk assessment reports'
      },
      {
        name: 'Compliance Reports',
        href: '/analytics/compliance',
        icon: Shield,
        description: 'Compliance monitoring'
      }
    ]
  },
  {
    name: 'System',
    href: '/system',
    icon: Settings,
    description: 'System administration',
    children: [
      {
        name: 'Processing Status',
        href: '/processing-status',
        icon: Activity,
        description: 'Monitor system health',
        badge: 'Live'
      },
      {
        name: 'API Documentation',
        href: '/api-docs',
        icon: FileText,
        description: 'API reference'
      },
      {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
        description: 'System configuration'
      }
    ]
  }
]

export default function MainNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const pathname = usePathname()

  const toggleExpanded = (itemName: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemName)) {
      newExpanded.delete(itemName)
    } else {
      newExpanded.add(itemName)
    }
    setExpandedItems(newExpanded)
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const NavItem: React.FC<{ 
    item: NavigationItem
    level?: number
    isMobile?: boolean
  }> = ({ item, level = 0, isMobile = false }) => {
    const hasChildren = item.children != null && item.children.length > 0
    const isExpanded = expandedItems.has(item.name)
    const active = isActive(item.href)

    return (
      <div className={cn('space-y-1', level > 0 && 'ml-4')}>
        <div className="flex items-center">
          <Link
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
              level > 0 && 'text-sm',
              'flex-1'
            )}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
          >
            <item.icon className={cn('h-4 w-4', (item.isAI ?? false) && 'text-blue-600')} />
            <span className="flex-1">{item.name}</span>
            
            {item.isNew === true && (
              <Badge variant="secondary" className="text-xs">
                New
              </Badge>
            )}
            
            {item.isAI === true && (
              <AIBadge>AI</AIBadge>
            )}
            
            {item.badge != null && item.isNew !== true && item.isAI !== true && (
              <Badge variant="outline" className="text-xs">
                {item.badge}
              </Badge>
            )}
          </Link>
          
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => toggleExpanded(item.name)}
            >
              <ChevronDown 
                className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </Button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {item.children!.map((child) => (
              <NavItem 
                key={child.name} 
                item={child} 
                level={level + 1}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:bg-background">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Contract Intelligence</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-green-500" />
              <span>System Online</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-16 px-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold">Contract Intelligence</h1>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" suppressHydrationWarning>
            <div className="fixed inset-0 bg-black/20" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed top-0 left-0 bottom-0 w-64 bg-background border-r shadow-lg" suppressHydrationWarning>
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-lg font-semibold">Contract Intelligence</h1>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                {/* Mobile Navigation Items */}
                <div className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
                  {navigationItems.map((item) => (
                    <NavItem key={item.name} item={item} isMobile />
                  ))}
                </div>

                {/* Mobile Footer */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span>System Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}