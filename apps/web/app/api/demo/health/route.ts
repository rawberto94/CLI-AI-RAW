import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'production',
    timestamp: new Date().toISOString(),
    optimizations: {
      swap: true,
      competingContainersStopped: true,
      demoContractsSeeded: true,
      pilotMode: true,
    },
    stadler: {
      tenant: 'Stadler',
      slug: 'stadler',
      contracts: 15,
      currencies: ['CHF'],
      categories: ['Maintenance', 'Supply', 'Service', 'Integration', 'Supply & Installation'],
    },
  });
}
