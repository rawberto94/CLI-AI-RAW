"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo } from "react";

interface VirtualizedContractListProps {
  contracts: any[];
  selectedContracts: Set<string>;
  searchQuery: string;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  onDownload: (id: string) => void;
  onApproval: (id: string, title: string) => void;
  formatCurrency: (value: number) => string;
  formatDate: (date: string) => string;
  CompactContractRow: React.ComponentType<any>;
}

export function VirtualizedContractList({
  contracts,
  selectedContracts,
  searchQuery,
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval,
  formatCurrency,
  formatDate,
  CompactContractRow,
}: VirtualizedContractListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create virtualizer instance
  const rowVirtualizer = useVirtualizer({
    count: contracts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height in pixels
    overscan: 10, // Number of items to render outside viewport
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const contract = contracts[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <CompactContractRow
                contract={contract}
                index={virtualRow.index}
                isSelected={selectedContracts.has(contract.id)}
                searchQuery={searchQuery}
                onSelect={() => onSelect(contract.id)}
                onView={() => onView(contract.id)}
                onShare={() => onShare(contract.id, contract.title || "Contract")}
                onDelete={() => onDelete(contract.id, contract.title || "Contract")}
                onDownload={() => onDownload(contract.id)}
                onApproval={() => onApproval(contract.id, contract.title || "Contract")}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
