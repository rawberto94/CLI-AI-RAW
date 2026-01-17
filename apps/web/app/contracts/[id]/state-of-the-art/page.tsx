'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArtifactEditor } from '@/components/contracts/ArtifactEditor';
import { EnhancedArtifactEditor } from '@/components/contracts/EnhancedArtifactEditor';
import { RateCardEditor } from '@/components/contracts/RateCardEditor';
import { EnhancedMetadataEditor } from '@/components/contracts/EnhancedMetadataEditor';
import { VersionHistoryPanel } from '@/components/contracts/VersionHistoryPanel';
import { AIAnalysisPanel } from '@/components/contracts/AIAnalysisPanel';
import { 
  FileText, DollarSign, TrendingUp, AlertCircle, CheckCircle2,
  RefreshCw, Download, Edit, History, Tags, ChevronLeft,
  Sparkles, Zap, Target, Clock, Users, Shield, MessageSquare
} from 'lucide-react';

import { ArtifactViewer } from '@/components/contracts/ArtifactViewer';
import { OrchestratorProgress } from '@/components/contracts/OrchestratorProgressEnhanced';
import { OrchestratorAwareChatbot } from '@/components/contracts/OrchestratorAwareChatbot';

interface ContractData {
  id: string;
  name: string;
  status: string;
  uploadedAt: string;
  artifacts?: any[];
  costSavings?: any;
}

