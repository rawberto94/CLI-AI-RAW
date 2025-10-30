/**
 * Alert Checker
 * Periodically checks thresholds and generates alerts
 */

import { alertingService } from './alerting.service';
import { monitoringService } from './monitoring.service';

class AlertChecker {
  private intervalId?: NodeJS.Timeout;
  private checkInterval = 60000; // Check every minute
  private isRunning = false;

  /**
   * Start the alert checker
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      monitoringService.logWarning('Alert checker already running');
      return;
    }

    this.checkInterval = intervalMs;
    this.isRunning = true;

    monitoringService.logInfo('Starting alert checker', {
      interval: intervalMs,
    });

    // Run immediately
    this.check();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.check();
    }, this.checkInterval);
  }

  /**
   * Stop the alert checker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;

    monitoringService.logInfo('Alert checker stopped');
  }

  /**
   * Check thresholds
   */
  private async check(): Promise<void> {
    try {
      const startTime = Date.now();
      const newAlerts = await alertingService.checkThresholds();
      const duration = Date.now() - startTime;

      monitoringService.recordTiming('alert_check', duration);

      if (newAlerts.length > 0) {
        monitoringService.logWarning('New alerts generated', {
          count: newAlerts.length,
          alerts: newAlerts.map(a => ({
            severity: a.severity,
            metric: a.threshold.metric,
          })),
        });
      }
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'alert_checker',
      });
    }
  }

  /**
   * Check if running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const alertChecker = new AlertChecker();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  alertChecker.start();
}
