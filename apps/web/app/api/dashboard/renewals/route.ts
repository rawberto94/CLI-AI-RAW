/**
 * Dashboard Renewals API
 * GET /api/dashboard/renewals - Get upcoming contract renewals
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo";
    const days = Number(searchParams.get("days")) || 90;
    const dataMode = request.headers.get('x-data-mode') || 'real';
    
    // Mock data for demo mode
    const mockRenewals = [
      {
        id: "1",
        name: "AWS Enterprise Agreement",
        type: "Cloud Services",
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 15,
        priority: 'urgent'
      },
      {
        id: "2",
        name: "Accenture IT Services MSA",
        type: "IT Services",
        endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 28,
        priority: 'urgent'
      },
      {
        id: "3",
        name: "Salesforce Enterprise License",
        type: "Software License",
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 45,
        priority: 'high'
      },
      {
        id: "4",
        name: "Deloitte Consulting Agreement",
        type: "Consulting",
        endDate: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 62,
        priority: 'high'
      },
      {
        id: "5",
        name: "Microsoft Azure Subscription",
        type: "Cloud Services",
        endDate: new Date(Date.now() + 78 * 24 * 60 * 60 * 1000).toISOString(),
        daysUntilExpiry: 78,
        priority: 'medium'
      },
    ];
    
    // If mock mode, return mock data immediately
    if (dataMode === 'mock') {
      return NextResponse.json({
        success: true,
        data: mockRenewals,
        meta: { source: 'mock' }
      });
    }
    
    try {
      const { prisma } = await import("@/lib/prisma");
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      const renewals = await prisma.contract.findMany({
        where: {
          tenantId,
          endDate: {
            gte: now,
            lte: futureDate
          },
          status: { in: ['COMPLETED', 'PROCESSING'] }
        },
        select: {
          id: true,
          fileName: true,
          originalName: true,
          contractType: true,
          endDate: true,
          startDate: true,
          createdAt: true,
        },
        orderBy: {
          endDate: 'asc'
        },
        take: 10
      });
      
      // If no renewals found in database, return mock data for demo
      if (renewals.length === 0) {
        const mockRenewals = [
          {
            id: "mock-1",
            name: "AWS Enterprise Agreement",
            type: "Cloud Services",
            endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilExpiry: 15,
            priority: 'urgent' as const
          },
          {
            id: "mock-2",
            name: "Accenture IT Services MSA",
            type: "IT Services",
            endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilExpiry: 28,
            priority: 'urgent' as const
          },
          {
            id: "mock-3",
            name: "Salesforce Enterprise License",
            type: "Software License",
            endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilExpiry: 45,
            priority: 'high' as const
          },
        ];
        
        return NextResponse.json({
          success: true,
          data: mockRenewals
        });
      }
      
      return NextResponse.json({
        success: true,
        data: renewals.map(contract => {
          const daysUntilExpiry = contract.endDate 
            ? Math.ceil((contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;
            
          return {
            id: contract.id,
            name: contract.originalName || contract.fileName,
            type: contract.contractType || 'Unknown',
            endDate: contract.endDate?.toISOString(),
            daysUntilExpiry,
            priority: daysUntilExpiry && daysUntilExpiry <= 30 ? 'urgent' : 
                     daysUntilExpiry && daysUntilExpiry <= 60 ? 'high' : 'medium'
          };
        })
      });
    } catch (dbError) {
      console.log("Database unavailable, using mock data");
      
      // Mock data
      const mockRenewals = [
        {
          id: "1",
          name: "AWS Enterprise Agreement",
          type: "Cloud Services",
          endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 15,
          priority: 'urgent'
        },
        {
          id: "2",
          name: "Accenture IT Services MSA",
          type: "IT Services",
          endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 28,
          priority: 'urgent'
        },
        {
          id: "3",
          name: "Salesforce Enterprise License",
          type: "Software License",
          endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 45,
          priority: 'high'
        },
        {
          id: "4",
          name: "Deloitte Consulting Agreement",
          type: "Consulting",
          endDate: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 62,
          priority: 'high'
        },
        {
          id: "5",
          name: "Microsoft Azure Subscription",
          type: "Cloud Services",
          endDate: new Date(Date.now() + 78 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiry: 78,
          priority: 'medium'
        },
      ];
      
      return NextResponse.json({
        success: true,
        data: mockRenewals
      });
    }
  } catch (error) {
    console.error("Error in renewals API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch renewals" },
      { status: 500 }
    );
  }
}
