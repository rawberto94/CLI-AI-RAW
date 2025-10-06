'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/design-system'
import { Button } from '@/components/ui/button'
import { Bell, User, Search } from 'lucide-react'

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
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              {title && (
                <div>
                  <h1 className="text-xl font-semibold">{title}</h1>
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <Button variant="ghost" size="sm" className="hidden md:flex">
                <Search className="h-4 w-4 mr-2" />
                Search contracts...
              </Button>
              
              {/* Notifications */}
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              
              {/* User Menu */}
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
              </Button>
              
              {/* Custom Actions */}
              {actions}
            </div>
          </div>
        </header>
      )}

      {/* Page Content */}
      <main className={cn('flex-1', className)}>
        <div className="container mx-auto px-4 lg:px-6 py-6">
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