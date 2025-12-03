"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, memo, useCallback, useMemo } from "react";
import {
  Home,
  FolderOpen,
  Building2,
  FileEdit,
  Layers,
  Percent,
  ShieldAlert,
  AlertTriangle,
  Upload,
  Bell,
  FileText,
  Presentation,
  Sparkles,
  Play,
  Rocket,
  Tag,
  CreditCard,
  CheckCircle,
  GitBranch,
  Clock,
  Search,
  MessageSquare,
  Brain,
  Calendar,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Workflow,
  BarChart3,
  Wrench,
  Zap,
  Heart,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
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
}

// Consolidated navigation groups
const navigationGroups: NavGroup[] = [
  {
    id: 'core',
    label: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/contracts", label: "Contracts", icon: FolderOpen },
      { href: "/upload", label: "Upload", icon: Upload },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: Workflow,
    defaultOpen: true,
    items: [
      { href: "/workflows", label: "Workflows", icon: Workflow, badge: "4" },
      { href: "/deadlines", label: "Deadlines", icon: Clock, badge: "5", badgeVariant: 'destructive' },
      { href: "/renewals", label: "Renewals", icon: Calendar },
    ],
  },
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    icon: Brain,
    defaultOpen: true,
    items: [
      { href: "/ai/chat", label: "AI Assistant", icon: MessageSquare },
      { href: "/search/advanced", label: "Smart Search", icon: Search },
      { href: "/ai/compare", label: "Compare", icon: Brain },
      { href: "/intelligence/health", label: "Health Score", icon: Heart },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      { href: "/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/rate-cards", label: "Rate Cards", icon: CreditCard },
      { href: "/benchmarks", label: "Benchmarks", icon: Percent },
      { href: "/analytics", label: "Reports", icon: Presentation },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance & Risk',
    icon: ShieldAlert,
    items: [
      { href: "/compliance", label: "Compliance", icon: ShieldAlert },
      { href: "/risk", label: "Risk Analysis", icon: AlertTriangle },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    items: [
      { href: "/drafts", label: "Draft Editor", icon: FileEdit },
      { href: "/settings/taxonomy", label: "Taxonomy", icon: Tag },
      { href: "/automation", label: "Automation", icon: Sparkles },
      { href: "/runs", label: "Pipeline Runs", icon: Layers },
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
  
  return (
    <aside className="hidden border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 md:block shadow-sm">
      <div className="flex h-full max-h-screen flex-col">
        {/* Header */}
        <div className="flex h-14 items-center border-b border-slate-200/60 px-4 lg:h-[60px] lg:px-5 bg-white/80 backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
              <FileText className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">PactumAI</span>
              <span className="text-[10px] text-slate-500 -mt-0.5">Contract Intelligence</span>
            </div>
          </Link>
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

        {/* Quick Actions - Featured Demo */}
        <div className="p-3 border-b border-slate-200/60">
          <Link
            href="/futuristic-contracts"
            className={cn(
              "flex items-center gap-3 p-3.5 rounded-xl transition-all",
              "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
              "text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02]"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">AI Intelligence Hub</div>
              <div className="text-[11px] text-blue-100">Full AI-powered experience</div>
            </div>
            <Sparkles className="h-4 w-4 animate-pulse" />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <nav className="space-y-1">
            {navigationGroups.map((group) => (
              <NavGroupSection key={group.id} group={group} pathname={pathname} />
            ))}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200/60 space-y-2 bg-white/50">
          <Link href="/upload" className="block">
            <Button size="sm" className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 rounded-xl shadow-lg shadow-slate-900/20">
              <Upload className="mr-2 h-4 w-4" />
              Upload Contract
            </Button>
          </Link>
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
