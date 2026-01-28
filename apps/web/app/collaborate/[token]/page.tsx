'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Download,
  MessageSquare,
  Eye,
  Clock,
  Building,
  User,
  AlertTriangle,
  CheckCircle,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface Contract {
  id: string;
  name: string;
  type: string;
  effectiveDate?: string;
  expirationDate?: string;
  parties: string[];
}

interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  isInternal: boolean;
}

interface CollaboratorInfo {
  name?: string;
  email: string;
  organization?: string;
  type: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canComment: boolean;
  };
  expiresAt: string;
}

export default function CollaboratorPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborator, setCollaborator] = useState<CollaboratorInfo | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/collaborate/${token}`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Invalid or expired access link');
        } else if (response.status === 403) {
          setError('Access has been revoked');
        } else {
          setError('Failed to load portal');
        }
        return;
      }

      const data = await response.json();
      setCollaborator(data.collaborator);
      setContracts(data.contracts);
    } catch (err) {
      setError('Failed to load portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  const handleView = async (contract: Contract) => {
    try {
      const response = await fetch(`/api/collaborate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view',
          contractId: contract.id,
        }),
      });

      if (response.ok) {
        // Open contract viewer or redirect
        window.open(`/api/collaborate/${token}/view/${contract.id}`, '_blank');
      }
    } catch {
      toast.error('Failed to view contract');
    }
  };

  const handleDownload = async (contract: Contract) => {
    try {
      const response = await fetch(`/api/collaborate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          contractId: contract.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.downloadUrl) {
          window.location.href = data.downloadUrl;
        }
      }
    } catch {
      toast.error('Failed to download contract');
    }
  };

  const handleOpenComments = async (contract: Contract) => {
    setSelectedContract(contract);
    setShowComments(true);

    try {
      const response = await fetch(`/api/collaborate/${token}/comments?contractId=${contract.id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch {
      console.error('Failed to load comments');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedContract) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/collaborate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          contractId: selectedContract.id,
          comment: newComment,
        }),
      });

      if (response.ok) {
        toast.success('Comment added');
        setNewComment('');
        handleOpenComments(selectedContract); // Refresh comments
      }
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Please contact the organization for a new access link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!collaborator) return null;

  const isExpiringSoon = new Date(collaborator.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Contract Portal</h1>
              <p className="text-sm text-muted-foreground">
                Shared with {collaborator.name || collaborator.email}
                {collaborator.organization && ` • ${collaborator.organization}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize">
                {collaborator.type}
              </Badge>
              {isExpiringSoon ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {formatDistanceToNow(new Date(collaborator.expiresAt), { addSuffix: true })}
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Valid until {format(new Date(collaborator.expiresAt), 'MMM d, yyyy')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Permissions Banner */}
      <div className="bg-violet-50 border-b">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Your permissions:</span>
            {collaborator.permissions.canView && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4 text-violet-600" /> View
              </span>
            )}
            {collaborator.permissions.canDownload && (
              <span className="flex items-center gap-1">
                <Download className="h-4 w-4 text-green-600" /> Download
              </span>
            )}
            {collaborator.permissions.canComment && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4 text-purple-600" /> Comment
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold mb-4">Shared Contracts ({contracts.length})</h2>

        {contracts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No contracts have been shared with you yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contracts.map(contract => (
              <Card key={contract.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-violet-600" />
                    <Badge variant="outline">{contract.type}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{contract.name}</CardTitle>
                  {contract.parties && contract.parties.length > 0 && (
                    <CardDescription>
                      {contract.parties.join(' • ')}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {(contract.effectiveDate || contract.expirationDate) && (
                    <div className="text-sm text-muted-foreground mb-4">
                      {contract.effectiveDate && (
                        <p>Effective: {format(new Date(contract.effectiveDate), 'MMM d, yyyy')}</p>
                      )}
                      {contract.expirationDate && (
                        <p>Expires: {format(new Date(contract.expirationDate), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {collaborator.permissions.canView && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleView(contract)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    {collaborator.permissions.canDownload && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownload(contract)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                    {collaborator.permissions.canComment && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenComments(contract)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
            <DialogDescription>
              {selectedContract?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-auto space-y-3">
            {comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No comments yet</p>
            ) : (
              comments.map(comment => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg ${comment.isInternal ? 'bg-violet-50' : 'bg-muted'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {collaborator.permissions.canComment && (
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={handleSubmitComment} disabled={isSubmitting || !newComment.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          This is a secure portal. Your access is logged for security purposes.
        </div>
      </footer>
    </div>
  );
}
