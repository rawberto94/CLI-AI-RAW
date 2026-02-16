'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitCompare, 
  ArrowRight, 
  Check, 
  X, 
  AlertTriangle,
  Calendar,
  User,
  MessageSquare,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Plus,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface NegotiationRound {
  id: string;
  roundNumber: number;
  version: string;
  submittedBy: Party;
  submittedAt: Date | string;
  status: RoundStatus;
  changes: NegotiationChange[];
  comments: NegotiationComment[];
  responseDeadline?: Date | string;
}

interface NegotiationChange {
  id: string;
  section: string;
  clause: string;
  originalText: string;
  proposedText: string;
  changeType: ChangeType;
  status: ChangeStatus;
  importance: ChangeImportance;
  respondedBy?: string;
  respondedAt?: Date | string;
  responseNote?: string;
}

interface NegotiationComment {
  id: string;
  author: string;
  authorRole: string;
  content: string;
  timestamp: Date | string;
  replyTo?: string;
}

interface Party {
  name: string;
  role: 'initiator' | 'counterparty';
  representative: string;
  email: string;
}

type RoundStatus = 'pending' | 'in-review' | 'accepted' | 'countered' | 'rejected';
type ChangeType = 'addition' | 'deletion' | 'modification';
type ChangeStatus = 'pending' | 'accepted' | 'rejected' | 'countered';
type ChangeImportance = 'low' | 'medium' | 'high' | 'critical';

interface NegotiationTrackerProps {
  contractId: string;
  className?: string;
}

// ============================================================================
// API Integration
// ============================================================================

async function fetchContractNegotiationData(contractId: string): Promise<{
  parties: { initiator: Party; counterparty: Party };
  rounds: NegotiationRound[];
}> {
  // Fetch contract data for parties
  const contractRes = await fetch(`/api/contracts/${contractId}`);
  let parties: { initiator: Party; counterparty: Party } = {
    initiator: { name: 'Your Organization', role: 'initiator', representative: 'You', email: '' },
    counterparty: { name: 'Counterparty', role: 'counterparty', representative: 'TBD', email: '' },
  };
  let rounds: NegotiationRound[] = [];

  if (contractRes.ok) {
    const contractData = await contractRes.json();
    const c = contractData.contract || contractData;
    // Map contract parties
    const contractParties = c.parties || c.metadata?.parties || [];
    if (contractParties.length >= 1) {
      parties.initiator = {
        name: contractParties[0]?.name || c.tenantId || 'Your Organization',
        role: 'initiator',
        representative: contractParties[0]?.representative || contractParties[0]?.name || 'You',
        email: contractParties[0]?.email || '',
      };
    }
    if (contractParties.length >= 2) {
      parties.counterparty = {
        name: contractParties[1]?.name || c.supplier || 'Counterparty',
        role: 'counterparty',
        representative: contractParties[1]?.representative || contractParties[1]?.name || 'TBD',
        email: contractParties[1]?.email || '',
      };
    } else if (c.supplier) {
      parties.counterparty = {
        name: c.supplier,
        role: 'counterparty',
        representative: c.supplier,
        email: '',
      };
    }

    // Map contract activities as negotiation rounds
    const activities = c.activities || c.auditLog || [];
    const negotiationActivities = activities.filter((a: any) =>
      a.action?.includes('negotiat') || a.action?.includes('redline') ||
      a.action?.includes('counter') || a.action?.includes('review')
    );

    if (negotiationActivities.length > 0) {
      rounds = negotiationActivities.map((a: any, idx: number) => ({
        id: a.id || `round-${idx + 1}`,
        roundNumber: idx + 1,
        version: `v${idx + 1}.0`,
        submittedBy: idx % 2 === 0 ? parties.initiator : parties.counterparty,
        submittedAt: new Date(a.createdAt || a.timestamp || Date.now()),
        status: (a.status === 'accepted' ? 'accepted' :
                a.status === 'rejected' ? 'rejected' :
                a.status === 'countered' ? 'countered' :
                idx === negotiationActivities.length - 1 ? 'in-review' : 'countered') as RoundStatus,
        responseDeadline: a.dueDate ? new Date(a.dueDate) : undefined,
        changes: (a.changes || []).map((ch: any, ci: number) => ({
          id: ch.id || `change-${idx}-${ci}`,
          section: ch.section || ch.clause || `Section ${ci + 1}`,
          clause: ch.clause || ch.title || 'Modified Clause',
          originalText: ch.originalText || ch.before || '',
          proposedText: ch.proposedText || ch.after || ch.content || '',
          changeType: (ch.changeType || 'modification') as ChangeType,
          status: (ch.status || 'pending') as ChangeStatus,
          importance: (ch.importance || ch.priority || 'medium') as ChangeImportance,
          respondedBy: ch.respondedBy,
          respondedAt: ch.respondedAt ? new Date(ch.respondedAt) : undefined,
          responseNote: ch.responseNote || ch.note,
        })),
        comments: (a.comments || []).map((cm: any) => ({
          id: cm.id || `comment-${Math.random()}`,
          author: cm.author || cm.userName || 'User',
          authorRole: cm.authorRole || cm.role || '',
          content: cm.content || cm.message || '',
          timestamp: new Date(cm.createdAt || cm.timestamp || Date.now()),
        })),
      }));
    }
  }

  return { parties, rounds };
}

