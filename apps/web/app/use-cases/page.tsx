'use client';

import UseCasesSection from '@/components/pilot-demo/UseCasesSection';

export default function UseCasesPage() {
  return (
    <div className="container mx-auto py-6">
      <UseCasesSection />
    </div>
  );
}

// Old simple version (replaced with full UseCasesSection component)
function OldUseCasesPage() {
  const useCases = [
    {
      icon: FileText,
      title: 'Contract Analysis',
      description: 'AI-powered contract review and clause extraction',
      features: ['Automated clause detection', 'Risk identification', 'Compliance checking'],
      badge: 'Core'
    },
    {
      icon: DollarSign,
      title: 'Cost Optimization',
      description: 'Identify savings opportunities and cost reduction strategies',
      features: ['Rate card benchmarking', 'Savings pipeline tracking', 'Cost anomaly detection'],
      badge: 'Financial'
    },
    {
      icon: Shield,
      title: 'Risk Management',
      description: 'Proactive risk detection and mitigation strategies',
      features: ['Risk scoring', 'Compliance monitoring', 'Alert management'],
      badge: 'Compliance'
    },
    {
      icon: Search,
      title: 'Contract Discovery',
      description: 'Intelligent search across all contract documents',
      features: ['Semantic search', 'Multi-criteria filtering', 'Full-text search'],
      badge: 'Search'
    },
    {
      icon: Users,
      title: 'Supplier Management',
      description: 'Track and analyze supplier relationships',
      features: ['Performance analytics', 'Relationship tracking', 'Renewal monitoring'],
      badge: 'Procurement'
    },
    {
      icon: Clock,
      title: 'Renewal Tracking',
      description: 'Never miss a contract renewal deadline',
      features: ['Automated reminders', 'Renewal radar', 'Timeline visualization'],
      badge: 'Operations'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Comprehensive analytics and business intelligence',
      features: ['Custom dashboards', 'Trend analysis', 'Predictive insights'],
      badge: 'Analytics'
    },
    {
      icon: AlertTriangle,
      title: 'Compliance Monitoring',
      description: 'Ensure regulatory compliance across all contracts',
      features: ['Compliance scoring', 'Regulatory updates', 'Audit trails'],
      badge: 'Compliance'
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Use Cases</h1>
        <p className="text-muted-foreground text-lg">
          Discover how our AI-powered Contract Intelligence Platform can transform your contract management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {useCases.map((useCase, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <useCase.icon className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary">{useCase.badge}</Badge>
              </div>
              <CardTitle className="text-xl">{useCase.title}</CardTitle>
              <CardDescription>{useCase.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {useCase.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm">
                    <span className="mr-2 mt-0.5">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 bg-primary/5 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold mb-2">1. Upload Contracts</h3>
            <p className="text-sm text-muted-foreground">
              Upload your contract documents in PDF or Word format
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. AI Processing</h3>
            <p className="text-sm text-muted-foreground">
              Our AI analyzes and extracts key information automatically
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Insights & Actions</h3>
            <p className="text-sm text-muted-foreground">
              Get actionable insights and manage your contracts efficiently
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
