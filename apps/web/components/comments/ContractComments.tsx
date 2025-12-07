/**
 * Contract Comments
 * Collaborative commenting system for contracts
 */

'use client';

import { memo, useState, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Reply,
  MoreHorizontal,
  Edit,
  Trash2,
  Pin,
  Heart,
  Check,
  X,
  Loader2,
  AtSign,
  Paperclip,
  Smile,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

interface Comment {
  id: string;
  content: string;
  author: User;
  createdAt: Date;
  updatedAt?: Date;
  isPinned?: boolean;
  isResolved?: boolean;
  reactions: { emoji: string; users: string[] }[];
  replies: Comment[];
  mentions?: string[];
  attachmentName?: string;
  pageReference?: number;
  clauseReference?: string;
}

// Demo data
const currentUser: User = {
  id: 'user-1',
  name: 'John Smith',
  email: 'john@company.com',
  role: 'Contract Manager',
};

const demoComments: Comment[] = [
  {
    id: 'c1',
    content: 'The payment terms in Section 4.2 need to be reviewed. The NET-60 doesn\'t align with our standard NET-30 policy.',
    author: {
      id: 'user-2',
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
      role: 'Legal Counsel',
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isPinned: true,
    isResolved: false,
    reactions: [{ emoji: '👍', users: ['user-1', 'user-3'] }],
    replies: [
      {
        id: 'r1',
        content: 'Good catch. I\'ll reach out to the vendor to negotiate NET-30.',
        author: currentUser,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        reactions: [],
        replies: [],
      },
    ],
    pageReference: 5,
    clauseReference: '4.2',
  },
  {
    id: 'c2',
    content: '@Michael Can you verify the liability cap is appropriate for this contract value?',
    author: {
      id: 'user-3',
      name: 'Emily Davis',
      email: 'emily@company.com',
      role: 'VP Operations',
    },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isResolved: true,
    reactions: [],
    replies: [
      {
        id: 'r2',
        content: 'Verified. The $2M cap is within acceptable range for the contract value.',
        author: {
          id: 'user-4',
          name: 'Michael Chen',
          email: 'michael@company.com',
          role: 'Finance Director',
        },
        createdAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
        reactions: [{ emoji: '✅', users: ['user-3'] }],
        replies: [],
      },
    ],
    mentions: ['Michael'],
    clauseReference: '6.1',
  },
  {
    id: 'c3',
    content: 'I\'ve attached the updated scope of work document for reference.',
    author: currentUser,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    reactions: [{ emoji: '👀', users: ['user-2'] }],
    replies: [],
    attachmentName: 'Updated_SOW_v2.pdf',
  },
];

interface ContractCommentsProps {
  contractId: string;
  className?: string;
}

export const ContractComments = memo(function ContractComments({
  contractId,
  className,
}: ContractCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(demoComments);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'pinned'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredComments = comments.filter(comment => {
    if (filter === 'unresolved') return !comment.isResolved;
    if (filter === 'pinned') return comment.isPinned;
    return true;
  });

  const unresolvedCount = comments.filter(c => !c.isResolved).length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const comment: Comment = {
      id: `c${Date.now()}`,
      content: newComment,
      author: currentUser,
      createdAt: new Date(),
      reactions: [],
      replies: [],
    };

    setComments(prev => [comment, ...prev]);
    setNewComment('');
    setIsSubmitting(false);
    toast.success('Comment added');
  };

  const handleSubmitReply = async (commentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const reply: Comment = {
      id: `r${Date.now()}`,
      content: replyContent,
      author: currentUser,
      createdAt: new Date(),
      reactions: [],
      replies: [],
    };

    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, reply] }
          : c
      )
    );

    setReplyingTo(null);
    setReplyContent('');
    setIsSubmitting(false);
    toast.success('Reply added');
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, content: editContent, updatedAt: new Date() }
          : c
      )
    );

    setEditingComment(null);
    setEditContent('');
    toast.success('Comment updated');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    toast.success('Comment deleted');
  };

  const togglePin = (commentId: string) => {
    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, isPinned: !c.isPinned } : c
      )
    );
  };

  const toggleResolved = (commentId: string) => {
    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
      )
    );
    toast.success('Comment marked as resolved');
  };

  const addReaction = (commentId: string, emoji: string) => {
    setComments(prev =>
      prev.map(c => {
        if (c.id !== commentId) return c;

        const existingReaction = c.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          if (existingReaction.users.includes(currentUser.id)) {
            // Remove reaction
            return {
              ...c,
              reactions: c.reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, users: r.users.filter(u => u !== currentUser.id) }
                  : r
              ).filter(r => r.users.length > 0),
            };
          } else {
            // Add to existing reaction
            return {
              ...c,
              reactions: c.reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, users: [...r.users, currentUser.id] }
                  : r
              ),
            };
          }
        } else {
          // Add new reaction
          return {
            ...c,
            reactions: [...c.reactions, { emoji, users: [currentUser.id] }],
          };
        }
      })
    );
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      className={cn(
        'group',
        !isReply && 'border-b pb-4 last:border-b-0',
        isReply && 'mt-3 pl-4 border-l-2 border-slate-200'
      )}
    >
      <div className="flex gap-3">
        <Avatar className={cn('flex-shrink-0', isReply ? 'h-7 w-7' : 'h-9 w-9')}>
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
            {getInitials(comment.author.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.author.name}</span>
            {comment.author.role && (
              <Badge variant="outline" className="text-[10px] py-0">
                {comment.author.role}
              </Badge>
            )}
            <span className="text-xs text-slate-400">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
            {comment.updatedAt && (
              <span className="text-xs text-slate-400">(edited)</span>
            )}
            {comment.isPinned && (
              <Pin className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            )}
            {comment.isResolved && (
              <Badge variant="secondary" className="text-[10px] py-0 bg-green-100 text-green-700">
                Resolved
              </Badge>
            )}
          </div>

          {/* References */}
          {(comment.pageReference || comment.clauseReference) && (
            <div className="flex gap-2 mt-1">
              {comment.pageReference && (
                <Badge variant="outline" className="text-[10px] py-0">
                  Page {comment.pageReference}
                </Badge>
              )}
              {comment.clauseReference && (
                <Badge variant="outline" className="text-[10px] py-0">
                  Clause {comment.clauseReference}
                </Badge>
              )}
            </div>
          )}

          {/* Content */}
          {editingComment === comment.id ? (
            <div className="mt-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingComment(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleEditComment(comment.id)}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className={cn(
              'text-sm mt-1 text-slate-700',
              comment.isResolved && 'text-slate-500'
            )}>
              {comment.content}
            </p>
          )}

          {/* Attachment */}
          {comment.attachmentName && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-slate-50 rounded text-sm text-blue-600 hover:bg-slate-100 cursor-pointer">
              <Paperclip className="h-4 w-4" />
              {comment.attachmentName}
            </div>
          )}

          {/* Reactions */}
          {comment.reactions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {comment.reactions.map((reaction, i) => (
                <button
                  key={i}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                    reaction.users.includes(currentUser.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  )}
                  onClick={() => addReaction(comment.id, reaction.emoji)}
                >
                  {reaction.emoji}
                  <span>{reaction.users.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setReplyingTo(comment.id);
                      setReplyContent('');
                    }}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reply to this comment</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => addReaction(comment.id, '👍')}
            >
              <Heart className="h-3 w-3" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Smile className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <div className="flex gap-1 p-1">
                  {['👍', '👎', '❤️', '🎉', '😄', '🤔', '✅', '⚠️'].map(emoji => (
                    <button
                      key={emoji}
                      className="p-1.5 hover:bg-slate-100 rounded"
                      onClick={() => addReaction(comment.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isReply && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => toggleResolved(comment.id)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  {comment.isResolved ? 'Reopen' : 'Resolve'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => togglePin(comment.id)}>
                      <Pin className="h-4 w-4 mr-2" />
                      {comment.isPinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                    {comment.author.id === currentUser.id && (
                      <>
                        <DropdownMenuItem onClick={() => {
                          setEditingComment(comment.id);
                          setEditContent(comment.content);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Reply Input */}
          {replyingTo === comment.id && (
            <div className="mt-3 flex gap-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                className="text-sm"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Comments
          {comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </h3>

        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'unresolved' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('unresolved')}
          >
            Unresolved ({unresolvedCount})
          </Button>
          <Button
            variant={filter === 'pinned' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('pinned')}
          >
            <Pin className="h-3 w-3 mr-1" />
            Pinned
          </Button>
        </div>
      </div>

      {/* New Comment Input */}
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
            {getInitials(currentUser.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            placeholder="Add a comment... Use @ to mention someone"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7">
                <AtSign className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Comment
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {filteredComments.map(comment => renderComment(comment))}
      </div>

      {filteredComments.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>No comments yet</p>
          <p className="text-sm mt-1">Start the conversation!</p>
        </div>
      )}
    </div>
  );
});

export default ContractComments;
