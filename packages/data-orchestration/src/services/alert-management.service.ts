import { PrismaClient } from '@prisma/client';

interface AlertRule {
  id?: string;
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  type: 'rate_increase' | 'market_shift' | 'opportunity' | 'quality_issue' | 'threshold';
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly';
}

interface AlertCondition {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'contains';
  value: any;
  logic?: 'AND' | 'OR';
}

interface AlertAction {
  type: 'email' | 'in_app' | 'webhook';
  config: any;
}

interface Alert {
  id: string;
  tenantId: string;
  userId?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: any;
  read: boolean;
  createdAt: Date;
}

export class AlertManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create alert rule
   */
  async createAlertRule(rule: AlertRule) {
    // Store rule configuration in database
    // For now, we'll use a simple JSON storage approach
    return {
      id: `rule_${Date.now()}`,
      ...rule,
      createdAt: new Date(),
    };
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>) {
    // Update rule configuration
    return {
      id: ruleId,
      ...updates,
      updatedAt: new Date(),
    };
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string) {
    // Delete rule
    return { success: true };
  }

  /**
   * List alert rules
   */
  async listAlertRules(tenantId: string, userId?: string) {
    // Fetch rules from database
    // For now, return empty array
    return [];
  }

  /**
   * Evaluate alert rules
   */
  async evaluateRules(tenantId: string, context: any) {
    const rules = await this.listAlertRules(tenantId);
    const triggeredAlerts: Alert[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const shouldTrigger = this.evaluateConditions(rule.conditions, context);

      if (shouldTrigger) {
        const alert = await this.createAlert({
          tenantId,
          userId: rule.userId,
          type: rule.type,
          severity: this.determineSeverity(rule, context),
          title: rule.name,
          description: rule.description || '',
          data: context,
        });

        triggeredAlerts.push(alert);

        // Execute actions
        await this.executeActions(rule.actions, alert);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Evaluate conditions
   */
  private evaluateConditions(conditions: AlertCondition[], context: any): boolean {
    if (conditions.length === 0) return false;

    let result = true;
    let currentLogic: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, context);

      if (currentLogic === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentLogic = condition.logic || 'AND';
    }

    return result;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: AlertCondition, context: any): boolean {
    const value = this.getNestedValue(context, condition.field);

    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Determine severity
   */
  private determineSeverity(rule: any, context: any): 'low' | 'medium' | 'high' | 'critical' {
    // Simple logic - can be enhanced
    if (rule.type === 'quality_issue') return 'high';
    if (rule.type === 'market_shift') return 'medium';
    return 'low';
  }

  /**
   * Create alert
   */
  async createAlert(alert: Omit<Alert, 'id' | 'read' | 'createdAt'>) {
    const newAlert = await this.prisma.rateCardAlert.create({
      data: {
        tenantId: alert.tenantId,
        userId: alert.userId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        data: alert.data,
        read: false,
      },
    });

    return newAlert as Alert;
  }

  /**
   * Execute actions
   */
  private async executeActions(actions: AlertAction[], alert: Alert) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'email':
            await this.sendEmailNotification(action.config, alert);
            break;
          case 'in_app':
            // Already created in database
            break;
          case 'webhook':
            await this.sendWebhook(action.config, alert);
            break;
        }
      } catch {
        // Action execution failed
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(_config: any, _alert: Alert) {
    // Implement email sending logic
  }

  /**
   * Send webhook
   */
  private async sendWebhook(_config: any, _alert: Alert) {
    // Implement webhook logic
  }

  /**
   * Get alerts for user
   */
  async getAlerts(tenantId: string, userId?: string, options: {
    read?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: any = { tenantId };

    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }

    if (options.read !== undefined) {
      where.read = options.read;
    }

    const alerts = await this.prisma.rateCardAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return alerts;
  }

  /**
   * Mark alert as read
   */
  async markAsRead(alertId: string) {
    return this.prisma.rateCardAlert.update({
      where: { id: alertId },
      data: { read: true },
    });
  }

  /**
   * Mark all alerts as read
   */
  async markAllAsRead(tenantId: string, userId?: string) {
    const where: any = { tenantId, read: false };

    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }

    return this.prisma.rateCardAlert.updateMany({
      where,
      data: { read: true },
    });
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string) {
    return this.prisma.rateCardAlert.delete({
      where: { id: alertId },
    });
  }
}
