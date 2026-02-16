'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Reply, 
  ThumbsUp,
  AtSign,
  Smile,
  X,
  ChevronDown,
  Clock,
  User,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    layout?: boolean;
    className?: string;
    key?: string;
  }
>;

interface Comment {
  id: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  replyTo?: string;
  reactions: {
    emoji: string;
    users: string[];
  }[];
  mentions: string[];
}

interface CommentsThreadProps {
  approvalId: string;
  currentUserId?: string;
  currentUserName?: string;
  onCommentAdded?: () => void;
  className?: string;
}

// Mock current user
const currentUser = {
  id: 'current-user',
  name: 'You',
  email: 'you@company.com',
};

// Mock comments for demo
const mockComments: Comment[] = [
  {
    id: 'c1',
    author: {
      id: 'user-1',
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
    },
    content: 'I\'ve reviewed the terms and they look good. The pricing is in line with our budget.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    reactions: [
      { emoji: '👍', users: ['user-2', 'user-3'] },
    ],
    mentions: [],
  },
  {
    id: 'c2',
    author: {
      id: 'user-2',
      name: 'Michael Chen',
      email: 'michael@company.com',
    },
    content: '@Sarah Johnson can you double-check the SLA commitments? I noticed the uptime guarantee is 99.5% which is lower than our standard.',
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    reactions: [],
    mentions: ['Sarah Johnson'],
  },
  {
    id: 'c3',
    author: {
      id: 'user-1',
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
    },
    content: 'Good catch! I\'ll request an amendment to increase the uptime guarantee to 99.9%.',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    replyTo: 'c2',
    reactions: [
      { emoji: '✅', users: ['user-2'] },
    ],
    mentions: [],
  },
];

