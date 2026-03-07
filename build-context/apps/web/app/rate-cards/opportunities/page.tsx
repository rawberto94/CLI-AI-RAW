'use client';

import { useState } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { OpportunitiesList } from '@/components/rate-cards/OpportunitiesList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, FileText, Calendar, Sparkles } from 'lucide-react';

export default function OpportunitiesPage() {
  const [clientFilter, setClientFilter] = useState('');
  const [opportunityType, setOpportunityType] = useState<string>('all');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20">
      <div className="container mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Savings Opportunities
            </h1>
            <p className="text-slate-600">
              Identify, track, and realize cost savings opportunities
            </p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientFilter" className="text-slate-700">Filter by Client</Label>
                  <Input
                    id="clientFilter"
                    placeholder="Enter client name..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="bg-white"
                  />
                </div>
                {clientFilter && (
                  <div className="flex items-center pt-8">
                    <Badge variant="outline" className="bg-white">Client: {clientFilter}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Opportunity Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={opportunityType} onValueChange={setOpportunityType}>
            <TabsList className="grid w-full grid-cols-4 bg-white/90 backdrop-blur-sm border border-white/50">
              <TabsTrigger value="all">
                All Opportunities
              </TabsTrigger>
              <TabsTrigger value="above-baseline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Above Baseline
              </TabsTrigger>
              <TabsTrigger value="negotiation-due">
                <TrendingUp className="h-4 w-4 mr-2" />
                Negotiation Due
              </TabsTrigger>
              <TabsTrigger value="msa-renewal">
                <Calendar className="h-4 w-4 mr-2" />
                MSA Renewal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              <OpportunitiesList />
            </TabsContent>

            <TabsContent value="above-baseline" className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                    Above Baseline Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-4">
                    Rate cards that exceed their baseline thresholds, indicating potential for cost reduction
                  </p>
                  <OpportunitiesList />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="negotiation-due" className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-1.5 bg-violet-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-violet-600" />
                    </div>
                    Negotiation Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-4">
                    Rates significantly above market median that present negotiation opportunities
                  </p>
                  <OpportunitiesList />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="msa-renewal" className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-1.5 bg-violet-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-violet-600" />
                    </div>
                    MSA Renewal Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-4">
                    Upcoming MSA renewals in the next 90 days that require attention
              </p>
              <OpportunitiesList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      {clientFilter && (
        <Card>
          <CardHeader>
            <CardTitle>Client-Specific Opportunities - {clientFilter}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100/50">
                <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">12</div>
                <div className="text-sm text-orange-700">Above Baseline</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100/50">
                <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">8</div>
                <div className="text-sm text-violet-700">Negotiation Due</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100/50">
                <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">3</div>
                <div className="text-sm text-violet-700">MSA Renewals</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </motion.div>
      </div>
    </div>
  );
}
