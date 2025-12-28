"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { User, Settings, LogOut, ChevronDown, Keyboard, HelpCircle, Command, Sparkles, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import IntelligentSearch from "./search/IntelligentSearch"
import IntelligenceNotifications from "./notifications/IntelligenceNotifications"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"
import { signOut } from "next-auth/react"

export function Topbar() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const userInitials = session?.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  // Open keyboard shortcuts modal
  const openShortcuts = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openKeyboardShortcuts'));
  }, []);

  // Open command palette
  const openCommandPalette = useCallback(() => {
    // Simulate Ctrl+K
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  }, []);

  // Open AI assistant
  const openAIAssistant = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openAIChatbot', {
      detail: { autoMessage: 'Hi! How can I help you today?' }
    }));
  }, []);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 sticky top-0 z-20 dark:bg-slate-900/80 dark:border-slate-800">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
          ConTigo
        </h1>
      </div>
      <div className="flex flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial max-w-md">
          <IntelligentSearch />
        </div>

        {/* Quick Action Buttons - Desktop Only */}
        <TooltipProvider delayDuration={300}>
          <div className="hidden md:flex items-center gap-1">
            {/* Command Palette Hint */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openCommandPalette}
                  className="h-8 px-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <Command className="h-4 w-4" />
                  <span className="ml-1.5 text-xs text-slate-400 hidden lg:inline">⌘K</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                <span>Command Palette</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 rounded">⌘K</kbd>
              </TooltipContent>
            </Tooltip>

            {/* AI Assistant */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openAIAssistant}
                  className="h-8 px-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                <span>AI Assistant</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 rounded">⌘/</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Keyboard Shortcuts */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openShortcuts}
                  className="h-8 px-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                <span>Keyboard Shortcuts</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 rounded">?</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Theme Toggle */}
        <ThemeToggle />

        <IntelligenceNotifications />
        
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || 'User'} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xs font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-slate-900 truncate">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {session?.user?.email || ''}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Help & Shortcuts Section */}
            <DropdownMenuItem 
              onClick={openShortcuts}
              className="cursor-pointer"
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Keyboard Shortcuts
              <kbd className="ml-auto text-xs text-slate-400">?</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/ai/chat" className="flex items-center gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4" />
                AI Assistant
                <kbd className="ml-auto text-xs text-slate-400">⌘/</kbd>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a 
                href="https://docs.contigo.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" />
                Help & Docs
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 px-0"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>Toggle theme</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
