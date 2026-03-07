/**
 * Document Analytics Page
 * Comprehensive analytics for document classification and signature status
 */

import { Metadata } from "next";
import DocumentAnalyticsCharts from "@/components/dashboard/DocumentAnalyticsCharts";

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
