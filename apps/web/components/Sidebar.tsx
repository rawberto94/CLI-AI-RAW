"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, memo, useCallback, useMemo, useEffect } from "react";
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
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  description?: string;
}

// Simplified navigation - Core features only
const navigationGroups: NavGroup[] = [
  {
    id: 'core',
    label: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { href: "/", label: "Dashboard", icon: Home, description: "Your contract overview and key metrics" },
      { href: "/contracts", label: "Contracts", icon: FolderOpen, description: "Manage and analyze your contracts" },
    ],
  },
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    icon: MessageSquare,
    defaultOpen: true,
    items: [
      { href: "/ai/chat", label: "AI Chatbot", icon: MessageSquare, description: "Ask questions about your contracts" },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { href: "/analytics", label: "Reports", icon: Presentation, description: "View insights and reports" },
    ],
  },
];

// Collapsible nav group component - memoized for performance
const NavGroupSection = memo(function NavGroupSection({ 
  group, 
  pathname 
}: { 
  group: NavGroup; 
  pathname: string 
}) {
  const [isOpen, setIsOpen] = useState(group.defaultOpen ?? false);
  
  // Memoize active state calculation
  const hasActiveItem = useMemo(
    () => group.items.some(item => pathname === item.href),
    [group.items, pathname]
  );
  
  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);
  const Icon = group.icon;

  return (
    <div className="mb-1">
      <button
        onClick={toggleOpen}
        className={cn(
          "flex items-center w-full gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all",
          "hover:bg-slate-100/80",
          hasActiveItem 
            ? "text-blue-700 bg-blue-50/50" 
            : "text-slate-600"
        )}
      >
        <Icon className={cn("h-4 w-4", hasActiveItem && "text-blue-600")} />
        <span className="flex-1 text-left">{group.label}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="ml-4 mt-1.5 space-y-0.5 border-l-2 border-slate-200/60 pl-2">
          {group.items.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
});

// Memoized nav item component
const NavItem = memo(function NavItem({ 
  item, 
  pathname 
}: { 
  item: NavItem; 
  pathname: string 
}) {
  const active = pathname === item.href;
  const ItemIcon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all",
        active 
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-semibold shadow-sm" 
          : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
      )}
    >
      <ItemIcon className={cn("h-3.5 w-3.5", active && "text-blue-600")} />
      <span className="flex-1">{item.label}</span>
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
  );
});

export function Sidebar() {
  const pathname = usePathname();
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Check if user is new (first visit)
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('pactum-tutorial-seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem('pactum-tutorial-seen', 'true');
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem('pactum-tutorial-seen');
    setShowTutorial(true);
  }, []);
  
  return (
    <aside className="hidden border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 md:block shadow-sm">
      <div className="flex h-full max-h-screen flex-col">
        {/* Header */}
        <div className="flex h-14 items-center border-b border-slate-200/60 px-4 lg:h-[60px] lg:px-5 bg-white/80 backdrop-blur-sm">
          <ConTigoLogoSVG size="md" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Notifications</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Welcome Tutorial Banner */}
        {showTutorial && (
          <div className="p-3 border-b border-slate-200/60">
            <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <button 
                onClick={dismissTutorial}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Welcome to ConTigo!</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Start by uploading a contract or ask the AI Chatbot to help you analyze your documents.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link href="/contracts">
                      <Button size="sm" className="h-7 text-xs rounded-lg bg-blue-600 hover:bg-blue-700">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        Explore Contracts
                      </Button>
                    </Link>
                    <Link href="/ai/chat">
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Try AI Chat
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <nav className="space-y-1">
            {navigationGroups.map((group) => (
              <NavGroupSection key={group.id} group={group} pathname={pathname} />
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200/60 space-y-2 bg-white/50">
          {/* Help & Tutorial Button */}
          <button
            onClick={resetTutorial}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Show Welcome Guide</span>
          </button>
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-slate-400">v1.0.0</span>
            <Link href="/settings" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
