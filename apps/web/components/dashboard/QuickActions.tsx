/**
 * Contracts Dashboard - Quick Actions Grid
 * Fast access to common contract management actions
 * Updated with new innovation modules
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Search, 
  FileText, 
  BarChart3, 
  Calendar,
  Zap,
  Sparkles,
  CheckCircle2,
  Shield,
  Keyboard,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
  icon: any;
  label: string;
  description: string;
  href: string;
  color: string;
  badge?: string | number;
  isNew?: boolean;
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
    icon: Zap,
    label: "Intelligence",
    description: "AI-powered insights",
    href: "/intelligence",
    color: "purple",
    isNew: true
  },
  {
    icon: Sparkles,
    label: "Generate",
    description: "Create contracts",
    href: "/generate",
    color: "indigo",
    isNew: true
  },
  {
    icon: CheckCircle2,
    label: "Approvals",
    description: "Pending items",
    href: "/approvals",
    color: "amber",
    badge: 4
  },
  {
    icon: Calendar,
    label: "Renewals",
    description: "Upcoming renewals",
    href: "/renewals",
    color: "green",
    badge: 2
  },
  {
    icon: Shield,
    label: "Governance",
    description: "Policies & compliance",
    href: "/governance",
    color: "slate",
    isNew: true
  }
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Quick Actions
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            <span>Press ? for shortcuts</span>
          </div>
        </div>
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
                  className="h-auto w-full flex flex-col items-center gap-2 py-4 hover:shadow-md transition-all relative group"
                >
                  {action.isNew && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] px-1.5 py-0.5">
                      NEW
                    </Badge>
                  )}
                  {action.badge && (
                    <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5">
                      {action.badge}
                    </Badge>
                  )}
                  <Icon className={`h-6 w-6 text-${action.color}-600 group-hover:scale-110 transition-transform`} />
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
