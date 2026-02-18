/**
 * Enhanced App Shell
 * Wraps the app with command palette, onboarding, and theme support
 */

'use client';

import React from 'react';
// @ts-ignore - module may not exist yet
import { CommandPalette, useCommandPalette } from '@/components/command-palette/CommandPalette';
import { OnboardingTour, useOnboardingTour } from '@/components/onboarding/OnboardingTour';
import { NotificationCenter, type Notification } from '@/components/notifications/NotificationCenter';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

interface EnhancedAppShellProps {
  children: React.ReactNode;
}

// Sample notifications for demo - in real app, fetch from API
const sampleNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    category: 'contract',
    title: 'Contract Processed',
    message: 'Acme Corp MSA has been analyzed and is ready for review.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
    actionUrl: '/contracts/acme-corp',
    actionLabel: 'View Contract'
  },
  {
    id: '2',
    type: 'ai',
    category: 'analysis',
    title: 'AI Analysis Complete',
    message: 'Found 3 potential risks and 2 optimization opportunities.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
    actionUrl: '/contracts/tech-services?tab=analysis'
  },
  {
    id: '3',
    type: 'warning',
    category: 'alert',
    title: 'Renewal Alert',
    message: 'Global IT Services contract expires in 15 days.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
    actionUrl: '/contracts/global-it'
  },
  {
    id: '4',
    type: 'info',
    category: 'system',
    title: 'Weekly Report Ready',
    message: 'Your contract portfolio summary for this week is available.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: true,
    actionUrl: '/reports/weekly'
  }
];

export function EnhancedAppShell({ children }: EnhancedAppShellProps) {
  const commandPalette = useCommandPalette();
  const onboarding = useOnboardingTour();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <ThemeProvider>
      {/* Main Content */}
      {children}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={onboarding.isOpen}
        onComplete={onboarding.complete}
        onSkip={onboarding.skip}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onDelete={handleDeleteNotification}
        onClearAll={handleClearAll}
      />
    </ThemeProvider>
  );
}

/**
 * Context for app shell features
 */
interface AppShellContextType {
  openCommandPalette: () => void;
  openNotifications: () => void;
  restartOnboarding: () => void;
}

const AppShellContext = React.createContext<AppShellContextType | null>(null);

export function useAppShell() {
  const context = React.useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within EnhancedAppShell');
  }
  return context;
}

export default EnhancedAppShell;
