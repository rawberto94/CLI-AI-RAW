/**
 * AI System Status API
 * 
 * GET /api/ai/status - Get AI system health and capabilities status
 * 
 * Features:
 * - OpenAI API connectivity check
 * - RAG system status
 * - Embedding coverage
 * - Model availability
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

export const GET = withAuthApiHandler(async (_request, ctx) => {
  const tenantId = ctx.tenantId;
  const startTime = Date.now();
  
  try {
    // Check OpenAI configuration
    const openaiConfigured = hasAIClientConfig();
    const mistralConfigured = !!process.env.MISTRAL_API_KEY;
    
    // Test OpenAI connectivity (lightweight)
    let openaiStatus: 'connected' | 'error' | 'not_configured' = 'not_configured';
    let openaiLatency: number | null = null;
    
    if (openaiConfigured) {
      try {
        const testStart = Date.now();
        const OpenAI = (await import('openai')).default;
        const openai = createOpenAIClient();
        
        // Simple model list call to verify connectivity
        await openai.models.list();
        openaiLatency = Date.now() - testStart;
        openaiStatus = 'connected';
      } catch (_error) {
        openaiStatus = 'error';
      }
    }
    
    // Get RAG statistics
    const [totalContracts, contractsWithEmbeddings, totalEmbeddings] = await Promise.all([
      prisma.contract.count({
        where: { tenantId, status: { in: ['COMPLETED', 'ACTIVE'] } } }),
      prisma.contract.count({
        where: { 
          tenantId, 
          status: { in: ['COMPLETED', 'ACTIVE'] },
          contractEmbeddings: { some: {} } } }),
      prisma.contractEmbedding.count({
        where: { contract: { tenantId } } }),
    ]);
    
    const ragCoverage = totalContracts > 0 
      ? Math.round((contractsWithEmbeddings / totalContracts) * 100)
      : 100;
    
    // Build capabilities list
    const capabilities = {
      chat: openaiConfigured,
      contractAnalysis: openaiConfigured,
      contractComparison: openaiConfigured,
      semanticSearch: openaiConfigured && ragCoverage > 0,
      riskAnalysis: openaiConfigured,
      clauseExtraction: openaiConfigured,
      ocr: openaiConfigured || mistralConfigured,
      embeddings: openaiConfigured,
      queryExpansion: openaiConfigured,
      crossEncoderReranking: openaiConfigured };
    
    const enabledCount = Object.values(capabilities).filter(Boolean).length;
    const totalCapabilities = Object.keys(capabilities).length;
    
    return createSuccessResponse(ctx, {
      status: openaiStatus === 'connected' ? 'healthy' : openaiConfigured ? 'degraded' : 'limited',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      
      providers: {
        openai: {
          configured: openaiConfigured,
          status: openaiStatus,
          latency: openaiLatency,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          embeddingModel: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small' },
        mistral: {
          configured: mistralConfigured,
          status: mistralConfigured ? 'available' : 'not_configured' } },
      
      rag: {
        status: ragCoverage === 100 ? 'fully_indexed' : ragCoverage > 50 ? 'partially_indexed' : 'needs_indexing',
        coverage: ragCoverage,
        statistics: {
          totalContracts,
          indexedContracts: contractsWithEmbeddings,
          pendingContracts: totalContracts - contractsWithEmbeddings,
          totalEmbeddings,
          averageEmbeddingsPerContract: contractsWithEmbeddings > 0 
            ? Math.round(totalEmbeddings / contractsWithEmbeddings) 
            : 0 },
        features: {
          semanticChunking: true,
          hybridSearch: true,
          queryExpansion: openaiConfigured,
          reranking: openaiConfigured,
          crossContractSearch: true } },
      
      capabilities,
      capabilitySummary: {
        enabled: enabledCount,
        total: totalCapabilities,
        percentage: Math.round((enabledCount / totalCapabilities) * 100) },
      
      recommendations: [
        ...(!openaiConfigured ? ['Configure OPENAI_API_KEY to enable AI features'] : []),
        ...(ragCoverage < 80 ? [`Run batch RAG processing to index ${totalContracts - contractsWithEmbeddings} remaining contracts`] : []),
        ...(!mistralConfigured && openaiConfigured ? ['Consider adding MISTRAL_API_KEY for OCR fallback'] : []),
      ],
      
      endpoints: {
        chat: '/api/ai/chat',
        analyze: '/api/ai/analyze',
        compare: '/api/ai/compare',
        insights: '/api/ai/insights',
        batchRAG: '/api/ai/rag/batch',
        suggestions: '/api/ai/suggestions',
        history: '/api/ai/history' } });
    
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});
