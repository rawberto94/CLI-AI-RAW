'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { LoadingState } from '@/components/ui/loading-states'
import {
  Plus,
  Tag,
  Folder,
  Settings,
  BarChart3,
  Edit,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  Users,
  Hash,
  Calendar
} from 'lucide-react'

interface TaxonomyCategory {
  id: string
  name: string
  description?: string
  color: string
  icon: string
  contractCount: number
}

interface TaxonomyTag {
  id: string
  name: string
  color: string
  type: 'system' | 'custom'
  contractCount: number
  trending: boolean
}

interface MetadataField {
  id: string
  name: string
  label: string
  type: string
  category: string
  required: boolean
  usageCount: number
}

export default function TaxonomyManagementPage() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([])
  const [tags, setTags] = useState<TaxonomyTag[]>([])
  const [fields, setFields] = useState<MetadataField[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadTaxonomyData()
  }, [])

  const loadTaxonomyData = async () => {
    try {
      setIsLoading(true)
      
      // Load all taxonomy data
      const [taxonomyResponse, analyticsResponse] = await Promise.all([
        fetch('/api/taxonomy?tenantId=demo'),
        fetch('/api/taxonomy?type=analytics&tenantId=demo')
      ])

      if (taxonomyResponse.ok) {
        const taxonomyData = await taxonomyResponse.json()
        if (taxonomyData.success) {
          setCategories(taxonomyData.data.categories || [])
          setTags(taxonomyData.data.tags || [])
          setFields(taxonomyData.data.fields || [])
        }
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json()
        if (analyticsData.success) {
          setAnalytics(analyticsData.data)
        }
      }
    } catch (error) {
      console.error('Failed to load taxonomy data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredFields = fields.filter(field =>
    field.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingState 
            title="Loading Taxonomy Management"
            description="Preparing your taxonomy data and analytics..."
            size="lg"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Tag className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Taxonomy Management</h1>
              <p className="text-gray-600">
                Manage categories, tags, and custom fields for contract organization
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Categories"
              value={analytics.categoryUsage?.length || 0}
              subtitle="Active categories"
              icon={<Folder className="w-4 h-4" />}
              color="blue"
            />
            <MetricCard
              title="Tags"
              value={analytics.tagUsage?.length || 0}
              subtitle="Available tags"
              icon={<Tag className="w-4 h-4" />}
              color="purple"
            />
            <MetricCard
              title="Custom Fields"
              value={analytics.fieldUsage?.length || 0}
              subtitle="Metadata fields"
              icon={<Hash className="w-4 h-4" />}
              color="green"
            />
            <MetricCard
              title="Total Usage"
              value={analytics.categoryUsage?.reduce((sum: number, cat: any) => sum + cat.contractCount, 0) || 0}
              subtitle="Contract assignments"
              icon={<BarChart3 className="w-4 h-4" />}
              color="orange"
            />
          </div>
        )}

        {/* Search and Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search categories, tags, or fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600">
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="tags" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="fields" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Custom Fields
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map((category) => (
                <EnhancedCard key={category.id} variant="interactive" hover>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: category.color + '20' }}
                        >
                          <Folder 
                            className="w-5 h-5" 
                            style={{ color: category.color }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                          <p className="text-sm text-gray-600">{category.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {category.contractCount} contracts
                      </Badge>
                      <Badge 
                        variant="outline"
                        style={{ 
                          backgroundColor: category.color + '20',
                          borderColor: category.color,
                          color: category.color 
                        }}
                      >
                        Active
                      </Badge>
                    </div>
                  </CardContent>
                </EnhancedCard>
              ))}
            </div>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTags.map((tag) => (
                <EnhancedCard key={tag.id} variant="interactive" hover>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                        style={{ 
                          backgroundColor: tag.color + '20',
                          borderColor: tag.color,
                          color: tag.color 
                        }}
                      >
                        <Tag className="w-3 h-3" />
                        {tag.name}
                      </Badge>
                      {tag.trending && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {tag.contractCount} contracts
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {tag.type}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-3">
                      <Button variant="ghost" size="sm" className="flex-1">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </EnhancedCard>
              ))}
            </div>
          </TabsContent>

          {/* Custom Fields Tab */}
          <TabsContent value="fields" className="space-y-6">
            <div className="space-y-4">
              {filteredFields.map((field) => (
                <EnhancedCard key={field.id} variant="interactive" hover>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Hash className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{field.label}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {field.category}
                            </Badge>
                            {field.required && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {field.usageCount || 0}
                          </div>
                          <div className="text-xs text-gray-600">uses</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </EnhancedCard>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Usage */}
                <EnhancedCard variant="gradient">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="w-5 h-5 text-blue-600" />
                      Category Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.categoryUsage?.map((cat: any, index: number) => (
                        <div key={cat.categoryId} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${(cat.contractCount / Math.max(...analytics.categoryUsage.map((c: any) => c.contractCount))) * 100}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 w-8">{cat.contractCount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </EnhancedCard>

                {/* Tag Trends */}
                <EnhancedCard variant="gradient">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Tag Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.tagUsage?.map((tag: any) => (
                        <div key={tag.tagId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{tag.name}</span>
                            {tag.trending && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                Trending
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-600">{tag.contractCount}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </EnhancedCard>

                {/* Recent Activity */}
                <EnhancedCard variant="gradient" className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.recentActivity?.map((activity: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            {activity.type === 'tag_created' && <Tag className="w-4 h-4 text-purple-600" />}
                            {activity.type === 'category_updated' && <Folder className="w-4 h-4 text-purple-600" />}
                            {activity.type === 'field_added' && <Hash className="w-4 h-4 text-purple-600" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {activity.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                            <p className="text-sm text-gray-600">{activity.item}</p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </EnhancedCard>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}