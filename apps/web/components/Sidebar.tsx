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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Button } from "./ui/button";

const items = [
  { href: "/", label: "Dashboard", Icon: Home },
  { href: "/contracts", label: "Contracts", Icon: FolderOpen },
  { href: "/suppliers", label: "Suppliers", Icon: Building2 },
  { href: "/drafts", label: "Draft Editor", Icon: FileEdit },
  { href: "/rate-cards", label: "Rate Cards", Icon: CreditCard },
  { href: "/benchmarks", label: "Benchmarks", Icon: Percent },
  { href: "/benchmarks/compare", label: "Compare", Icon: Percent },
  { href: "/compliance", label: "Compliance", Icon: ShieldAlert },
  { href: "/risk", label: "Risk", Icon: AlertTriangle },
  { href: "/taxonomy", label: "Taxonomy", Icon: Tag },
  { href: "/analytics", label: "Analytics", Icon: Presentation },
  { href: "/automation", label: "Automation", Icon: Sparkles },
  { href: "/upload", label: "Upload", Icon: Upload },
  { href: "/runs", label: "Runs", Icon: Layers },
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

          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {items.map(({ href, label, Icon }) => {
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
