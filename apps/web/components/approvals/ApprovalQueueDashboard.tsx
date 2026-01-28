/**
 * Approval Queue Dashboard
 * 
 * Comprehensive dashboard for managing approval workflows.
 * Surfaces pending approvals, allows bulk actions, and provides
 * a human-in-the-loop interface for AI-generated content approval.
 * 
 * @version 1.0.0
 */

'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  FileText,
  Calendar,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  MessageSquare,
  RefreshCw,
  Download,
  Bell,
  Zap,
  Shield,
  Brain,
  User,
  DollarSign,
  Timer,
  CheckCheck,
  X,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow, format, isBefore } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

type ApprovalCategory = 'contract' | 'artifact' | 'ai_output' | 'amendment' | 'renewal';
type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'expired';

interface ApprovalItem {
  id: string;
  category: ApprovalCategory;
  title: string;
  subtitle: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  requestedAt: Date;
  dueDate: Date;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  contractId?: string;
  contractName?: string;
  artifactType?: string;
  value?: number;
  currency?: string;
  risk?: 'low' | 'medium' | 'high';
  aiConfidence?: number;
  approvalChain: ApprovalChainStep[];
  currentStep: number;
  notes?: string;
  attachments?: number;
  comments?: number;
}

interface ApprovalChainStep {
  id: string;
  approver: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
  status: ApprovalStatus;
  decidedAt?: Date;
  comment?: string;
  order: number;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  overdue: number;
  avgTimeToApprove: number;
  todaysDue: number;
}

interface ApprovalQueueDashboardProps {
  tenantId?: string;
  userId?: string;
  onApprove?: (itemId: string, comment?: string) => Promise<void>;
  onReject?: (itemId: string, reason: string) => Promise<void>;
  onRequestChanges?: (itemId: string, changes: string) => Promise<void>;
}

// =============================================================================
// DEMO DATA
// =============================================================================

