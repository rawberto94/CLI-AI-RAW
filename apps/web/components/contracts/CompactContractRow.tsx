"use client";

import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Eye,
  Clock,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Brain,
  Building2,
  Tag,
  RefreshCw,
  Scale,
  Edit3,
  GitBranch,
  AlertCircle,
  CalendarOff,
  User,
  PenTool,
  Link2,
} from "lucide-react";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { CategoryBadge } from "@/components/contracts/CategoryComponents";
import { HighlightText } from "@/components/contracts/HighlightText";
import { ContractHoverPreview } from "@/components/contracts/ContractHoverPreview";
import { SignatureStatusBadge } from "@/components/contracts/SignatureStatusBadge";
import { DocumentTypeBadge } from "@/components/contracts/DocumentTypeBadge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Contract } from "@/hooks/use-queries";
import type { DocumentClassification } from "@/lib/types/contract-metadata-schema";

export interface CompactContractRowProps {
  contract: Contract;
  index: number;
  isSelected: boolean;
  searchQuery?: string;
  onSelect: () => void;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onApproval: () => void;
  formatCurrency: (value?: number) => string;
  formatDate: (date?: string) => string;
}

export const CompactContractRow = memo(function CompactContractRow({
  contract,
  index,
  isSelected,
  searchQuery = "",
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval,
  formatCurrency,
  formatDate,
}: CompactContractRowProps) {
  const router = useRouter();
  const { isExpiringSoon, isNew, isExpired } = useMemo(() => {
    const now = Date.now();
    return {
      isExpiringSoon: !!(contract.expirationDate && 
        new Date(contract.expirationDate).getTime() < now + 30 * 24 * 60 * 60 * 1000),
      isNew: !!(contract.createdAt && 
        new Date(contract.createdAt).getTime() > now - 7 * 24 * 60 * 60 * 1000),
      isExpired: !!(contract.expirationDate && new Date(contract.expirationDate).getTime() < now),
    };
  }, [contract.expirationDate, contract.createdAt]);

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    // Only activate when the row itself is focused (not a child control like checkbox/buttons/menus)
    if (e.currentTarget !== e.target) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onView();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors duration-150 group border-b border-slate-100 dark:border-slate-700 relative min-w-[1180px]",
        isSelected 
          ? "bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600" 
          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
        // Zebra striping for unselected rows
        !isSelected && index % 2 === 0 && "bg-white dark:bg-slate-900",
        !isSelected && index % 2 === 1 && "bg-slate-50/30 dark:bg-slate-800/30",
        isExpiringSoon && !isSelected && "border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/30",
        isExpired && !isSelected && "border-l-2 border-l-red-400 bg-red-50/20 dark:bg-red-950/20"
      )}
      onClick={onView}
      role="link"
      tabIndex={0}
      aria-label={`View contract ${contract.title || 'Untitled Contract'}`}
      onKeyDown={handleRowKeyDown}
      data-testid={`contract-row-${contract.id}`}
    >
      {/* Selection indicator line */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-800" />
      )}
      {/* Checkbox — stopPropagation only when clicking the checkbox itself, not the padding */}
      <div
        className="w-10 flex-shrink-0 flex items-center justify-center"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
            e.stopPropagation();
          }
        }}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
            e.stopPropagation();
          }
        }}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${contract.title}`}
          className="border-slate-300 h-4 w-4 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
        />
      </div>

      {/* Contract Title with Hover Preview */}
      <div className="flex-1 min-w-[220px] overflow-hidden">
      <ContractHoverPreview
        contract={contract}
        onView={onView}
        onAnalyze={() => window.dispatchEvent(new CustomEvent('openAIChatbot', {
          detail: { autoMessage: `Analyze contract: ${contract.title}`, contractId: contract.id }
        }))}
        side="right"
        delay={500}
      >
        <div className="flex items-center gap-3">
          <div 
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isExpired 
                ? "bg-red-50 dark:bg-red-950/30"
                : isExpiringSoon
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            <FileText className={cn(
              "h-4 w-4",
              isExpired 
                ? "text-red-500 dark:text-red-400" 
                : isExpiringSoon 
                  ? "text-amber-500 dark:text-amber-400" 
                  : "text-slate-400 dark:text-slate-500"
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-800 truncate group-hover:text-slate-900 transition-colors text-sm" title={contract.title}>
                <HighlightText text={contract.title || 'Untitled Contract'} query={searchQuery} />
              </p>
              {isNew && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-white flex-shrink-0">
                  New
                </span>
              )}
              <DocumentTypeBadge 
                classification={contract.documentClassification as DocumentClassification} 
                showWarning={!!contract.documentClassificationWarning}
              />
              {contract.hasHierarchy && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 flex-shrink-0" title={contract.parentContractId ? 'Linked to parent contract' : `${contract.childContracts?.length || 0} linked contract(s)`}>
                  <Link2 className="h-3 w-3" />
                  {contract.parentContractId ? 'Linked' : contract.childContracts?.length || 0}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatDate(contract.createdAt)}
            </p>
          </div>
        </div>
      </ContractHoverPreview>
      </div>

      {/* Category */}
      <div className="hidden lg:block w-[120px] overflow-hidden">
        {contract.category ? (
          <CategoryBadge 
            category={contract.category.name} 
            color={contract.category.color}
            icon={contract.category.icon}
            categoryPath={contract.category.path}
            size="sm"
          />
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <Tag className="h-3 w-3" />
            Uncategorized
          </span>
        )}
      </div>

      {/* Contract Type */}
      <div className="hidden lg:block w-[110px] overflow-hidden">
        {contract.type && contract.type !== 'OTHER' ? (
          <span className="block max-w-full truncate px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title={contract.type}>
            {contract.type}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            General
          </span>
        )}
      </div>

      {/* Party */}
      <div className="hidden md:block w-[150px] overflow-hidden">
        {(contract.parties?.supplier || contract.parties?.client) ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3 w-3 text-slate-500" />
            </div>
            <span className="text-[13px] text-slate-600 truncate" title={contract.parties?.supplier || contract.parties?.client}>
              {contract.parties?.supplier || contract.parties?.client}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <User className="h-3 w-3" />
            Add party
          </span>
        )}
      </div>

      {/* Value */}
      <div className="hidden lg:block w-[110px] text-right">
        {contract.value ? (
          <span className="text-[13px] font-medium tabular-nums text-slate-800">
            {formatCurrency(contract.value)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>

      {/* Expiration Date */}
      <div className="hidden md:block w-[110px]">
        {contract.expirationDate ? (
          <div className="flex flex-col">
            <span className={cn(
              "text-[13px] tabular-nums",
              isExpired ? "text-red-600 dark:text-red-400 font-medium" : isExpiringSoon ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-600 dark:text-slate-400"
            )}>
              {formatDate(contract.expirationDate)}
            </span>
            {isExpired && (
              <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" /> Expired
              </span>
            )}
            {!isExpired && isExpiringSoon && (
              <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 mt-0.5 flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> Soon
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <CalendarOff className="h-3 w-3" />
            No expiry
          </span>
        )}
      </div>

      {/* Signature Status */}
      <div className="hidden lg:block w-[90px]">
        <SignatureStatusBadge status={contract.signatureStatus} />
      </div>

      {/* Status */}
      <div className="w-[200px]">
        <ContractStatusBadge 
          status={contract.status} 
          documentRole={contract.documentRole}
          size="sm"
        />
      </div>

      {/* Actions — stopPropagation only when interacting with the menu, not empty padding */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center" onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [role="menu"], [role="menuitem"]')) {
          e.stopPropagation();
        }
      }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
              onClick={() => {}}
            >
              <MoreHorizontal className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-lg border-slate-200 rounded-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onSelect={onView} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Eye className="h-4 w-4 mr-2.5 text-slate-500" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Brain className="h-4 w-4 mr-2.5 text-slate-500" /> AI Analysis
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}/legal-review`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Scale className="h-4 w-4 mr-2.5 text-slate-500" /> Legal Review
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}/redline`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Edit3 className="h-4 w-4 mr-2.5 text-slate-500" /> Redline Editor
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}/renew`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <RefreshCw className="h-4 w-4 mr-2.5 text-slate-500" /> Start Renewal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/drafting/copilot?mode=amendment&from=${contract.id}`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <GitBranch className="h-4 w-4 mr-2.5 text-slate-500" /> Create Amendment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onApproval} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <PenTool className="h-4 w-4 mr-2.5 text-slate-500" /> Request Signature
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={onDownload} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Download className="h-4 w-4 mr-2.5 text-slate-500" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShare} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Share2 className="h-4 w-4 mr-2.5 text-slate-500" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="text-sm rounded-md cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 focus:bg-red-50 dark:focus:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4 mr-2.5" /> Delete Contract
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
