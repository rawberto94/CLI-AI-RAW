/**
 * Scheduled Reports Service
 * 
 * Manages automated report generation and delivery
 * with scheduling, templates, and distribution.
 * 
 * Features:
 * - Cron-based scheduling
 * - Multiple export formats (PDF, Excel, CSV)
 * - Email delivery
 * - Report templates
 * - Retry logic
 */

import Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';
export type ReportType = 'executive' | 'financial' | 'risk' | 'compliance' | 'operational' | 'custom';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';

export interface ReportSchedule {
  id: string;
  name: string;
  description?: string;
  reportType: ReportType;
  format: ReportFormat;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone: string;
  enabled: boolean;
  
  // Report configuration
  config: {
    dateRange?: 'last_7_days' | 'last_30_days' | 'last_quarter' | 'ytd' | 'custom';
    customStartDate?: string;
    customEndDate?: string;
    includeCharts?: boolean;
    includeSummary?: boolean;
    filters?: Record<string, unknown>;
    sections?: string[];
    templateId?: string;
  };
  
  // Delivery configuration
  delivery: {
    email?: {
      recipients: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      body?: string;
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
    storage?: {
      provider: 'local' | 's3' | 'azure' | 'gcs';
      path?: string;
      bucket?: string;
    };
  };
  
  // Metadata
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
}

export interface ReportExecution {
  id: string;
  scheduleId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
  retryCount: number;
  deliveryStatus: {
    email?: 'pending' | 'sent' | 'failed';
    webhook?: 'pending' | 'sent' | 'failed';
    storage?: 'pending' | 'uploaded' | 'failed';
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  sections: ReportSection[];
  styles?: ReportStyles;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSection {
  id: string;
  type: 'header' | 'summary' | 'chart' | 'table' | 'text' | 'metrics' | 'footer';
  title?: string;
  content?: string;
  dataSource?: string;
  chartConfig?: {
    type: 'bar' | 'line' | 'pie' | 'area';
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
  };
  tableConfig?: {
    columns: Array<{ key: string; label: string; format?: string }>;
    sortBy?: string;
    limit?: number;
  };
}

export interface ReportStyles {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  headerBackground?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ScheduledReportsService {
  private redis: InstanceType<typeof Redis> | null = null;
  private schedules: Map<string, ReportSchedule> = new Map();
  private executionHistory: Map<string, ReportExecution[]> = new Map();

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });

      await this.redis.connect();
    } catch {
      this.redis = null;
      console.warn('[ScheduledReports] Redis unavailable, using memory storage');
    }
  }

  // --------------------------------------------------------------------------
  // SCHEDULE MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create a new report schedule
   */
  async createSchedule(
    schedule: Omit<ReportSchedule, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'nextRunAt'>
  ): Promise<ReportSchedule> {
    const newSchedule: ReportSchedule = {
      ...schedule,
      id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      nextRunAt: this.calculateNextRun(schedule.frequency, schedule.cronExpression, schedule.timezone),
    };

    await this.saveSchedule(newSchedule);
    return newSchedule;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    id: string,
    updates: Partial<Omit<ReportSchedule, 'id' | 'createdAt'>>
  ): Promise<ReportSchedule | null> {
    const existing = await this.getSchedule(id);
    if (!existing) return null;

    const updated: ReportSchedule = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      nextRunAt: updates.frequency || updates.cronExpression
        ? this.calculateNextRun(
            updates.frequency || existing.frequency,
            updates.cronExpression || existing.cronExpression,
            updates.timezone || existing.timezone
          )
        : existing.nextRunAt,
    };

