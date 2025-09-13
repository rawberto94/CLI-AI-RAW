"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  FolderOpen,
  Building2,
  FileEdit,
  Layers,
  Table2,
  Percent,
  ShieldAlert,
  AlertTriangle,
  ScrollText,
  BarChart3,
  Upload,
  Bell,
  FileText,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import { Button } from "./ui/button"

const items = [
  { href: "/", label: "Dashboard", Icon: Home },
  { href: "/contracts", label: "Contracts", Icon: FolderOpen },
  { href: "/suppliers", label: "Suppliers", Icon: Building2 },
  { href: "/drafts", label: "Draft Editor", Icon: FileEdit },
  { href: "/clauses", label: "Clauses & Playbooks", Icon: Layers },
  { href: "/financials", label: "Financials", Icon: Table2 },
  { href: "/benchmarks", label: "Benchmarks", Icon: Percent },
  { href: "/benchmarks/compare", label: "Compare", Icon: Percent },
  { href: "/compliance", label: "Compliance", Icon: ShieldAlert },
  { href: "/risk", label: "Risk", Icon: AlertTriangle },
  { href: "/reports", label: "Reports", Icon: ScrollText },
  { href: "/analytics", label: "Analytics & Spend", Icon: BarChart3 },
  { href: "/upload", label: "Upload", Icon: Upload },
  { href: "/runs", label: "Runs", Icon: Layers },
]

export function Sidebar() {
  const pathname = usePathname()
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
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {items.map(({ href, label, Icon }) => {
              const active = pathname === href
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
              )
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
          gpt-4.1-mini • PS-2025.3 • Dataset v2025.08
        </div>
      </div>
    </aside>
  )
}

