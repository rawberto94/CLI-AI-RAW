import { NextResponse } from "next/server"

export const runtime = "nodejs"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Get contract details and processing status
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id
    
    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 })
    }

    // Fetch contract from backend API
    const contractRes = await fetch(`${API_URL}/api/contracts/${contractId}`, {
      headers: {
        'x-tenant-id': 'demo'
      }
    });
    
    if (!contractRes.ok) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const contract = await contractRes.json();
    
    // Fetch artifacts
    const artifactsRes = await fetch(`${API_URL}/api/contracts/${contractId}/artifacts`, {
      headers: {
        'x-tenant-id': 'demo'
      }
    });
    
    const artifacts = artifactsRes.ok ? await artifactsRes.json() : {};
    
    // Combine contract metadata with artifacts
    const contractData = {
      id: contract.id,
      filename: contract.name,
      uploadDate: contract.createdAt,
      status: contract.status === 'COMPLETED' ? 'completed' : contract.status === 'PROCESSING' ? 'processing' : 'error',
      tenantId: contract.tenantId || 'demo',
      uploadedBy: 'user',
      fileSize: 0,
      mimeType: 'application/pdf',
      processing: {
        jobId: contract.id,
        status: contract.status,
        currentStage: 'completed',
        progress: 100,
        startTime: contract.createdAt,
        completedAt: contract.updatedAt
      },
      extractedData: artifacts
    }
    
    // Check if we have real processing results
    const hasRealResults = contractData.extractedData && contractData.status === 'completed'
    
    // Add some computed fields for the UI
    const enrichedData = {
      ...contractData,
      processingDuration: contractData.processing.completedAt 
        ? new Date(contractData.processing.completedAt).getTime() - new Date(contractData.processing.startTime).getTime()
        : Date.now() - new Date(contractData.processing.startTime).getTime(),
      
      // Add summary statistics
      summary: {
        totalClauses: contractData.extractedData?.clauses?.clauses?.length || 0,
        riskFactors: contractData.extractedData?.risk?.riskFactors?.length || 0,
        complianceIssues: contractData.extractedData?.compliance?.issues?.length || 0,
        financialTerms: Object.keys(contractData.extractedData?.financial || {}).length,
        keyParties: contractData.extractedData?.metadata?.parties?.length || 0,
        extractedTables: contractData.extractedData?.financial?.extractedTables?.length || 0,
        rateCards: contractData.extractedData?.financial?.rateCards?.length || 0,
        totalSavingsOpportunity: contractData.extractedData?.financial?.benchmarkingResults?.reduce((sum: number, br: any) => sum + (br.totalSavingsOpportunity || 0), 0) || 0
      },

      // Add processing insights
      insights: generateProcessingInsights(contractData),
      
      // Transform financial data for UI compatibility
      financial: transformFinancialData(contractData.extractedData?.financial),
      metadata: contractData.extractedData?.metadata,
      risk: contractData.extractedData?.risk,
      compliance: contractData.extractedData?.compliance,
      clauses: contractData.extractedData?.clauses
    }

    return NextResponse.json(enrichedData)

  } catch (error) {
    console.error('Error fetching contract:', error)
    return NextResponse.json({ 
      error: "Failed to fetch contract details" 
    }, { status: 500 })
  }
}

// Update contract metadata
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id
    const updates = await req.json()
    
    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 })
    }

    // Load existing contract data
    const contractDataPath = join(process.cwd(), 'data', 'contracts', `${contractId}.json`)
    
    if (!existsSync(contractDataPath)) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const contractData = JSON.parse(await readFile(contractDataPath, 'utf-8'))
    
    // Update allowed fields
    const allowedUpdates = ['clientId', 'supplierId', 'notes', 'tags', 'priority']
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    // Apply updates
    const updatedData = {
      ...contractData,
      ...filteredUpdates,
      lastModified: new Date().toISOString()
    }

    // Save updated data
    await writeFile(contractDataPath, JSON.stringify(updatedData, null, 2))

    return NextResponse.json(updatedData)

  } catch (error) {
    console.error('Error updating contract:', error)
    return NextResponse.json({ 
      error: "Failed to update contract" 
    }, { status: 500 })
  }
}

// Delete contract
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id
    
    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 })
    }

    const contractDataPath = join(process.cwd(), 'data', 'contracts', `${contractId}.json`)
    
    if (!existsSync(contractDataPath)) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    // Delete contract file
    const { unlink } = await import('fs/promises')
    await unlink(contractDataPath)

    // Also try to delete the uploaded file
    try {
      const contractData = JSON.parse(await readFile(contractDataPath, 'utf-8'))
      if (contractData.filePath && existsSync(contractData.filePath)) {
        await unlink(contractData.filePath)
      }
    } catch (error) {
      // File might already be deleted, ignore error
    }

    return NextResponse.json({ message: "Contract deleted successfully" })

  } catch (error) {
    console.error('Error deleting contract:', error)
    return NextResponse.json({ 
      error: "Failed to delete contract" 
    }, { status: 500 })
  }
}

