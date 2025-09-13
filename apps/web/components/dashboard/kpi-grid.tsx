"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card"
import {
  DollarSign,
  Building2,
  ShieldAlert,
  Target,
  Calendar,
  Hourglass,
  TrendingUp,
} from "lucide-react"

const kpiCards = [
  {
    title: "Total Contract Value",
    value: "$3.7M",
    change: "+12%",
    trend: "up",
    icon: DollarSign,
    color: "text-green-600",
  },
  {
    title: "Active Suppliers",
    value: "24",
    change: "+3",
    trend: "up",
    icon: Building2,
    color: "text-blue-600",
  },
  {
    title: "Compliance Rate",
    value: "94%",
    change: "+2%",
    trend: "up",
    icon: ShieldAlert,
    color: "text-green-600",
  },
  {
    title: "Avg Risk Score",
    value: "78",
    change: "+5",
    trend: "up",
    icon: Target,
    color: "text-yellow-600",
  },
  {
    title: "Contracts Expiring",
    value: "6",
    change: "Next 90 days",
    trend: "neutral",
    icon: Calendar,
    color: "text-orange-600",
  },
  {
    title: "Processing Queue",
    value: "2",
    change: "Active",
    trend: "neutral",
    icon: Hourglass,
    color: "text-blue-600",
  },
]

export function KpiGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card
            key={index}
            className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group cursor-pointer"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <Icon className={`w-4 h-4 text-muted-foreground ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                {kpi.trend === "up" && (
                  <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                )}
                <span
                  className={
                    kpi.trend === "up"
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }
                >
                  {kpi.change}
                </span>
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