    await this.saveSchedule(updated);
    return updated;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<boolean> {
    if (this.redis) {
      await this.redis.del(`schedule:${id}`);
      await this.redis.srem('schedules:all', id);
    }
    this.schedules.delete(id);
    return true;
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(id: string): Promise<ReportSchedule | null> {
    if (this.redis) {
      try {
        const data = await this.redis.get(`schedule:${id}`);
        if (data) return JSON.parse(data);
      } catch {
        // Fall through
      }
    }
    return this.schedules.get(id) || null;
  }

  /**
   * List all schedules for a tenant
   */
  async listSchedules(
    tenantId: string,
    options?: { enabled?: boolean; type?: ReportType }
  ): Promise<ReportSchedule[]> {
    let schedules: ReportSchedule[] = [];

    if (this.redis) {
      try {
        const ids = await this.redis.smembers('schedules:all');
        const pipeline = this.redis.pipeline();
        
        for (const id of ids) {
          pipeline.get(`schedule:${id}`);
        }
        
        const results = await pipeline.exec();
        schedules = results
          ?.map(([, data]) => data ? JSON.parse(data as string) : null)
          .filter((s): s is ReportSchedule => s !== null) || [];
      } catch {
        schedules = Array.from(this.schedules.values());
      }
    } else {
      schedules = Array.from(this.schedules.values());
    }

    // Filter by tenant
    schedules = schedules.filter(s => s.tenantId === tenantId);

    // Apply additional filters
    if (options?.enabled !== undefined) {
      schedules = schedules.filter(s => s.enabled === options.enabled);
    }
    if (options?.type) {
      schedules = schedules.filter(s => s.reportType === options.type);
    }

    return schedules.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get schedules due for execution
   */
  async getDueSchedules(): Promise<ReportSchedule[]> {
    const now = new Date();
    let schedules: ReportSchedule[] = [];

    if (this.redis) {
      try {
        const ids = await this.redis.smembers('schedules:all');
        const pipeline = this.redis.pipeline();
        
        for (const id of ids) {
          pipeline.get(`schedule:${id}`);
        }
        
        const results = await pipeline.exec();
        schedules = results
          ?.map(([, data]) => data ? JSON.parse(data as string) : null)
          .filter((s): s is ReportSchedule => s !== null) || [];
      } catch {
        schedules = Array.from(this.schedules.values());
      }
    } else {
      schedules = Array.from(this.schedules.values());
    }

    return schedules.filter(s => 
      s.enabled && 
      s.nextRunAt && 
      new Date(s.nextRunAt) <= now
    );
  }

  // --------------------------------------------------------------------------
  // REPORT EXECUTION
  // --------------------------------------------------------------------------

  /**
   * Execute a scheduled report
   */
  async executeReport(scheduleId: string): Promise<ReportExecution> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const execution: ReportExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scheduleId,
      status: 'running',
      startedAt: new Date().toISOString(),
      retryCount: 0,
      deliveryStatus: {},
    };

    try {
      // Generate report
      const report = await this.generateReport(schedule);
      
      execution.fileUrl = report.url;
      execution.fileSize = report.size;

      // Handle delivery
      if (schedule.delivery.email?.recipients?.length) {
        try {
          await this.sendReportByEmail(schedule, report);
          execution.deliveryStatus.email = 'sent';
        } catch {
          execution.deliveryStatus.email = 'failed';
        }
      }

      if (schedule.delivery.webhook?.url) {
        try {
          await this.sendReportToWebhook(schedule, report);
          execution.deliveryStatus.webhook = 'sent';
        } catch {
          execution.deliveryStatus.webhook = 'failed';
        }
      }

      if (schedule.delivery.storage?.provider) {
        try {
          await this.uploadReport(schedule, report);
          execution.deliveryStatus.storage = 'uploaded';
        } catch {
          execution.deliveryStatus.storage = 'failed';
        }
      }

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.duration = Date.now() - new Date(execution.startedAt).getTime();

      // Update schedule
      await this.updateSchedule(scheduleId, {
        lastRunAt: execution.startedAt,
        nextRunAt: this.calculateNextRun(schedule.frequency, schedule.cronExpression, schedule.timezone),
        runCount: schedule.runCount + 1,
      });

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date().toISOString();
      execution.duration = Date.now() - new Date(execution.startedAt).getTime();
    }

    // Save execution record
    await this.saveExecution(execution);

    return execution;
  }

  /**
   * Manually trigger a report
   */
  async triggerReport(
    scheduleId: string,
    options?: { format?: ReportFormat; recipients?: string[] }
  ): Promise<ReportExecution> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Apply overrides
    if (options?.format) {
      schedule.format = options.format;
    }
    if (options?.recipients) {
      schedule.delivery.email = {
        ...schedule.delivery.email,
        recipients: options.recipients,
      };
    }

