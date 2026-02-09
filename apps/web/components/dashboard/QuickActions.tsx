/**
 * Contracts Dashboard - Quick Actions Grid
 * Fast access to common contract management actions
 * Only shows currently ACTIVE features
 * See UNUSED_FILES.md for future upgrades
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Upload, 
  Search, 
  BarChart3, 
  Zap,
  MessageSquare,
  Keyboard,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: string;
  gradient: string;
  shadowColor: string;
  badge?: string | number;
  isNew?: boolean;
}

// Only ACTIVE features - see UNUSED_FILES.md for future upgrades
const actions: QuickAction[] = [
  {
    icon: Upload,
    label: "Upload Contract",
    description: "Add new contracts",
    href: "/upload",
    color: "blue",
    gradient: "from-violet-500 to-purple-500",
    shadowColor: "shadow-violet-500/20"
  },
  {
    icon: MessageSquare,
    label: "AI Assistant",
    description: "Ask anything",
    href: "/ai/chat",
    color: "purple",
    gradient: "from-violet-500 to-pink-500",
    shadowColor: "shadow-violet-500/20"
  },
  {
    icon: Search,
    label: "Smart Search",
    description: "Find contracts",
    href: "/search",
    color: "emerald",
    gradient: "from-violet-500 to-violet-500",
    shadowColor: "shadow-violet-500/20"
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "View reports",
    href: "/analytics",
    color: "amber",
    gradient: "from-amber-500 to-orange-500",
    shadowColor: "shadow-amber-500/20"
  },
  // FUTURE UPGRADES - Uncomment when ready:
  // {
  //   icon: Zap,
  //   label: "Intelligence",
  //   description: "AI-powered insights",
  //   href: "/intelligence",
  //   color: "purple",
  //   gradient: "from-violet-500 to-pink-500",
  //   shadowColor: "shadow-violet-500/20",
  //   isNew: true
  // },
  // {
  //   icon: CheckCircle2,
  //   label: "Approvals",
  //   description: "Pending items",
  //   href: "/approvals",
  //   color: "amber",
  //   gradient: "from-amber-500 to-orange-500",
  //   shadowColor: "shadow-amber-500/20",
  //   badge: 4
  // },
  // {
  //   icon: Calendar,
  //   label: "Renewals",
  //   description: "Upcoming renewals",
  //   href: "/renewals",
  //   color: "green",
  //   gradient: "from-violet-500 to-purple-500",
  //   shadowColor: "shadow-violet-500/20",
  //   badge: 2
  // },
  // {
  //   icon: Shield,
  //   label: "Governance",
  //   description: "Policies & compliance",
  //   href: "/governance",
  //   color: "slate",
  //   gradient: "from-slate-600 to-slate-700",
  //   shadowColor: "shadow-slate-500/20",
  //   isNew: true
  // }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-violet-100/50 dark:border-violet-800/30 shadow-xl shadow-violet-500/5">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent rounded-full -translate-y-1/2 -translate-x-1/2" />
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30">
                <Zap className="h-4 w-4" />
              </div>
              Quick Actions
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-violet-50 dark:bg-violet-950/50 px-2.5 py-1 rounded-full border border-violet-100 dark:border-violet-800/50">
              <Keyboard className="h-3 w-3" />
              <span>Press ? for shortcuts</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
        </CardHeader>
        <CardContent>
          <motion.div 
            className="grid grid-cols-2 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.label} variants={itemVariants}>
                  <Link href={action.href}>
                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        variant="outline" 
                        className={`h-auto w-full flex flex-col items-center gap-2 py-5 transition-all relative group bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-violet-50/50 dark:hover:bg-violet-950/30 hover:border-violet-200 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/10 rounded-xl`}
                      >
                        {action.isNew && (
                          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] px-2 py-0.5 shadow-lg shadow-violet-500/30 border-0">
                            NEW
                          </Badge>
                        )}
                        {action.badge && (
                          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] px-2 py-0.5 shadow-lg shadow-rose-500/30 border-0 animate-pulse">
                            {action.badge}
                          </Badge>
                        )}
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-md ${action.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-sm">{action.label}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