export function CommentsThread({ 
  approvalId, 
  currentUserId = currentUser.id,
  currentUserName = currentUser.name,
  onCommentAdded,
  className 
}: CommentsThreadProps) {
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [newComment, setNewComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newComment]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const comment: Comment = {
        id: `c${Date.now()}`,
        author: {
          id: currentUserId,
          name: currentUserName,
          email: 'you@company.com',
        },
        content,
        createdAt: new Date().toISOString(),
        replyTo: replyingTo || undefined,
        reactions: [],
        mentions: content.match(/@[\w\s]+/g)?.map(m => m.slice(1)) || [],
      };
      
      return comment;
    },
    onSuccess: (comment) => {
      setComments(prev => [...prev, comment]);
      setNewComment('');
      setReplyingTo(null);
      toast.success('Comment added');
      onCommentAdded?.();
      queryClient.invalidateQueries({ queryKey: ['approval-comments', approvalId] });
    },
    onError: () => {
      toast.error('Failed to add comment');
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return commentId;
    },
    onSuccess: (commentId) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  // Edit comment mutation
  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { commentId, content };
    },
    onSuccess: ({ commentId, content }) => {
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, content, isEdited: true, updatedAt: new Date().toISOString() }
          : c
      ));
      setEditingId(null);
      setEditContent('');
      toast.success('Comment updated');
    },
    onError: () => {
      toast.error('Failed to update comment');
    },
  });

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { commentId, emoji };
    },
    onSuccess: ({ commentId, emoji }) => {
      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        
        const existingReaction = c.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          // Toggle reaction
          if (existingReaction.users.includes(currentUserId)) {
            return {
              ...c,
              reactions: c.reactions.map(r => 
                r.emoji === emoji 
                  ? { ...r, users: r.users.filter(u => u !== currentUserId) }
                  : r
              ).filter(r => r.users.length > 0),
            };
          } else {
            return {
              ...c,
              reactions: c.reactions.map(r =>
                r.emoji === emoji
                  ? { ...r, users: [...r.users, currentUserId] }
                  : r
              ),
            };
          }
        } else {
          return {
            ...c,
            reactions: [...c.reactions, { emoji, users: [currentUserId] }],
          };
        }
      }));
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const timeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const quickEmojis = ['👍', '👏', '✅', '❤️', '🎉', '👀'];

  return (
    <div 
      className={cn("bg-white rounded-xl border border-slate-200 overflow-hidden", className)}
      role="region"
      aria-label="Discussion thread"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="comments-list"
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span className="font-medium text-slate-900">Discussion</span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full" aria-label={`${comments.length} comments`}>
            {comments.length}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-slate-400 transition-transform",
          isExpanded && "rotate-180"
        )} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <MotionDiv key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Comments List */}
            <div id="comments-list" className="max-h-[400px] overflow-y-auto" role="list" aria-label="Comments">
              {comments.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-slate-500">No comments yet</p>
                  <p className="text-sm text-slate-400">Start the discussion below</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {comments.map(comment => {
                    const isOwn = comment.author.id === currentUserId;
                    const replyParent = comment.replyTo 
                      ? comments.find(c => c.id === comment.replyTo)
                      : null;

                    return (
                      <MotionDiv
                        key={comment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 hover:bg-slate-50/50 transition-colors group"
                      >
                        {/* Reply indicator */}
                        {replyParent && (
                          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                            <Reply className="w-3 h-3 rotate-180" />
                            <span>Replying to {replyParent.author.name}</span>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0",
                            isOwn ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {comment.author.avatar ? (
                              
                              <img 
                                src={comment.author.avatar} 
                                alt={comment.author.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              comment.author.name.charAt(0)
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900">
                                {comment.author.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                {timeAgo(comment.createdAt)}
                              </span>
                              {comment.isEdited && (
                                <span className="text-xs text-slate-400">(edited)</span>
                              )}
                            </div>

                            {/* Content */}
                            {editingId === comment.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  rows={2}
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => editCommentMutation.mutate({ 
                                      commentId: comment.id, 
                                      content: editContent 
                                    })}
                                    disabled={editCommentMutation.isPending}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditContent('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {comment.content.split(/(@[\w\s]+)/g).map((part, idx) => 
                                  part.startsWith('@') ? (
                                    <span key={idx} className="text-violet-600 font-medium">
                                      {part}
                                    </span>
                                  ) : part
                                )}
                              </p>
                            )}

                            {/* Reactions */}
                            {comment.reactions.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {comment.reactions.map((reaction, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => addReactionMutation.mutate({ 
                                      commentId: comment.id, 
                                      emoji: reaction.emoji 
                                    })}
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors",
                                      reaction.users.includes(currentUserId)
                                        ? "bg-violet-100 text-violet-700"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.users.length}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            {editingId !== comment.id && (
                              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Quick reactions */}
                                <div className="flex items-center gap-0.5">
                                  {quickEmojis.slice(0, 3).map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => addReactionMutation.mutate({ 
                                        commentId: comment.id, 
                                        emoji 
                                      })}
                                      className="p-1 hover:bg-slate-100 rounded text-sm"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => {
                                    setReplyingTo(comment.id);
                                    textareaRef.current?.focus();
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                >
                                  <Reply className="w-3.5 h-3.5" />
                                </button>

                                {isOwn && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuItem onClick={() => {
                                        setEditingId(comment.id);
                                        setEditContent(comment.content);
                                      }}>
                                        <Edit2 className="w-3.5 h-3.5 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-red-600"
                                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </MotionDiv>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="px-4 py-2 bg-violet-50 border-t border-violet-100 flex items-center justify-between">
                <span className="text-sm text-violet-600">
                  Replying to {comments.find(c => c.id === replyingTo)?.author.name}
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-violet-500 hover:text-violet-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {currentUserName.charAt(0)}
                </div>
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment... Use @ to mention someone"
                    aria-label="Write a comment"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[40px] max-h-[120px]"
                    rows={1}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting options">
                      <button 
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="Mention someone"
                      >
                        <AtSign className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button 
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="Add emoji"
                      >
                        <Smile className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button 
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="Attach file"
                      >
                        <Paperclip className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ⌘+Enter to send
                      </span>
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                        className="gap-1"
                        aria-label="Send comment"
                      >
                        {addCommentMutation.isPending ? (
                          <Clock className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CommentsThread;