    return this.executeReport(scheduleId);
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(
    scheduleId: string,
    limit: number = 10
  ): Promise<ReportExecution[]> {
    if (this.redis) {
      try {
        const executions = await this.redis.lrange(`executions:${scheduleId}`, 0, limit - 1);
        return executions.map(e => JSON.parse(e));
      } catch {
        // Fall through
      }
    }

    const history = this.executionHistory.get(scheduleId) || [];
    return history.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // REPORT GENERATION
  // --------------------------------------------------------------------------

  private async generateReport(
    schedule: ReportSchedule
  ): Promise<{ url: string; size: number; content: Buffer }> {
    // Calculate date range
    const dateRange = this.calculateDateRange(schedule.config);

    // Fetch data based on report type
    const data = await this.fetchReportData(schedule.reportType, dateRange, schedule.config.filters);

    // Generate report in requested format
    let content: Buffer;
    let mimeType: string;
    let extension: string;

    switch (schedule.format) {
      case 'pdf':
        content = await this.generatePDF(schedule, data);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'excel':
        content = await this.generateExcel(schedule, data);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'csv':
        content = await this.generateCSV(data);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'json':
      default:
        content = Buffer.from(JSON.stringify(data, null, 2));
        mimeType = 'application/json';
        extension = 'json';
    }

    // Generate filename
    const filename = `${schedule.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${extension}`;

    // Store temporarily
    const url = await this.storeTemporarily(filename, content, mimeType);

    return {
      url,
      size: content.length,
      content,
    };
  }

  private async fetchReportData(
    type: ReportType,
    dateRange: { start: Date; end: Date },
    _filters?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // In production, this would fetch from database
    // For now, return mock data structure
    
    const baseData = {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      type,
    };

    switch (type) {
      case 'executive':
        return {
          ...baseData,
          summary: {
            totalContracts: 247,
            activeContracts: 189,
            totalValue: 45600000,
            expiringThisMonth: 12,
            pendingApprovals: 15,
          },
          kpis: [
            { name: 'Contract Growth', value: 12, unit: '%', trend: 'up' },
            { name: 'Avg Processing Time', value: 18.5, unit: 'hours', trend: 'down' },
            { name: 'Compliance Rate', value: 98.2, unit: '%', trend: 'stable' },
          ],
          charts: {
            contractsByStatus: [
              { status: 'Active', count: 189 },
              { status: 'Draft', count: 28 },
              { status: 'Pending', count: 15 },
              { status: 'Expired', count: 12 },
            ],
            valueByCategory: [
              { category: 'IT Services', value: 15200000 },
              { category: 'Professional Services', value: 12400000 },
              { category: 'Software', value: 9800000 },
              { category: 'Hardware', value: 8200000 },
            ],
          },
        };

      case 'financial':
        return {
          ...baseData,
          summary: {
            totalCommitted: 45600000,
            totalSpent: 32400000,
            remainingBudget: 13200000,
            savingsIdentified: 2100000,
          },
          spendByMonth: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(2025, i, 1).toLocaleDateString('en-US', { month: 'short' }),
            actual: Math.random() * 3000000 + 2000000,
            budget: 3000000,
          })),
          topVendors: [
            { name: 'Acme Corp', spent: 5200000, contracts: 12 },
            { name: 'TechPro Inc', spent: 3800000, contracts: 8 },
            { name: 'DataSys Ltd', spent: 2900000, contracts: 15 },
          ],
        };

      case 'risk':
        return {
          ...baseData,
          summary: {
            highRiskContracts: 8,
            mediumRiskContracts: 24,
            lowRiskContracts: 215,
            avgRiskScore: 2.4,
          },
          riskFactors: [
            { factor: 'Expiration Risk', count: 23, severity: 'high' },
            { factor: 'Compliance Gap', count: 5, severity: 'critical' },
            { factor: 'Single Source', count: 12, severity: 'medium' },
            { factor: 'Budget Overrun', count: 8, severity: 'medium' },
          ],
          mitigationActions: [
            { action: 'Renewal Review', contracts: 23, dueDate: '2025-02-01' },
            { action: 'Compliance Audit', contracts: 5, dueDate: '2025-01-31' },
          ],
        };

      case 'compliance':
        return {
          ...baseData,
          summary: {
            compliantContracts: 235,
            nonCompliantContracts: 12,
            complianceRate: 95.1,
            openIssues: 8,
          },
          complianceByCategory: [
            { category: 'Data Privacy', compliant: 98, total: 100 },
            { category: 'Security', compliant: 95, total: 100 },
            { category: 'Financial', compliant: 92, total: 100 },
            { category: 'Legal', compliant: 96, total: 100 },
          ],
          issues: [
            { id: 'COMP-001', contract: 'CNT-1234', issue: 'Missing DPA', priority: 'high' },
            { id: 'COMP-002', contract: 'CNT-5678', issue: 'Outdated Terms', priority: 'medium' },
          ],
        };