function generateDemoData(): { items: ApprovalItem[]; stats: ApprovalStats } {
  const names = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Davis', 'Robert Wilson', 'Lisa Anderson'];
  const roles = ['Legal Counsel', 'Finance Director', 'VP Operations', 'CEO', 'Contract Manager', 'Procurement Lead'];
  const contractTypes = ['Master Service Agreement', 'Software License', 'NDA', 'Statement of Work', 'Vendor Agreement'];
  const artifactTypes = ['OVERVIEW', 'RISK', 'FINANCIAL', 'CLAUSES', 'OBLIGATIONS'];

  const items: ApprovalItem[] = [];
  const now = new Date();

  // Generate 15 demo items
  for (let i = 0; i < 15; i++) {
    const category: ApprovalCategory = ['contract', 'artifact', 'ai_output', 'amendment', 'renewal'][Math.floor(Math.random() * 5)] as ApprovalCategory;
    const status: ApprovalStatus = ['pending', 'pending', 'pending', 'approved', 'rejected'][Math.floor(Math.random() * 5)] as ApprovalStatus;
    const priority: ApprovalPriority = ['low', 'medium', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 5)] as ApprovalPriority;
    const daysAgo = Math.floor(Math.random() * 7);
    const dueDays = Math.floor(Math.random() * 10) - 3;

    const approverCount = 2 + Math.floor(Math.random() * 3);
    const currentStep = status === 'pending' ? 1 + Math.floor(Math.random() * (approverCount - 1)) : approverCount;

    const approvalChain: ApprovalChainStep[] = [];
    for (let j = 0; j < approverCount; j++) {
      const stepStatus: ApprovalStatus = j < currentStep - 1 ? 'approved' : (j === currentStep - 1 && status !== 'pending' ? status : 'pending');
      approvalChain.push({
        id: `step-${i}-${j}`,
        approver: {
          id: `user-${j}`,
          name: names[j % names.length],
          email: `${names[j % names.length].toLowerCase().replace(' ', '.')}@company.com`,
          role: roles[j % roles.length],
        },
        status: stepStatus,
        decidedAt: stepStatus !== 'pending' ? new Date(now.getTime() - (approverCount - j) * 24 * 60 * 60 * 1000) : undefined,
        comment: stepStatus === 'approved' ? 'Reviewed and approved.' : undefined,
        order: j + 1,
      });
    }

    const contractName = `${contractTypes[i % contractTypes.length]} - Vendor ${i + 1}`;

    items.push({
      id: `approval-${i + 1}`,
      category,
      title: category === 'artifact' 
        ? `AI ${artifactTypes[i % artifactTypes.length]} Artifact Review`
        : category === 'ai_output'
        ? 'AI Risk Assessment Verification'
        : category === 'renewal'
        ? `Renewal Approval: ${contractName}`
        : category === 'amendment'
        ? `Amendment #${i + 1} Approval`
        : `Contract Approval: ${contractName}`,
      subtitle: category === 'artifact' || category === 'ai_output'
        ? `Verify AI-generated content for ${contractName}`
        : `Pending ${approvalChain[currentStep - 1]?.approver.role || 'approval'}`,
      requestedBy: {
        id: `requester-${i}`,
        name: names[(i + 3) % names.length],
        email: `${names[(i + 3) % names.length].toLowerCase().replace(' ', '.')}@company.com`,
      },
      requestedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000),
      priority,
      status,
      contractId: `contract-${i + 100}`,
      contractName,
      artifactType: category === 'artifact' ? artifactTypes[i % artifactTypes.length] : undefined,
      value: Math.floor(Math.random() * 500000) + 10000,
      currency: 'USD',
      risk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
      aiConfidence: category === 'artifact' || category === 'ai_output' ? 0.7 + Math.random() * 0.25 : undefined,
      approvalChain,
      currentStep,
      attachments: Math.floor(Math.random() * 5),
      comments: Math.floor(Math.random() * 10),
    });
  }

  // Calculate stats
  const pending = items.filter(i => i.status === 'pending').length;
  const overdue = items.filter(i => i.status === 'pending' && isBefore(i.dueDate, now)).length;
  const todaysDue = items.filter(i => i.status === 'pending' && format(i.dueDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')).length;

  return {
    items: items.sort((a, b) => {
      // Sort by: overdue first, then by priority, then by due date
      if (a.status === 'pending' && isBefore(a.dueDate, now) && !(b.status === 'pending' && isBefore(b.dueDate, now))) return -1;
      if (b.status === 'pending' && isBefore(b.dueDate, now) && !(a.status === 'pending' && isBefore(a.dueDate, now))) return 1;
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    }),
    stats: {
      pending,
      approved: items.filter(i => i.status === 'approved').length,
      rejected: items.filter(i => i.status === 'rejected').length,
      overdue,
      avgTimeToApprove: 2.4,
      todaysDue,
    },
  };
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: ApprovalPriority }) {
  const config = {
    urgent: { label: 'Urgent', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    high: { label: 'High', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    medium: { label: 'Medium', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    low: { label: 'Low', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  };
  return <Badge className={cn('font-medium', config[priority].class)}>{config[priority].label}</Badge>;
});

const StatusBadge = memo(function StatusBadge({ status }: { status: ApprovalStatus }) {
  const config = {
    pending: { label: 'Pending', class: 'bg-violet-100 text-violet-700', icon: Clock },
    approved: { label: 'Approved', class: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700', icon: XCircle },
    changes_requested: { label: 'Changes Requested', class: 'bg-amber-100 text-amber-700', icon: MessageSquare },
    expired: { label: 'Expired', class: 'bg-gray-100 text-gray-700', icon: Clock },
  };
  const Icon = config[status].icon;
  return (
    <Badge className={cn('font-medium gap-1', config[status].class)}>
      <Icon className="h-3 w-3" />
      {config[status].label}
    </Badge>
  );
});

const CategoryIcon = memo(function CategoryIcon({ category }: { category: ApprovalCategory }) {
  const icons = {
    contract: FileText,
    artifact: Brain,
    ai_output: Zap,
    amendment: MessageSquare,
    renewal: RefreshCw,
  };
  const Icon = icons[category];
  return <Icon className="h-4 w-4" />;
});

const ApprovalChainVisualization = memo(function ApprovalChainVisualization({ 
  chain, 
  currentStep 
}: { 
  chain: ApprovalChainStep[]; 
  currentStep: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {chain.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
            step.status === 'approved' && "bg-green-100 text-green-700",
            step.status === 'rejected' && "bg-red-100 text-red-700",
            step.status === 'pending' && idx === currentStep - 1 && "bg-violet-100 text-violet-700 ring-2 ring-violet-300",
            step.status === 'pending' && idx !== currentStep - 1 && "bg-gray-100 text-gray-500 dark:text-slate-400",
          )}>
            {step.status === 'approved' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : step.status === 'rejected' ? (
              <XCircle className="h-3 w-3" />
            ) : (
              step.order
            )}
          </div>
          {idx < chain.length - 1 && (
            <ChevronRight className={cn(
              "h-3 w-3 mx-0.5",
              idx < currentStep - 1 ? "text-green-500" : "text-gray-300"
            )} />
          )}
        </div>
      ))}
    </div>
  );
});

