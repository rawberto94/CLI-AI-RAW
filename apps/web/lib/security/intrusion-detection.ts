/**
 * Intrusion Detection Service
 *
 * Monitors for suspicious activity patterns and triggers alerts:
 * - Brute force attacks (login attempts)
 * - Credential stuffing
 * - API abuse
 * - Data exfiltration attempts
 * - Privilege escalation
 * - Unusual access patterns
 *
 * @example
 * import { IntrusionDetector } from '@/lib/security/intrusion-detection';
 *
 * const detector = new IntrusionDetector();
 * detector.onAlert((alert) => sendToSecurityTeam(alert));
 * detector.trackEvent({ type: 'login_attempt', ip: '1.2.3.4', success: false });
 */

import { auditLog, AuditAction } from './audit';

// ============================================================================
// Types
// ============================================================================

export interface SecurityEvent {
  type: SecurityEventType;
  ip: string;
  userId?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export type SecurityEventType =
  | 'login_attempt'
  | 'api_request'
  | 'file_download'
  | 'file_upload'
  | 'data_export'
  | 'permission_change'
  | 'password_change'
  | 'mfa_change'
  | 'api_key_usage'
  | 'admin_action'
  | 'config_change'
  | 'rate_limit_exceeded';

export interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ip: string;
  userId?: string;
  evidence: SecurityEvent[];
  timestamp: Date;
  acknowledged: boolean;
}

export type AlertType =
  | 'brute_force'
  | 'credential_stuffing'
  | 'api_abuse'
  | 'data_exfiltration'
  | 'privilege_escalation'
  | 'unusual_access'
  | 'impossible_travel'
  | 'account_takeover'
  | 'mass_download';

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  eventType: SecurityEventType | SecurityEventType[];
  condition: (events: SecurityEvent[], context: DetectionContext) => boolean;
  alertType: AlertType;
  severity: SecurityAlert['severity'];
  cooldownMs: number; // Don't alert again within this period
}

export interface DetectionContext {
  ip: string;
  userId?: string;
  timeWindowMs: number;
}

export interface DetectorConfig {
  /** Time window for analysis (default: 5 minutes) */
  analysisWindowMs: number;
  /** Max events to keep in memory per IP */
  maxEventsPerIP: number;
  /** Enable real-time detection */
  realTimeDetection: boolean;
  /** Detection rules */
  rules: DetectionRule[];
}

// ============================================================================
// Default Detection Rules
// ============================================================================

