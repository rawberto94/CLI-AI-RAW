/**
 * Webhook and Real-Time Notification Service
 * Manages webhook subscriptions and delivers real-time notifications
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  lastDelivery?: Date;
  failureCount: number;
  maxRetries: number;
  retryDelay: number;
  headers?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  tenantId: string;
  source: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export interface NotificationPreference {
  tenantId: string;
  userId?: string;
  channels: {
    email: boolean;
    webhook: boolean;
    realtime: boolean;
  };
  events: Record<string, boolean>;
  filters?: {
    contractTypes?: string[];
    riskLevels?: string[];
    valueThresholds?: {
      min?: number;
      max?: number;
    };
  };
}

export class WebhookService extends EventEmitter {
  private subscriptions = new Map<string, WebhookSubscription>();
  private deliveries = new Map<string, WebhookDelivery>();
  private notificationPreferences = new Map<string, NotificationPreference>();
  private eventQueue: WebhookEvent[] = [];
  private processingQueue = false;

  constructor() {
    super();
    this.startEventProcessor();
  }

  /**
   * Create a webhook subscription
   */
  async createSubscription(
    tenantId: string,
    url: string,
    events: string[],
    options: {
      secret?: string;
      maxRetries?: number;
      retryDelay?: number;
      headers?: Record<string, string>;
    } = {}
  ): Promise<WebhookSubscription> {
    const subscription: WebhookSubscription = {
      id: this.generateId(),
      tenantId,
      url,
      events,
      secret: options.secret || this.generateSecret(),
      active: true,
      createdAt: new Date(),
      failureCount: 0,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      headers: options.headers
    };

    this.subscriptions.set(subscription.id, subscription);
    this.emit('subscription:created', subscription);

    return subscription;
  }

  /**
   * Update a webhook subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<WebhookSubscription>
  ): Promise<WebhookSubscription | null> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return null;
    }

    const updatedSubscription = { ...subscription, ...updates };
    this.subscriptions.set(subscriptionId, updatedSubscription);
    this.emit('subscription:updated', updatedSubscription);

    return updatedSubscription;
  }

  /**
   * Delete a webhook subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.subscriptions.delete(subscriptionId);
    this.emit('subscription:deleted', subscription);

    return true;
  }

  /**
   * Get webhook subscriptions for a tenant
   */
  getSubscriptions(tenantId: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.tenantId === tenantId);
  }

  /**
   * Publish an event to webhooks
   */
  async publishEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<void> {
    const webhookEvent: WebhookEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event
    };

    this.eventQueue.push(webhookEvent);
    this.emit('event:queued', webhookEvent);

    // Process immediately if not already processing
    if (!this.processingQueue) {
      this.processEventQueue();
    }
  }

  /**
   * Get webhook deliveries
   */
  getDeliveries(
    subscriptionId?: string,
    status?: WebhookDelivery['status']
  ): WebhookDelivery[] {
    let deliveries = Array.from(this.deliveries.values());

    if (subscriptionId) {
      deliveries = deliveries.filter(d => d.subscriptionId === subscriptionId);
    }

    if (status) {
      deliveries = deliveries.filter(d => d.status === status);
    }

    return deliveries.sort((a, b) => 
      (b.lastAttempt?.getTime() || 0) - (a.lastAttempt?.getTime() || 0)
    );
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== 'failed') {
      return false;
    }

    delivery.status = 'retrying';
    delivery.nextRetry = new Date();
    
    this.emit('delivery:retry_scheduled', delivery);
    
    // Process the retry
    setTimeout(() => this.processDelivery(delivery), 100);
    
    return true;
  }

  /**
   * Set notification preferences
   */
  setNotificationPreferences(preferences: NotificationPreference): void {
    const key = preferences.userId 
      ? `${preferences.tenantId}:${preferences.userId}`
      : preferences.tenantId;
    
    this.notificationPreferences.set(key, preferences);
    this.emit('preferences:updated', preferences);
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(tenantId: string, userId?: string): NotificationPreference | null {
    const key = userId ? `${tenantId}:${userId}` : tenantId;
    return this.notificationPreferences.get(key) || null;
  }

  /**
   * Send real-time notification
   */
  async sendRealTimeNotification(
    tenantId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: any;
      userId?: string;
    }
  ): Promise<void> {
    // Check notification preferences
    const preferences = this.getNotificationPreferences(tenantId, notification.userId);
    if (preferences && !preferences.channels.realtime) {
      return;
    }

    // Check event filters
    if (preferences && !this.matchesEventFilters(notification, preferences)) {
      return;
    }

    this.emit('notification:realtime', {
      tenantId,
      userId: notification.userId,
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    tenantId: string,
    notification: {
      to: string;
      subject: string;
      body: string;
      template?: string;
      data?: any;
    }
  ): Promise<void> {
    // Check notification preferences
    const preferences = this.getNotificationPreferences(tenantId);
    if (preferences && !preferences.channels.email) {
      return;
    }

    this.emit('notification:email', {
      tenantId,
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(tenantId: string): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
    eventsByType: Record<string, number>;
  } {
    const subscriptions = this.getSubscriptions(tenantId);
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => {
        const subscription = this.subscriptions.get(d.subscriptionId);
        return subscription?.tenantId === tenantId;
      });

    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;

    // Calculate average delivery time (simplified)
    const deliveryTimes = deliveries
      .filter(d => d.status === 'delivered' && d.lastAttempt)
      .map(() => Math.random() * 1000 + 100); // Mock delivery times

    const averageDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0;

    // Event types (would be tracked from actual events)
    const eventsByType: Record<string, number> = {
      'contract.uploaded': 45,
      'contract.processed': 42,
      'contract.analysis_completed': 38,
      'processing.failed': 5,
      'risk.high_detected': 8
    };

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.active).length,
      totalDeliveries: deliveries.length,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime,
      eventsByType
    };
  }

  // Private helper methods

  private startEventProcessor(): void {
    setInterval(() => {
      if (this.eventQueue.length > 0 && !this.processingQueue) {
        this.processEventQueue();
      }
    }, 1000);
  }

  private async processEventQueue(): Promise<void> {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => 
        sub.tenantId === event.tenantId &&
        sub.active &&
        sub.events.includes(event.type)
      );

    // Create deliveries for each matching subscription
    const deliveries = matchingSubscriptions.map(subscription => {
      const delivery: WebhookDelivery = {
        id: this.generateId(),
        subscriptionId: subscription.id,
        eventId: event.id,
        url: subscription.url,
        status: 'pending',
        attempts: 0
      };

      this.deliveries.set(delivery.id, delivery);
      return delivery;
    });

    // Process deliveries
    await Promise.all(deliveries.map(delivery => this.processDelivery(delivery)));

    this.emit('event:processed', event, deliveries);
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const subscription = this.subscriptions.get(delivery.subscriptionId);
    if (!subscription) {
      delivery.status = 'failed';
      delivery.error = 'Subscription not found';
      return;
    }

    delivery.attempts++;
    delivery.lastAttempt = new Date();
    delivery.status = 'pending';

    try {
      // Get the event data
      const event = this.getEventById(delivery.eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Prepare webhook payload
      const payload = {
        id: event.id,
        type: event.type,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
        tenant_id: event.tenantId
      };

      // Create signature
      const signature = this.createSignature(JSON.stringify(payload), subscription.secret);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.type,
        'X-Webhook-Delivery': delivery.id,
        'User-Agent': 'ContractIntelligence-Webhook/1.0',
        ...subscription.headers
      };

      // Make HTTP request (simulated)
      const response = await this.makeWebhookRequest(
        subscription.url,
        payload,
        headers
      );

      delivery.responseStatus = response.status;
      delivery.responseBody = response.body;

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'delivered';
        subscription.lastDelivery = new Date();
        subscription.failureCount = 0;
        this.emit('delivery:success', delivery);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }

    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      subscription.failureCount++;

      this.emit('delivery:failed', delivery, error);

      // Schedule retry if within limits
      if (delivery.attempts < subscription.maxRetries) {
        delivery.status = 'retrying';
        delivery.nextRetry = new Date(Date.now() + subscription.retryDelay * delivery.attempts);
        
        setTimeout(() => {
          this.processDelivery(delivery);
        }, subscription.retryDelay * delivery.attempts);
      } else {
        // Disable subscription if too many failures
        if (subscription.failureCount >= 10) {
          subscription.active = false;
          this.emit('subscription:disabled', subscription);
        }
      }
    }
  }

  private async makeWebhookRequest(
    url: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<{ status: number; body: string }> {
    // Simulate HTTP request
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate different response scenarios
    const random = Math.random();
    
    if (random < 0.05) {
      // 5% network errors
      throw new Error('Network error: Connection timeout');
    } else if (random < 0.1) {
      // 5% server errors
      return { status: 500, body: 'Internal Server Error' };
    } else if (random < 0.15) {
      // 5% client errors
      return { status: 400, body: 'Bad Request' };
    } else {
      // 85% success
      return { status: 200, body: 'OK' };
    }
  }

  private createSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getEventById(eventId: string): WebhookEvent | null {
    // In a real implementation, this would query the event store
    // For now, return a mock event
    return {
      id: eventId,
      type: 'contract.processed',
      data: { contractId: 'contract_123' },
      timestamp: new Date(),
      tenantId: 'tenant_456',
      source: 'processing-service'
    };
  }

  private matchesEventFilters(
    notification: any,
    preferences: NotificationPreference
  ): boolean {
    if (!preferences.filters) {
      return true;
    }

    // Check contract type filter
    if (preferences.filters.contractTypes && notification.data?.contractType) {
      if (!preferences.filters.contractTypes.includes(notification.data.contractType)) {
        return false;
      }
    }

    // Check risk level filter
    if (preferences.filters.riskLevels && notification.data?.riskLevel) {
      if (!preferences.filters.riskLevels.includes(notification.data.riskLevel)) {
        return false;
      }
    }

    // Check value threshold filter
    if (preferences.filters.valueThresholds && notification.data?.contractValue) {
      const value = notification.data.contractValue;
      const thresholds = preferences.filters.valueThresholds;
      
      if (thresholds.min && value < thresholds.min) {
        return false;
      }
      
      if (thresholds.max && value > thresholds.max) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const webhookService = new WebhookService();