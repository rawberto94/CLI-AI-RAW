"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Download,
  Save,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Contract } from "@/lib/contracts/contracts-data-service";
import {
  createComparison,
  saveComparison,
  getDifferenceColor,
  getSeverityColor,
  formatDifferenceValue,
  type Comparison,
  type Difference,
} from "@/lib/contracts/comparison";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";

interface ComparisonViewProps {
  contracts: Contract[];
  onClose: () => void;
}

export function ComparisonView({ contracts, onClose }: ComparisonViewProps) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const scrollRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const comp = createComparison(contracts);
    setComparison(comp);
  }, [contracts]);

  if (!comparison) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Analyzing contracts...</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    saveComparison(comparison);
    alert("Comparison saved!");
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert("Export functionality coming soon!");
  };

  const handleSyncScroll = (index: number, scrollTop: number) => {
    scrollRefs.current.forEach((ref, i) => {
      if (ref && i !== index) {
        ref.scrollTop = scrollTop;
      }
    });
  };

  const navigateToDifference = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev"
        ? Math.max(0, currentDiffIndex - 1)
        : Math.min(comparison.differences.length - 1, currentDiffIndex + 1);
    setCurrentDiffIndex(newIndex);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Contract Comparison</h2>
              <p className="text-sm text-gray-600">
                {comparison.contracts.length} contracts •{" "}
                {comparison.differences.length} differences found
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Similarity Score</div>
            <div className="text-2xl font-bold text-blue-600">
              {comparison.metrics.similarityScore}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Value Difference</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(comparison.metrics.valueDifference)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Risk Difference</div>
            <div className="text-2xl font-bold text-yellow-600">
              {comparison.metrics.riskDifference}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Key Differences</div>
            <div className="text-2xl font-bold text-gray-900">
              {comparison.metrics.keyDifferences.length}
            </div>
          </div>
        </div>

        {/* Key Differences Summary */}
        {comparison.metrics.keyDifferences.length > 0 && (
          <div className="mt-4 bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Key Differences:
            </div>
            <div className="flex flex-wrap gap-2">
              {comparison.metrics.keyDifferences.map((diff, idx) => (
                <Badge key={idx} className={getSeverityColor(diff.severity)}>
                  {diff.field} ({diff.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Difference Navigation */}
      {comparison.differences.length > 0 && (
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Difference {currentDiffIndex + 1} of{" "}
              {comparison.differences.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToDifference("prev")}
                disabled={currentDiffIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToDifference("next")}
                disabled={
                  currentDiffIndex === comparison.differences.length - 1
                }
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Columns */}
      <div className="flex-1 overflow-hidden">
        <div
          className="h-full grid"
          style={{ gridTemplateColumns: `repeat(${contracts.length}, 1fr)` }}
        >
          {contracts.map((contract, index) => (
            <div
              key={contract.id}
              className="border-r border-gray-200 last:border-r-0 flex flex-col"
            >
              {/* Column Header */}
              <div className="bg-gray-50 border-b border-gray-200 p-4 sticky top-0 z-10">
                <h3 className="font-semibold text-gray-900 truncate">
                  {contract.filename || contract.originalName || "Untitled"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDateTime(contract.uploadDate)}
                </p>
              </div>

              {/* Column Content */}
              <div
                ref={(el: HTMLDivElement | null) => {
                  scrollRefs.current[index] = el as HTMLDivElement | null;
                }}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                onScroll={(e) =>
                  handleSyncScroll(index, e.currentTarget.scrollTop)
                }
              >
                <ComparisonField
                  label="Parties"
                  value={contract.extractedData?.parties}
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.parties"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Contract Value"
                  value={
                    contract.extractedData?.financial?.totalValue
                      ? formatCurrency(
                          contract.extractedData.financial.totalValue,
                          contract.extractedData.financial.currency
                        )
                      : "Not specified"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.financial.totalValue"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Effective Date"
                  value={
                    contract.extractedData?.dates?.effectiveDate
                      ? formatDateTime(
                          contract.extractedData.dates.effectiveDate
                        )
                      : "Not specified"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.dates.effectiveDate"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Expiration Date"
                  value={
                    contract.extractedData?.dates?.expirationDate
                      ? formatDateTime(
                          contract.extractedData.dates.expirationDate
                        )
                      : "Not specified"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.dates.expirationDate"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Payment Terms"
                  value={
                    contract.extractedData?.terms?.paymentTerms ||
                    "Not specified"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.terms.paymentTerms"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Termination Clause"
                  value={
                    contract.extractedData?.terms?.terminationClause ||
                    "Not specified"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.terms.terminationClause"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Risk Score"
                  value={contract.extractedData?.risk?.overallScore || "N/A"}
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.risk.overallScore"
                  )}
                  contractIndex={index}
                />

                <ComparisonField
                  label="Compliance Score"
                  value={
                    contract.extractedData?.compliance?.overallScore || "N/A"
                  }
                  difference={comparison.differences.find(
                    (d) => d.field === "extractedData.compliance.overallScore"
                  )}
                  contractIndex={index}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Comparison Field Component
interface ComparisonFieldProps {
  label: string;
  value: any;
  difference?: Difference;
  contractIndex: number;
}

function ComparisonField({
  label,
  value,
  difference,
  contractIndex,
}: ComparisonFieldProps) {
  const isDifferent = difference && difference.type !== "identical";
  const displayValue = formatDifferenceValue(value);

  return (
    <div
      className={`p-3 rounded-lg border ${
        isDifferent
          ? getDifferenceColor(difference.type)
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="text-sm text-gray-900">{displayValue}</div>
      {isDifferent && difference && (
        <div className="mt-2">
          <Badge className={getSeverityColor(difference.severity)}>
            {difference.type === "modified" && "Different"}
            {difference.type === "added" && "Added"}
            {difference.type === "removed" && "Missing"}
          </Badge>
        </div>
      )}
    </div>
  );
}