const DEFAULT_RULES: DetectionRule[] = [
  // Brute Force: 5+ failed logins from same IP in 5 minutes
  {
    id: 'BRUTE-001',
    name: 'Brute Force Attack',
    description: 'Multiple failed login attempts from same IP',
    eventType: 'login_attempt',
    condition: (events) => {
      const failed = events.filter((e) => !e.success);
      return failed.length >= 5;
    },
    alertType: 'brute_force',
    severity: 'high',
    cooldownMs: 15 * 60 * 1000, // 15 minutes
  },

  // Credential Stuffing: Failed logins with multiple usernames from same IP
  {
    id: 'CRED-001',
    name: 'Credential Stuffing',
    description: 'Multiple failed logins with different usernames',
    eventType: 'login_attempt',
    condition: (events) => {
      const failed = events.filter((e) => !e.success && e.userId);
      const uniqueUsers = new Set(failed.map((e) => e.userId));
      return failed.length >= 3 && uniqueUsers.size >= 3;
    },
    alertType: 'credential_stuffing',
    severity: 'critical',
    cooldownMs: 30 * 60 * 1000,
  },

  // API Abuse: 100+ requests in 1 minute from same IP
  {
    id: 'API-001',
    name: 'API Abuse',
    description: 'Excessive API requests from same IP',
    eventType: 'api_request',
    condition: (events) => events.length >= 100,
    alertType: 'api_abuse',
    severity: 'medium',
    cooldownMs: 5 * 60 * 1000,
  },

  // Rate Limit Abuse: 10+ rate limit exceeds in 5 minutes
  {
    id: 'RATE-001',
    name: 'Rate Limit Abuse',
    description: 'Repeatedly hitting rate limits',
    eventType: 'rate_limit_exceeded',
    condition: (events) => events.length >= 10,
    alertType: 'api_abuse',
    severity: 'medium',
    cooldownMs: 10 * 60 * 1000,
  },

  // Data Exfiltration: Multiple large exports in short time
  {
    id: 'EXFIL-001',
    name: 'Data Exfiltration Attempt',
    description: 'Multiple data exports in short time',
    eventType: 'data_export',
    condition: (events) => events.length >= 5,
    alertType: 'data_exfiltration',
    severity: 'critical',
    cooldownMs: 60 * 60 * 1000,
  },

  // Mass Download: 20+ file downloads in 5 minutes
  {
    id: 'MASS-001',
    name: 'Mass Download',
    description: 'Downloading many files rapidly',
    eventType: 'file_download',
    condition: (events) => events.length >= 20,
    alertType: 'mass_download',
    severity: 'high',
    cooldownMs: 30 * 60 * 1000,
  },

  // Privilege Escalation: Multiple permission changes
  {
    id: 'PRIV-001',
    name: 'Privilege Escalation Attempt',
    description: 'Multiple permission change attempts',
    eventType: 'permission_change',
    condition: (events) => {
      const failed = events.filter((e) => !e.success);
      return failed.length >= 3;
    },
    alertType: 'privilege_escalation',
    severity: 'critical',
    cooldownMs: 60 * 60 * 1000,
  },

  // Account Takeover: Password + MFA changes from new IP
  {
    id: 'ATO-001',
    name: 'Potential Account Takeover',
    description: 'Password and MFA changes from unusual location',
    eventType: ['password_change', 'mfa_change'],
    condition: (events, context) => {
      const hasPasswordChange = events.some((e) => e.type === 'password_change');
      const hasMFAChange = events.some((e) => e.type === 'mfa_change');
      return hasPasswordChange && hasMFAChange;
    },
    alertType: 'account_takeover',
    severity: 'critical',
    cooldownMs: 24 * 60 * 60 * 1000,
  },

  // Unusual Admin Activity: Multiple admin actions in quick succession
  {
    id: 'ADMIN-001',
    name: 'Unusual Admin Activity',
    description: 'Burst of administrative actions',
    eventType: 'admin_action',
    condition: (events) => events.length >= 10,
    alertType: 'unusual_access',
    severity: 'high',
    cooldownMs: 30 * 60 * 1000,
  },
];

// ============================================================================
// Event Store (In-Memory, replace with Redis in production)
// ============================================================================

interface EventStore {
  byIP: Map<string, SecurityEvent[]>;
  byUser: Map<string, SecurityEvent[]>;
  recent: SecurityEvent[];
}

class InMemoryEventStore {
  private store: EventStore = {
    byIP: new Map(),
    byUser: new Map(),
    recent: [],
  };

  private maxEventsPerKey = 1000;
  private maxRecentEvents = 10000;

  add(event: SecurityEvent): void {
    const eventWithTime = { ...event, timestamp: event.timestamp || new Date() };

    // Store by IP
    const ipEvents = this.store.byIP.get(event.ip) || [];
    ipEvents.push(eventWithTime);
    if (ipEvents.length > this.maxEventsPerKey) {
      ipEvents.shift();
    }
    this.store.byIP.set(event.ip, ipEvents);

    // Store by User
    if (event.userId) {
      const userEvents = this.store.byUser.get(event.userId) || [];
      userEvents.push(eventWithTime);
      if (userEvents.length > this.maxEventsPerKey) {
        userEvents.shift();
      }
      this.store.byUser.set(event.userId, userEvents);
    }

    // Store in recent
    this.store.recent.push(eventWithTime);
    if (this.store.recent.length > this.maxRecentEvents) {
      this.store.recent.shift();
    }
  }

  getByIP(ip: string, windowMs: number): SecurityEvent[] {
    const events = this.store.byIP.get(ip) || [];
    const cutoff = Date.now() - windowMs;
    return events.filter((e) => e.timestamp && e.timestamp.getTime() > cutoff);
  }