export default function StateOfTheArtContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;
  const tenantId = 'default-tenant';
  const userId = 'current-user';
  
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
    loadContractData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const loadContractData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/details`);
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const result = await response.json();
      if (result.success && result.data) {
        setContract(result.data);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleArtifactSave = async (artifactId: string, updates: any) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/artifacts/${artifactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, userId, tenantId, reason: 'User edit' })
      });

      if (response.ok) {
        await loadContractData();
        setEditingArtifactId(null);
      }
    } catch {
      // Error handled silently
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto p-6 space-y-6">
          {/* Skeleton Loading */}
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-4 gap-4 mt-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-32 bg-white/50 backdrop-blur rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700">Contract Not Found</h2>
          <p className="text-gray-500 mt-2">The contract you&apos;re looking for doesn&apos;t exist</p>
          <Button onClick={() => router.push('/contracts')} className="mt-6">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Contracts
          </Button>
        </motion.div>
      </div>
    );
  }

  const avgConfidence = contract.artifacts?.length
    ? contract.artifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / contract.artifacts.length
    : 0;

  const avgCompleteness = contract.artifacts?.length
    ? contract.artifacts.reduce((sum, a) => sum + (a.completeness || 0), 0) / contract.artifacts.length
    : 0;

  const artifacts = contract.artifacts ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6 space-y-6">
        
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-sm text-gray-600"
        >
          <button onClick={() => router.push('/contracts')} className="hover:text-blue-600 transition-colors">
            Contracts
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">{contract.name}</span>
        </motion.div>

        {/* Header with Gradient */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl"
        >
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <FileText className="h-10 w-10" />
                  </motion.div>
                  <div>
                    <h1 className="text-3xl font-bold">{contract.name}</h1>
                    <p className="text-blue-100 text-sm mt-1">ID: {contract.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-white/20 backdrop-blur text-white border-white/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {contract.status}
                  </Badge>
                  <span className="text-sm text-blue-100">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Uploaded {new Date(contract.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="bg-white/20 backdrop-blur hover:bg-white/30 text-white border-white/30">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button className="bg-white text-blue-600 hover:bg-blue-50">
                  <FileText className="h-4 w-4 mr-2" />
                  View PDF
                </Button>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>
        </motion.div>

        {/* Orchestrator Progress - Real-time updates */}
        <OrchestratorProgress 
          contractId={contractId} 
          tenantId={tenantId}
        />

        {/* Stats Cards with Glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { 
              label: 'Artifacts', 
              value: contract.artifacts?.length || 0, 
              icon: FileText, 
              color: 'from-blue-500 to-cyan-500',
              bgColor: 'bg-blue-50'
            },
            { 
              label: 'AI Confidence', 
              value: `${Math.round(avgConfidence * 100)}%`, 
              icon: Sparkles, 
              color: 'from-green-500 to-emerald-500',
              bgColor: 'bg-green-50',
              progress: avgConfidence * 100
            },
            { 
              label: 'Completeness', 
              value: `${Math.round(avgCompleteness)}%`, 
              icon: Target, 
              color: 'from-purple-500 to-pink-500',
              bgColor: 'bg-purple-50',
              progress: avgCompleteness
            },
            { 
              label: 'Potential Savings', 
              value: `$${(contract.costSavings?.totalPotentialSavings.amount || 0).toLocaleString()}`, 
              icon: DollarSign, 
              color: 'from-amber-500 to-orange-500',
              bgColor: 'bg-amber-50'
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5`}></div>
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent">
                        {stat.value}
                      </p>
                      {stat.progress !== undefined && (
                        <Progress value={stat.progress} className="h-2 mt-2" />
                      )}
                    </div>

                    const artifacts = contract.artifacts ?? [];
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content with Modern Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs defaultValue="artifacts" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-white/60 backdrop-blur-lg border border-gray-200/50 p-1 rounded-xl shadow-lg">
              <TabsTrigger value="artifacts" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg">
                <FileText className="h-4 w-4 mr-2" />
                Artifacts
              </TabsTrigger>
              <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg">
                <MessageSquare className="h-4 w-4 mr-2" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="metadata" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg">
                <Tags className="h-4 w-4 mr-2" />
                Metadata
              </TabsTrigger>
              <TabsTrigger value="savings" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg">
                <DollarSign className="h-4 w-4 mr-2" />
                Savings
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg">
                <TrendingUp className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Artifacts Tab */}
            <TabsContent value="artifacts" className="mt-6 space-y-4">
              <AnimatePresence mode="wait">
                {contract.artifacts && contract.artifacts.length > 0 ? (
                  contract.artifacts.map((artifact, index) => {
                    const artifactId = artifact.id || `artifact-${index}`;
                    const isEditing = editingArtifactId === artifactId;
                    const isRateCard = artifact.type === 'RATES' || artifact.type === 'rate_card';

                    return (
                      <motion.div
                        key={artifactId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                          {/* Gradient Top Border */}
                          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                          
                          <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex items-center justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                    <FileText className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-xl">{artifact.type}</CardTitle>
                                    <CardDescription className="flex items-center gap-2 mt-1">
                                      <Zap className="h-3 w-3" />
                                      Extracted via {artifact.method}
                                    </CardDescription>
                                  </div>
                                </div>
                                
                                {/* Confidence & Completeness Badges */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    {Math.round((artifact.confidence || 0) * 100)}% confidence
                                  </Badge>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <Target className="h-3 w-3 mr-1" />
                                    {artifact.completeness}% complete
                                  </Badge>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedArtifactId(artifactId);
                                    setShowVersionHistory(true);
                                  }}
                                  className="hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                                >
                                  <History className="h-4 w-4 mr-2" />
                                  History
                                </Button>
                                {!isEditing && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingArtifactId(artifactId)}
                                    className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-6">
                            <AnimatePresence mode="wait">
                              {isEditing ? (
                                <motion.div
                                  key="editing"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                >
                                  {isRateCard ? (
                                    <RateCardEditor
                                      artifact={{
                                        id: artifactId,
                                        contractId,
                                        type: 'rate_card',
                                        data: artifact.data,
                                        confidence: artifact.confidence || 0,
                                        extractedAt: new Date().toISOString(),
                                        isEdited: false,
                                        editCount: 0
                                      }}
                                      contractId={contractId}
                                      onUpdate={() => {
                                        loadContractData();
                                        setEditingArtifactId(null);
                                      }}
                                    />
                                  ) : (
                                    <EnhancedArtifactEditor
                                      artifact={{
                                        id: artifactId,
                                        contractId,
                                        type: artifact.type.toLowerCase(),
                                        data: artifact.data,
                                        confidence: artifact.confidence || 0,
                                        isEdited: artifact.isEdited || false,
                                        editCount: artifact.editCount || 0,
                                        lastEditedAt: artifact.lastEditedAt,
                                        validationStatus: artifact.validationStatus,
                                      }}
                                      contractId={contractId}
                                      onSave={() => {
                                        loadContractData();
                                        setEditingArtifactId(null);
                                      }}
                                      onCancel={() => setEditingArtifactId(null)}
                                      showHistory={() => {
                                        setSelectedArtifactId(artifactId);
                                        setShowVersionHistory(true);
                                      }}
                                    />
                                  )}
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="viewing"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                >
                                  {/* Beautiful Artifact Display */}
                                  <ArtifactViewer
                                    type={artifact.type}
                                    data={artifact.data}
                                    confidence={artifact.confidence}
                                    processingTime={artifact.processingTime}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="border-0 shadow-lg">
                      <CardContent className="py-16 text-center">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                          <FileText className="h-12 w-12 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Artifacts Yet</h3>
                        <p className="text-gray-500 mb-6">Upload a contract to extract artifacts with AI</p>
                        <Button onClick={() => router.push('/contracts')}>
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Back to Contracts
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="ai-analysis" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>
                  <CardContent className="p-0">
                    <AIAnalysisPanel
                      contractId={contractId}
                      contractName={contract.name}
                      className="h-[600px]"
                      onAnalysisComplete={(result) => {
                        // Analysis completed successfully
                      }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Metadata Tab */}
            <TabsContent value="metadata" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-lg">
                  <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"></div>
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                        <Tags className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>Contract Metadata</CardTitle>
                        <CardDescription>Manage tags, custom fields, and data quality</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <EnhancedMetadataEditor
                      contractId={contractId}
                      tenantId={tenantId}
                      initialMetadata={{
                        tags: ['professional-services', 'software-development'],
                        customFields: {
                          projectCode: 'PROJ-2025-001',
                          department: 'Engineering'
                        },
                        dataQualityScore: avgCompleteness / 100
                      }}
                      onSave={() => loadContractData()}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Savings Tab */}
            <TabsContent value="savings" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {contract.costSavings ? (
                  <div className="space-y-4">
                    {contract.costSavings.opportunities.map((opp: any, index: number) => (
                      <motion.div
                        key={opp.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="border-0 shadow-lg hover:shadow-xl transition-all">
                          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg">{opp.title}</CardTitle>
                                <CardDescription>{opp.description}</CardDescription>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">
                                  ${opp.potentialSavings.amount.toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-500">{opp.potentialSavings.percentage}% savings</p>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="py-16 text-center">
                      <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No cost savings opportunities identified yet</p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-lg">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <CardHeader>
                    <CardTitle>AI-Powered Insights</CardTitle>
                    <CardDescription>
                      {artifacts && artifacts.length > 0 
                        ? 'Review the generated artifacts above for AI insights about this contract.' 
                        : 'Generate artifacts to unlock AI-powered insights about this contract.'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Version History Modal */}
        <AnimatePresence>
          {showVersionHistory && selectedArtifactId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowVersionHistory(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl"
              >
                <Card className="border-0 shadow-2xl max-h-[90vh] overflow-auto">
                  <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                          <History className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle>Version History</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowVersionHistory(false)}
                        className="hover:bg-white/50"
                      >
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <VersionHistoryPanel
                      artifactId={selectedArtifactId}
                      contractId={contractId}
                      onRevert={async (version) => {
                        try {
                          const response = await fetch(
                            `/api/contracts/${contractId}/artifacts/${selectedArtifactId}/revert/${version}`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId, tenantId })
                            }
                          );
                          if (response.ok) {
                            await loadContractData();
                            setShowVersionHistory(false);
                          }
                        } catch {
                          // Error handled silently
                        }
                      }}
                      onClose={() => setShowVersionHistory(false)}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Assistant Button */}
      {!chatbotOpen && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button
            onClick={() => setChatbotOpen(true)}
            className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 relative group"
          >
            <MessageSquare className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          </Button>
        </motion.div>
      )}

      {/* Orchestrator-Aware Chatbot */}
      <OrchestratorAwareChatbot
        contractId={contractId}
        tenantId={tenantId}
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
      />
    </div>
  );
}
