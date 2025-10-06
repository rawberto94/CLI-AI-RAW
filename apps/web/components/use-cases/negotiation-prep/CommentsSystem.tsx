'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Reply, Edit2, Trash2, MoreVertical } from 'lucide-react'
import { CommentsService, type Comment, type CommentThread } from '@/lib/negotiation-prep/comments-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CommentsSystemProps {
  scenarioId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
}

export function CommentsSystem({
  scenarioId,
  currentUserId,
  currentUserName,
  currentUserAvatar = '👤'
}: CommentsSystemProps) {
  const [threads, setThreads] = useState<CommentThread[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Load comments
  useEffect(() => {
    const loadComments = () => {
      const commentThreads = CommentsService.getCommentThreads(scenarioId)
      setThreads(commentThreads)
    }

    loadComments()

    // Subscribe to updates
    const unsubscribe = CommentsService.subscribe(loadComments)
    return unsubscribe
  }, [scenarioId])

  const handleAddComment = () => {
    if (!newComment.trim()) return

    CommentsService.addComment(
      scenarioId,
      currentUserId,
      currentUserName,
      newComment,
      replyingTo || undefined,
      currentUserAvatar
    )

    setNewComment('')
    setReplyingTo(null)
  }

  const handleEdit = (commentId: string) => {
    const comment = threads
      .flatMap(t => [t.comment, ...t.replies])
      .find(c => c.id === commentId)
    
    if (comment) {
      setEditingId(commentId)
      setEditContent(comment.content)
    }
  }

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return

    CommentsService.updateComment(editingId, editContent)
    setEditingId(null)
    setEditContent('')
  }

  const handleDelete = (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      CommentsService.deleteComment(commentId)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Team Comments
          </CardTitle>
          <span className="text-sm text-gray-500">
            {CommentsService.getCommentCount(scenarioId)} comments
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment Input */}
        <div className="space-y-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded">
              <Reply className="w-4 h-4" />
              <span>Replying to comment</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="ml-auto text-blue-600 hover:text-blue-800"
              >
                Cancel
              </button>
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg">
              {currentUserAvatar}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment... (use @name to mention someone)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 ml-10">
            Tip: Use @username to mention team members
          </p>
        </div>

        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {threads.map((thread) => (
              <CommentThreadComponent
                key={thread.comment.id}
                thread={thread}
                currentUserId={currentUserId}
                editingId={editingId}
                editContent={editContent}
                onReply={(id) => setReplyingTo(id)}
                onEdit={handleEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => {
                  setEditingId(null)
                  setEditContent('')
                }}
                onDelete={handleDelete}
                onEditContentChange={setEditContent}
              />
            ))}
          </AnimatePresence>

          {threads.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No comments yet. Be the first to comment!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface CommentThreadComponentProps {
  thread: CommentThread
  currentUserId: string
  editingId: string | null
  editContent: string
  onReply: (id: string) => void
  onEdit: (id: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onEditContentChange: (content: string) => void
}

function CommentThreadComponent({
  thread,
  currentUserId,
  editingId,
  editContent,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditContentChange
}: CommentThreadComponentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {/* Main Comment */}
      <CommentItem
        comment={thread.comment}
        currentUserId={currentUserId}
        isEditing={editingId === thread.comment.id}
        editContent={editContent}
        onReply={onReply}
        onEdit={onEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onDelete={onDelete}
        onEditContentChange={onEditContentChange}
      />

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="ml-10 space-y-3 border-l-2 border-gray-200 pl-4">
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isEditing={editingId === reply.id}
              editContent={editContent}
              onReply={onReply}
              onEdit={onEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onEditContentChange={onEditContentChange}
              isReply
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  isEditing: boolean
  editContent: string
  onReply: (id: string) => void
  onEdit: (id: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onEditContentChange: (content: string) => void
  isReply?: boolean
}

function CommentItem({
  comment,
  currentUserId,
  isEditing,
  editContent,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditContentChange,
  isReply = false
}: CommentItemProps) {
  const [showActions, setShowActions] = useState(false)
  const isOwner = comment.userId === currentUserId

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const highlightMentions = (content: string) => {
    return content.replace(/@(\w+)/g, '<span class="text-blue-600 font-medium">@$1</span>')
  }

  return (
    <div
      className="flex gap-3 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-lg">
        {comment.userAvatar || '👤'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.userName}</span>
          <span className="text-xs text-gray-500">{formatTime(comment.createdAt)}</span>
          {comment.isEdited && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={onSaveEdit} size="sm">
                Save
              </Button>
              <Button onClick={onCancelEdit} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: highlightMentions(comment.content) }}
            />

            {/* Actions */}
            <div className={`flex items-center gap-3 mt-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
              {!isReply && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}
              
              {isOwner && (
                <>
                  <button
                    onClick={() => onEdit(comment.id)}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
