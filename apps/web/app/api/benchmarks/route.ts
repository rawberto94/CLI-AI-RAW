import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Mock benchmarks data for demo
export async function GET() {
  const mockBenchmarks = {
    items: [
      {
        id: "bench_001",
        role: "Senior Developer",
        market_rate: 150,
        currency: "USD",
        unit: "hour",
        region: "US",
        percentile_50: 140,
        percentile_75: 160,
        percentile_90: 180,
        sample_size: 245
      },
      {
        id: "bench_002", 
        role: "Project Manager",
        market_rate: 125,
        currency: "USD",
        unit: "hour",
        region: "US",
        percentile_50: 115,
        percentile_75: 135,
        percentile_90: 155,
        sample_size: 189
      }
    ],
    total: 2,
    page: 1,
    limit: 50
  }

  return NextResponse.json(mockBenchmarks)
}