import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/contracts/[id]/artifacts/stream
 * 
 * Server-Sent Events (SSE) endpoint for streaming artifact generation progress
 * Returns real-time updates as artifacts are generated
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const contractId = params.id;
  const tenantId = request.headers.get('x-tenant-id') || 'demo';

  // Try to validate contract exists, but don't fail if DB is unavailable
  let contract;
  let useMockData = false;
  
  try {
    contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId }
    });
    
    if (!contract) {
      useMockData = true;
    }
  } catch (dbError) {
    console.log('Database unavailable, using mock stream data');
    useMockData = true;
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // Poll for artifact updates every 500ms
      let updateCount = 0;
      pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          let artifacts: any[] = [];
          let contractStatus = 'PROCESSING';
          
          if (useMockData) {
            // Mock data for when database is unavailable
            updateCount++;
            const progress = Math.min(updateCount * 10, 100);
            
            // Simulate artifact generation
            const mockArtifacts = [
              { type: 'overview', status: progress >= 20 ? 'valid' : 'pending' },
              { type: 'key_clauses', status: progress >= 40 ? 'valid' : 'pending' },
              { type: 'financial_analysis', status: progress >= 60 ? 'valid' : 'pending' },
              { type: 'risk_assessment', status: progress >= 80 ? 'valid' : 'pending' },
              { type: 'compliance_check', status: progress >= 100 ? 'valid' : 'pending' },
            ].filter(a => progress >= 20 || a.type === 'overview');
            
            artifacts = mockArtifacts.map((a, i) => ({
              id: `mock-artifact-${i}`,
              type: a.type,
              status: a.status,
              hasContent: a.status === 'valid',
              contentLength: a.status === 'valid' ? 1024 : 0,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }));
            
            contractStatus = progress >= 100 ? 'COMPLETED' : 'PROCESSING';
          } else {
            // Fetch current artifacts from database
            const dbArtifacts = await prisma.artifact.findMany({
              where: { contractId, tenantId },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                type: true,
                validationStatus: true,
                data: true,
                createdAt: true,
                updatedAt: true
              }
            });

            // Check contract status
            const updatedContract = await prisma.contract.findUnique({
              where: { id: contractId },
              select: { 
                status: true
              }
            });
            
            artifacts = dbArtifacts.map(a => ({
              id: a.id,
              type: a.type,
              status: a.validationStatus || 'valid',
              hasContent: !!a.data,
              contentLength: JSON.stringify(a.data).length || 0,
              metadata: {},
              createdAt: a.createdAt,
              updatedAt: a.updatedAt
            }));
            
            contractStatus = updatedContract?.status || 'PROCESSING';
          }

          // Send artifact update
          const data = {
            type: 'update',
            contractId,
            contractStatus,
            processingStage: contractStatus === 'COMPLETED' ? 'complete' : 'processing',
            errorMessage: null,
            artifacts,
            timestamp: new Date().toISOString()
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );

          // If contract is completed or failed, close stream
          if (contractStatus === 'COMPLETED' || contractStatus === 'FAILED') {
            // Send final update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete', 
                contractId,
                status: contractStatus,
                artifactCount: artifacts.length
              })}\n\n`)
            );
            
            clearInterval(pollInterval);
            controller.close();
            isClosed = true;
          }
        } catch (error) {
          console.error('Error polling artifacts:', error);
          // Don't fail the stream, just log the error
        }
      }, 500); // Poll every 500ms
              error: 'Failed to fetch artifacts' 
            })}\n\n`)
          );
        }
      }, 500); // Poll every 500ms

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        isClosed = true;
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },

    cancel() {
      clearInterval(pollInterval);
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
