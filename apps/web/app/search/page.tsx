import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contract Search - Contract Intelligence',
  description: 'AI-powered semantic contract search and discovery platform',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  Filter,
  FileText,
  Calendar,
  DollarSign,
  Building,
  User,
  Clock,
  ArrowRight,
  Download,
  Eye,
  Star,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

// Mock search results data
const searchData = {
  recentSearches: [
    'payment terms',
    'auto-renewal clauses',
    'liability limitations',
    'data processing agreements',
    'termination rights'
  ],
  popularSearches: [
    'MSA agreements',
    'software licenses',
    'consulting contracts',
    'SLA requirements',
    'intellectual property'
  ],
  sampleResults: [
    {
      id: 'contract-001',
      name: 'TechCorp Master Service Agreement',
      type: 'MSA',
      client: 'TechCorp Solutions',
      supplier: 'Your Company',
      value: 2400000,
      status: 'Active',
      uploadDate: '2024-01-15',
      expiryDate: '2025-01-15',
      riskScore: 23,
      complianceScore: 94,
      relevanceScore: 95,
      highlights: [
        'Payment terms: Net 30 days',
        'Auto-renewal clause with 90-day notice',
        'Liability cap: $5M'
      ],
      tags: ['msa', 'software-development', 'high-value']
    },
    {
      id: 'contract-002',
      name: 'CloudServices Infrastructure Agreement',
      type: 'Service Agreement',
      client: 'CloudServices Inc',
      supplier: 'Your Company',
      value: 1800000,
      status: 'Active',
      uploadDate: '2024-01-10',
      expiryDate: '2024-12-31',
      riskScore: 45,
      complianceScore: 87,
      relevanceScore: 89,
      highlights: [
        'SLA: 99.9% uptime guarantee',
        'Data sovereignty requirements',
        'Monthly payment schedule'
      ],
      tags: ['infrastructure', 'cloud-services', 'sla']
    },
    {
      id: 'contract-003',
      name: 'DataPro Analytics License',
      type: 'Software License',
      client: 'DataPro Systems',
      supplier: 'Your Company',
      value: 950000,
      status: 'Active',
      uploadDate: '2024-01-08',
      expiryDate: '2024-06-30',
      riskScore: 67,
      complianceScore: 91,
      relevanceScore: 82,
      highlights: [
        'Usage-based pricing model',
        'IP ownership clearly defined',
        'Termination for convenience clause'
      ],
      tags: ['software-license', 'analytics', 'usage-based']
    }
  ],
  quickFilters: [
    { name: 'Active Contracts', count: 892, active: false },
    { name: 'High Value (>$1M)', count: 234, active: false },
    { name: 'Expiring Soon', count: 45, active: false },
    { name: 'High Risk', count: 23, active: false },
    { name: 'MSA Agreements', count: 156, active: false },
    { name: 'Software Licenses', count: 189, active: false }
  ]
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showResults, setShowResults] = React.useState(false)

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setShowResults(true)
  }

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-600 bg-green-50'
    if (score < 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getRiskIcon = (score: number) => {
    if (score < 30) return <CheckCircle className="w-4 h-4" />
    if (score < 60) return <AlertTriangle className="w-4 h-4" />
    return <Shield className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contract Search</h1>
          <p className="text-gray-600 mt-1">Find contracts quickly with AI-powered semantic search</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search/advanced">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Advanced Search
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contracts by content, terms, parties, or any other criteria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
            <Button 
              onClick={() => handleSearch(searchQuery)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Search
            </Button>
          </div>
          
          {/* Search Suggestions */}
          {!showResults && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Searches</h3>
                <div className="space-y-2">
                  {searchData.recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      {search}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Searches</h3>
                <div className="space-y-2">
                  {searchData.popularSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-3">
        {searchData.quickFilters.map((filter, index) => (
          <Button
            key={index}
            variant={filter.active ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {filter.name}
            <Badge variant="secondary" className="ml-1">
              {filter.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Search Results */}
      {showResults && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Search Results for "{searchQuery}"
              </h2>
              <p className="text-gray-600">Found {searchData.sampleResults.length} contracts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select className="border border-gray-300 rounded px-3 py-1 text-sm">
                <option>Relevance</option>
                <option>Date (Newest)</option>
                <option>Date (Oldest)</option>
                <option>Value (High to Low)</option>
                <option>Value (Low to High)</option>
              </select>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {searchData.sampleResults.map((contract, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{contract.name}</h3>
                        <Badge variant="outline">{contract.type}</Badge>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm text-gray-600">{contract.relevanceScore}% match</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          <span>{contract.client}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>${(contract.value / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Expires: {contract.expiryDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contract.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {contract.status}
                          </span>
                        </div>
                      </div>

                      {/* Highlights */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Highlights:</h4>
                        <ul className="space-y-1">
                          {contract.highlights.map((highlight, highlightIndex) => (
                            <li key={highlightIndex} className="text-sm text-gray-600 flex items-start gap-2">
                              <ArrowRight className="w-3 h-3 mt-0.5 text-blue-600 flex-shrink-0" />
                              <span dangerouslySetInnerHTML={{ __html: highlight }} />
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {contract.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="ml-6 text-right">
                      {/* Risk & Compliance Scores */}
                      <div className="space-y-2 mb-4">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRiskColor(contract.riskScore)}`}>
                          {getRiskIcon(contract.riskScore)}
                          Risk: {contract.riskScore}
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-green-600 bg-green-50">
                          <CheckCircle className="w-4 h-4" />
                          Compliance: {contract.complianceScore}%
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <Link href={`/contracts/${contract.id}`}>
                          <Button size="sm" className="w-full">
                            <Eye className="w-4 h-4 mr-2" />
                            View Contract
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline" className="w-full">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center">
            <Button variant="outline" size="lg">
              Load More Results
            </Button>
          </div>
        </div>
      )}

      {/* Empty State for No Results */}
      {showResults && searchData.sampleResults.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No contracts found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search terms or using different keywords
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setShowResults(false)}>
                Clear Search
              </Button>
              <Link href="/search/advanced">
                <Button>
                  Try Advanced Search
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}