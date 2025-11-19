/**
 * Contracts Dashboard - Quick Actions Grid
 * Fast access to common contract management actions
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Search, 
  FileText, 
  BarChart3, 
  Bell,
  Calendar,
  Filter,
  Download,
  Zap
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
  icon: any;
  label: string;
  description: string;
  href: string;
  color: string;
}

const actions: QuickAction[] = [
  {
    icon: Upload,
    label: "Upload Contract",
    description: "Add new contracts",
    href: "/upload",
    color: "blue"
  },
  {
    icon: Search,
    label: "Search",
    description: "Find contracts quickly",
    href: "/search",
    color: "purple"
  },
  {
    icon: FileText,
    label: "All Contracts",
    description: "Browse all contracts",
    href: "/contracts",
    color: "green"
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "View insights",
    href: "/analytics",
    color: "orange"
  },
  {
    icon: Calendar,
    label: "Renewals",
    description: "Manage renewals",
    href: "/contracts?filter=expiring",
    color: "red"
  },
  {
    icon: Bell,
    label: "Alerts",
    description: "View notifications",
    href: "/alerts",
    color: "yellow"
  }
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          Quick Actions
        </CardTitle>
        <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <Button 
                  variant="outline" 
                  className="h-auto w-full flex flex-col items-center gap-2 py-4 hover:shadow-md transition-all"
                >
                  <Icon className={`h-6 w-6 text-${action.color}-600`} />
                  <div className="text-center">
                    <div className="font-semibold text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.description}</div>
                  </div>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