  getByUser(userId: string, windowMs: number): SecurityEvent[] {
    const events = this.store.byUser.get(userId) || [];
    const cutoff = Date.now() - windowMs;
    return events.filter((e) => e.timestamp && e.timestamp.getTime() > cutoff);
  }

  getRecent(windowMs: number): SecurityEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.store.recent.filter(
      (e) => e.timestamp && e.timestamp.getTime() > cutoff
    );
  }

  cleanup(maxAgeMs: number): void {
    const cutoff = Date.now() - maxAgeMs;

    // Cleanup by IP
    for (const [ip, events] of this.store.byIP.entries()) {
      const filtered = events.filter(
        (e) => e.timestamp && e.timestamp.getTime() > cutoff
      );
      if (filtered.length === 0) {
        this.store.byIP.delete(ip);
      } else {
        this.store.byIP.set(ip, filtered);
      }
    }

    // Cleanup by User
    for (const [userId, events] of this.store.byUser.entries()) {
      const filtered = events.filter(
        (e) => e.timestamp && e.timestamp.getTime() > cutoff
      );
      if (filtered.length === 0) {
        this.store.byUser.delete(userId);
      } else {
        this.store.byUser.set(userId, filtered);
      }
    }

    // Cleanup recent
    this.store.recent = this.store.recent.filter(
      (e) => e.timestamp && e.timestamp.getTime() > cutoff
    );
  }
}

// ============================================================================
// Intrusion Detector
// ============================================================================

export class IntrusionDetector {
  private config: DetectorConfig;
  private eventStore: InMemoryEventStore;
  private alertHandlers: Array<(alert: SecurityAlert) => void | Promise<void>> = [];
  private alerts: Map<string, SecurityAlert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<DetectorConfig>) {
    this.config = {
      analysisWindowMs: 5 * 60 * 1000, // 5 minutes
      maxEventsPerIP: 1000,
      realTimeDetection: true,
      rules: DEFAULT_RULES,
      ...config,
    };

    this.eventStore = new InMemoryEventStore();

    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.eventStore.cleanup(60 * 60 * 1000); // Keep 1 hour of events
    }, 5 * 60 * 1000);
  }

  /**
   * Track a security event
   */
  async trackEvent(event: SecurityEvent): Promise<void> {
    this.eventStore.add(event);

    // Real-time detection
    if (this.config.realTimeDetection) {
      await this.analyzeForIP(event.ip);
      if (event.userId) {
        await this.analyzeForUser(event.userId);
      }
    }
  }

  /**
   * Analyze events for a specific IP
   */
  private async analyzeForIP(ip: string): Promise<void> {
    const events = this.eventStore.getByIP(ip, this.config.analysisWindowMs);

    const context: DetectionContext = {
      ip,
      timeWindowMs: this.config.analysisWindowMs,
    };

    await this.runRules(events, context);
  }

  /**
   * Analyze events for a specific user
   */
  private async analyzeForUser(userId: string): Promise<void> {
    const events = this.eventStore.getByUser(userId, this.config.analysisWindowMs);

    if (events.length === 0) return;

    const firstEvent = events[0]!;
    const context: DetectionContext = {
      ip: firstEvent.ip,
      userId,
      timeWindowMs: this.config.analysisWindowMs,
    };

    await this.runRules(events, context);
  }

  /**
   * Run detection rules against events
   */
  private async runRules(
    events: SecurityEvent[],
    context: DetectionContext
  ): Promise<void> {
    for (const rule of this.config.rules) {
      // Check cooldown
      const cooldownKey = `${rule.id}:${context.ip}:${context.userId || ''}`;
      const lastAlertTime = this.alertCooldowns.get(cooldownKey);
      if (lastAlertTime && Date.now() - lastAlertTime < rule.cooldownMs) {
        continue;
      }

      // Filter events by type
      const eventTypes = Array.isArray(rule.eventType)
        ? rule.eventType
        : [rule.eventType];
      const relevantEvents = events.filter((e) => eventTypes.includes(e.type));

      if (relevantEvents.length === 0) continue;

      // Check condition
      if (rule.condition(relevantEvents, context)) {
        await this.triggerAlert(rule, relevantEvents, context);
        this.alertCooldowns.set(cooldownKey, Date.now());
      }
    }
  }

  /**
   * Trigger a security alert
   */
  private async triggerAlert(
    rule: DetectionRule,
    evidence: SecurityEvent[],
    context: DetectionContext
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      type: rule.alertType,
      severity: rule.severity,
      title: rule.name,
      description: rule.description,
      ip: context.ip,
      userId: context.userId,
      evidence,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);

    // Log to audit
    await auditLog({
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      ipAddress: context.ip,
      userId: context.userId,
      metadata: {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        ruleId: rule.id,
        evidenceCount: evidence.length,
      },
      success: false,
      errorMessage: `Security alert: ${rule.name}`,
    });

    // Call handlers
    for (const handler of this.alertHandlers) {
      try {
        await handler(alert);
      } catch {
        // Handler error - continue with other handlers
      }
    }
  }

  /**
   * Register an alert handler
   */
  onAlert(handler: (alert: SecurityAlert) => void | Promise<void>): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const index = this.alertHandlers.indexOf(handler);
      if (index > -1) {
        this.alertHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Get all unacknowledged alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalAlerts: number;
    unacknowledged: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const alert of alerts) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      bySeverity,
      byType,
    };
  }

  /**
   * Add a custom detection rule
   */
  addRule(rule: DetectionRule): void {
    this.config.rules.push(rule);
  }

  /**
   * Block an IP (call your firewall/WAF)
   */
  async blockIP(ip: string, reason: string, durationMs: number): Promise<void> {
    // In production: Call your firewall API, update nginx, etc.
    // await firewall.blockIP(ip, durationMs);

    await auditLog({
      action: AuditAction.ACCESS_DENIED,
      ipAddress: ip,
      metadata: {
        action: 'ip_blocked',
        reason,
        durationMs,
      },
    });
  }

  /**
   * Shutdown detector
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================================
// Geo-IP Anomaly Detection (requires geo-ip service)
// ============================================================================

export interface GeoLocation {
  ip: string;
  country: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Detect impossible travel (login from two far locations in short time)
 */
