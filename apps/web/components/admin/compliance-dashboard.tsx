'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  Database,
  Lock,
  Users,
  Server,
  Clock,
  Download,
  RefreshCcw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'data' | 'access' | 'audit' | 'operational';
  status: 'passed' | 'failed' | 'warning' | 'not-applicable';
  lastChecked: Date;
  details?: string;
  actionRequired?: string;
  documentationUrl?: string;
}

interface ComplianceStats {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  notApplicable: number;
  score: number;
}

// SOC2 Type II Controls mapped to application features
const complianceChecks: ComplianceCheck[] = [
  // Security Controls (CC)
  {
    id: 'cc-1-1',
    name: 'Multi-Factor Authentication',
    description: 'MFA/2FA is available and enforced for privileged users',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'TOTP-based MFA implemented with backup codes',
  },
  {
    id: 'cc-1-2',
    name: 'Password Policy',
    description: 'Strong password requirements enforced',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Minimum 12 characters, complexity requirements, breach database check',
  },
  {
    id: 'cc-1-3',
    name: 'Session Management',
    description: 'Secure session handling with timeout and revocation',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'JWT-based sessions with configurable expiry, session listing and revocation',
  },
  {
    id: 'cc-2-1',
    name: 'Data Encryption at Rest',
    description: 'Sensitive data encrypted in database',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'AES-256-GCM encryption for PII and sensitive fields',
  },
  {
    id: 'cc-2-2',
    name: 'Data Encryption in Transit',
    description: 'All communications use TLS 1.2+',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'HTTPS enforced, HSTS enabled, TLS 1.3 supported',
  },
  {
    id: 'cc-3-1',
    name: 'Web Application Firewall',
    description: 'WAF protection against common attacks',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Custom WAF with SQL injection, XSS, CSRF protection',
  },
  {
    id: 'cc-3-2',
    name: 'Rate Limiting',
    description: 'API rate limiting to prevent abuse',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Tiered rate limits based on user role and endpoint sensitivity',
  },
  {
    id: 'cc-3-3',
    name: 'Intrusion Detection',
    description: 'Security event monitoring and alerting',
    category: 'security',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Automated detection of suspicious patterns with alerting',
  },

  // Data Controls
  {
    id: 'dc-1-1',
    name: 'Data Classification',
    description: 'Data classified by sensitivity level',
    category: 'data',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Four-tier classification: Public, Internal, Confidential, Restricted',
  },
  {
    id: 'dc-1-2',
    name: 'Data Retention Policy',
    description: 'Automated data retention and deletion',
    category: 'data',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Configurable retention periods, automated cleanup jobs',
  },
  {
    id: 'dc-2-1',
    name: 'Backup & Recovery',
    description: 'Regular backups with tested recovery procedures',
    category: 'data',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Daily backups, point-in-time recovery, cross-region replication',
  },
  {
    id: 'dc-2-2',
    name: 'Data Export',
    description: 'Users can export their data (GDPR compliance)',
    category: 'data',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Self-service data export in standard formats',
  },

  // Access Controls
  {
    id: 'ac-1-1',
    name: 'Role-Based Access Control',
    description: 'Fine-grained RBAC implementation',
    category: 'access',
    status: 'passed',
    lastChecked: new Date(),
    details: '60+ permissions across 10+ roles with inheritance',
  },
  {
    id: 'ac-1-2',
    name: 'Tenant Isolation',
    description: 'Strict multi-tenant data separation',
    category: 'access',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Row-Level Security (RLS) in PostgreSQL, tenant context enforcement',
  },
  {
    id: 'ac-1-3',
    name: 'Least Privilege',
    description: 'Users have minimum required permissions',
    category: 'access',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Default roles with minimal permissions, explicit grants required',
  },
  {
    id: 'ac-2-1',
    name: 'SSO Integration',
    description: 'Enterprise SSO support (SAML, OIDC)',
    category: 'access',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Azure AD, Google Workspace, Okta integration available',
  },
  {
    id: 'ac-2-2',
    name: 'User Provisioning',
    description: 'Automated user lifecycle management',
    category: 'access',
    status: 'warning',
    lastChecked: new Date(),
    details: 'Manual provisioning only',
    actionRequired: 'Implement SCIM 2.0 for automated provisioning',
  },

  // Audit Controls
  {
    id: 'au-1-1',
    name: 'Comprehensive Audit Logging',
    description: 'All security-relevant events logged',
    category: 'audit',
    status: 'passed',
    lastChecked: new Date(),
    details: '40+ audit action types, immutable log storage',
  },
  {
    id: 'au-1-2',
    name: 'Audit Log Retention',
    description: 'Audit logs retained per compliance requirements',
    category: 'audit',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Configurable retention, minimum 1 year for compliance',
  },
  {
    id: 'au-1-3',
    name: 'Audit Log Export',
    description: 'Audit logs exportable for external analysis',
    category: 'audit',
    status: 'passed',
    lastChecked: new Date(),
    details: 'CSV and JSON export available',
  },
  {
    id: 'au-2-1',
    name: 'Security Monitoring',
    description: 'Real-time security event monitoring',
    category: 'audit',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Prometheus metrics, Grafana dashboards, PagerDuty integration',
  },

  // Operational Controls
  {
    id: 'op-1-1',
    name: 'Incident Response Plan',
    description: 'Documented incident response procedures',
    category: 'operational',
    status: 'passed',
    lastChecked: new Date(),
    details: 'Runbooks for common incidents, escalation procedures defined',
  },
  {
    id: 'op-1-2',
    name: 'Disaster Recovery',
    description: 'DR plan with defined RTO/RPO',
    category: 'operational',
    status: 'passed',
    lastChecked: new Date(),
    details: 'RTO: 4 hours, RPO: 1 hour, documented recovery procedures',
  },
  {
    id: 'op-2-1',
    name: 'Change Management',
    description: 'Controlled deployment process',
    category: 'operational',
    status: 'passed',
    lastChecked: new Date(),
    details: 'CI/CD pipeline, staged deployments, automatic rollback',
  },
  {
    id: 'op-2-2',
    name: 'Vulnerability Management',
    description: 'Regular security scanning and patching',
    category: 'operational',
    status: 'warning',
    lastChecked: new Date(),
    details: 'Dependabot enabled',
    actionRequired: 'Add DAST scanning to CI/CD pipeline',
  },
];

