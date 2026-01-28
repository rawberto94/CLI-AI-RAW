/**
 * Theme Provider and Dark Mode Toggle
 * Provides system, light, and dark theme options
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme'
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Initialize theme from storage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
  }, [storageKey]);

  // Update resolved theme when theme or system preference changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        root.classList.remove('light', 'dark');
        root.classList.add(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
  };

  // Prevent flash of incorrect theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Theme Toggle Button - Cycles through themes
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme as Theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      setTheme(nextTheme);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className={cn('w-9 h-9 p-0', className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {theme === 'light' && <Sun className="h-4 w-4" />}
          {theme === 'dark' && <Moon className="h-4 w-4" />}
          {theme === 'system' && <Monitor className="h-4 w-4" />}
        </motion.div>
      </AnimatePresence>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

/**
 * Theme Selector Dropdown
 */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const themes = [
    { value: 'light' as Theme, label: 'Light', icon: Sun },
    { value: 'dark' as Theme, label: 'Dark', icon: Moon },
    { value: 'system' as Theme, label: 'System', icon: Monitor }
  ];

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="w-full justify-start gap-2"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="capitalize">{theme}</span>
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50"
            >
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    setTheme(value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    theme === value
                      ? 'bg-violet-50 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {theme === value && <Check className="h-4 w-4 ml-auto" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Inline Theme Switch
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div
      className={cn(
        'relative inline-flex h-8 w-[120px] rounded-full bg-gray-100 dark:bg-gray-800 p-1',
        className
      )}
    >
      <motion.div
        className="absolute h-6 w-[36px] rounded-full bg-white dark:bg-gray-700 shadow-sm"
        animate={{
          x: theme === 'light' ? 0 : theme === 'dark' ? 38 : 76
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
      {[
        { value: 'light' as Theme, icon: Sun },
        { value: 'dark' as Theme, icon: Moon },
        { value: 'system' as Theme, icon: Monitor }
      ].map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'relative z-10 flex-1 flex items-center justify-center transition-colors',
            theme === value
              ? 'text-gray-900 dark:text-gray-100'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export default ThemeProvider;
