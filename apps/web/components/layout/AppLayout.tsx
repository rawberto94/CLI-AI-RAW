'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

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
          className="sticky top-16 lg:top-0 z-20 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70"
        >
          <div className="flex h-14 md:h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              {title && (
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                    {title}
                  </h1>
                  {description && (
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate hidden sm:block">{description}</p>
                  )}
                </div>
              )}
            </div>
            
            {actions && (
              <div className="flex items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>
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
      className={cn('bg-gradient-to-br from-violet-50/50 via-white to-purple-50/50', className)}
    >
      <div className="space-y-8">
        {children}
      </div>
    </AppLayout>
  )
}