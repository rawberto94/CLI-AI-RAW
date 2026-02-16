"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Eye,
  Calendar,
  Banknote,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Brain,
  Building2,
  Loader2,
  RefreshCw,
  Scale,
  Edit3,
  GitBranch,
} from "lucide-react";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { CategoryBadge } from "@/components/contracts/CategoryComponents";
import { HighlightText } from "@/components/contracts/HighlightText";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Contract } from "@/hooks/use-queries";

export interface ContractCardViewProps {
  contract: Contract;
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
  getRiskBadge: (riskScore?: number) => React.ReactNode;
}

export const ContractCardView = memo(function ContractCardView({
  contract,
  isSelected,
  searchQuery = "",
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval: _onApproval,
  formatCurrency,
  formatDate,
  getRiskBadge,
}: ContractCardViewProps) {
  const router = useRouter();
  const isExpiringSoon = contract.expirationDate && 
    new Date(contract.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = contract.expirationDate && new Date(contract.expirationDate) < new Date();
  const isNew = contract.createdAt && 
    new Date(contract.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-colors bg-white border-slate-200 shadow-sm hover:shadow-md rounded-xl overflow-hidden",
        isSelected && "ring-1 ring-slate-800 border-slate-300",
        isNew && "border-slate-300"
      )}
      onClick={onView}
    >
      {/* Top bar */}
      <div className="h-0.5 w-full bg-slate-200" />
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-0.5 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
              />
            </div>
            <div className="relative p-2.5 bg-slate-100 rounded-lg">
              <FileText className="h-5 w-5 text-slate-600" />
              {isNew && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-slate-600 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-800 transition-colors">
                  <HighlightText text={contract.title || 'Untitled Contract'} query={searchQuery} />
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500">
                  {contract.type || 'Contract'}
                </p>
                {contract.category && (
                  <CategoryBadge 
                    category={contract.category.name}
                    color={contract.category.color}
                    icon={contract.category.icon}
                    categoryPath={contract.category.path}
                    size="sm"
                  />
                )}
              </div>
            </div>
          </div>
          <ContractStatusBadge 
            status={contract.status} 
            documentRole={contract.documentRole}
            size="md"
          />
        </div>

        {/* Key Details */}
        <div className="space-y-3 mb-4">
          {contract.parties?.client && (
            <div className="flex items-center gap-3 text-sm p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <Building2 className="h-4 w-4 text-slate-600" />
              </div>
              <span className="text-slate-700 truncate font-medium">{contract.parties.client}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">
                <Banknote className="h-4 w-4 text-slate-600" />
              </div>
              <span className={contract.value ? "font-bold text-slate-800" : "text-slate-400 italic"}>
                {formatCurrency(contract.value)}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className={cn(
                "text-sm font-medium",
                isExpired ? "text-red-600 dark:text-red-400" : 
                isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
              )}>
                {isExpired ? 'Expired' : formatDate(contract.expirationDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Risk & Progress */}
        <div className="flex items-center justify-between mb-4">
          {getRiskBadge(contract.riskScore)}
          {contract.status === 'processing' && contract.processing && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {contract.processing.progress}%
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div 
          className="flex items-center justify-between pt-4 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
                  onClick={onView}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
                  onClick={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')}
                >
                  <Brain className="h-4 w-4 text-slate-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
                  onClick={onShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-lg rounded-lg">
              <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}/legal-review`)} className="cursor-pointer text-sm">
                <Scale className="h-4 w-4 mr-2 text-slate-500" /> Legal Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}/redline`)} className="cursor-pointer text-sm">
                <Edit3 className="h-4 w-4 mr-2 text-slate-500" /> Redline Editor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/generate?create=renewal&from=${contract.id}`)} className="cursor-pointer text-sm">
                <RefreshCw className="h-4 w-4 mr-2 text-slate-500" /> Start Renewal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/generate?create=amendment&from=${contract.id}`)} className="cursor-pointer text-sm">
                <GitBranch className="h-4 w-4 mr-2 text-slate-500" /> Create Amendment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDownload} className="cursor-pointer text-sm">
                <Download className="h-4 w-4 mr-2 text-slate-500" /> Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  onDelete();
                }} 
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer text-sm"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
});
