'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageSquare,
  Send,
  Reply,
  MoreVertical,
  Trash2,
  Edit2,
  ThumbsUp,
  User,
  Clock,
  AtSign,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  author: string
  authorEmail: string
  content: string
  createdAt: string
  updatedAt?: string
  replies?: Comment[]
  mentions?: string[]
  isResolved?: boolean
  likes?: number
}

interface ContractCommentsProps {
  contractId: string
  currentUser?: string
  currentUserEmail?: string
}

export function ContractComments({
  contractId,
  currentUser = 'Current User',
  currentUserEmail = 'user@example.com',
}: ContractCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadComments()
  }, [contractId])

  const loadComments = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/comments`)
      if (!response.ok) throw new Error('Failed to load comments')
      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error('Failed to load comments:', error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setLoading(true)
    try {
      const mentions = extractMentions(newComment)
      
      const response = await fetch(`/api/contracts/${contractId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          author: currentUser,
          authorEmail: currentUserEmail,
          mentions,
        }),
      })

      if (!response.ok) throw new Error('Failed to add comment')
      
      setNewComment('')
      await loadComments()
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddReply = async (parentId: string) => {
    if (!replyContent.trim()) return

    setLoading(true)
    try {
      const mentions = extractMentions(replyContent)
      
      const response = await fetch(`/api/contracts/${contractId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          author: currentUser,
          authorEmail: currentUserEmail,
          parentId,
          mentions,
        }),
      })

      if (!response.ok) throw new Error('Failed to add reply')
      
      setReplyContent('')
      setReplyingTo(null)
      await loadComments()
    } catch (error) {
      console.error('Failed to add reply:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (commentId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/comments/${commentId}/resolve`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to resolve comment')
      await loadComments()
    } catch (error) {
      console.error('Failed to resolve comment:', error)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const response = await fetch(`/api/contracts/${contractId}/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete comment')
      await loadComments()
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g
    const matches = text.match(mentionRegex)
    return matches ? matches.map(m => m.substring(1)) : []
  }

  const highlightMentions = (text: string) => {
    return text.split(/(@\w+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-blue-600 font-semibold">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const initials = comment.author
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()

    return (
      <div key={comment.id} className={cn('space-y-3', isReply && 'ml-12')}>
        <div
          className={cn(
            'p-4 rounded-xl border-2 transition-all',
            comment.isResolved
              ? 'bg-green-50 border-green-200'
              : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
          )}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600">
              <AvatarFallback className="text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{comment.author}</p>
                    {comment.isResolved && (
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!comment.isResolved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(comment.id)}
                      className="hover:bg-green-50"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(comment.id)}
                    className="hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <p className="text-gray-700 text-sm leading-relaxed">
                {highlightMentions(comment.content)}
              </p>

              {comment.mentions && comment.mentions.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <AtSign className="h-3 w-3 text-gray-500" />
                  {comment.mentions.map((mention, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      @{mention}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(comment.id)}
                  className="text-blue-600 hover:bg-blue-50"
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-50">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {comment.likes || 0}
                </Button>
              </div>

              {replyingTo === comment.id && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply... Use @username to mention"
                    className="mb-2 text-sm"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAddReply(comment.id)}
                      disabled={loading || !replyContent.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyContent('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader className="border-b bg-gradient-to-br from-gray-50 to-slate-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Comments & Discussion
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* New Comment Input */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-600">
              <AvatarFallback className="text-white font-bold">
                {currentUser.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                data-comment-input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment... Use @username to mention team members"
                className="mb-3 bg-white"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  💡 Tip: Use <code className="bg-white px-1 rounded">@username</code> to mention someone
                </p>
                <Button
                  onClick={handleAddComment}
                  disabled={loading || !newComment.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post Comment
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No comments yet</p>
            <p className="text-gray-500 text-sm mt-2">Be the first to start a discussion</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.filter(c => !c.isResolved).map(comment => renderComment(comment))}
            
            {comments.some(c => c.isResolved) && (
              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Resolved Comments ({comments.filter(c => c.isResolved).length})
                </h3>
                <div className="space-y-4 opacity-75">
                  {comments.filter(c => c.isResolved).map(comment => renderComment(comment))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
