import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export const runtime = "nodejs"

// Export contract artifacts in various formats
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'
    const sections = searchParams.get('sections')?.split(',') || ['all']
    
    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 })
    }

    // Load contract data
    const contractDataPath = join(process.cwd(), 'data', 'contracts', `${contractId}.json`)
    
    if (!existsSync(contractDataPath)) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const contractData = JSON.parse(await readFile(contractDataPath, 'utf-8'))
    
    // Filter sections if specified
    let exportData = contractData
    if (!sections.includes('all')) {
      exportData = {
        id: contractData.id,
        filename: contractData.filename,
        uploadDate: contractData.uploadDate,
        status: contractData.status
      }
      
      if (sections.includes('metadata')) {
        exportData.extractedData = { metadata: contractData.extractedData?.metadata }
      }
      if (sections.includes('financial')) {
        exportData.extractedData = { ...exportData.extractedData, financial: contractData.extractedData?.financial }
      }
      if (sections.includes('risk')) {
        exportData.extractedData = { ...exportData.extractedData, risk: contractData.extractedData?.risk }
      }
      if (sections.includes('compliance')) {
        exportData.extractedData = { ...exportData.extractedData, compliance: contractData.extractedData?.compliance }
      }
      if (sections.includes('clauses')) {
        exportData.extractedData = { ...exportData.extractedData, clauses: contractData.extractedData?.clauses }
      }
    }

    // Generate export based on format
    switch (format.toLowerCase()) {
      case 'json':
        return NextResponse.json(exportData, {
          headers: {
            'Content-Disposition': `attachment; filename="${contractData.filename}_analysis.json"`
          }
        })

      case 'csv':
        const csvData = generateCSV(exportData)
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${contractData.filename}_analysis.csv"`
          }
        })

      case 'summary':
        const summaryData = generateSummary(exportData)
        return NextResponse.json(summaryData, {
          headers: {
            'Content-Disposition': `attachment; filename="${contractData.filename}_summary.json"`
          }
        })

      default:
        return NextResponse.json({ error: "Unsupported format. Use: json, csv, summary" }, { status: 400 })
    }

  } catch (error) {
    console.error('Error exporting contract:', error)
    return NextResponse.json({ 
      error: "Failed to export contract" 
    }, { status: 500 })
  }
}

// Generate CSV format
function generateCSV(contractData: any): string {
  const rows = []
  
  // Header
  rows.push('Section,Field,Value,Confidence,Risk Level')
  
  // Basic info
  rows.push(`Basic,Contract ID,${contractData.id},,`)
  rows.push(`Basic,Filename,${contractData.filename},,`)
  rows.push(`Basic,Upload Date,${contractData.uploadDate},,`)
  rows.push(`Basic,Status,${contractData.status},,`)
  
  // Metadata
  if (contractData.extractedData?.metadata) {
    const metadata = contractData.extractedData.metadata
    Object.entries(metadata).forEach(([key, value]) => {
      rows.push(`Metadata,${key},${value},,`)
    })
  }
  
  // Financial terms
  if (contractData.extractedData?.financial) {
    const financial = contractData.extractedData.financial
    Object.entries(financial).forEach(([key, value]) => {
      if (typeof value === 'object') {
        rows.push(`Financial,${key},${JSON.stringify(value)},,`)
      } else {
        rows.push(`Financial,${key},${value},,`)
      }
    })
  }
  
  // Risk factors
  if (contractData.extractedData?.risk?.riskFactors) {
    contractData.extractedData.risk.riskFactors.forEach((factor: any, index: number) => {
      rows.push(`Risk,Factor ${index + 1},${factor.description},,${factor.severity}`)
    })
  }
  
  // Clauses
  if (contractData.extractedData?.clauses?.clauses) {
    contractData.extractedData.clauses.clauses.forEach((clause: any, index: number) => {
      rows.push(`Clauses,${clause.type},${clause.content},${clause.confidence},${clause.riskLevel}`)
    })
  }
  
  return rows.join('\n')
}

// Generate summary format
function generateSummary(contractData: any): any {
  return {
    contract: {
      id: contractData.id,
      filename: contractData.filename,
      status: contractData.status,
      uploadDate: contractData.uploadDate
    },
    summary: {
      totalClauses: contractData.extractedData?.clauses?.clauses?.length || 0,
      riskScore: contractData.extractedData?.risk?.riskScore || null,
      riskLevel: contractData.extractedData?.risk?.riskLevel || null,
      complianceScore: contractData.extractedData?.compliance?.complianceScore || null,
      totalValue: contractData.extractedData?.financial?.totalValue || null,
      currency: contractData.extractedData?.financial?.currency || null,
      paymentTerms: contractData.extractedData?.financial?.paymentTerms || null,
      keyParties: contractData.extractedData?.metadata?.parties || [],
      effectiveDate: contractData.extractedData?.metadata?.effectiveDate || null,
      expirationDate: contractData.extractedData?.metadata?.expirationDate || null
    },
    keyInsights: [
      `Contract contains ${contractData.extractedData?.clauses?.clauses?.length || 0} analyzed clauses`,
      `Risk assessment: ${contractData.extractedData?.risk?.riskLevel || 'Unknown'} (${contractData.extractedData?.risk?.riskScore || 'N/A'}/100)`,
      `Compliance score: ${contractData.extractedData?.compliance?.complianceScore || 'N/A'}%`,
      `Financial value: ${contractData.extractedData?.financial?.currency || ''} ${contractData.extractedData?.financial?.totalValue?.toLocaleString() || 'N/A'}`
    ],
    exportedAt: new Date().toISOString(),
    exportedBy: 'Contract Intelligence Platform'
  }
}