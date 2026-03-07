"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FinancialTabProps {
  contract: any;
  className?: string;
}

export function FinancialTabContent({
  contract,
  className,
}: FinancialTabProps) {
  const financial = contract.financialAnalysis || contract.financial || {};

  return (
    <div className={cn("space-y-6", className)}>
      {/* Financial Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                $
                {financial.totalValue?.toLocaleString() ||
                  contract.totalValue?.toLocaleString() ||
                  "0"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {financial.currency || contract.currency || "USD"}
              </div>
            </div>

            <div className="p-4 bg-violet-50 rounded-lg">
              <div className="text-sm text-gray-600">Payment Terms</div>
              <div className="text-xl font-bold text-violet-700 mt-1">
                {financial.paymentTerms || "Net 30"}
              </div>
            </div>

            <div className="p-4 bg-violet-50 rounded-lg">
              <div className="text-sm text-gray-600">Payment Schedule</div>
              <div className="text-xl font-bold text-violet-700 mt-1">
                {financial.paymentSchedule?.frequency || "Monthly"}
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-600">Penalties</div>
              <div className="text-xl font-bold text-orange-700 mt-1">
                {financial.penalties?.length || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Cards & Benchmarks */}
      {financial.rateCards && financial.rateCards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rate Cards & Market Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Level
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      Rate
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      Market
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {financial.rateCards.map(
                    (rate: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{rate.role || rate.roleTitle}</td>
                        <td className="py-3 px-4">{rate.level || rate.seniority}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          ${rate.hourlyRate || rate.dailyRate || rate.rate}/hr
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          ${rate.marketBenchmark || rate.benchmarkRate || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <VarianceBadge variance={rate.variance || 0} />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {financial.insights && (
              <div className="mt-4 p-4 bg-violet-50 rounded-lg border border-violet-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-violet-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-violet-900 mb-1">
                      AI Insight
                    </h4>
                    <p className="text-sm text-violet-800">
                      {financial.insights.recommendation}
                    </p>
                    <div className="mt-2 text-sm text-violet-700">
                      <strong>Potential Savings:</strong>{" "}
                      {financial.insights.totalAnnualSavings}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      {financial.costBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(financial.costBreakdown).map(
                ([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      ${value.toLocaleString()}
                    </span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Risks */}
      {financial.financialRisks && financial.financialRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Financial Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {financial.financialRisks.map((risk: any, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    "p-4 rounded-lg border-l-4",
                    risk.severity === "high"
                      ? "border-red-500 bg-red-50"
                      : risk.severity === "medium"
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-violet-500 bg-violet-50"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {risk.category}
                    </h4>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded",
                        risk.severity === "high"
                          ? "bg-red-200 text-red-800"
                          : risk.severity === "medium"
                          ? "bg-yellow-200 text-yellow-800"
                          : "bg-violet-200 text-violet-800"
                      )}
                    >
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{risk.description}</p>
                  {risk.mitigation && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Mitigation:</strong> {risk.mitigation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VarianceBadge({ variance }: { variance: string }) {
  const numVariance = parseFloat(variance);
  const isPositive = numVariance > 0;
  const isNeutral = Math.abs(numVariance) < 5;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded",
        isNeutral
          ? "bg-gray-100 text-gray-700"
          : isPositive
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700"
      )}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : isNeutral ? null : (
        <TrendingDown className="w-3 h-3" />
      )}
      {variance}
    </span>
  );
}
