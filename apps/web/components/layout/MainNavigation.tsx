'use client'

import React, { useState, useMemo, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Sparkles,
  Scale,
  Edit3,
  Bot,
  Zap,
  FilePlus,
} from 'lucide-react'
import { ApprovalNotificationBell } from '@/components/workflows/ApprovalNotificationBell'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description?: string
  children?: NavigationItem[]
  isPremium?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview & insights'
  },
  {
    name: 'Contracts',
    href: '/contracts',
    icon: FileText,
    description: 'Manage contracts'
  },
  {
    name: 'Upload',
    href: '/upload',
    icon: Upload,
    description: 'Upload contracts'
  },
  {
    name: 'AI Studio',
    href: '/drafting',
    icon: Sparkles,
    description: 'AI-powered tools',
    isPremium: true,
    children: [
      {
        name: 'Smart Drafting',
        href: '/drafting',
        icon: Edit3,
        description: 'Draft contracts'
      },
      {
        name: 'AI Copilot',
        href: '/drafting/copilot',
        icon: Bot,
        description: 'Premium AI assistance',
        isPremium: true
      },
      {
        name: 'AI Chat',
        href: '/ai/chat',
        icon: Sparkles,
        description: 'Ask anything'
      },
      {
        name: 'AI Activity',
        href: '/ai/activity',
        icon: Activity,
        description: 'Agent activity monitor'
      }
    ]
  },
  {
    name: 'Generate',
    href: '/generate',
    icon: Zap,
    description: 'Create contracts',
    isPremium: true,
    badge: 'NEW',
    children: [
      {
        name: 'New Contract',
        href: '/generate?create=new',
        icon: FileText,
        description: 'Start from scratch'
      },
      {
        name: 'From Template',
        href: '/generate?create=template',
        icon: FileText,
        description: 'Use a template'
      },
      {
        name: 'Renewal',
        href: '/generate?create=renewal',
        icon: GitBranch,
        description: 'Renew existing'
      },
      {
        name: 'Amendment',
        href: '/generate?create=amendment',
        icon: GitBranch,
        description: 'Amend existing'
      },
      {
        name: 'All Drafts',
        href: '/generate',
        icon: FileText,
        description: 'View all drafts'
      }
    ]
  },
  {
    name: 'Obligations',
    href: '/obligations',
    icon: Target,
    description: 'Track obligations',
    isPremium: true,
    badge: 'NEW'
  },
  {
    name: 'Analytics',
    href: '/dashboard',
    icon: BarChart3,
    description: 'Analytics & reports'
  },
  {
    name: 'Rate Cards',
    href: '/rate-cards',
    icon: CreditCard,
    description: 'Rate benchmarking',
    children: [
      {
        name: 'Dashboard',
        href: '/rate-cards/dashboard',
        icon: LayoutDashboard,
        description: 'Overview'
      },
      {
        name: 'All Entries',
        href: '/rate-cards/entries',
        icon: FileText,
        description: 'Browse entries'
      },
      {
        name: 'Benchmarking',
        href: '/rate-cards/benchmarking',
        icon: Target,
        description: 'Compare rates'
      },
      {
        name: 'Opportunities',
        href: '/rate-cards/opportunities',
        icon: TrendingUp,
        description: 'Savings potential'
      }
    ]
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
    description: 'Find contracts'
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: FileText,
    description: 'Contract templates'
  },
  {
    name: 'Approvals',
    href: '/approvals',
    icon: CheckCircle2,
    description: 'Approval workflows'
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: GitBranch,
    description: 'Workflow automation',
    children: [
      {
        name: 'All Workflows',
        href: '/workflows',
        icon: GitBranch,
        description: 'Manage workflows'
      },
      {
        name: 'Analytics',
        href: '/workflows/analytics',
        icon: BarChart3,
        description: 'Performance metrics'
      },
      {
        name: 'SLA Compliance',
        href: '/workflows/sla',
        icon: Target,
        description: 'SLA monitoring'
      }
    ]
  }
]

