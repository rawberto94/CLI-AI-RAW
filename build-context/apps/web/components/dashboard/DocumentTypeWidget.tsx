/**
 * Document Type Distribution Widget
 * Shows breakdown of document types in the repository with warnings
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  FileText, 
  ShoppingCart, 
  Receipt, 
  FileQuestion,
  AlertTriangle,
  FileCheck,
  FilePen,
  FileType2,
  ScrollText,
  Pen,
  PenLine
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocumentTypeBreakdown {
  type: string;
  count: number;
  percentage: number;
}

interface SignatureBreakdown {
  status: string;
  count: number;
}

interface DocumentTypeWidgetProps {
  documentTypes: DocumentTypeBreakdown[];
  signatureStatus: SignatureBreakdown[];
  totalDocuments: number;
  nonContractCount: number;
  unsignedCount: number;
}

const documentTypeConfig: Record<string, { 
  label: string; 
  icon: any; 
  color: string;
  bgColor: string;
  isContract: boolean;
}> = {
  contract: {
    label: 'Contracts',
    icon: FileCheck,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: true,
  },
  purchase_order: {
    label: 'Purchase Orders',
    icon: ShoppingCart,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    isContract: false,
  },
  invoice: {
    label: 'Invoices',
    icon: Receipt,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: false,
  },
  quote: {
    label: 'Quotes',
    icon: FileQuestion,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: false,
  },
  proposal: {
    label: 'Proposals',
    icon: FileType2,
    color: 'text-violet-600 dark:text-indigo-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: false,
  },
  work_order: {
    label: 'Work Orders',
    icon: FilePen,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    isContract: false,
  },
  letter_of_intent: {
    label: 'Letters of Intent',
    icon: ScrollText,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: false,
  },
  memorandum: {
    label: 'Memoranda',
    icon: FileText,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    isContract: false,
  },
  amendment: {
    label: 'Amendments',
    icon: Pen,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    isContract: true,
  },
  addendum: {
    label: 'Addenda',
    icon: PenLine,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    isContract: true,
  },
  unknown: {
    label: 'Unknown',
    icon: FileQuestion,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    isContract: false,
  },
};

const signatureConfig: Record<string, { 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  signed: {
    label: 'Signed',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  partially_signed: {
    label: 'Partial',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  unsigned: {
    label: 'Unsigned',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
  },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 }
  }
};

export function DocumentTypeWidget({ 
  documentTypes, 
  signatureStatus, 
  totalDocuments, 
  nonContractCount,
  unsignedCount 
}: DocumentTypeWidgetProps) {
  const hasWarnings = nonContractCount > 0 || unsignedCount > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Document Classification
          </CardTitle>
          {hasWarnings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {nonContractCount + unsignedCount} Issues
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {nonContractCount > 0 && <p>{nonContractCount} non-contract documents</p>}
                    {unsignedCount > 0 && <p>{unsignedCount} unsigned contracts</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Document Types */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Document Types
          </h4>
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1.5"
          >
            {documentTypes.map(({ type, count, percentage }) => {
              const config = documentTypeConfig[type] || documentTypeConfig.unknown;
              const Icon = config.icon;
              
              return (
                <motion.div
                  key={type}
                  variants={itemVariants}
                  className={`flex items-center justify-between p-2 rounded-lg ${config.bgColor} ${!config.isContract ? 'border-l-2 border-amber-500' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm font-medium">{config.label}</span>
                    {!config.isContract && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Not a binding contract</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${config.color}`}>
                      {count}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Signature Status */}
        <div className="pt-2 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Signature Status
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {signatureStatus.map(({ status, count }) => {
              const config = signatureConfig[status] || signatureConfig.unknown;
              const percentage = totalDocuments > 0 ? (count / totalDocuments) * 100 : 0;
              const needsAttention = status === 'unsigned' || status === 'partially_signed';
              
              return (
                <div
                  key={status}
                  className={`p-2 rounded-lg ${config.bgColor} ${needsAttention ? 'ring-1 ring-amber-500/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {config.label}
                    </span>
                    {needsAttention && count > 0 && (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  <div className={`text-lg font-semibold ${config.color}`}>
                    {count}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {percentage.toFixed(0)}% of documents
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Bar */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Repository Health</span>
            <span>{totalDocuments} total documents</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            {documentTypes
              .filter(d => documentTypeConfig[d.type]?.isContract !== false)
              .reduce((sum, d) => sum + d.count, 0) > 0 && (
              <div 
                className="bg-violet-500 h-full"
                style={{ 
                  width: `${((totalDocuments - nonContractCount) / totalDocuments) * 100}%` 
                }}
              />
            )}
            {nonContractCount > 0 && (
              <div 
                className="bg-amber-500 h-full"
                style={{ 
                  width: `${(nonContractCount / totalDocuments) * 100}%` 
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Contracts
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Other Documents
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DocumentTypeWidget;
