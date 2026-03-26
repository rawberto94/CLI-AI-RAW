/**
 * Document Analytics Page
 * Comprehensive analytics for document classification and signature status
 */

import { Metadata } from "next";
import dynamic from "next/dynamic";

const DocumentAnalyticsCharts = dynamic(
  () => import("@/components/dashboard/DocumentAnalyticsCharts"),
  { loading: () => <div className="h-64 bg-slate-100 rounded-lg animate-pulse" /> }
);

export const metadata: Metadata = {
  title: "Document Analytics | Contigo",
  description: "Analytics and insights for document classification and signature status",
};

export default function DocumentAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Analytics</h1>
          <p className="text-muted-foreground">
            Track document classification trends and signature status over time
          </p>
        </div>
      </div>

      <DocumentAnalyticsCharts />
    </div>
  );
}
