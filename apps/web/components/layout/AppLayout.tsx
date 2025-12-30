'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Bell, User, Search, Sparkles } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export default function AppLayout({ 
  children, 
  title, 
  description, 
  actions,
  className 
}: AppLayoutProps) {
  return (
    <>
      {/* Top Bar */}
      {(title || actions) && (
        <motion.header 
          role="banner"
          aria-label="Page header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-16 lg:top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70"
        >
          {/* Decorative accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          
          <div className="flex h-14 md:h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {title && (
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent truncate">
                    {title}
                  </h1>
                  {description && (
                    <p className="text-xs md:text-sm text-slate-500 truncate hidden sm:block">{description}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              {/* Search - hidden on mobile */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden md:flex h-9 w-9 rounded-xl hover:bg-slate-100/80" 
                aria-label="Search contracts"
              >
                <Search className="h-4 w-4 text-slate-500" />
              </Button>
              
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-xl hover:bg-slate-100/80" 
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-slate-500" />
              </Button>
              
              {/* User Menu */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-xl hover:bg-slate-100/80" 
                aria-label="User menu"
              >
                <User className="h-4 w-4 text-slate-500" />
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
        </motion.header>
      )}

      {/* Page Content */}
      <main 
        role="main" 
        id="main-content" 
        aria-label={title || 'Main content'}
        className={cn('flex-1 w-full max-w-full overflow-x-hidden', className)}
      >
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
      className={cn('bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50', className)}
    >
      <div className="space-y-8">
        {children}
      </div>
    </AppLayout>
  )
}