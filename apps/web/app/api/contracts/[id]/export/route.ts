import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const format = request.nextUrl.searchParams.get('format') || 'json'
    const dataMode = request.headers.get('x-data-mode') || 'real'

    if (dataMode !== 'real') {
      // Mock response
      return new NextResponse('Mock export data', {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="contract-${params.id}.${format}"`
        }
      })
    }

    // Fetch contract with artifacts
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: {
        artifacts: true
      }
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    switch (format) {
      case 'json':
        return new NextResponse(JSON.stringify(contract, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="contract-${params.id}.json"`
          }
        })

      case 'pdf':
        // TODO: Implement PDF generation with pdfkit
        // For now, return JSON
        return new NextResponse(JSON.stringify(contract, null, 2), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="contract-${params.id}.pdf"`
          }
        })

      case 'excel':
        // TODO: Implement Excel generation with exceljs
        // For now, return CSV
        const csv = generateCSV(contract)
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="contract-${params.id}.csv"`
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid format' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}

function generateCSV(contract: any): string {
  const rows = [
    ['Field', 'Value'],
    ['Contract ID', contract.id],
    ['Title', contract.contractTitle || ''],
    ['Supplier', contract.supplierName || ''],
    ['Client', contract.clientName || ''],
    ['Value', contract.totalValue || ''],
    ['Status', contract.status],
    ['Uploaded', contract.uploadedAt],
    ['', ''],
    ['Artifacts', ''],
    ...contract.artifacts.map((a: any) => [a.type, a.data])
  ]

  return rows.map(row => row.join(',')).join('\n')
}
