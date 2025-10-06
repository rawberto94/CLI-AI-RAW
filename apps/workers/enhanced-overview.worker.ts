/**
 * Enhanced Overview Worker - Simplified implementation
 */

import { getSharedLLMClient, createProvenance, isLLMAvailable } from './shared/llm-utils';
import { getSharedDatabaseClient } from './shared/database-utils';

const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

export async function runEnhancedOverview(job: { data: { docId: string; tenantId?: string } }): Promise<{ docId: string }> {
  const { docId, tenantId } = job.data;
  console.log(`[enhanced-overview] Starting for ${docId}`);
  
  try {
    // Get contract
    const contractResult = await dbClient.findContract(docId, true);
    if (!contractResult.success || !contractResult.data) {
      throw new Error(`Contract ${docId} not found`);
    }
    
    const contract = contractResult.data;
    const contractTenantId = tenantId ?? contract.tenantId ?? 'demo';

    // Get all artifacts for comprehensive overview
    const artifactsResult = await dbClient.findArtifacts(docId, undefined, 10);
    const artifacts = artifactsResult.success ? artifactsResult.data || [] : [];

    // Get content
    const ingestionArtifact = artifacts.find((a: any) => a.type === 'INGESTION');
    if (!ingestionArtifact?.data?.content) {
      throw new Error(`No content for ${docId}`);
    }

    const content = (ingestionArtifact.data as { content: string }).content;
    const overview = createEnhancedOverview(content, artifacts);

    // Create artifact data
    const artifactData = {
      docId,
      version: '1.0',
      type: 'ENHANCED_OVERVIEW',
      overview,
      insights: overview.insights,
      score: overview.overallScore,
      analysisTimestamp: Date.now(),
      provenance: createProvenance('enhanced-overview')
    };

    await dbClient.createArtifact({
      contractId: docId,
      type: 'ENHANCED_OVERVIEW',
      data: artifactData,
      tenantId: contractTenantId
    });

    console.log(`[enhanced-overview] Completed ${docId} - Score: ${overview.overallScore}`);
    return { docId };

  } catch (error) {
    console.error(`[enhanced-overview] Failed ${docId}:`, error);
    throw error;
  }
}

function createEnhancedOverview(content: string, artifacts: any[]): any {
  const insights = [];
  const scores = [];

  // Analyze contract complexity
  const wordCount = content.split(/\s+/).length;
  const complexity = wordCount > 5000 ? 'high' : wordCount > 2000 ? 'medium' : 'low';
  insights.push({
    type: 'complexity',
    title: 'Contract Complexity',
    content: `This is a ${complexity} complexity contract with ${wordCount} words`,
    confidence: 0.9
  });
  scores.push(complexity === 'low' ? 85 : complexity === 'medium' ? 70 : 55);

  // Analyze key sections
  const sections = ['payment', 'termination', 'liability', 'intellectual property'];
  let foundSections = 0;
  
  sections.forEach(section => {
    const regex = new RegExp(section.replace(' ', '\\s+'), 'i');
    if (regex.test(content)) {
      foundSections++;
      insights.push({
        type: 'section',
        title: `${section.charAt(0).toUpperCase() + section.slice(1)} Clause`,
        content: `Contains ${section} provisions`,
        confidence: 0.8
      });
    }
  });

  const sectionScore = (foundSections / sections.length) * 100;
  scores.push(sectionScore);

  // Analyze artifacts
  artifacts.forEach(artifact => {
    if (artifact.type === 'COMPLIANCE' && artifact.data) {
      insights.push({
        type: 'compliance',
        title: 'Compliance Assessment',
        content: `Compliance analysis completed with ${artifact.data.issues?.length || 0} issues identified`,
        confidence: 0.85
      });
      scores.push(85);
    }
    
    if (artifact.type === 'FINANCIAL' && artifact.data) {
      insights.push({
        type: 'financial',
        title: 'Financial Analysis',
        content: `Financial terms analyzed including payment obligations`,
        confidence: 0.8
      });
      scores.push(80);
    }
  });

  // Calculate overall score
  const overallScore = scores.length > 0 
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 75;

  return {
    insights,
    overallScore,
    complexity,
    sectionsFound: foundSections,
    artifactsAnalyzed: artifacts.length,
    summary: `Comprehensive overview generated with ${insights.length} insights and overall score of ${overallScore}`
  };
}

export default runEnhancedOverview;