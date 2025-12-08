'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/design-system'
import { Button } from '@/components/ui/button'
import { Bell, User, Search, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ConTigoLogoSVG } from '@/components/ui/ConTigoLogo'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

// Simple mobile nav items
const mobileNavItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/upload', label: 'Upload' },
  { href: '/ai/chat', label: 'AI Assistant' },
  { href: '/search', label: 'Search' },
  { href: '/analytics', label: 'Analytics' },
]

export default function AppLayout({ 
  children, 
  title, 
  description, 
  actions,
  className 
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  return (
    <>
      {/* Top Bar */}
      {(title || actions) && (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 md:h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              {title && (
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-semibold truncate">{title}</h1>
                  {description && (
                    <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{description}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              {/* Search - hidden on mobile */}
              <Button variant="ghost" size="icon" className="hidden md:flex" aria-label="Search contracts">
                <Search className="h-4 w-4" />
              </Button>
              
              {/* Notifications */}
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
              
              {/* User Menu */}
              <Button variant="ghost" size="icon" aria-label="User menu">
                <User className="h-4 w-4" />
              </Button>
              
              {/* Custom Actions - hidden on mobile if space is tight */}
              <div className="hidden sm:flex items-center gap-2">
                {actions}
              </div>
            </div>
          </div>
          
          {/* Mobile actions row if present */}
          {actions && (
            <div className="sm:hidden px-4 pb-3 flex gap-2">
              {actions}
            </div>
          )}
        </header>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-50 md:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <ConTigoLogoSVG size="md" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Nav items */}
              <nav className="p-4 space-y-1">
                {mobileNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Page Content */}
      <main className={cn('flex-1 w-full max-w-full overflow-x-hidden', className)}>
        <div className="w-full px-4 lg:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
    </>
  )
}

// Specialized layout for dashboard pages
export function DashboardLayout({ 
  children, 
  title, 
  description, 
  actions,
  className 
}: AppLayoutProps) {
  return (
    <AppLayout 
      title={title} 
      description={description} 
      actions={actions}
      className={className}
    >
      {children}
    </AppLayout>
  )
}

// Specialized layout for contract pages
export function ContractLayout({ 
  children, 
  title, 
  description, 
  actions,
  className 
}: AppLayoutProps) {
  return (
    <AppLayout 
      title={title} 
      description={description} 
      actions={actions}
      className={className}
    >
      <div className="space-y-6">
        {children}
      </div>
    </AppLayout>
  )
}

// Specialized layout for AI demo pages
export function AILayout({ 
  children, 
  title, 
  description, 
  actions,
  className 
}: AppLayoutProps) {
  return (
    <AppLayout 
      title={title} 
      description={description} 
      actions={actions}
      className={cn('bg-gradient-to-br from-blue-50 via-white to-purple-50', className)}
    >
      <div className="space-y-8">
        {children}
      </div>
    </AppLayout>
  )
}