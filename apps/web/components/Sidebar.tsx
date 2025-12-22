"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, memo, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  FolderOpen,
  Bell,
  FileText,
  Presentation,
  Sparkles,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  BarChart3,
  HelpCircle,
  X,
  Upload,
  Search,
  Zap,
  Shield,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Menu,
  ArrowLeftRight,
  GraduationCap,
  BookOpen,
  Rocket,
  PlayCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ConTigoLogoSVG } from "./ui/ConTigoLogo";
import { cn } from "@/lib/utils";

// Navigation group type
interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
  gradient?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  description?: string;
  isNew?: boolean;
  tourId?: string; // For onboarding tour targeting
}

// Navigation groups - ONLY showing currently active features
// See UNUSED_FILES.md for future upgrades (Renewals, Approvals, etc.)
const navigationGroups: NavGroup[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Rocket,
    defaultOpen: true,
    gradient: 'from-violet-500 to-purple-500',
    items: [
      { href: "/tour", label: "App Tour", icon: PlayCircle, description: "Interactive walkthrough of all features", isNew: true, tourId: "app-tour" },
      { href: "/tour#learn", label: "Learning Center", icon: GraduationCap, description: "Tutorials and best practices", tourId: "learning-center" },
      { href: "/tour#guides", label: "Feature Guides", icon: BookOpen, description: "Step-by-step feature guides", tourId: "feature-guides" },
    ],
  },
  {
    id: 'core',
    label: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    gradient: 'from-blue-500 to-indigo-500',
    items: [
      { href: "/", label: "Dashboard", icon: Home, description: "Your contract overview and key metrics", tourId: "dashboard" },
      { href: "/contracts", label: "Contracts", icon: FolderOpen, description: "Manage and analyze your contracts", tourId: "contracts" },
      { href: "/upload", label: "Upload", icon: Upload, description: "Add new contracts", tourId: "upload" },
    ],
  },
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    icon: Sparkles,
    defaultOpen: true,
    gradient: 'from-purple-500 to-pink-500',
    items: [
      { href: "/ai/chat", label: "AI Assistant", icon: MessageSquare, description: "Ask questions about your contracts", isNew: true, tourId: "ai-assistant" },
      { href: "/search", label: "Smart Search", icon: Search, description: "AI-powered contract search", tourId: "smart-search" },
      { href: "/compare", label: "Compare", icon: ArrowLeftRight, description: "Compare contracts side by side", tourId: "compare" },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    defaultOpen: false,
    gradient: 'from-amber-500 to-orange-500',
    items: [
      { href: "/analytics", label: "Reports", icon: Presentation, description: "View insights and reports", tourId: "analytics" },
    ],
  },
  // FUTURE UPGRADES - Uncomment when ready:
  // {
  //   id: 'management',
  //   label: 'Management',
  //   icon: Calendar,
  //   defaultOpen: false,
  //   gradient: 'from-emerald-500 to-teal-500',
  //   items: [
  //     { href: "/renewals", label: "Renewals", icon: Clock, description: "Track contract renewals" },
  //     { href: "/approvals", label: "Approvals", icon: Shield, description: "Pending approvals queue" },
  //     { href: "/compliance", label: "Compliance", icon: Shield, description: "Compliance monitoring" },
  //     { href: "/governance", label: "Governance", icon: Shield, description: "Policies & compliance" },
  //   ],
  // },
];

function isPathActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Collapsible nav group component - memoized for performance
const NavGroupSection = memo(function NavGroupSection({ 
  group, 
  pathname 
}: { 
  group: NavGroup; 
  pathname: string 
}) {
  const [isOpen, setIsOpen] = useState(group.defaultOpen ?? false);
  const contentId = `nav-group-${group.id}`;
  
  // Memoize active state calculation
  const hasActiveItem = useMemo(
    () => group.items.some(item => isPathActive(pathname, item.href)),
    [group.items, pathname]
  );
  
  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);
  const Icon = group.icon;

  return (
    <div className="mb-2">
      <motion.button
        type="button"
        onClick={toggleOpen}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "flex items-center w-full gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
          "hover:bg-gradient-to-r hover:from-slate-100/80 hover:to-slate-50/50",
          hasActiveItem 
            ? "text-slate-900 bg-gradient-to-r from-slate-100 to-slate-50" 
            : "text-slate-600"
        )}
      >
        <div className={cn(
          "p-1.5 rounded-lg transition-all",
          hasActiveItem 
            ? `bg-gradient-to-br ${group.gradient} text-white shadow-sm` 
            : "bg-slate-100 text-slate-500"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-left">{group.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.div>
      </motion.button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-1.5 space-y-0.5 border-l-2 border-slate-200/60 pl-2">
              {group.items.map((item) => (
                <NavItemComponent key={item.href} item={item} pathname={pathname} gradient={group.gradient} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Memoized nav item component
const NavItemComponent = memo(function NavItemComponent({ 
  item, 
  pathname,
  gradient
}: { 
  item: NavItem; 
  pathname: string;
  gradient?: string;
}) {
  const active = isPathActive(pathname, item.href);
  const ItemIcon = item.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          data-tour={item.tourId}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-200",
            active
              ? `bg-gradient-to-r ${gradient || 'from-blue-50 to-indigo-50'} text-slate-900 font-semibold shadow-sm border border-slate-200/50`
              : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
          )}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            className={cn(
              "p-1 rounded-md transition-all",
              active
                ? `bg-gradient-to-br ${gradient} text-white shadow-sm`
                : "bg-transparent text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
            )}
          >
            <ItemIcon className="h-3.5 w-3.5" />
          </motion.div>
          <span className="flex-1">{item.label}</span>
          {item.isNew && (
            <Badge className="h-4 px-1.5 text-[9px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 animate-pulse">
              NEW
            </Badge>
          )}
          {item.badge && (
            <Badge
              variant={item.badgeVariant || "secondary"}
              className={cn(
                "h-5 px-1.5 text-[10px] font-bold rounded-full",
                item.badgeVariant === 'destructive'
                  ? "bg-gradient-to-r from-rose-100 to-red-100 text-rose-700"
                  : "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700"
              )}
            >
              {item.badge}
            </Badge>
          )}
        </Link>
      </TooltipTrigger>
      {item.description && (
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs">{item.description}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
});

// Mobile hamburger button (exported for use in layout)
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={onClick}
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

// Mobile sidebar overlay
function MobileSidebar({ 
  isOpen, 
  onClose, 
  pathname,
  resetTutorial 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  pathname: string;
  resetTutorial: () => void;
}) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          
          {/* Sidebar drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-gradient-to-b from-white via-slate-50/30 to-slate-100/50 shadow-2xl z-50 md:hidden overflow-y-auto"
          >
            {/* Close button */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
              <ConTigoLogoSVG size="md" />
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close navigation menu"
                className="h-10 w-10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Navigation */}
            <TooltipProvider delayDuration={500}>
              <nav className="p-4 space-y-2">
                {navigationGroups.map((group) => (
                  <NavGroupSection key={group.id} group={group} pathname={pathname} />
                ))}
              </nav>
            </TooltipProvider>
            
            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200/60 bg-white/90 backdrop-blur-sm">
              {/* Guided Tour CTA */}
              <Link
                href="/tour"
                onClick={onClose}
                className="flex items-center gap-3 w-full px-3 py-2.5 mb-3 text-sm rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/25"
              >
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <PlayCircle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold">Start Guided Tour</span>
                  <span className="block text-[10px] text-white/80">Learn all features</span>
                </div>
                <ChevronRight className="h-4 w-4 text-white/70" />
              </Link>
              
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={resetTutorial}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="font-medium">Quick Start Guide</span>
                </button>
                
                <Link href="/tour#learn" onClick={onClose}>
                  <div className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                    <GraduationCap className="h-4 w-4" />
                    <span className="font-medium">Learning Center</span>
                  </div>
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [showTutorial, setShowTutorial] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const welcomeBannerKey = 'contigo-welcome-banner-dismissed';
  const legacyWelcomeBannerKey = 'pactum-tutorial-seen';
  
  // Check if user is new (first visit)
  useEffect(() => {
    const dismissed = localStorage.getItem(welcomeBannerKey) || localStorage.getItem(legacyWelcomeBannerKey);
    if (!dismissed) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(welcomeBannerKey, 'true');
    localStorage.setItem(legacyWelcomeBannerKey, 'true');
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(welcomeBannerKey);
    localStorage.removeItem(legacyWelcomeBannerKey);
    localStorage.removeItem('contigo-tutorial-completed');
    setShowTutorial(true);
    // Dispatch event to trigger the main tutorial
    window.dispatchEvent(new CustomEvent('show-tutorial'));
  }, []);
  
  return (
    <aside className="hidden border-r border-slate-200/60 bg-gradient-to-b from-white via-slate-50/30 to-slate-100/50 md:block shadow-sm backdrop-blur-sm">
      <TooltipProvider delayDuration={500}>
        <div className="flex h-full max-h-screen flex-col">
        {/* Header with enhanced branding */}
        <div className="flex h-16 items-center border-b border-slate-200/60 px-4 lg:px-5 bg-white/80 backdrop-blur-xl">
          <ConTigoLogoSVG size="md" />
          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  aria-label="Notifications"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <Bell className="h-4 w-4" />
                  {/* Notification dot */}
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-3 py-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Link
                    href="/upload"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </Link>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Upload new contracts</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Link
                    href="/search"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search
                  </Link>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Search contracts</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Welcome Tutorial Banner */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 border-b border-slate-200/60">
                <div className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100 shadow-sm">
                  <motion.button 
                    type="button"
                    onClick={dismissTutorial}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    aria-label="Dismiss welcome banner"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-white/50 transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                  <div className="flex items-start gap-3">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30"
                    >
                      <Sparkles className="h-5 w-5 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Welcome to ConTigo!</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        AI-powered contract intelligence at your fingertips.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Link href="/contracts">
                            <Button size="sm" className="h-7 text-xs rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md shadow-purple-500/25">
                              <FolderOpen className="h-3 w-3 mr-1" />
                              Explore
                            </Button>
                          </Link>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Link href="/ai/chat">
                            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg border-purple-200 text-purple-700 hover:bg-purple-50">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              AI Chat
                            </Button>
                          </Link>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <nav className="space-y-1">
            {navigationGroups.map((group) => (
              <NavGroupSection key={group.id} group={group} pathname={pathname} />
            ))}
          </nav>
        </div>

        {/* Footer with enhanced styling */}
        <div className="p-3 border-t border-slate-200/60 bg-gradient-to-t from-slate-100/80 to-transparent">
          {/* Guided Tour CTA */}
          <motion.div 
            whileHover={{ scale: 1.01 }} 
            whileTap={{ scale: 0.99 }}
            className="mb-3"
          >
            <Link
              href="/tour"
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              <div className="p-1.5 bg-white/20 rounded-lg">
                <PlayCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">Start Guided Tour</span>
                <span className="block text-[10px] text-white/80">Learn all features in 5 min</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/70" />
            </Link>
          </motion.div>
          
          {/* Quick Actions */}
          <div className="space-y-1 mb-2">
            {/* Welcome Guide */}
            <motion.button
              type="button"
              onClick={resetTutorial}
              whileHover={{ x: 2 }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">Quick Start Guide</span>
            </motion.button>
            
            {/* Learning Center Link */}
            <Link href="/tour#learn">
              <motion.div
                whileHover={{ x: 2 }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
              >
                <GraduationCap className="h-4 w-4" />
                <span className="font-medium">Learning Center</span>
              </motion.div>
            </Link>
            
            {/* Keyboard Shortcuts */}
            <motion.button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('openKeyboardShortcuts'))}
              whileHover={{ x: 2 }}
              className="flex items-center justify-between w-full px-3 py-2 text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                  <path d="M6 8h.01"></path>
                  <path d="M10 8h.01"></path>
                  <path d="M14 8h.01"></path>
                  <path d="M18 8h.01"></path>
                  <path d="M6 12h.01"></path>
                  <path d="M18 12h.01"></path>
                  <path d="M10 12h8"></path>
                  <path d="M6 16h12"></path>
                </svg>
                <span className="font-medium">Keyboard Shortcuts</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 rounded">?</kbd>
            </motion.button>
          </div>
          
          <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium">System Online</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">v1.0</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings" aria-label="Settings">
                    <motion.div 
                      whileHover={{ rotate: 90 }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      <Settings className="h-4 w-4" />
                    </motion.div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        </div>
      </TooltipProvider>
      
      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        pathname={pathname}
        resetTutorial={resetTutorial}
      />
    </aside>
  );
}

// Export context for mobile menu control from layout
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
