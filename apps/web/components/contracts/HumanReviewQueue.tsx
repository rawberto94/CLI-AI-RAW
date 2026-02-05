'use client';

/**
 * Human Review Queue UI Component
 * 
 * Displays documents that need manual review due to low OCR confidence.
 * Allows reviewers to verify, correct, and approve extracted data.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  FileText,
  ChevronRight,
  RefreshCw,
  Filter,
  ArrowUp,
  ArrowDown,
  Edit3,
  Eye,
  AlertOctagon,
  BarChart3,
  Users,
  Calendar,
  Search,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type ReviewPriority = 'critical' | 'high' | 'medium' | 'low';
type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'escalated';
type ReviewType = 'ocr_quality' | 'data_verification' | 'compliance_check' | 'legal_review';

interface LowConfidenceRegion {
  start: number;
  end: number;
  text: string;
  avgConfidence: number;
  fieldType?: string;
  correctedText?: string;
}

interface ReviewItem {
  id: string;
  contractId: string;
  tenantId: string;
  type: ReviewType;
  priority: ReviewPriority;
  status: ReviewStatus;
  ocrConfidence: number;
  lowConfidenceRegions: LowConfidenceRegion[];
  documentName: string;
  documentType?: string;
  pageCount?: number;
  extractedFields?: Record<string, {
    value: string;
    confidence: number;
    verified?: boolean;
  }>;
  assignedTo?: string;
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  notes?: string;
}

interface ReviewQueueStats {
  total: number;
  byStatus: Record<ReviewStatus, number>;
  byPriority: Record<ReviewPriority, number>;
  avgTimeToComplete: number;
  completedToday: number;
  avgConfidenceImprovement: number;
}

interface HumanReviewQueueProps {
  tenantId?: string;
  onSelectItem?: (item: ReviewItem) => void;
  className?: string;
}

// ============================================================================
// PRIORITY BADGE COMPONENT
// ============================================================================

const PriorityBadge: React.FC<{ priority: ReviewPriority }> = ({ priority }) => {
  const config = {
    critical: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: AlertOctagon,
      label: 'Critical',
    },
    high: {
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      icon: AlertTriangle,
      label: 'High',
    },
    medium: {
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: Clock,
      label: 'Medium',
    },
    low: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      icon: CheckCircle2,
      label: 'Low',
    },
  };

  const { color, icon: Icon, label } = config[priority];

  return (
    <Badge className={cn('gap-1', color)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

const StatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const config = {
    pending: {
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      label: 'Pending',
    },
    in_progress: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      label: 'In Progress',
    },
    completed: {
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      label: 'Completed',
    },
    rejected: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      label: 'Rejected',
    },
    escalated: {
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      label: 'Escalated',
    },
  };

  const { color, label } = config[status];

  return <Badge className={color}>{label}</Badge>;
};

// ============================================================================
// STATS CARDS COMPONENT
// ============================================================================

const StatsCards: React.FC<{ stats: ReviewQueueStats }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{stats.byStatus.pending}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold text-red-600">{stats.byPriority.critical}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertOctagon className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed Today</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedToday}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Time</p>
              <p className="text-2xl font-bold">{stats.avgTimeToComplete.toFixed(1)}h</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// REVIEW ITEM ROW COMPONENT
// ============================================================================

interface ReviewItemRowProps {
  item: ReviewItem;
  onSelect: () => void;
  onAssign?: (userId: string) => void;
  onEscalate?: () => void;
}

const ReviewItemRow: React.FC<ReviewItemRowProps> = ({
  item,
  onSelect,
  onAssign,
  onEscalate,
}) => {
  const confidencePercent = Math.round(item.ocrConfidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md',
        item.priority === 'critical' && 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
        item.priority === 'high' && 'border-orange-200 bg-orange-50/30 dark:border-orange-900 dark:bg-orange-950/10',
        item.status === 'in_progress' && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{item.documentName}</span>
            {item.documentType && (
              <Badge variant="outline" className="flex-shrink-0">
                {item.documentType}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span className={cn(
                      'font-medium',
                      confidencePercent < 50 && 'text-red-600',
                      confidencePercent >= 50 && confidencePercent < 70 && 'text-yellow-600',
                      confidencePercent >= 70 && 'text-green-600'
                    )}>
                      {confidencePercent}%
                    </span>
                    <span>confidence</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>OCR extraction confidence score</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="text-sm text-muted-foreground">
              • {item.lowConfidenceRegions.length} sections need review
            </span>
          </div>

          {item.assignedTo && (
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Assigned to {item.assignedTo}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {item.status === 'pending' && onAssign && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onAssign('current_user'); }}
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assign to Me</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {item.status === 'in_progress' && onEscalate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); onEscalate(); }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Escalate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Progress bar showing confidence */}
      <div className="mt-3">
        <Progress 
          value={confidencePercent} 
          className={cn(
            'h-1.5',
            confidencePercent < 50 && '[&>div]:bg-red-500',
            confidencePercent >= 50 && confidencePercent < 70 && '[&>div]:bg-yellow-500',
            confidencePercent >= 70 && '[&>div]:bg-green-500'
          )}
        />
      </div>
    </motion.div>
  );
};