function MainNavigation() {
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
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg shadow-md shadow-violet-500/20">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Contract Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          <ApprovalNotificationBell />
          <CompactConnectionStatus />
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-slate-100/80"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <motion.div
              animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 text-slate-600" />
              ) : (
                <Menu className="h-5 w-5 text-slate-600" />
              )}
            </motion.div>
          </Button>
        </div>
      </motion.div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-screen transition-all duration-300 ease-out',
          'bg-white/95 backdrop-blur-xl border-r border-slate-200/60 shadow-xl shadow-slate-200/40',
          'lg:translate-x-0 w-64',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-violet-400/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 -right-10 w-32 h-32 bg-gradient-to-br from-purple-400/15 to-fuchsia-500/15 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative h-16 flex items-center justify-between px-5 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white/50">
          <div className="flex items-center gap-2.5">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="p-2 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25"
            >
              {/* Contigo Stacked Bars Icon */}
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none" className="text-white">
                <g transform="translate(8, 10)">
                  <rect x="0" y="0" width="32" height="8" rx="4" fill="currentColor"/>
                  <rect x="0" y="12" width="32" height="8" rx="4" fill="currentColor" fillOpacity="0.8"/>
                  <rect x="0" y="24" width="32" height="8" rx="4" fill="currentColor" fillOpacity="0.6"/>
                </g>
              </svg>
            </motion.div>
            <div className="flex items-center">
              <span className="font-bold text-base text-violet-600">con</span>
              <span className="font-bold text-base text-gray-900">tigo</span>
            </div>
          </div>
          <ApprovalNotificationBell />
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto p-4 space-y-1.5">
          {navigationItems.map((item, index) => {
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.name)
            const isItemActive = isActive(item.href)
            const hasActiveChild = isChildActive(item.children)

            return (
              <motion.div 
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {hasChildren ? (
                  <>
                    <button
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-button`}
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        'group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        (isItemActive || hasActiveChild)
                          ? 'bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-purple-500/10 text-violet-700 shadow-sm border border-violet-200/50'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-1.5 rounded-lg transition-all duration-200',
                          (isItemActive || hasActiveChild)
                            ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                        )}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </div>
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <Badge className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-violet-500 to-violet-500 text-white border-0 shadow-sm">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            {item.badge}
                          </Badge>
                        )}
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Children */}
                    <AnimatePresence>
                      {isExpanded && item.children && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-4 mt-1.5 space-y-1 border-l-2 border-gradient-to-b from-violet-200 to-purple-200 pl-3 overflow-hidden"
                        >
                          {item.children.map((child, childIndex) => (
                            <motion.div
                              key={`${child.name}-${childIndex}`}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: childIndex * 0.05 }}
                            >
                              <Link
                                href={child.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                  'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                                  isActive(child.href)
                                    ? 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 font-medium border border-violet-100/50'
                                    : child.isPremium
                                    ? 'text-purple-600 hover:bg-purple-50 hover:text-purple-700'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                )}
                              >
                                <child.icon className={cn(
                                  'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                                  isActive(child.href) ? 'text-violet-600' : child.isPremium ? 'text-purple-500' : 'text-slate-400 group-hover:text-slate-600'
                                )} />
                                <span>{child.name}</span>
                                {child.isPremium && (
                                  <Badge className="ml-auto text-[10px] px-1 py-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                    AI
                                  </Badge>
                                )}
                                {child.badge && !child.isPremium && (
                                  <Badge className="ml-auto text-[10px] bg-slate-100 text-slate-600 border-0">
                                    {child.badge}
                                  </Badge>
                                )}
                              </Link>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <Link
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-link`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      isItemActive
                        ? 'bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-purple-500/10 text-violet-700 shadow-sm border border-violet-200/50'
                        : item.isPremium
                        ? 'text-purple-700 hover:bg-purple-50 hover:text-purple-900 border border-purple-100/50'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-lg transition-all duration-200',
                      isItemActive
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30'
                        : item.isPremium
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    )}>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                    </div>
                    <span>{item.name}</span>
                    {item.badge && (
                      <Badge className="ml-auto text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-violet-500 to-violet-500 text-white border-0 shadow-sm">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )}
              </motion.div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="relative border-t border-slate-200/60 p-4 bg-gradient-to-t from-slate-50/80 to-transparent">
          <div className="text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Version</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-mono bg-white/80">
                v2.0.0
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Real-time</span>
              <CompactConnectionStatus />
            </div>
            <motion.div 
              className="pt-2 mt-2 border-t border-slate-200/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                <span>AI-Powered Analysis</span>
              </div>
            </motion.div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  )
}

// Export memoized component for better performance
export default memo(MainNavigation)
