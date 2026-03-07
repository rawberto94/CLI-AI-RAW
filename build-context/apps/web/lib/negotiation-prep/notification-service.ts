/**
 * Notification Service for Negotiation Prep
 * Manages in-app notifications for team collaboration
 */

export interface Notification {
  id: string
  userId: string
  type: 'comment' | 'mention' | 'share' | 'outcome' | 'system'
  title: string
  message: string
  link?: string
  createdAt: Date
  read: boolean
  data?: any
}

export class NotificationService {
  private static notifications: Notification[] = []
  private static listeners: Map<string, Array<(notifications: Notification[]) => void>> = new Map()

  /**
   * Create a notification
   */
  static createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    link?: string,
    data?: any
  ): Notification {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      link,
      createdAt: new Date(),
      read: false,
      data
    }

    this.notifications.push(notification)
    this.notifyListeners(userId)

    return notification
  }

  /**
   * Get notifications for a user
   */
  static getUserNotifications(userId: string): Notification[] {
    return this.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get unread count
   */
  static getUnreadCount(userId: string): number {
    return this.notifications.filter(n => n.userId === userId && !n.read).length
  }

  /**
   * Mark as read
   */
  static markAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (!notification) return false

    notification.read = true
    this.notifyListeners(notification.userId)
    return true
  }

  /**
   * Mark all as read
   */
  static markAllAsRead(userId: string): number {
    let count = 0
    this.notifications.forEach(n => {
      if (n.userId === userId && !n.read) {
        n.read = true
        count++
      }
    })

    if (count > 0) {
      this.notifyListeners(userId)
    }

    return count
  }

  /**
   * Delete notification
   */
  static deleteNotification(notificationId: string): boolean {
    const index = this.notifications.findIndex(n => n.id === notificationId)
    if (index === -1) return false

    const notification = this.notifications[index]
    if (!notification) return false
    this.notifications.splice(index, 1)
    this.notifyListeners(notification.userId)
    return true
  }

  /**
   * Subscribe to notifications
   */
  static subscribe(userId: string, callback: (notifications: Notification[]) => void): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, [])
    }

    this.listeners.get(userId)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(userId)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  /**
   * Notify listeners
   */
  private static notifyListeners(userId: string): void {
    const callbacks = this.listeners.get(userId)
    if (callbacks) {
      const notifications = this.getUserNotifications(userId)
      callbacks.forEach(callback => callback(notifications))
    }
  }

  /**
   * Clear all notifications (for testing)
   */
  static clearNotifications(): void {
    this.notifications = []
    this.listeners.forEach((callbacks, userId) => {
      callbacks.forEach(callback => callback([]))
    })
  }

  /**
   * Create sample notifications
   */
  static createSampleNotifications(userId: string): void {
    this.createNotification(
      userId,
      'mention',
      'You were mentioned',
      'Sarah Chen mentioned you in a comment',
      '/use-cases/negotiation-prep'
    )

    this.createNotification(
      userId,
      'comment',
      'New comment',
      'Michael Brown commented on your negotiation scenario',
      '/use-cases/negotiation-prep'
    )

    this.createNotification(
      userId,
      'share',
      'Scenario shared',
      'Lisa Wang shared a negotiation scenario with you',
      '/use-cases/negotiation-prep/shared/abc123'
    )
  }
}
