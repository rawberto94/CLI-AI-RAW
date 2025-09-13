"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { KpiGrid } from "../components/dashboard/kpi-grid"
import { RecentContracts } from "../components/dashboard/recent-contracts"
import { FinancialsTab } from "./components/tabs/FinancialsTab"
import { ComplianceTab } from "./components/tabs/ComplianceTab"
import { BenchmarksTab } from "./components/tabs/BenchmarksTab"
import { ClausesTab } from "./components/tabs/ClausesTab"
import { RiskTab } from "./components/tabs/RiskTab"
import { ReportsTab } from "./components/tabs/ReportsTab"

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="clauses">Clauses</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <KpiGrid />
          <RecentContracts />
        </TabsContent>
        <TabsContent value="financials" className="space-y-4">
          <FinancialsTab />
        </TabsContent>
        <TabsContent value="clauses" className="space-y-4">
          <ClausesTab />
        </TabsContent>
        <TabsContent value="compliance" className="space-y-4">
          <ComplianceTab />
        </TabsContent>
        <TabsContent value="benchmarks" className="space-y-4">
          <BenchmarksTab />
        </TabsContent>
        <TabsContent value="risk" className="space-y-4">
          <RiskTab />
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