export function detectImpossibleTravel(
  currentLocation: GeoLocation,
  previousLocation: GeoLocation,
  timeDifferenceMs: number
): { impossible: boolean; details: string } {
  // Calculate distance (Haversine formula)
  if (
    !currentLocation.latitude ||
    !currentLocation.longitude ||
    !previousLocation.latitude ||
    !previousLocation.longitude
  ) {
    // Can't calculate distance without coordinates
    if (currentLocation.country !== previousLocation.country) {
      // Different countries in short time
      if (timeDifferenceMs < 60 * 60 * 1000) {
        // Less than 1 hour
        return {
          impossible: true,
          details: `Different countries (${previousLocation.country} → ${currentLocation.country}) in ${Math.round(timeDifferenceMs / 60000)} minutes`,
        };
      }
    }
    return { impossible: false, details: '' };
  }

  const R = 6371; // Earth's radius in km
  const lat1 = (previousLocation.latitude * Math.PI) / 180;
  const lat2 = (currentLocation.latitude * Math.PI) / 180;
  const deltaLat =
    ((currentLocation.latitude - previousLocation.latitude) * Math.PI) / 180;
  const deltaLon =
    ((currentLocation.longitude - previousLocation.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Calculate maximum possible travel speed
  const hours = timeDifferenceMs / (60 * 60 * 1000);
  const maxSpeed = 1000; // Max 1000 km/h (faster than commercial flights)

  const maxPossibleDistance = maxSpeed * hours;

  if (distance > maxPossibleDistance) {
    return {
      impossible: true,
      details: `Traveled ${Math.round(distance)}km in ${hours.toFixed(1)}h (max possible: ${Math.round(maxPossibleDistance)}km)`,
    };
  }

  return { impossible: false, details: '' };
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_RULES };