// ============================================================================
// REVIEW DETAIL DIALOG
// ============================================================================

interface ReviewDetailDialogProps {
  item: ReviewItem | null;
  open: boolean;
  onClose: () => void;
  onSubmitCorrections: (corrections: any[], notes: string, score: number) => void;
}

const ReviewDetailDialog: React.FC<ReviewDetailDialogProps> = ({
  item,
  open,
  onClose,
  onSubmitCorrections,
}) => {
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState(4);

  if (!item) return null;

  const handleCorrectionChange = (index: number, value: string) => {
    const newCorrections = new Map(corrections);
    if (value === item.lowConfidenceRegions[index]?.text) {
      newCorrections.delete(index);
    } else {
      newCorrections.set(index, value);
    }
    setCorrections(newCorrections);
  };

  const handleSubmit = () => {
    const correctionsList = Array.from(corrections.entries()).map(([index, correctedValue]) => {
      const region = item.lowConfidenceRegions[index];
      return {
        field: region?.fieldType || `region_${index}`,
        originalValue: region?.text || '',
        correctedValue,
        reason: 'Manual correction',
      };
    });

    onSubmitCorrections(correctionsList, notes, score);
    setCorrections(new Map());
    setNotes('');
    setScore(4);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {item.documentName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
            <span>• {Math.round(item.ocrConfidence * 100)}% confidence</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="regions" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="regions">Low Confidence Regions</TabsTrigger>
            <TabsTrigger value="fields">Extracted Fields</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="regions" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {item.lowConfidenceRegions.map((region, index) => (
                  <Card key={index} className={cn(
                    'border',
                    region.avgConfidence < 0.5 && 'border-red-200 dark:border-red-900',
                    region.avgConfidence >= 0.5 && region.avgConfidence < 0.7 && 'border-yellow-200 dark:border-yellow-900'
                  )}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {region.fieldType && (
                            <Badge variant="outline">{region.fieldType}</Badge>
                          )}
                          <span className={cn(
                            'text-sm font-medium',
                            region.avgConfidence < 0.5 && 'text-red-600',
                            region.avgConfidence >= 0.5 && region.avgConfidence < 0.7 && 'text-yellow-600',
                            region.avgConfidence >= 0.7 && 'text-green-600'
                          )}>
                            {Math.round(region.avgConfidence * 100)}% confident
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Characters {region.start}-{region.end}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="p-2 bg-muted rounded text-sm font-mono">
                          {region.text}
                        </div>

                        <div className="flex items-center gap-2">
                          <Edit3 className="h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Enter correction (leave empty to confirm original)"
                            defaultValue={region.text}
                            onChange={(e) => handleCorrectionChange(index, e.target.value)}
                            className={cn(
                              corrections.has(index) && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="fields" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {item.extractedFields ? (
                  Object.entries(item.extractedFields).map(([field, data]) => (
                    <div key={field} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{field}</span>
                        <span className="text-muted-foreground ml-2">{data.value}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm',
                          data.confidence < 0.7 && 'text-yellow-600',
                          data.confidence >= 0.7 && 'text-green-600'
                        )}>
                          {Math.round(data.confidence * 100)}%
                        </span>
                        {data.verified && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No extracted fields available
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-hidden">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Review Notes</label>
                <Textarea
                  placeholder="Add notes about this review..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Quality Score</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      variant={score === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScore(value)}
                    >
                      {value}
                    </Button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">
                    (1 = Poor, 5 = Excellent)
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Submit Review ({corrections.size} corrections)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const HumanReviewQueue: React.FC<HumanReviewQueueProps> = ({
  tenantId,
  onSelectItem,
  className,
}) => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // In production, replace with actual API calls
        // const response = await fetch(`/api/review-queue?tenantId=${tenantId}&status=${statusFilter}`);
        // const data = await response.json();
        
        // Mock data for demonstration
        const mockItems: ReviewItem[] = [
          {
            id: 'review_1',
            contractId: 'contract_abc',
            tenantId: tenantId || 'tenant_1',
            type: 'ocr_quality',
            priority: 'critical',
            status: 'pending',
            ocrConfidence: 0.45,
            lowConfidenceRegions: [
              { start: 100, end: 150, text: 'Pa7ty Name: Acme Corp.', avgConfidence: 0.35, fieldType: 'party_name' },
              { start: 300, end: 350, text: 'Total: $l2,500.00', avgConfidence: 0.42, fieldType: 'amount' },
            ],
            documentName: 'Service_Agreement_2024.pdf',
            documentType: 'SERVICE_AGREEMENT',
            pageCount: 12,
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
            updatedAt: new Date(Date.now() - 1000 * 60 * 30),
          },
          {
            id: 'review_2',
            contractId: 'contract_def',
            tenantId: tenantId || 'tenant_1',
            type: 'ocr_quality',
            priority: 'high',
            status: 'in_progress',
            ocrConfidence: 0.58,
            lowConfidenceRegions: [
              { start: 50, end: 100, text: 'Effective Date: J4n 15, 2024', avgConfidence: 0.52, fieldType: 'date' },
            ],
            documentName: 'NDA_ClientXYZ.pdf',
            documentType: 'NDA',
            pageCount: 4,
            assignedTo: 'john.doe@example.com',
            assignedAt: new Date(Date.now() - 1000 * 60 * 15),
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
            updatedAt: new Date(Date.now() - 1000 * 60 * 15),
          },
          {
            id: 'review_3',
            contractId: 'contract_ghi',
            tenantId: tenantId || 'tenant_1',
            type: 'ocr_quality',
            priority: 'medium',
            status: 'pending',
            ocrConfidence: 0.68,
            lowConfidenceRegions: [
              { start: 200, end: 250, text: 'Term: 24 mon+hs', avgConfidence: 0.55, fieldType: 'term' },
              { start: 400, end: 450, text: 'Auto-renewal: Y3s', avgConfidence: 0.60, fieldType: 'renewal' },
              { start: 600, end: 650, text: 'Penalty: l0%', avgConfidence: 0.58, fieldType: 'penalty' },
            ],
            documentName: 'Master_Services_Agreement.pdf',
            documentType: 'MSA',
            pageCount: 28,
            createdAt: new Date(Date.now() - 1000 * 60 * 120),
            updatedAt: new Date(Date.now() - 1000 * 60 * 120),
          },
        ];

        const mockStats: ReviewQueueStats = {
          total: 15,
          byStatus: { pending: 8, in_progress: 3, completed: 3, rejected: 0, escalated: 1 },
          byPriority: { critical: 2, high: 4, medium: 6, low: 3 },
          avgTimeToComplete: 1.5,
          completedToday: 3,
          avgConfidenceImprovement: 0.15,
        };

        setItems(mockItems);
        setStats(mockStats);
      } catch (error) {
        console.error('Failed to load review queue:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, statusFilter]);

  // Filter items
  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (searchQuery && !item.documentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSelectItem = (item: ReviewItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
    onSelectItem?.(item);
  };

  const handleSubmitCorrections = async (
    corrections: any[],
    notes: string,
    score: number
  ) => {
    // In production, call API
    console.log('Submitting corrections:', { corrections, notes, score });
    setDialogOpen(false);
    setSelectedItem(null);
    
    // Refresh data
    // await loadData();
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats */}
      {stats && <StatsCards stats={stats} />}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Review Queue
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLoading(true)}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 max-w-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Items List */}
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items matching your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <ReviewItemRow
                    key={item.id}
                    item={item}
                    onSelect={() => handleSelectItem(item)}
                    onAssign={(userId) => console.log('Assign to:', userId)}
                    onEscalate={() => console.log('Escalate item:', item.id)}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Review Detail Dialog */}
      <ReviewDetailDialog
        item={selectedItem}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedItem(null); }}
        onSubmitCorrections={handleSubmitCorrections}
      />
    </div>
  );
};

export default HumanReviewQueue;
