/**
 * useContractsPageActions – Selection state, dialog state, and all
 * action handlers (download, share, delete, bulk ops, categorize)
 * extracted from the contracts list page.
 */
"use client";

import { useState, useCallback } from "react";
import { queryKeys } from "@/hooks/use-queries";
import { type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getTenantId } from "@/lib/tenant";

interface UseContractsPageActionsOptions {
  dataMode: string;
  refetch: () => Promise<any>;
  refetchStats: () => Promise<any>;
  crossModule: { onContractChange: (id?: string) => void };
  queryClient: QueryClient;
}

export function useContractsPageActions({
  dataMode,
  refetch,
  refetchStats,
  crossModule,
  queryClient,
}: UseContractsPageActionsOptions) {
  // ── Selection state ────────────────────────────────────────────────
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // ── Dialog state ───────────────────────────────────────────────────
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareContractId, setShareContractId] = useState<string | null>(null);
  const [shareContractTitle, setShareContractTitle] = useState("");
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalContractId, setApprovalContractId] = useState<string | null>(null);
  const [approvalContractTitle, setApprovalContractTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
  const [bulkShareDialogOpen, setBulkShareDialogOpen] = useState(false);

  // ── Selection ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((contractId: string) => {
    setSelectedContracts((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  }, []);

  // ── Bulk operations ────────────────────────────────────────────────
  const performBulkAction = useCallback(
    async (action: "export" | "analyze" | "delete" | "share") => {
      if (selectedContracts.size === 0) return;
      setIsProcessingBulk(true);
      try {
        const response = await fetch("/api/contracts/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-data-mode": dataMode,
            "x-tenant-id": getTenantId(),
          },
          body: JSON.stringify({
            operation: action,
            contractIds: Array.from(selectedContracts),
          }),
        });
        if (!response.ok) throw new Error("Operation failed");
        await response.json();
        toast.success(`Successfully ${action}ed ${selectedContracts.size} contracts`);
        if (action === "delete") refetch();
        setSelectedContracts(new Set());
      } catch {
        toast.error(`Failed to ${action} contracts`);
      } finally {
        setIsProcessingBulk(false);
      }
    },
    [selectedContracts, dataMode, refetch],
  );

  // ── Contract actions ───────────────────────────────────────────────
  const handleDownload = useCallback(async (contractId: string, format: "json" | "csv" | "pdf" = "pdf") => {
    try {
      toast.info("Preparing download...");
      const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`, {
        headers: { "x-tenant-id": getTenantId() },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract-${contractId}.${format === "pdf" ? "html" : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download contract");
    }
  }, []);

  const handleShare = useCallback((contractId: string, contractTitle: string) => {
    setShareContractId(contractId);
    setShareContractTitle(contractTitle);
    setShareDialogOpen(true);
  }, []);

  const handleRequestApproval = useCallback((contractId: string, contractTitle: string) => {
    setApprovalContractId(contractId);
    setApprovalContractTitle(contractTitle);
    setApprovalModalOpen(true);
  }, []);

  const handleApprovalSuccess = useCallback(() => {
    toast.success("Contract submitted for approval", {
      description: `${approvalContractTitle} has been sent for review`,
    });
    setApprovalModalOpen(false);
    setApprovalContractId(null);
    setApprovalContractTitle("");
    refetch();
  }, [approvalContractTitle, refetch]);

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDeleteClick = useCallback((contractId: string, contractTitle: string) => {
    setContractToDelete({ id: contractId, title: contractTitle });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!contractToDelete) return;
    const contractId = contractToDelete.id;
    try {
      toast.info("Deleting contract...");
      setSelectedContracts((prev) => {
        const updated = new Set(prev);
        updated.delete(contractId);
        return updated;
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "DELETE",
        headers: { "x-tenant-id": getTenantId() },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.details || "Delete failed");
      // Invalidate cache and refetch (onContractChange now handles both)
      await crossModule.onContractChange(contractId);
      await refetchStats();
      toast.success("Contract deleted successfully");
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") toast.error("Delete request timed out. Please try again.");
        else toast.error(error.message);
      } else {
        toast.error("Failed to delete contract");
      }
    } finally {
      setContractToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [contractToDelete, crossModule, refetch, refetchStats]);

  // ── Bulk delete ────────────────────────────────────────────────────
  const handleBulkDeleteClick = useCallback(() => {
    if (selectedContracts.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedContracts.size]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedContracts.size === 0) return;
    setIsProcessingBulk(true);
    setBulkDeleteDialogOpen(false);
    try {
      const response = await fetch("/api/contracts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-data-mode": dataMode,
          "x-tenant-id": getTenantId(),
        },
        body: JSON.stringify({ operation: "delete", contractIds: Array.from(selectedContracts) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || data?.details || "Bulk delete failed");
      }
      const failedCount = data?.failed ?? 0;
      const deletedCount = data?.deleted ?? selectedContracts.size;
      // Invalidate cache and refetch (onContractChange now handles both)
      await crossModule.onContractChange();
      await refetchStats();
      if (failedCount > 0) {
        toast.warning(`Deleted ${deletedCount} contracts, ${failedCount} failed`);
      } else {
        toast.success(`Deleted ${deletedCount} contracts`);
      }
      setSelectedContracts(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete contracts";
      toast.error(message);
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedContracts, dataMode, crossModule, queryClient, refetch, refetchStats]);

  // ── Bulk action with confirmation ──────────────────────────────────
  const handleBulkActionWithConfirmation = useCallback(
    (action: "export" | "share") => {
      if (selectedContracts.size === 0) return;
      switch (action) {
        case "export":
          setBulkExportDialogOpen(true);
          break;
        case "share":
          setBulkShareDialogOpen(true);
          break;
      }
    },
    [selectedContracts.size],
  );

  const handleConfirmBulkAction = useCallback(async () => {
    // Determine which dialog is open and perform the action
    if (bulkExportDialogOpen) {
      await performBulkAction("export");
      setBulkExportDialogOpen(false);
    } else if (bulkShareDialogOpen) {
      await performBulkAction("share");
      setBulkShareDialogOpen(false);
    }
  }, [bulkExportDialogOpen, bulkShareDialogOpen, performBulkAction]);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    // Selection
    selectedContracts, setSelectedContracts, toggleSelect,
    // Processing
    isProcessingBulk,
    // Actions
    performBulkAction,
    handleDownload, handleShare, handleRequestApproval, handleApprovalSuccess,
    handleDeleteClick, handleConfirmDelete,
    handleBulkDeleteClick, handleConfirmBulkDelete,
    handleBulkActionWithConfirmation, handleConfirmBulkAction,
    // Dialogs
    shareDialogOpen, setShareDialogOpen, shareContractId, setShareContractId, shareContractTitle,
    approvalModalOpen, setApprovalModalOpen, approvalContractId, setApprovalContractId, approvalContractTitle, setApprovalContractTitle,
    deleteDialogOpen, setDeleteDialogOpen, contractToDelete,
    bulkDeleteDialogOpen, setBulkDeleteDialogOpen,
    bulkExportDialogOpen, setBulkExportDialogOpen,
    bulkShareDialogOpen, setBulkShareDialogOpen,
  };
}
