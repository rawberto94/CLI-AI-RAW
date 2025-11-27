'use client'

import React, { useState, useMemo } from 'react'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTemplates, useDeleteTemplate } from '@/hooks/use-queries'

interface ContractTemplate {
  id: string
  name: string
  description: string
  category: string
  language: string
  variables: number
  clauses: number
  createdBy: string
  createdAt: string
  lastModified: string
  status: 'draft' | 'active' | 'archived'
  usageCount: number
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Use React Query for data fetching with caching
  const { data: templatesData, isLoading: loading, refetch } = useTemplates()
  const deleteTemplate = useDeleteTemplate()

  // Fallback to mock data if API returns empty
  const templates: ContractTemplate[] = useMemo(() => {
    if (templatesData?.templates && (templatesData.templates as ContractTemplate[]).length > 0) {
      return templatesData.templates as ContractTemplate[]
    }
    // Mock data fallback
    return [
      {
        id: '1',
        name: 'Software License Agreement',
        description: 'Standard SaaS software licensing agreement with usage terms',
        category: 'Technology',
        language: 'en-US',
        variables: 12,
        clauses: 18,
        createdBy: 'Sarah Chen',
        createdAt: '2024-01-15',
        lastModified: '2024-12-20',
        status: 'active',
        usageCount: 45,
      },
      {
        id: '2',
        name: 'Master Services Agreement',
        description: 'Comprehensive MSA template for professional services',
        category: 'Services',
        language: 'en-US',
        variables: 15,
        clauses: 25,
        createdBy: 'Roberto Ostojic',
        createdAt: '2024-02-10',
        lastModified: '2024-12-18',
        status: 'active',
        usageCount: 78,
      },
      {
        id: '3',
        name: 'Non-Disclosure Agreement',
        description: 'Mutual NDA with customizable confidentiality terms',
        category: 'Legal',
        language: 'en-US',
        variables: 8,
        clauses: 12,
        createdBy: 'Mike Johnson',
        createdAt: '2024-03-05',
        lastModified: '2024-11-30',
        status: 'active',
        usageCount: 120,
      },
      {
        id: '4',
        name: 'Employment Agreement',
        description: 'Standard employment contract with benefits and termination clauses',
        category: 'HR',
        language: 'en-US',
        variables: 20,
        clauses: 30,
        createdBy: 'Sarah Chen',
        createdAt: '2024-04-12',
        lastModified: '2024-12-10',
        status: 'active',
        usageCount: 65,
      },
      {
        id: '5',
        name: 'Vendor Agreement',
        description: 'Procurement contract for goods and services',
        category: 'Procurement',
        language: 'en-US',
        variables: 18,
        clauses: 22,
        createdBy: 'Alex Brown',
        createdAt: '2024-05-20',
        lastModified: '2024-12-05',
        status: 'active',
        usageCount: 32,
      },
      {
        id: '6',
        name: 'Consulting Agreement (Draft)',
        description: 'Independent contractor consulting agreement',
        category: 'Services',
        language: 'en-US',
        variables: 10,
        clauses: 15,
        createdBy: 'Jane Smith',
        createdAt: '2024-12-01',
        lastModified: '2024-12-15',
        status: 'draft',
        usageCount: 0,
      },
    ]
  }, [templatesData])

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate.mutateAsync(id)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Active</Badge>
      case 'draft':
        return <Badge className="bg-yellow-500 text-white">Draft</Badge>
      case 'archived':
        return <Badge className="bg-gray-500 text-white">Archived</Badge>
      default:
        return null
    }
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(templates.map((t) => t.category)))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageBreadcrumb />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">Contract Templates</h1>
            </div>
            <p className="text-gray-600 text-lg">
              Manage and create reusable contract templates
            </p>
          </div>

          <Link href="/templates/new">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Template
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Total Templates</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{templates.length}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Active</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {templates.filter((t) => t.status === 'active').length}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Draft</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">
                    {templates.filter((t) => t.status === 'draft').length}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase">Total Usage</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {templates.reduce((sum, t) => sum + t.usageCount, 0)}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter('all')}
                  size="sm"
                >
                  All Categories
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={categoryFilter === category ? 'default' : 'outline'}
                    onClick={() => setCategoryFilter(category)}
                    size="sm"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="shadow-xl border-0 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No templates found</p>
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="shadow-xl border-0 bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-shadow duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl font-bold text-gray-900 flex-1">
                      {template.name}
                    </CardTitle>
                    {getStatusBadge(template.status)}
                  </div>
                  <Badge variant="outline" className="w-fit mt-2">
                    {template.category}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {template.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-500 font-medium uppercase">Variables</p>
                      <p className="text-lg font-bold text-blue-600">{template.variables}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-500 font-medium uppercase">Clauses</p>
                      <p className="text-lg font-bold text-purple-600">{template.clauses}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>Created by {template.createdBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>Modified {new Date(template.lastModified).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      <span>Used {template.usageCount} times</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Link href={`/templates/${template.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
