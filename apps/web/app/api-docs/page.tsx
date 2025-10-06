import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation - Contract Intelligence',
  description: 'Complete API reference and integration guides for developers',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText,
  Code,
  Globe,
  Key,
  Shield,
  Zap,
  Database,
  Upload,
  Download,
  Search,
  BarChart3,
  Users,
  Settings,
  Copy,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Book,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

// Mock API documentation data
const apiData = {
  overview: {
    version: '2.4.1',
    baseUrl: 'https://api.contractintelligence.com/v2',
    totalEndpoints: 47,
    rateLimits: '1000 requests/hour',
    authentication: 'Bearer Token',
    status: 'Stable'
  },
  endpoints: [
    {
      category: 'Contracts',
      description: 'Manage and analyze contract documents',
      endpoints: [
        {
          method: 'GET',
          path: '/contracts',
          description: 'List all contracts with filtering and pagination',
          parameters: ['page', 'limit', 'status', 'client', 'supplier'],
          response: 'Array of contract objects'
        },
        {
          method: 'POST',
          path: '/contracts',
          description: 'Upload and create a new contract',
          parameters: ['file', 'metadata'],
          response: 'Contract object with processing status'
        },
        {
          method: 'GET',
          path: '/contracts/{id}',
          description: 'Get detailed contract information',
          parameters: ['id'],
          response: 'Detailed contract object'
        },
        {
          method: 'PUT',
          path: '/contracts/{id}',
          description: 'Update contract metadata',
          parameters: ['id', 'metadata'],
          response: 'Updated contract object'
        },
        {
          method: 'DELETE',
          path: '/contracts/{id}',
          description: 'Delete a contract',
          parameters: ['id'],
          response: 'Deletion confirmation'
        }
      ]
    },
    {
      category: 'AI Analysis',
      description: 'AI-powered contract analysis and insights',
      endpoints: [
        {
          method: 'POST',
          path: '/analysis/extract',
          description: 'Extract key terms and clauses from contract',
          parameters: ['contractId', 'extractionType'],
          response: 'Extracted terms and metadata'
        },
        {
          method: 'POST',
          path: '/analysis/risk',
          description: 'Perform risk analysis on contract',
          parameters: ['contractId', 'riskCategories'],
          response: 'Risk assessment report'
        },
        {
          method: 'POST',
          path: '/analysis/compliance',
          description: 'Check contract compliance against regulations',
          parameters: ['contractId', 'regulations'],
          response: 'Compliance assessment'
        },
        {
          method: 'GET',
          path: '/analysis/insights',
          description: 'Get AI-generated insights for contract portfolio',
          parameters: ['timeframe', 'categories'],
          response: 'Business insights and recommendations'
        }
      ]
    },
    {
      category: 'Search',
      description: 'Semantic search and discovery',
      endpoints: [
        {
          method: 'GET',
          path: '/search',
          description: 'Search contracts using natural language',
          parameters: ['query', 'filters', 'limit'],
          response: 'Ranked search results'
        },
        {
          method: 'POST',
          path: '/search/advanced',
          description: 'Advanced search with complex filters',
          parameters: ['criteria', 'sorting', 'pagination'],
          response: 'Filtered search results'
        },
        {
          method: 'GET',
          path: '/search/suggestions',
          description: 'Get search suggestions and autocomplete',
          parameters: ['partial_query'],
          response: 'Search suggestions array'
        }
      ]
    },
    {
      category: 'Analytics',
      description: 'Portfolio analytics and reporting',
      endpoints: [
        {
          method: 'GET',
          path: '/analytics/portfolio',
          description: 'Get portfolio overview metrics',
          parameters: ['timeframe', 'groupBy'],
          response: 'Portfolio analytics data'
        },
        {
          method: 'GET',
          path: '/analytics/risk',
          description: 'Get risk analytics and trends',
          parameters: ['timeframe', 'categories'],
          response: 'Risk analytics data'
        },
        {
          method: 'GET',
          path: '/analytics/compliance',
          description: 'Get compliance metrics and reports',
          parameters: ['regulations', 'timeframe'],
          response: 'Compliance analytics data'
        }
      ]
    }
  ],
  authentication: {
    type: 'Bearer Token',
    description: 'All API requests require authentication using a Bearer token in the Authorization header',
    example: 'Authorization: Bearer your-api-token-here',
    tokenEndpoint: '/auth/token',
    scopes: ['read:contracts', 'write:contracts', 'admin:system']
  },
  examples: [
    {
      title: 'Upload a Contract',
      method: 'POST',
      endpoint: '/contracts',
      code: `curl -X POST \\
  https://api.contractintelligence.com/v2/contracts \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@contract.pdf" \\
  -F "metadata={\\"client\\":\\"TechCorp\\",\\"type\\":\\"MSA\\"}"`,
      response: `{
  "id": "contract_123",
  "status": "processing",
  "filename": "contract.pdf",
  "uploadedAt": "2024-01-20T10:30:00Z",
  "processingEstimate": "2-3 minutes"
}`
    },
    {
      title: 'Search Contracts',
      method: 'GET',
      endpoint: '/search',
      code: `curl -X GET \\
  "https://api.contractintelligence.com/v2/search?query=payment%20terms&limit=10" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
      response: `{
  "results": [
    {
      "id": "contract_123",
      "title": "TechCorp Service Agreement",
      "relevanceScore": 0.95,
      "highlights": ["payment terms", "net 30 days"]
    }
  ],
  "total": 42,
  "page": 1
}`
    },
    {
      title: 'Get Risk Analysis',
      method: 'POST',
      endpoint: '/analysis/risk',
      code: `curl -X POST \\
  https://api.contractintelligence.com/v2/analysis/risk \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"contractId": "contract_123", "riskCategories": ["financial", "legal"]}'`,
      response: `{
  "contractId": "contract_123",
  "riskScore": 23,
  "riskLevel": "low",
  "categories": {
    "financial": {"score": 15, "factors": ["payment terms"]},
    "legal": {"score": 31, "factors": ["liability cap"]}
  }
}`
    }
  ],
  sdks: [
    {
      language: 'JavaScript/Node.js',
      description: 'Official JavaScript SDK for Node.js and browser environments',
      installation: 'npm install @contractintelligence/sdk',
      github: 'https://github.com/contractintelligence/js-sdk'
    },
    {
      language: 'Python',
      description: 'Official Python SDK with async support',
      installation: 'pip install contractintelligence-sdk',
      github: 'https://github.com/contractintelligence/python-sdk'
    },
    {
      language: 'Java',
      description: 'Official Java SDK for enterprise applications',
      installation: 'Maven/Gradle dependency available',
      github: 'https://github.com/contractintelligence/java-sdk'
    },
    {
      language: 'C#/.NET',
      description: 'Official .NET SDK for Windows and cross-platform',
      installation: 'NuGet package available',
      github: 'https://github.com/contractintelligence/dotnet-sdk'
    }
  ]
}

