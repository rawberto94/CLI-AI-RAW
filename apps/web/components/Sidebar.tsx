"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

// Core navigation items
const coreItems = [
  { href: "/", label: "Dashboard", Icon: Home, section: "main" },
  { href: "/contracts", label: "Contracts", Icon: FolderOpen, section: "main" },
  { href: "/upload", label: "Upload", Icon: Upload, section: "main" },
];

// Workflow and collaboration items
const workflowItems = [
  { href: "/approvals", label: "Approvals", Icon: CheckCircle, badge: "2", section: "workflow" },
  { href: "/workflows", label: "Workflows", Icon: GitBranch, section: "workflow" },
  { href: "/deadlines", label: "Deadlines", Icon: Clock, badge: "5", section: "workflow" },
  { href: "/renewals", label: "Renewals", Icon: Calendar, section: "workflow" },
];

// AI & Intelligence items
const aiItems = [
  { href: "/ai/chat", label: "AI Chat", Icon: MessageSquare, section: "ai" },
  { href: "/search/advanced", label: "AI Search", Icon: Search, section: "ai" },
  { href: "/ai/compare", label: "Compare", Icon: Brain, section: "ai" },
];

// Analysis items
const analysisItems = [
  { href: "/suppliers", label: "Suppliers", Icon: Building2, section: "analysis" },
  { href: "/rate-cards", label: "Rate Cards", Icon: CreditCard, section: "analysis" },
  { href: "/benchmarks", label: "Benchmarks", Icon: Percent, section: "analysis" },
  { href: "/compliance", label: "Compliance", Icon: ShieldAlert, section: "analysis" },
  { href: "/risk", label: "Risk", Icon: AlertTriangle, section: "analysis" },
  { href: "/analytics", label: "Analytics", Icon: Presentation, section: "analysis" },
];

// Tools and settings
const toolsItems = [
  { href: "/drafts", label: "Draft Editor", Icon: FileEdit, section: "tools" },
  { href: "/taxonomy", label: "Taxonomy", Icon: Tag, section: "tools" },
  { href: "/automation", label: "Automation", Icon: Sparkles, section: "tools" },
  { href: "/runs", label: "Runs", Icon: Layers, section: "tools" },
];

const demoItems = [
  {
    href: "/futuristic-contracts",
    label: "AI Intelligence Hub",
    Icon: Sparkles,
    badge: "Live Demo",
    description: "Complete AI-powered contract intelligence",
  },
  {
    href: "/pilot-demo",
    label: "Executive Pilot Demo",
    Icon: Rocket,
    badge: "CTO Ready",
    description: "Executive presentation demo",
  },
  {
    href: "/mvp",
    label: "MVP Showcase",
    Icon: Play,
    badge: "Interactive",
    description: "Core functionality demo",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileText className="h-6 w-6" />
            <span className="">Contract Intelligence</span>
          </Link>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-auto h-8 w-8"
                >
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Toggle notifications</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex-1">
          {/* AI Intelligence Demo Section */}
          <div className="px-2 lg:px-4 mb-4">
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                AI Intelligence Platform
              </h3>
            </div>

            {demoItems.map(({ href, label, Icon, badge, description }) => {
              const active = pathname === href;
              const isMainDemo = href === "/futuristic-contracts";

              return (
                <div key={href} className="mb-2">
                  {isMainDemo ? (
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-1">
                      <Link
                        href={href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-white transition-all hover:bg-white/10 ${
                          active ? "bg-white/20" : ""
                        }`}
                      >
                        <div className="p-1 bg-white/20 rounded-full">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">
                              {label}
                            </span>
                            {badge && (
                              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                                {badge}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-blue-100">
                            {description}
                          </span>
                        </div>
                        <Sparkles className="h-4 w-4 ml-auto animate-pulse" />
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted/50 ${
                        active ? "bg-muted text-primary" : ""
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{label}</span>
                          {badge && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {description}
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Separator */}
          <div className="px-2 lg:px-4 mb-4">
            <div className="border-t border-muted"></div>
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                Core Platform
              </h3>
            </div>
          </div>

          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 gap-0.5">
            {/* Core Items */}
            {coreItems.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                    active ? "bg-muted text-primary" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            
            {/* Workflow Section */}
            <div className="mt-4 mb-2">
              <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workflow & Collaboration
              </span>
            </div>
            {workflowItems.map(({ href, label, Icon, badge }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                    active ? "bg-muted text-primary" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-100 text-blue-700">
                      {badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
            
            {/* AI Section */}
            <div className="mt-4 mb-2">
              <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                AI & Intelligence
              </span>
            </div>
            {aiItems.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                    active ? "bg-muted text-primary" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            
            {/* Analysis Section */}
            <div className="mt-4 mb-2">
              <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Analysis
              </span>
            </div>
            {analysisItems.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                    active ? "bg-muted text-primary" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            
            {/* Tools Section */}
            <div className="mt-4 mb-2">
              <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tools
              </span>
            </div>
            {toolsItems.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                    active ? "bg-muted text-primary" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Link href="/upload" className="block">
            <Button size="sm" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Upload Contract
            </Button>
          </Link>
        </div>
        <div className="p-3 border-t text-xs text-slate-500 dark:border-slate-800">
          Contract Intelligence Platform v1.0
        </div>
      </div>
    </aside>
  );
}
