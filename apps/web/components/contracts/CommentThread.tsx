'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageSquare,
  Send,
  Reply,
  MoreHorizontal,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  AtSign,
  Paperclip,
  X,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  content: string
  author: string
  authorEmail: string
  createdAt: string
  updatedAt?: string
  parentId?: string
  mentions?: string[]
  replies?: Comment[]
  edited?: boolean
}

interface CommentThreadProps {
  contractId: string
  sectionId?: string
  onCommentAdded?: (comment: Comment) => void
}

export function CommentThread({
  contractId,
  sectionId,
  onCommentAdded,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    loadComments()
  }, [contractId, sectionId])

  const loadComments = async () => {
    setLoading(true)
    try {
      const url = sectionId
        ? `/api/contracts/${contractId}/comments?section=${sectionId}`
        : `/api/contracts/${contractId}/comments`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load comments')
      
      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          sectionId,
          parentId: replyTo,
          mentions: extractMentions(newComment),
        }),
      })

      if (!response.ok) throw new Error('Failed to post comment')

      const data = await response.json()
      if (onCommentAdded) onCommentAdded(data.comment)
      
      setNewComment('')
      setReplyTo(null)
      await loadComments()
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/contracts/${contractId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          mentions: extractMentions(editContent),
        }),
      })

      if (!response.ok) throw new Error('Failed to update comment')

      setEditingId(null)
      setEditContent('')
      await loadComments()
    } catch (error) {
      console.error('Failed to update comment:', error)
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
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) {
        mentions.push(match[1])
      }
    }

    return mentions
  }

  const formatContent = (content: string) => {
    return content.replace(/@(\w+)/g, '<span class="text-blue-600 font-semibold">@$1</span>')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingId === comment.id

    return (
      <div
        key={comment.id}
        className={cn(
          'group',
          isReply && 'ml-12 mt-3'
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600">
            <AvatarFallback className="text-white font-semibold">
              {getInitials(comment.author)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className={cn(
              'p-4 rounded-xl border-2 transition-all',
              isReply ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200',
              'group-hover:shadow-md'
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{comment.author}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                  {comment.edited && (
                    <Badge variant="outline" className="text-xs">
                      Edited
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyTo(comment.id)}
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[80px]"
                    placeholder="Edit your comment..."
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(comment.id)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(null)
                        setEditContent('')
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-gray-700 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: formatContent(comment.content) }}
                />
              )}

              {comment.mentions && comment.mentions.length > 0 && !isEditing && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <AtSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-600">
                    Mentioned: {comment.mentions.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3 space-y-3">
                {comment.replies.map((reply) => renderComment(reply, true))}
              </div>
            )}

            {/* Reply Form */}
            {replyTo === comment.id && (
              <div className="mt-3 ml-12 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Reply className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">
                    Replying to {comment.author}
                  </span>
                </div>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write your reply... (use @username to mention)"
                  className="mb-2"
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={submitting || !newComment.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submitting ? 'Sending...' : 'Reply'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReplyTo(null)
                      setNewComment('')
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
    )
  }

  if (loading) {
    return (
      <Card className="shadow-xl border-0">
        <CardContent className="p-8 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader className="border-b bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Comments & Discussion
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            {comments.reduce((total, c) => total + 1 + (c.replies?.length || 0), 0)} comments
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* New Comment Form */}
        {!replyTo && (
          <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment... (use @username to mention someone)"
              className="mb-3"
              rows={4}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <AtSign className="h-4 w-4" />
                <span>Use @ to mention team members</span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !newComment.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </div>
        )}

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No comments yet</p>
            <p className="text-gray-500 text-sm mt-2">Be the first to start the discussion!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments
              .filter((c) => !c.parentId)
              .map((comment) => renderComment(comment))}
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={loadComments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Comments
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