export default function APIDocsPage() {
  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800'
      case 'POST': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-yellow-100 text-yellow-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            API Documentation
          </h1>
          <p className="text-gray-600 mt-1">Complete API reference and integration guides</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-green-100 text-green-800">
            v{apiData.overview.version}
          </Badge>
          <Badge className="bg-blue-100 text-blue-800">
            {apiData.overview.status}
          </Badge>
          <Button>
            <ExternalLink className="w-4 h-4 mr-2" />
            Interactive API Explorer
          </Button>
        </div>
      </div>

      {/* API Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-600" />
            API Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">{apiData.overview.totalEndpoints}</div>
              <div className="text-sm text-gray-600">Total Endpoints</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600 mb-1">{apiData.overview.rateLimits}</div>
              <div className="text-sm text-gray-600">Rate Limits</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600 mb-1">{apiData.overview.authentication}</div>
              <div className="text-sm text-gray-600">Authentication</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900 mb-1">{apiData.overview.baseUrl}</div>
              <div className="text-sm text-gray-600">Base URL</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Get API Token</h4>
                <p className="text-gray-600 text-sm">Sign up for an account and generate your API token from the dashboard</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Make Your First Request</h4>
                <p className="text-gray-600 text-sm">Use curl or your preferred HTTP client to test the API</p>
                <div className="mt-2 p-3 bg-gray-900 rounded-lg text-green-400 text-sm font-mono">
                  curl -H "Authorization: Bearer YOUR_TOKEN" {apiData.overview.baseUrl}/contracts
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">3</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Integrate with SDK</h4>
                <p className="text-gray-600 text-sm">Use our official SDKs for faster integration</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-6 h-6 text-green-600" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">Bearer Token Authentication</h4>
              <p className="text-green-700 text-sm mb-3">{apiData.authentication.description}</p>
              <div className="bg-green-900 text-green-100 p-3 rounded font-mono text-sm">
                {apiData.authentication.example}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {apiData.authentication.scopes.map((scope, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg text-center">
                  <Badge variant="outline" className="mb-2">{scope}</Badge>
                  <div className="text-xs text-gray-600">
                    {scope.includes('read') ? 'Read access' : 
                     scope.includes('write') ? 'Write access' : 
                     'Admin access'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <div className="space-y-6">
        {apiData.endpoints.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {category.category === 'Contracts' && <FileText className="w-6 h-6 text-blue-600" />}
                {category.category === 'AI Analysis' && <BarChart3 className="w-6 h-6 text-purple-600" />}
                {category.category === 'Search' && <Search className="w-6 h-6 text-green-600" />}
                {category.category === 'Analytics' && <BarChart3 className="w-6 h-6 text-orange-600" />}
                {category.category}
              </CardTitle>
              <p className="text-gray-600">{category.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {category.endpoints.map((endpoint, endpointIndex) => (
                  <div key={endpointIndex} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={getMethodColor(endpoint.method)}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {endpoint.path}
                      </code>
                    </div>
                    
                    <p className="text-gray-700 mb-3">{endpoint.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Parameters:</h5>
                        <div className="flex flex-wrap gap-1">
                          {endpoint.parameters.map((param, paramIndex) => (
                            <Badge key={paramIndex} variant="outline" className="text-xs">
                              {param}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Response:</h5>
                        <p className="text-gray-600 text-sm">{endpoint.response}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-6 h-6 text-green-600" />
            Code Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {apiData.examples.map((example, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{example.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge className={getMethodColor(example.method)}>
                        {example.method}
                      </Badge>
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                        {example.endpoint}
                      </code>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-700">Request:</h5>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(example.code)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{example.code}</code>
                    </pre>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-gray-700 mb-2">Response:</h5>
                    <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{example.response}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SDKs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-600" />
            Official SDKs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apiData.sdks.map((sdk, index) => (
              <div key={index} className="p-6 border border-gray-200 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{sdk.language}</h4>
                <p className="text-gray-600 mb-4">{sdk.description}</p>
                
                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-gray-700 mb-1">Installation:</h5>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded block">
                      {sdk.installation}
                    </code>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={sdk.github} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        GitHub
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Support & Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <Book className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Documentation</h4>
              <p className="text-gray-600 text-sm mb-4">Comprehensive guides and tutorials</p>
              <Button variant="outline" size="sm">
                View Guides
              </Button>
            </div>
            
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <Terminal className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">API Explorer</h4>
              <p className="text-gray-600 text-sm mb-4">Interactive API testing tool</p>
              <Button variant="outline" size="sm">
                Try Now
              </Button>
            </div>
            
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Developer Support</h4>
              <p className="text-gray-600 text-sm mb-4">Get help from our team</p>
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}