// ============================================================================
// Status & Importance Configs
// ============================================================================

const roundStatusConfig: Record<RoundStatus, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
  'in-review': { label: 'In Review', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  countered: { label: 'Countered', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
};

const changeStatusConfig: Record<ChangeStatus, { 
  label: string; 
  color: string;
  icon: React.ReactNode;
}> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: <Check className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <X className="h-3 w-3" /> },
  countered: { label: 'Countered', color: 'bg-violet-100 text-violet-700', icon: <GitCompare className="h-3 w-3" /> },
};

const importanceConfig: Record<ChangeImportance, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-violet-100 text-violet-600' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-600' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-600' },
};

const changeTypeConfig: Record<ChangeType, { label: string; color: string }> = {
  addition: { label: 'Added', color: 'text-green-600' },
  deletion: { label: 'Deleted', color: 'text-red-600' },
  modification: { label: 'Modified', color: 'text-amber-600' },
};

// ============================================================================
// Main Component
// ============================================================================

export function NegotiationTracker({ contractId, className }: NegotiationTrackerProps) {
  const [rounds, setRounds] = useState<NegotiationRound[]>([]);
  const [parties, setParties] = useState<{ initiator: Party; counterparty: Party }>({
    initiator: { name: 'Your Organization', role: 'initiator', representative: 'You', email: '' },
    counterparty: { name: 'Counterparty', role: 'counterparty', representative: 'TBD', email: '' },
  });
  const [loading, setLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchRounds();
  }, [contractId]);

  const fetchRounds = async () => {
    setLoading(true);
    try {
      const data = await fetchContractNegotiationData(contractId);
      setParties(data.parties);
      setRounds(data.rounds);
      // Auto-expand the latest round
      if (data.rounds.length > 0) {
        setExpandedRounds(new Set([data.rounds[0].id]));
      }
    } catch {
      // Keep empty state
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRounds(newExpanded);
  };

  const handleChangeResponse = (roundId: string, changeId: string, status: ChangeStatus) => {
    setRounds(prev => prev.map(round => {
      if (round.id !== roundId) return round;
      return {
        ...round,
        changes: round.changes.map(change => {
          if (change.id !== changeId) return change;
          return {
            ...change,
            status,
            respondedBy: 'Current User',
            respondedAt: new Date(),
          };
        }),
      };
    }));
  };

  const addComment = (roundId: string) => {
    if (!newComment.trim()) return;
    
    setRounds(prev => prev.map(round => {
      if (round.id !== roundId) return round;
      return {
        ...round,
        comments: [
          ...round.comments,
          {
            id: `comment-${Date.now()}`,
            author: 'Current User',
            authorRole: 'Your Role',
            content: newComment,
            timestamp: new Date(),
          },
        ],
      };
    }));
    setNewComment('');
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Stats
  const currentRound = rounds[0];
  const pendingChanges = currentRound?.changes.filter(c => c.status === 'pending').length || 0;
  const totalRounds = rounds.length;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Negotiation Tracker
            </CardTitle>
            <CardDescription>
              Track contract revisions and negotiate terms with counterparties
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchRounds}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Round
            </Button>
          </div>
        </div>

        {/* Parties Overview */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Initiator</div>
            <div className="font-medium">{parties.initiator.name}</div>
            <div className="text-sm text-muted-foreground">
              {parties.initiator.representative}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Counterparty</div>
            <div className="font-medium">{parties.counterparty.name}</div>
            <div className="text-sm text-muted-foreground">
              {parties.counterparty.representative}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span>{totalRounds} Rounds</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>{pendingChanges} Pending Changes</span>
          </div>
          {currentRound?.responseDeadline && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Due: {formatDate(currentRound.responseDeadline)}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitCompare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No negotiation rounds yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start negotiating by creating the first round
            </p>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Start Negotiation
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rounds.map((round) => {
              const isExpanded = expandedRounds.has(round.id);
              const status = roundStatusConfig[round.status];
              
              return (
                <div
                  key={round.id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Round Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(round.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {round.roundNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Round {round.roundNumber}</span>
                            <Badge variant="outline">{round.version}</Badge>
                            <Badge 
                              variant="secondary"
                              className={cn("text-xs", status.color)}
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Submitted by {round.submittedBy.representative} ({round.submittedBy.name})
                            <span className="mx-1">•</span>
                            {formatDate(round.submittedAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {round.changes.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {round.changes.length} change{round.changes.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t">
                      {/* Changes */}
                      {round.changes.length > 0 && (
                        <div className="p-4 space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Proposed Changes
                          </h4>
                          {round.changes.map((change) => {
                            const changeStatus = changeStatusConfig[change.status];
                            const importance = importanceConfig[change.importance];
                            const changeType = changeTypeConfig[change.changeType];
                            
                            return (
                              <div
                                key={change.id}
                                className="border rounded-lg p-3 bg-muted/20"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{change.clause}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {change.section}
                                      </Badge>
                                      <Badge 
                                        variant="secondary"
                                        className={cn("text-xs", importance.color)}
                                      >
                                        {importance.label}
                                      </Badge>
                                      <span className={cn("text-xs", changeType.color)}>
                                        {changeType.label}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge 
                                    variant="secondary"
                                    className={cn("text-xs flex items-center gap-1", changeStatus.color)}
                                  >
                                    {changeStatus.icon}
                                    {changeStatus.label}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {change.originalText && (
                                    <div>
                                      <div className="text-xs text-muted-foreground mb-1">
                                        Original
                                      </div>
                                      <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded border-l-2 border-red-400">
                                        {change.originalText}
                                      </div>
                                    </div>
                                  )}
                                  <div className={cn(!change.originalText && "col-span-2")}>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Proposed
                                    </div>
                                    <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded border-l-2 border-green-400">
                                      {change.proposedText}
                                    </div>
                                  </div>
                                </div>

                                {change.responseNote && (
                                  <div className="mt-2 text-sm text-muted-foreground italic">
                                    Note: {change.responseNote}
                                  </div>
                                )}

                                {change.status === 'pending' && (
                                  <div className="flex items-center gap-2 mt-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 hover:text-green-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangeResponse(round.id, change.id, 'accepted');
                                      }}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangeResponse(round.id, change.id, 'rejected');
                                      }}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangeResponse(round.id, change.id, 'countered');
                                      }}
                                    >
                                      <GitCompare className="h-3 w-3 mr-1" />
                                      Counter
                                    </Button>
                                  </div>
                                )}

                                {change.respondedBy && (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Responded by {change.respondedBy} on {formatDate(change.respondedAt!)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comments */}
                      <div className="p-4 border-t bg-muted/10">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                          Discussion
                        </h4>
                        
                        {round.comments.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {round.comments.map((comment) => (
                              <div key={comment.id} className="flex gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(comment.author)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{comment.author}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {comment.authorRole}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(comment.timestamp)}
                                    </span>
                                  </div>
                                  <p className="text-sm">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="min-h-[60px]"
                          />
                          <Button
                            size="sm"
                            onClick={() => addComment(round.id)}
                            disabled={!newComment.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NegotiationTracker;