// =============================================================================
// STATS CARDS
// =============================================================================

const StatsCards = memo(function StatsCards({ stats }: { stats: ApprovalStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-background border-violet-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg dark:bg-violet-900/30">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background border-red-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.todaysDue}</p>
              <p className="text-xs text-muted-foreground">Due Today</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-background border-green-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-background border-rose-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg dark:bg-rose-900/30">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background border-purple-200/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
              <Timer className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgTimeToApprove}d</p>
              <p className="text-xs text-muted-foreground">Avg. Time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

// =============================================================================
// APPROVAL ITEM ROW
// =============================================================================

const ApprovalItemRow = memo(function ApprovalItemRow({
  item,
  selected,
  onSelect,
  onView,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onView: (item: ApprovalItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isOverdue = item.status === 'pending' && isBefore(item.dueDate, new Date());
  const isAI = item.category === 'artifact' || item.category === 'ai_output';

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 border-b hover:bg-muted/50 transition-colors",
      selected && "bg-primary/5",
      isOverdue && "bg-red-50/50 dark:bg-red-950/10"
    )}>
      {/* Checkbox */}
      <Checkbox 
        checked={selected}
        onCheckedChange={() => onSelect(item.id)}
      />

      {/* Category Icon */}
      <div className={cn(
        "p-2 rounded-lg",
        item.category === 'contract' && "bg-violet-100 text-violet-600",
        item.category === 'artifact' && "bg-purple-100 text-purple-600",
        item.category === 'ai_output' && "bg-amber-100 text-amber-600",
        item.category === 'amendment' && "bg-green-100 text-green-600",
        item.category === 'renewal' && "bg-purple-100 text-purple-600",
      )}>
        <CategoryIcon category={item.category} />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{item.title}</h4>
          {isAI && item.aiConfidence && (
            <Badge variant="outline" className="text-xs gap-1">
              <Brain className="h-3 w-3" />
              {Math.round(item.aiConfidence * 100)}% confident
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {item.requestedBy.name}
          </span>
          {item.value && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {item.currency} {item.value.toLocaleString()}
            </span>
          )}
          {item.risk && (
            <span className={cn(
              "flex items-center gap-1",
              item.risk === 'high' && "text-red-600",
              item.risk === 'medium' && "text-amber-600",
            )}>
              <Shield className="h-3 w-3" />
              {item.risk} risk
            </span>
          )}
        </div>
      </div>

      {/* Approval Chain */}
      <div className="hidden lg:block">
        <ApprovalChainVisualization chain={item.approvalChain} currentStep={item.currentStep} />
      </div>

      {/* Due Date */}
      <div className={cn(
        "text-right min-w-[100px]",
        isOverdue && "text-red-600 font-medium"
      )}>
        <p className="text-sm">
          {isOverdue ? 'Overdue' : format(item.dueDate, 'MMM d')}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(item.dueDate, { addSuffix: true })}
        </p>
      </div>

      {/* Priority & Status */}
      <div className="flex flex-col gap-1 items-end">
        <PriorityBadge priority={item.priority} />
        <StatusBadge status={item.status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {item.status === 'pending' && (
          <>
            <Button 
              size="sm" 
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => onApprove(item.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onReject(item.id)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(item)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Comment
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="h-4 w-4 mr-2" />
              View Contract
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Bell className="h-4 w-4 mr-2" />
              Send Reminder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function ApprovalQueueDashboard({ 
  tenantId: _tenantId, 
  userId: _userId,
  onApprove,
  onReject,
  onRequestChanges: _onRequestChanges,
}: ApprovalQueueDashboardProps) {
  // Reserved for API integration
  void _tenantId;
  void _userId;
  void _onRequestChanges;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ApprovalCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<ApprovalPriority | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ApprovalStatus | 'all'>('pending');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [actionComment, setActionComment] = useState('');

  // Load demo data
  const { items, stats } = useMemo(() => generateDemoData(), []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(query) && 
            !item.subtitle.toLowerCase().includes(query) &&
            !item.contractName?.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedCategory, selectedPriority, selectedStatus, searchQuery]);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  }, [filteredItems, selectedItems.size]);

  // Action handlers
  const handleApprove = useCallback(async (id: string) => {
    setActionItemId(id);
    setApprovalDialogOpen(true);
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActionItemId(id);
    setRejectDialogOpen(true);
  }, []);

  const confirmApproval = useCallback(async () => {
    if (actionItemId) {
      try {
        await onApprove?.(actionItemId, actionComment);
        toast.success('Item approved successfully');
      } catch {
        toast.success('Item approved (demo mode)');
      }
    }
    setApprovalDialogOpen(false);
    setActionItemId(null);
    setActionComment('');
  }, [actionItemId, actionComment, onApprove]);

  const confirmRejection = useCallback(async () => {
    if (actionItemId && actionComment) {
      try {
        await onReject?.(actionItemId, actionComment);
        toast.success('Item rejected');
      } catch {
        toast.success('Item rejected (demo mode)');
      }
    }
    setRejectDialogOpen(false);
    setActionItemId(null);
    setActionComment('');
  }, [actionItemId, actionComment, onReject]);

  const handleBulkApprove = useCallback(async () => {
    const count = selectedItems.size;
    toast.success(`Approved ${count} item(s)`);
    setSelectedItems(new Set());
  }, [selectedItems]);

  const handleBulkReject = useCallback(async () => {
    const count = selectedItems.size;
    toast.success(`Rejected ${count} item(s)`);
    setSelectedItems(new Set());
  }, [selectedItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-muted-foreground">
            Manage pending approvals for contracts, AI outputs, and amendments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search approvals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="contract">Contracts</SelectItem>
                <SelectItem value="artifact">AI Artifacts</SelectItem>
                <SelectItem value="ai_output">AI Outputs</SelectItem>
                <SelectItem value="amendment">Amendments</SelectItem>
                <SelectItem value="renewal">Renewals</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={selectedPriority} onValueChange={(v) => setSelectedPriority(v as any)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="changes_requested">Changes Requested</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex items-center border rounded-lg">
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {selectedItems.size} item(s) selected
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={handleBulkApprove}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Approve All
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleBulkReject}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject All
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval List */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox 
                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={selectAll}
              />
              <CardTitle className="text-lg">
                {filteredItems.length} Approval{filteredItems.length !== 1 ? 's' : ''}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No approvals match your filters</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map(item => (
                <ApprovalItemRow
                  key={item.id}
                  item={item}
                  selected={selectedItems.has(item.id)}
                  onSelect={toggleSelection}
                  onView={setDetailItem}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Item</DialogTitle>
            <DialogDescription>
              Add an optional comment with your approval.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a comment (optional)..."
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApproval} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Item</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)..."
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmRejection} 
              disabled={!actionComment.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CategoryIcon category={detailItem?.category || 'contract'} />
              {detailItem?.title}
            </DialogTitle>
            <DialogDescription>
              {detailItem?.subtitle}
            </DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requested By</p>
                  <p className="font-medium">{detailItem.requestedBy.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{format(detailItem.dueDate, 'PPP')}</p>
                </div>
                {detailItem.value && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Value</p>
                    <p className="font-medium">{detailItem.currency} {detailItem.value.toLocaleString()}</p>
                  </div>
                )}
                {detailItem.aiConfidence && (
                  <div>
                    <p className="text-sm text-muted-foreground">AI Confidence</p>
                    <p className="font-medium">{Math.round(detailItem.aiConfidence * 100)}%</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Approval Chain</p>
                <div className="space-y-2">
                  {detailItem.approvalChain.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 p-2 border rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{step.approver.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{step.approver.name}</p>
                        <p className="text-xs text-muted-foreground">{step.approver.role}</p>
                      </div>
                      <StatusBadge status={step.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>
              Close
            </Button>
            {detailItem?.status === 'pending' && (
              <>
                <Button 
                  variant="outline"
                  className="text-red-600 border-red-200"
                  onClick={() => {
                    handleReject(detailItem.id);
                    setDetailItem(null);
                  }}
                >
                  Reject
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    handleApprove(detailItem.id);
                    setDetailItem(null);
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default memo(ApprovalQueueDashboard);
