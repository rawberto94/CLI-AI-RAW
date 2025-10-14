import { NextRequest, NextResponse } from 'next/server';

/**
 * Real-time Streaming API for Analytical Intelligence
 * Provides Server-Sent Events for live updates
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'default';
  const engines = searchParams.get('engines')?.split(',') || ['all'];

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connection',
        message: 'Connected to analytical intelligence stream',
        timestamp: new Date().toISOString(),
        tenantId,
        engines
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Set up periodic updates (every 30 seconds)
      const interval = setInterval(async () => {
        try {
          // Get latest analytical intelligence data
          const updates = await getAnalyticalUpdates(tenantId, engines);
          
          if (updates && updates.length > 0) {
            const message = `data: ${JSON.stringify({
              type: 'update',
              data: updates,
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(message));
          }

          // Send heartbeat
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(heartbeat));

        } catch (error) {
          console.error('Error in analytical intelligence stream:', error);
          
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            message: 'Stream error occurred',
            timestamp: new Date().toISOString()
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(errorMessage));
        }
      }, 30000); // 30 seconds

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

async function getAnalyticalUpdates(tenantId: string, engines: string[]): Promise<any[]> {
  const updates = [];

  try {
    // Mock real-time updates - in production would get actual data
    
    // Rate benchmarking updates
    if (engines.includes('all') || engines.includes('rate-benchmarking')) {
      const rateBenchmarkUpdate = {
        engine: 'rate-benchmarking',
        type: 'benchmark_updated',
        data: {
          cohort: 'Senior Consultant - IT Services - Onshore',
          newBenchmark: {
            p50: 175,
            p75: 200,
            sampleSize: 45
          },
          change: '+2.5%'
        }
      };
      updates.push(rateBenchmarkUpdate);
    }

    // Renewal alerts
    if (engines.includes('all') || engines.includes('renewal-radar')) {
      const renewalUpdate = {
        engine: 'renewal-radar',
        type: 'new_alert',
        data: {
          contractId: 'contract-123',
          supplier: 'Accenture',
          daysUntilExpiry: 28,
          priority: 'high',
          value: 2500000
        }
      };
      updates.push(renewalUpdate);
    }

    // Compliance updates
    if (engines.includes('all') || engines.includes('compliance')) {
      const complianceUpdate = {
        engine: 'compliance',
        type: 'compliance_scored',
        data: {
          contractId: 'contract-456',
          overallScore: 78,
          riskLevel: 'medium',
          criticalIssues: 1
        }
      };
      updates.push(complianceUpdate);
    }

    // Spend variance alerts
    if (engines.includes('all') || engines.includes('spend-overlay')) {
      const spendUpdate = {
        engine: 'spend-overlay',
        type: 'variance_detected',
        data: {
          supplierId: 'deloitte',
          variancePercentage: 15.2,
          period: '2024-03',
          amount: 125000
        }
      };
      updates.push(spendUpdate);
    }

    // Supplier intelligence updates
    if (engines.includes('all') || engines.includes('supplier-snapshot')) {
      const supplierUpdate = {
        engine: 'supplier-snapshot',
        type: 'profile_updated',
        data: {
          supplierId: 'pwc',
          performanceScore: 87,
          riskScore: 23,
          change: 'improved'
        }
      };
      updates.push(supplierUpdate);
    }

    // Only return updates occasionally to avoid spam
    return Math.random() > 0.7 ? updates : [];

  } catch (error) {
    console.error('Error getting analytical updates:', error);
    return [];
  }
}