function generateProcessingInsights(contractData: any) {
  const insights = []

  // Processing performance insight
  if (contractData.processing.completedAt) {
    const duration = new Date(contractData.processing.completedAt).getTime() - 
                    new Date(contractData.processing.startTime).getTime()
    const durationSeconds = Math.round(duration / 1000)
    
    insights.push({
      type: 'performance',
      title: 'Processing Performance',
      description: `Contract processed in ${durationSeconds} seconds`,
      icon: 'zap',
      color: 'green'
    })
  }

  // Risk insight
  if (contractData.extractedData?.risk) {
    const risk = contractData.extractedData.risk
    insights.push({
      type: 'risk',
      title: `${risk.riskLevel} Risk Level`,
      description: `Risk score: ${risk.riskScore}/100 with ${risk.riskFactors?.length || 0} identified factors`,
      icon: 'shield',
      color: risk.riskLevel === 'LOW' ? 'green' : risk.riskLevel === 'MEDIUM' ? 'yellow' : 'red'
    })
  }

  // Compliance insight
  if (contractData.extractedData?.compliance) {
    const compliance = contractData.extractedData.compliance
    insights.push({
      type: 'compliance',
      title: 'Compliance Status',
      description: `${compliance.complianceScore}% compliant with ${compliance.regulations?.length || 0} regulations checked`,
      icon: 'award',
      color: compliance.complianceScore >= 90 ? 'green' : compliance.complianceScore >= 70 ? 'yellow' : 'red'
    })
  }

  // Financial insight
  if (contractData.extractedData?.financial) {
    const financial = contractData.extractedData.financial
    insights.push({
      type: 'financial',
      title: 'Financial Terms',
      description: `Total value: ${financial.currency} ${financial.totalValue?.toLocaleString()} with ${financial.paymentTerms}`,
      icon: 'dollar-sign',
      color: 'blue'
    })
  }

  // Clause completeness insight
  if (contractData.extractedData?.clauses) {
    const clauses = contractData.extractedData.clauses
    insights.push({
      type: 'clauses',
      title: 'Clause Analysis',
      description: `${clauses.clauses?.length || 0} clauses extracted with ${clauses.completeness?.score || 0}% completeness`,
      icon: 'file-text',
      color: 'purple'
    })
  }

  return insights
}

function transformFinancialData(financialData: any) {
  if (!financialData) return null;
  
  return {
    totalValue: financialData.totalValue,
    currency: financialData.currency,
    paymentTerms: financialData.paymentTerms,
    milestones: financialData.extractedTables?.filter((t: any) => t.type === 'payment_schedule').length || 0,
    penalties: Array.isArray(financialData.penalties) ? financialData.penalties.join(', ') : financialData.penalties || 'None specified',
    extractedTables: financialData.extractedTables || [],
    rateCards: financialData.rateCards?.map((rc: any) => ({
      ...rc,
      insights: rc.insights || {
        totalAnnualSavings: financialData.benchmarkingResults?.find((br: any) => br.rateCardId === rc.id)?.totalSavingsOpportunity 
          ? `$${financialData.benchmarkingResults.find((br: any) => br.rateCardId === rc.id).totalSavingsOpportunity.toLocaleString()}`
          : '$0',
        averageVariance: financialData.benchmarkingResults?.find((br: any) => br.rateCardId === rc.id)?.averageVariance 
          ? `${financialData.benchmarkingResults.find((br: any) => br.rateCardId === rc.id).averageVariance > 0 ? '+' : ''}${financialData.benchmarkingResults.find((br: any) => br.rateCardId === rc.id).averageVariance.toFixed(1)}%`
          : '0%',
        ratesAboveMarket: financialData.benchmarkingResults?.find((br: any) => br.rateCardId === rc.id)?.ratesAboveMarket || 0,
        ratesBelowMarket: financialData.benchmarkingResults?.find((br: any) => br.rateCardId === rc.id)?.ratesBelowMarket || 0,
        recommendation: financialData.benchmarkingResults?.find((br: any) => br.rateCardId === rc.id)?.recommendations?.[0] || 'No specific recommendations'
      }
    })) || [],
    benchmarkingResults: financialData.benchmarkingResults || [],
    insights: financialData.insights || {
      totalPotentialSavings: 0,
      highestSavingsOpportunity: { role: 'N/A', amount: 0 },
      rateAnalysisSummary: {
        totalRoles: 0,
        aboveMarketCount: 0,
        belowMarketCount: 0,
        averageVariance: 0
      },
      recommendations: [],
      riskFactors: []
    }
  };
}