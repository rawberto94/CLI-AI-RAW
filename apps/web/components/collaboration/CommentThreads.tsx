'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Reply,
  MoreHorizontal,
  Check,
  CheckCheck,
  Trash2,
  Edit2,
  Clock,
  AtSign,
  ThumbsUp,
  Loader2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useComments } from '@/hooks/use-collaboration';

interface CommentThreadsProps {
  contractId: string;
  className?: string;
}

interface Comment {
  id: string;
  author: string;
  authorEmail?: string;
  content: string;
  mentions: string[];
  isResolved: boolean;
  likes: number;
  createdAt: string;
  replies?: Comment[];
}

export function CommentThreads({ contractId, className }: CommentThreadsProps) {
  const { comments, addComment, resolveComment, isPosting, isLoading } = useComments(contractId);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mock team members for mentions
  const teamMembers = [
    { id: 'sarah', name: 'Sarah Johnson', email: 'sarah@company.com' },
    { id: 'mike', name: 'Mike Chen', email: 'mike@company.com' },
    { id: 'emily', name: 'Emily Davis', email: 'emily@company.com' },
    { id: 'james', name: 'James Wilson', email: 'james@company.com' },
  ];

  const filteredMembers = teamMembers.filter(
    m => m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionSearch(mentionMatch[1]);
      setMentionPosition(cursorPosition - mentionMatch[0].length);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member: typeof teamMembers[0]) => {
    const beforeMention = newComment.substring(0, mentionPosition);
    const afterMention = newComment.substring(mentionPosition + mentionSearch.length + 1);
    const newValue = `${beforeMention}@${member.name} ${afterMention}`;
    setNewComment(newValue);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    // Extract mentions from content
    const mentionRegex = /@([A-Za-z\s]+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentions.push(match[1].trim());
    }

    try {
      await addComment(newComment, replyTo || undefined, mentions);
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const highlightMentions = (content: string) => {
    return content.replace(
      /@([A-Za-z\s]+)/g,
      '<span class="text-blue-600 font-medium">@$1</span>'
    );
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Comments</h3>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {comments.length}
          </span>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No comments yet</p>
            <p className="text-sm text-slate-400 mt-1">Be the first to leave a comment</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {(comments as Comment[]).map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'rounded-xl border-2 transition-all',
                  comment.isResolved
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                {/* Main Comment */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {getInitials(comment.author)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{comment.author}</span>
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {comment.isResolved && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                              <CheckCheck className="w-3 h-3" />
                              Resolved
                            </span>
                          )}
                          <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>
                      
                      <p 
                        className="text-slate-700 text-sm"
                        dangerouslySetInnerHTML={{ __html: highlightMentions(comment.content) }}
                      />
                      
                      {/* Actions */}
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={() => setReplyTo(comment.id)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          Reply
                        </button>
                        
                        <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {comment.likes || 0}
                        </button>
                        
                        {!comment.isResolved && (
                          <button
                            onClick={() => resolveComment(comment.id)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {getInitials(reply.author)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm text-slate-900">{reply.author}</span>
                            <span className="text-xs text-slate-400">
                              {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p 
                            className="text-slate-600 text-sm"
                            dangerouslySetInnerHTML={{ __html: highlightMentions(reply.content) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input */}
                {replyTo === comment.id && (
                  <div className="border-t border-slate-100 p-3 bg-blue-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Reply to ${comment.author}...`}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            addComment(e.currentTarget.value, comment.id);
                            setReplyTo(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => setReplyTo(null)}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* New Comment Input */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... Use @ to mention someone"
            className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            rows={2}
          />
          
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isPosting}
            className="absolute right-3 bottom-3 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPosting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>

          {/* Mentions Dropdown */}
          <AnimatePresence>
            {showMentions && filteredMembers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10"
              >
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <AtSign className="w-3 h-3" />
                    Mention someone
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => insertMention(member)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                        {getInitials(member.name)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <p className="text-xs text-slate-400 mt-2">
          Press Enter to send • Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}

export default CommentThreads;