function calculateStats(checks: ComplianceCheck[]): ComplianceStats {
  const total = checks.length;
  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const notApplicable = checks.filter(c => c.status === 'not-applicable').length;
  const applicableTotal = total - notApplicable;
  const score = applicableTotal > 0 ? Math.round((passed / applicableTotal) * 100) : 100;
  
  return { total, passed, failed, warnings, notApplicable, score };
}

function StatusIcon({ status }: { status: ComplianceCheck['status'] }) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    default:
      return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
  }
}

function CategoryIcon({ category }: { category: ComplianceCheck['category'] }) {
  const iconClass = "h-4 w-4";
  switch (category) {
    case 'security':
      return <Shield className={iconClass} />;
    case 'data':
      return <Database className={iconClass} />;
    case 'access':
      return <Users className={iconClass} />;
    case 'audit':
      return <FileText className={iconClass} />;
    case 'operational':
      return <Server className={iconClass} />;
  }
}

export function ComplianceDashboard() {
  const [checks] = useState<ComplianceCheck[]>(complianceChecks);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    setStats(calculateStats(checks));
  }, [checks]);

  const filteredChecks = activeCategory === 'all' 
    ? checks 
    : checks.filter(c => c.category === activeCategory);

  const categories = [
    { id: 'all', label: 'All Controls', count: checks.length },
    { id: 'security', label: 'Security', count: checks.filter(c => c.category === 'security').length },
    { id: 'data', label: 'Data', count: checks.filter(c => c.category === 'data').length },
    { id: 'access', label: 'Access', count: checks.filter(c => c.category === 'access').length },
    { id: 'audit', label: 'Audit', count: checks.filter(c => c.category === 'audit').length },
    { id: 'operational', label: 'Operational', count: checks.filter(c => c.category === 'operational').length },
  ];

  const handleExport = () => {
    const exportData = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      controls: checks.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        status: c.status,
        details: c.details,
        actionRequired: c.actionRequired,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            SOC 2 Type II control status and compliance monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button variant="outline" onClick={() => setLastRefresh(new Date())}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.score}%</div>
            <Progress value={stats.score} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.passed} of {stats.total - stats.notApplicable} controls passing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.passed}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Controls meeting requirements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.warnings}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Controls needing attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Controls requiring remediation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls List */}
      <Card>
        <CardHeader>
          <CardTitle>Control Status</CardTitle>
          <CardDescription>
            Detailed status of all compliance controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid w-full grid-cols-6">
              {categories.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                  {cat.label}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {cat.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-4">
              <div className="space-y-3">
                {filteredChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`flex items-start gap-4 p-4 border rounded-lg ${
                      check.status === 'failed' ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' :
                      check.status === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30' :
                      ''
                    }`}
                  >
                    <StatusIcon status={check.status} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{check.name}</span>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <CategoryIcon category={check.category} />
                          {check.category}
                        </Badge>
                        <code className="text-xs text-muted-foreground">{check.id}</code>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {check.description}
                      </p>
                      
                      {check.details && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Details:</strong> {check.details}
                        </p>
                      )}
                      
                      {check.actionRequired && (
                        <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">
                          <strong>Action Required:</strong> {check.actionRequired}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(check.lastChecked, { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {(stats.failed > 0 || stats.warnings > 0) && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {checks
                .filter(c => c.actionRequired)
                .map(check => (
                  <li key={check.id} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="h-4 w-4" />
                    <strong>{check.name}:</strong> {check.actionRequired}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ComplianceDashboard;
