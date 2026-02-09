'use client';

/**
 * Enhanced Artifact Viewer - State-of-the-Art Display
 * 
 * Features:
 * - Smooth animations and transitions
 * - Professional gradient styling
 * - Interactive elements
 * - Confidence scores visualization
 * - Smart data highlighting
 * - Responsive design
 * - Accessible markup
 * - Copy to clipboard functionality
 * - Export capabilities
 * - AI insights badges
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  FileText, DollarSign, Shield, AlertTriangle, CheckCircle2, 
  Calendar, Users, MapPin, Clock, TrendingUp, AlertCircle,
  Scale, Award, Target, Sparkles, Copy, Check, Download,
  BarChart3, PieChart, TrendingDown, Zap, Brain, Eye,
  ChevronDown, ChevronUp, ExternalLink, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhancedArtifactViewerProps {
  type: string;
  data: any;
  confidence?: number;
  processingTime?: number;
  onExport?: () => void;
}

export function EnhancedArtifactViewer({ 
  type, 
  data, 
  confidence, 
  processingTime,
  onExport 
}: EnhancedArtifactViewerProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const handleCopy = async (content: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(sectionName);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
    if (conf >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.9) return 'High Confidence';
    if (conf >= 0.7) return 'Medium Confidence';
    return 'Needs Review';
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  const renderOverview = (data: any) => (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Summary Card with Gradient */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 opacity-10" />
          <CardContent className="relative pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-md">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {data.contractType || 'Contract Overview'}
                  </h3>
                  {confidence && (
                    <Badge className={`${getConfidenceColor(confidence)} border`}>
                      <Brain className="h-3 w-3 mr-1" />
                      {getConfidenceLabel(confidence)}
                    </Badge>
                  )}
                </div>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {data.summary || data.detailedDescription}
                </p>
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                  {processingTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{processingTime}ms</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    <span className="font-medium text-violet-600">AI-Powered Analysis</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(data.summary, 'summary')}
              >
                {copiedSection === 'summary' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contract Details with Icon */}
        <motion.div variants={itemVariants}>
          <Card className="h-full border-violet-200 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-violet-500 rounded-lg">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                Contract Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {[
                { label: 'Type', value: data.contractType, icon: FileText },
                { label: 'Effective Date', value: data.effectiveDate, icon: Calendar },
                { label: 'Expiration Date', value: data.expirationDate, icon: Clock },
                { label: 'Duration', value: data.duration, icon: TrendingUp },
                { label: 'Jurisdiction', value: data.jurisdiction || data.governingLaw, icon: Scale },
              ].filter(item => item.value).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-violet-50 transition-colors">
                  <span className="flex items-center gap-2 text-gray-600">
                    <item.icon className="h-4 w-4 text-violet-600" />
                    {item.label}:
                  </span>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Parties with Elegant Design */}
        <motion.div variants={itemVariants}>
          <Card className="h-full border-violet-200 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-pink-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-violet-500 rounded-lg">
                  <Users className="h-4 w-4 text-white" />
                </div>
                Parties Involved
              </CardTitle>
              <CardDescription>
                {data.parties?.length || 0} {data.parties?.length === 1 ? 'party' : 'parties'} identified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {data.parties?.map((party: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-100 to-pink-100 opacity-50 rounded-lg" />
                  <div className="relative p-4 border border-violet-200 rounded-lg backdrop-blur-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg">
                          {party.name || party}
                        </h4>
                        {party.role && (
                          <Badge variant="outline" className="mt-1 bg-white">
                            {party.role}
                          </Badge>
                        )}
                      </div>
                      {party.confidence && (
                        <Badge className={getConfidenceColor(party.confidence)}>
                          {(party.confidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    {party.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-600 mt-2">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{party.address}</span>
                      </div>
                    )}
                    {party.obligations && (
                      <div className="mt-3 pt-3 border-t border-violet-200">
                        <p className="text-sm text-gray-700">{party.obligations}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Key Terms with Collapsible Design */}
      {data.keyTerms && data.keyTerms.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-green-200 hover:shadow-lg transition-shadow duration-300">
            <CardHeader 
              className="cursor-pointer bg-gradient-to-r from-violet-50 to-violet-50"
              onClick={() => toggleSection('keyTerms')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  Key Terms & Obligations
                  <Badge variant="outline" className="ml-2">
                    {data.keyTerms.length} terms
                  </Badge>
                </CardTitle>
                {expandedSections.has('keyTerms') ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedSections.has('keyTerms') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="pt-4">
                    <div className="grid gap-3">
                      {data.keyTerms.map((term: string, idx: number) => (
                        <motion.div
                          key={idx}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200 hover:border-green-400 transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
                            {idx + 1}
                          </div>
                          <p className="text-gray-700 pt-1 flex-1">{term}</p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* Renewal Terms */}
      {data.renewalTerms && (
        <motion.div variants={itemVariants}>
          <Card className="border-orange-200">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-600" />
                Renewal Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-gray-700">{data.renewalTerms}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );

  const renderFinancial = (data: any) => (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Total Value */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-400 via-green-500 to-violet-600 opacity-90" />
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full translate-x-1/3 translate-y-1/3" />
          </div>
          <CardContent className="relative pt-8 pb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-6 w-6 text-white" />
                  <p className="text-white text-lg font-medium opacity-90">Total Contract Value</p>
                </div>
                <p className="text-6xl font-bold text-white mb-3">
                  {data.totalValue?.currency || '$'}
                  {data.totalValue?.amount?.toLocaleString() || 'N/A'}
                </p>
                <div className="flex items-center gap-3">
                  {data.totalValue?.confidence && (
                    <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                      <Brain className="h-3 w-3 mr-1" />
                      {(data.totalValue.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  )}
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI-extracted
                  </Badge>
                </div>
              </div>
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <BarChart3 className="h-32 w-32 text-white opacity-30" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Schedule */}
      {data.paymentSchedule && data.paymentSchedule.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-violet-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 bg-violet-500 rounded-lg">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  Payment Schedule
                  <Badge variant="outline" className="ml-2">
                    {data.paymentSchedule.length} milestones
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(JSON.stringify(data.paymentSchedule, null, 2), 'schedule')}
                >
                  {copiedSection === 'schedule' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.paymentSchedule.map((payment: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-100 to-purple-100 rounded-lg" />
                    <div className="relative flex items-center justify-between p-5 border border-violet-200 rounded-lg backdrop-blur-sm hover:border-violet-400 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-violet-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {idx + 1}
                          </div>
                          <h4 className="font-semibold text-gray-900">{payment.milestone}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 ml-10">
                          <Calendar className="h-3 w-3" />
                          <span>{payment.dueDate}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-green-700">
                          ${payment.amount?.toLocaleString()}
                        </div>
                        <Badge variant="outline" className="mt-1 bg-green-50">
                          {payment.percentage}% of total
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Rate Cards - Premium Design */}
      {data.rateCards && data.rateCards.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-violet-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 via-pink-50 to-rose-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-pink-600 rounded-lg shadow-md">
                      <Award className="h-4 w-4 text-white" />
                    </div>
                    Professional Services Rate Cards
                  </CardTitle>
                  <CardDescription className="mt-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    {data.rateCards.length} role{data.rateCards.length !== 1 ? 's' : ''} identified and benchmarked
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                {data.rateCards.map((rate: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group relative overflow-hidden rounded-xl border-2 border-violet-200 hover:border-violet-400 transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-pink-50 to-rose-50 opacity-50" />
                    <div className="relative p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-gradient-to-br from-violet-600 to-pink-600 rounded-lg shadow-md">
                              <Users className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900">{rate.role}</h4>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {rate.seniority && (
                              <Badge variant="outline" className="bg-white">
                                {rate.seniority}
                              </Badge>
                            )}
                            {rate.lineOfService && (
                              <Badge variant="outline" className="bg-white">
                                {rate.lineOfService}
                              </Badge>
                            )}
                          </div>
                          {rate.location && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span>{rate.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                            ${typeof rate.dailyRate === 'number' ? rate.dailyRate.toLocaleString() : rate.rate?.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600 font-medium mt-1">
                            per {rate.unit || 'day'} {rate.currency || ''}
                          </div>
                        </div>
                      </div>
                      
                      {rate.skills && rate.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-violet-200">
                          {rate.skills.slice(0, 6).map((skill: string, skillIdx: number) => (
                            <Badge key={skillIdx} variant="outline" className="text-xs bg-white hover:bg-violet-50 transition-colors">
                              {skill}
                            </Badge>
                          ))}
                          {rate.skills.length > 6 && (
                            <Badge variant="outline" className="text-xs bg-gray-100">
                              +{rate.skills.length - 6} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border-2 border-violet-200"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-violet-500 rounded-lg">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      💡 Automated Benchmarking
                    </p>
                    <p className="text-sm text-gray-700">
                      These rates have been automatically extracted and saved to your Rate Card Benchmarking system. 
                      You can now compare them against market data to identify savings opportunities.
                    </p>
                  </div>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payment Terms Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-violet-200 h-full">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-600" />
                Payment Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-gray-700">{data.paymentTerms || 'Not specified'}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-orange-200 h-full">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Late Payment Penalties
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-gray-700">{data.penalties || 'None specified'}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  const renderRisk = (data: any) => (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Risk Score Hero */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-2xl">
          <div className={`absolute inset-0 ${
            data.riskLevel === 'high' ? 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-600' :
            data.riskLevel === 'medium' ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-600' :
            'bg-gradient-to-br from-violet-400 via-violet-500 to-violet-600'
          } opacity-90`} />
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/3 -translate-y-1/3" />
          </div>
          <CardContent className="relative pt-8 pb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-6 w-6 text-white" />
                  <p className="text-white text-lg font-medium opacity-90">Overall Risk Score</p>
                </div>
                <p className="text-7xl font-bold text-white mb-3">
                  {data.overallRiskScore}/10
                </p>
                <Badge 
                  className={`text-lg px-4 py-2 ${
                    data.riskLevel === 'high' ? 'bg-red-900/50 text-white border-white/30' :
                    data.riskLevel === 'medium' ? 'bg-yellow-900/50 text-white border-white/30' :
                    'bg-green-900/50 text-white border-white/30'
                  } backdrop-blur-sm`}
                >
                  {data.riskLevel?.toUpperCase()} RISK
                </Badge>
              </div>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <AlertTriangle className="h-32 w-32 text-white opacity-30" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Identified Risks */}
      {data.identifiedRisks && data.identifiedRisks.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-orange-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                Identified Risks
                <Badge variant="outline" className="ml-2">
                  {data.identifiedRisks.length} risks
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {data.identifiedRisks.map((risk: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-orange-400 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-violet-50">
                          {risk.category}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={
                            risk.severity === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                            risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                            'bg-green-100 text-green-700 border-green-300'
                          }
                        >
                          {risk.severity} severity
                        </Badge>
                        <Badge variant="outline" className="bg-gray-50">
                          {risk.likelihood} likelihood
                        </Badge>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 mb-3 text-lg">{risk.description}</p>
                    <div className="bg-gradient-to-r from-violet-50 to-violet-50 rounded-lg p-4 border-2 border-green-200">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-900 mb-1">Mitigation Strategy:</p>
                          <p className="text-sm text-gray-700">{risk.mitigation}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Red Flags */}
      {data.redFlags && data.redFlags.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-red-300 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-red-500 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-white" />
                </div>
                Critical Red Flags
                <Badge variant="destructive" className="ml-2">
                  {data.redFlags.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.redFlags.map((flag: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border-2 border-red-200 hover:border-red-400 transition-colors"
                  >
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-900 font-medium">{flag}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-violet-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-violet-500 rounded-lg">
                  <Target className="h-4 w-4 text-white" />
                </div>
                Recommendations
                <Badge variant="outline" className="ml-2 bg-violet-50">
                  {data.recommendations.length} actions
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.recommendations.map((rec: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-3 p-4 bg-violet-50 rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors"
                  >
                    <div className="w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-gray-700 pt-0.5">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );

  const renderCompliance = (data: any) => (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Compliance Score Hero */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 opacity-90" />
          <div className="absolute inset-0">
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-10 rounded-full -translate-x-1/2 translate-y-1/2" />
          </div>
          <CardContent className="relative pt-8 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="h-6 w-6 text-white" />
                  <p className="text-white text-lg font-medium opacity-90">Compliance Score</p>
                </div>
                <p className="text-7xl font-bold text-white mb-4">
                  {data.complianceScore}/10
                </p>
                <div className="w-full max-w-md bg-white/20 rounded-full h-3 backdrop-blur-sm">
                  <motion.div 
                    className="bg-white h-3 rounded-full shadow-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${(data.complianceScore / 10) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, -10, 10, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Scale className="h-32 w-32 text-white opacity-30" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Applicable Regulations */}
      {data.applicableRegulations && data.applicableRegulations.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-green-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-violet-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-green-500 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                Applicable Regulations
                <Badge variant="outline" className="ml-2 bg-green-50">
                  {data.applicableRegulations.length} regulations
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                {data.applicableRegulations.map((reg: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Badge 
                      variant="outline" 
                      className="text-sm px-4 py-2 bg-green-50 text-green-700 border-green-300 hover:bg-green-100 transition-colors"
                    >
                      {reg}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Data Protection */}
      {data.dataProtection && (
        <motion.div variants={itemVariants}>
          <Card className="border-violet-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-violet-500 rounded-lg">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                Data Protection & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">GDPR Compliant:</span>
                    <Badge 
                      variant="outline" 
                      className={data.dataProtection.gdprCompliant === 'yes' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                    >
                      {data.dataProtection.gdprCompliant}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Data Clauses:</span>
                    <Badge 
                      variant="outline" 
                      className={data.dataProtection.hasDataClauses ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                    >
                      {data.dataProtection.hasDataClauses ? 'Present' : 'Missing'}
                    </Badge>
                  </div>
                </div>
              </div>
              {data.dataProtection.dataRetention && (
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                  <p className="text-sm font-semibold text-violet-900 mb-2">Data Retention Policy:</p>
                  <p className="text-sm text-gray-700">{data.dataProtection.dataRetention}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Compliance Issues */}
      {data.complianceIssues && data.complianceIssues.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-orange-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                Compliance Issues
                <Badge variant="outline" className="ml-2 bg-orange-50">
                  {data.complianceIssues.length} issues
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {data.complianceIssues.map((issue: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-orange-400 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge 
                        variant="outline"
                        className={
                          issue.severity === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                          issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                          'bg-violet-100 text-violet-700 border-violet-300'
                        }
                      >
                        {issue.severity} severity
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50">
                        {issue.regulation}
                      </Badge>
                    </div>
                    <p className="text-gray-900 font-semibold mb-3 text-lg">{issue.issue}</p>
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border-2 border-violet-200">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-violet-900 mb-1">Recommendation:</p>
                          <p className="text-sm text-gray-700">{issue.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Missing Clauses */}
      {data.missingClauses && data.missingClauses.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-yellow-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-white" />
                </div>
                Missing Clauses
                <Badge variant="outline" className="ml-2 bg-yellow-50">
                  {data.missingClauses.length} missing
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.missingClauses.map((clause: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200 hover:border-yellow-400 transition-colors"
                  >
                    <div className="flex-shrink-0 w-7 h-7 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold shadow-md">
                      !
                    </div>
                    <p className="text-gray-900 pt-0.5 font-medium">{clause}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-green-200 hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-violet-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                AI Recommendations
                <Badge variant="outline" className="ml-2 bg-green-50">
                  {data.recommendations.length} actions
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {data.recommendations.map((rec: string, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );

  const renderClauses = (data: any) => (
    <motion.div 
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {data.clauses && data.clauses.length > 0 ? (
        data.clauses.map((clause: any, idx: number) => (
          <motion.div key={idx} variants={itemVariants}>
            <Card className="border-2 border-gray-200 hover:border-violet-400 hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-purple-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-lg flex items-center justify-center font-bold shadow-md">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="bg-violet-50 border-violet-300">
                          {clause.type}
                        </Badge>
                        <CardTitle className="text-base">{clause.title}</CardTitle>
                      </div>
                      {clause.pageReference && (
                        <p className="text-sm text-gray-500">{clause.pageReference}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={
                      clause.riskLevel === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                      clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                      'bg-green-100 text-green-700 border-green-300'
                    }
                  >
                    {clause.riskLevel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    Summary:
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{clause.summary}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-lg p-4 border-2 border-gray-200">
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Full Text:
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{clause.content}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))
      ) : (
        <div className="text-center py-16">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No clauses extracted</p>
        </div>
      )}
    </motion.div>
  );

  const renderDefault = (data: any) => (
    <Card className="border-gray-200">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-gray-600" />
          Raw Data View
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
          <pre className="text-sm overflow-auto max-h-96 text-gray-700 whitespace-pre-wrap font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    const artifactType = type.toUpperCase();
    
    switch (artifactType) {
      case 'OVERVIEW':
        return renderOverview(data);
      case 'FINANCIAL':
        return renderFinancial(data);
      case 'RISK':
        return renderRisk(data);
      case 'COMPLIANCE':
        return renderCompliance(data);
      case 'CLAUSES':
        return renderClauses(data);
      default:
        return renderDefault(data);
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
      
      {/* Enhanced Footer Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl border-2 border-gray-200"
      >
        <div className="flex items-center gap-6 text-sm text-gray-600">
          {processingTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-600" />
              <span><strong>{processingTime}ms</strong> processing time</span>
            </div>
          )}
          {confidence && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span><strong>{(confidence * 100).toFixed(0)}%</strong> confidence</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-600" />
            <span className="font-medium text-violet-600">AI-Enhanced Extraction</span>
          </div>
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </motion.div>
    </div>
  );
}