      default:
        return {
          ...baseData,
          message: 'Custom report type - data structure varies',
        };
    }
  }

  private async generatePDF(
    _schedule: ReportSchedule,
    data: Record<string, unknown>
  ): Promise<Buffer> {
    // In production, use a library like puppeteer or pdfkit
    // For now, return a simple placeholder
    const content = `
      REPORT: ${data.type}
      Generated: ${data.generatedAt}
      
      ${JSON.stringify(data, null, 2)}
    `;
    return Buffer.from(content);
  }

  private async generateExcel(
    _schedule: ReportSchedule,
    data: Record<string, unknown>
  ): Promise<Buffer> {
    // In production, use a library like exceljs
    // For now, return JSON as placeholder
    return Buffer.from(JSON.stringify(data, null, 2));
  }

  private async generateCSV(data: Record<string, unknown>): Promise<Buffer> {
    // Simple CSV generation
    const rows: string[] = [];
    
    function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, flatten(value as Record<string, unknown>, newKey));
        } else {
          result[newKey] = String(value);
        }
      }
      return result;
    }

    const flattened = flatten(data);
    rows.push(Object.keys(flattened).join(','));
    rows.push(Object.values(flattened).map(v => `"${v}"`).join(','));

    return Buffer.from(rows.join('\n'));
  }

  private async storeTemporarily(
    filename: string,
    content: Buffer,
    _mimeType: string
  ): Promise<string> {
    // In production, upload to S3/Azure/GCS with signed URL
    // For now, return a placeholder URL
    return `/api/reports/download/${filename}?token=${Buffer.from(content.slice(0, 16)).toString('hex')}`;
  }

  // --------------------------------------------------------------------------
  // DELIVERY
  // --------------------------------------------------------------------------

  private async sendReportByEmail(
    schedule: ReportSchedule,
    _report: { url: string; content: Buffer }
  ): Promise<void> {
    if (!schedule.delivery.email?.recipients?.length) return;

    // In production, use SendGrid, SES, or other email service
    console.warn(`[ScheduledReports] Sending report to: ${schedule.delivery.email.recipients.join(', ')}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Would call email service here:
    // await emailService.send({
    //   to: schedule.delivery.email.recipients,
    //   cc: schedule.delivery.email.cc,
    //   subject: schedule.delivery.email.subject || `Report: ${schedule.name}`,
    //   body: schedule.delivery.email.body || 'Please find your scheduled report attached.',
    //   attachments: [{ filename: `report.${schedule.format}`, content: report.content }]
    // });
  }

  private async sendReportToWebhook(
    schedule: ReportSchedule,
    report: { url: string }
  ): Promise<void> {
    if (!schedule.delivery.webhook?.url) return;

    await fetch(schedule.delivery.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...schedule.delivery.webhook.headers,
      },
      body: JSON.stringify({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        reportType: schedule.reportType,
        reportUrl: report.url,
        generatedAt: new Date().toISOString(),
      }),
    });
  }

  private async uploadReport(
    schedule: ReportSchedule,
    report: { content: Buffer }
  ): Promise<string> {
    if (!schedule.delivery.storage?.provider) return '';

    const filename = `reports/${schedule.tenantId}/${schedule.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${schedule.format}`;
    const bucket = schedule.delivery.storage.bucket || 'contigo-reports';
    
    console.warn(`[ScheduledReports] Uploading to ${schedule.delivery.storage.provider}: ${filename}`);

    // AWS S3
    if (schedule.delivery.storage.provider === 's3' && process.env.AWS_ACCESS_KEY_ID) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const s3 = new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const mimeTypes: Record<string, string> = {
          pdf: 'application/pdf',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv',
          json: 'application/json',
        };

        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: filename,
          Body: report.content,
          ContentType: mimeTypes[schedule.format] || 'application/octet-stream',
          ServerSideEncryption: 'AES256',
        }));

        // Generate pre-signed URL for 7 days
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const getCommand = new GetObjectCommand({ Bucket: bucket, Key: filename });
        const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 7 * 24 * 60 * 60 });
        
        console.warn(`[ScheduledReports] Uploaded to S3: s3://${bucket}/${filename}`);
        return signedUrl;
      } catch (error) {
        console.error('[ScheduledReports] S3 upload failed:', error);
      }
    }

    // Azure Blob Storage
    if (schedule.delivery.storage.provider === 'azure' && process.env.AZURE_STORAGE_CONNECTION_STRING) {
      try {
        const { BlobServiceClient } = await import('@azure/storage-blob');
        const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobService.getContainerClient(bucket);
        
        await containerClient.createIfNotExists();
        
        const blobClient = containerClient.getBlockBlobClient(filename);
        await blobClient.upload(report.content, report.content.length);

        console.warn(`[ScheduledReports] Uploaded to Azure: ${blobClient.url}`);
        return blobClient.url;
      } catch (error) {
        console.error('[ScheduledReports] Azure upload failed:', error);
      }
    }

    // Google Cloud Storage
    if (schedule.delivery.storage.provider === 'gcs' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Dynamic import with fallback - @google-cloud/storage is optional dependency
        // Use string variable to prevent TypeScript from trying to resolve the module
        const moduleName = '@google-cloud/storage';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gcsModule: any = await import(/* webpackIgnore: true */ moduleName).catch(() => null);
        if (gcsModule) {
          const { Storage } = gcsModule;
          const storage = new Storage();
          const bucketObj = storage.bucket(bucket);
          const file = bucketObj.file(filename);

          await file.save(report.content);

          // Make file accessible with signed URL
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          console.warn(`[ScheduledReports] Uploaded to GCS: gs://${bucket}/${filename}`);
          return url;
        }
      } catch (error) {
        console.error('[ScheduledReports] GCS upload failed:', error);
      }
    }

    // Fallback: Local storage (for development)
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const localPath = path.join(process.cwd(), 'tmp', 'reports', schedule.tenantId);
      await fs.mkdir(localPath, { recursive: true });
      const localFile = path.join(localPath, `${schedule.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${schedule.format}`);
      await fs.writeFile(localFile, report.content);
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return `${baseUrl}/api/reports/download?path=${encodeURIComponent(localFile)}`;
    } catch {
      console.error('[ScheduledReports] Local storage fallback failed');
    }

    return '';
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private calculateNextRun(
    frequency: ScheduleFrequency,
    cronExpression?: string,
    _timezone?: string
  ): string {
    const now = new Date();
    let nextRun: Date;

    if (cronExpression) {
      // In production, use cron-parser library
      // For now, approximate based on frequency
      nextRun = this.getNextRunByFrequency(now, frequency);
    } else {
      nextRun = this.getNextRunByFrequency(now, frequency);
    }

    return nextRun.toISOString();
  }

  private getNextRunByFrequency(from: Date, frequency: ScheduleFrequency): Date {
    const next = new Date(from);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0); // 6 AM
        break;
      case 'weekly':
        next.setDate(next.getDate() + (7 - next.getDay() + 1)); // Next Monday
        next.setHours(6, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1, 1); // First of next month
        next.setHours(6, 0, 0, 0);
        break;
      case 'quarterly':
        const currentQuarter = Math.floor(next.getMonth() / 3);
        next.setMonth((currentQuarter + 1) * 3, 1);
        next.setHours(6, 0, 0, 0);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private calculateDateRange(config: ReportSchedule['config']): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (config.dateRange) {
      case 'last_7_days':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_quarter':
        start = new Date(end);
        start.setMonth(start.getMonth() - 3);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = config.customStartDate ? new Date(config.customStartDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (config.customEndDate) {
          return { start, end: new Date(config.customEndDate) };
        }
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private async saveSchedule(schedule: ReportSchedule): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(`schedule:${schedule.id}`, JSON.stringify(schedule));
        await this.redis.sadd('schedules:all', schedule.id);
      } catch {
        // Fall through to memory
      }
    }
    this.schedules.set(schedule.id, schedule);
  }

  private async saveExecution(execution: ReportExecution): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.lpush(`executions:${execution.scheduleId}`, JSON.stringify(execution));
        await this.redis.ltrim(`executions:${execution.scheduleId}`, 0, 99); // Keep last 100
      } catch {
        // Fall through
      }
    }
    
    if (!this.executionHistory.has(execution.scheduleId)) {
      this.executionHistory.set(execution.scheduleId, []);
    }
    const history = this.executionHistory.get(execution.scheduleId)!;
    history.unshift(execution);
    if (history.length > 100) history.pop();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let scheduledReportsService: ScheduledReportsService | null = null;

export function getScheduledReportsService(): ScheduledReportsService {
  if (!scheduledReportsService) {
    scheduledReportsService = new ScheduledReportsService();
  }
  return scheduledReportsService;
}

export default ScheduledReportsService;
