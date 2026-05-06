/**
 * Artifact Export API Route
 * 
 * Export individual artifact data as JSON, CSV, PDF, or DOCX format.
 * Supports all 15 artifact types with proper content-type headers.
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getAuthenticatedApiContextWithSessionFallback, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { generateArtifactPDF, generateArtifactDOCX } from '@/lib/artifacts/artifact-export';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/export?format=json|csv|pdf|docx
 * Export artifact data in specified format
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = await getAuthenticatedApiContextWithSessionFallback(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const contractId = params.id;
    const artifactId = params.artifactId;
    const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (!['json', 'csv', 'pdf', 'docx'].includes(format)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Format must be "json", "csv", "pdf", or "docx"', 400);
    }

    // Fetch artifact with contract context
    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId },
      select: {
        id: true,
        type: true,
        data: true,
        confidence: true,
        qualityScore: true,
        completenessScore: true,
        accuracyScore: true,
        createdAt: true,
        updatedAt: true,
        contract: {
          select: {
            fileName: true,
            contractType: true,
          }
        }
      }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    if (!artifact.data) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Artifact has no data to export', 400);
    }

    const fileName = artifact.contract?.fileName?.replace(/\.[^.]+$/, '') || 'contract';
    const exportName = `${fileName}_${artifact.type.toLowerCase()}`;

    if (format === 'json') {
      const exportData = {
        artifact: {
          id: artifact.id,
          type: artifact.type,
          contractId,
          contractName: artifact.contract?.fileName,
          contractType: artifact.contract?.contractType,
          confidence: Number(artifact.confidence) || null,
          qualityScore: artifact.qualityScore,
          completenessScore: artifact.completenessScore,
          accuracyScore: artifact.accuracyScore,
          exportedAt: new Date().toISOString(),
        },
        data: artifact.data,
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${exportName}.json"`,
        },
      });
    }

    // PDF format — professional branded document
    if (format === 'pdf') {
      const pdfBytes = generateArtifactPDF({
        artifact: {
          id: artifact.id,
          type: artifact.type,
          data: artifact.data as Record<string, any>,
          confidence: Number(artifact.confidence) || null,
          qualityScore: artifact.qualityScore,
          completenessScore: artifact.completenessScore,
          modelUsed: (artifact as any).modelUsed,
          createdAt: artifact.createdAt,
        },
        contract: {
          fileName: artifact.contract?.fileName,
          contractType: artifact.contract?.contractType,
        },
      });

      return new Response(pdfBytes as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${exportName}.pdf"`,
        },
      });
    }

    // DOCX format — professional Word document
    if (format === 'docx') {
      const docxBytes = await generateArtifactDOCX({
        artifact: {
          id: artifact.id,
          type: artifact.type,
          data: artifact.data as Record<string, any>,
          confidence: Number(artifact.confidence) || null,
          qualityScore: artifact.qualityScore,
          completenessScore: artifact.completenessScore,
          modelUsed: (artifact as any).modelUsed,
          createdAt: artifact.createdAt,
        },
        contract: {
          fileName: artifact.contract?.fileName,
          contractType: artifact.contract?.contractType,
        },
      });

      return new Response(docxBytes as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${exportName}.docx"`,
        },
      });
    }

    // CSV format - flatten the artifact data
    const data = artifact.data as Record<string, any>;
    const rows = flattenToCSV(data, artifact.type);
    const csvContent = convertToCSV(rows);

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${exportName}.csv"`,
      },
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * Flatten artifact data into CSV-friendly rows based on type
 */
function flattenToCSV(data: Record<string, any>, type: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];

  switch (type) {
    case 'CLAUSES': {
      const clauses = data.clauses || data.items || [];
      for (const clause of (Array.isArray(clauses) ? clauses : [])) {
        rows.push({
          title: clause.title || clause.name || '',
          category: clause.category || clause.type || '',
          text: clause.fullText || clause.text || clause.summary || '',
          riskLevel: clause.riskLevel || '',
          section: clause.section || '',
        });
      }
      break;
    }
    case 'FINANCIAL': {
      rows.push({
        totalValue: String(data.totalValue || data.contractValue || ''),
        currency: data.currency || '',
        paymentTerms: data.paymentTerms || '',
        paymentSchedule: data.paymentSchedule || '',
      });
      const items = data.lineItems || data.rateCards || data.financialTerms || [];
      for (const item of (Array.isArray(items) ? items : [])) {
        rows.push({
          item: item.description || item.name || '',
          amount: String(item.amount || item.rate || ''),
          unit: item.unit || item.period || '',
          notes: item.notes || '',
        });
      }
      break;
    }
    case 'RISK': {
      const risks = data.risks || data.items || [];
      for (const risk of (Array.isArray(risks) ? risks : [])) {
        rows.push({
          title: risk.title || risk.name || '',
          severity: risk.severity || risk.level || '',
          category: risk.category || '',
          description: risk.description || '',
          mitigation: risk.mitigation || risk.recommendation || '',
        });
      }
      break;
    }
    case 'OBLIGATIONS': {
      const all = [
        ...(data.buyerObligations || []).map((o: any) => ({ ...o, party: 'Buyer' })),
        ...(data.sellerObligations || []).map((o: any) => ({ ...o, party: 'Seller' })),
        ...(data.mutualObligations || []).map((o: any) => ({ ...o, party: 'Mutual' })),
        ...(data.obligations || []),
      ];
      for (const ob of all) {
        rows.push({
          party: ob.party || '',
          obligation: ob.description || ob.text || ob.obligation || '',
          deadline: ob.deadline || ob.dueDate || '',
          status: ob.status || '',
        });
      }
      break;
    }
    case 'CONTACTS':
    case 'PARTIES': {
      const parties = data.parties || data.contacts || [];
      for (const p of (Array.isArray(parties) ? parties : [])) {
        rows.push({
          name: p.name || '',
          role: p.role || p.type || '',
          email: p.email || '',
          phone: p.phone || '',
          organization: p.organization || p.company || '',
        });
      }
      break;
    }
    default: {
      // Generic: flatten top-level scalar fields
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          rows.push({ field: key, value: String(value) });
        } else if (Array.isArray(value)) {
          rows.push({ field: key, value: `[${value.length} items]` });
        } else if (value && typeof value === 'object') {
          rows.push({ field: key, value: JSON.stringify(value) });
        }
      }
    }
  }

  return rows.length > 0 ? rows : [{ note: 'No structured data available' }];
}

/**
 * Convert row objects to CSV string
 */
function convertToCSV(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) return '';
  
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h] || '')).join(','))
  ];
  
  return lines.join('\n');
}
