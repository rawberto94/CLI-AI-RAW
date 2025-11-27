/**
 * Comments Service for Negotiation Prep
 * Manages comments and team collaboration
 */

export interface Comment {
  id: string
  scenarioId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: Date
  updatedAt: Date
  parentId?: string // For replies
  mentions: string[] // User IDs mentioned
  isEdited: boolean
  isDeleted: boolean
}

export interface CommentThread {
  comment: Comment
  replies: Comment[]
}

export class CommentsService {
  private static comments: Comment[] = []
  private static listeners: Array<(comments: Comment[]) => void> = []

  /**
   * Add a new comment
   */
  static addComment(
    scenarioId: string,
    userId: string,
    userName: string,
    content: string,
    parentId?: string,
    userAvatar?: string
  ): Comment {
    // Extract mentions from content (@username)
    const mentions = this.extractMentions(content)

    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scenarioId,
      userId,
      userName,
      userAvatar,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId,
      mentions,
      isEdited: false,
      isDeleted: false
    }

    this.comments.push(comment)
    this.notifyListeners()

    return comment
  }

  /**
   * Get comments for a scenario
   */
  static getComments(scenarioId: string): Comment[] {
    return this.comments
      .filter(c => c.scenarioId === scenarioId && !c.isDeleted)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  /**
   * Get comment threads (comments with replies)
   */
  static getCommentThreads(scenarioId: string): CommentThread[] {
    const comments = this.getComments(scenarioId)
    const topLevelComments = comments.filter(c => !c.parentId)

    return topLevelComments.map(comment => ({
      comment,
      replies: comments.filter(c => c.parentId === comment.id)
    }))
  }

  /**
   * Update a comment
   */
  static updateComment(commentId: string, content: string): Comment | null {
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return null

    comment.content = content
    comment.updatedAt = new Date()
    comment.isEdited = true
    comment.mentions = this.extractMentions(content)

    this.notifyListeners()
    return comment
  }

  /**
   * Delete a comment
   */
  static deleteComment(commentId: string): boolean {
    const comment = this.comments.find(c => c.id === commentId)
    if (!comment) return false

    comment.isDeleted = true
    comment.updatedAt = new Date()

    this.notifyListeners()
    return true
  }

  /**
   * Get comment count for a scenario
   */
  static getCommentCount(scenarioId: string): number {
    return this.comments.filter(c => c.scenarioId === scenarioId && !c.isDeleted).length
  }

  /**
   * Subscribe to comment updates
   */
  static subscribe(callback: (comments: Comment[]) => void): () => void {
    this.listeners.push(callback)
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Extract @mentions from content
   */
  private static extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) mentions.push(match[1])
    }

    return mentions
  }

  /**
   * Notify all listeners of changes
   */
  private static notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.comments]))
  }

  /**
   * Clear all comments (for testing)
   */
  static clearComments(): void {
    this.comments = []
    this.notifyListeners()
  }

  /**
   * Load sample comments
   */
  static loadSampleComments(scenarioId: string): void {
    const sampleComments = [
      {
        scenarioId,
        userId: 'user1',
        userName: 'Sarah Chen',
        content: 'I think we should focus on the volume discount angle. We have significant leverage there.',
        userAvatar: '👩‍💼'
      },
      {
        scenarioId,
        userId: 'user2',
        userName: 'Michael Brown',
        content: '@Sarah great point! I agree. Should we also mention the long-term partnership?',
        userAvatar: '👨‍💼'
      },
      {
        scenarioId,
        userId: 'user3',
        userName: 'Lisa Wang',
        content: 'The market data looks strong. I recommend we go with the moderate approach first.',
        userAvatar: '👩‍💻'
      }
    ]

    sampleComments.forEach(comment => {
      this.addComment(
        comment.scenarioId,
        comment.userId,
        comment.userName,
        comment.content,
        undefined,
        comment.userAvatar
      )
    })
  }
}
