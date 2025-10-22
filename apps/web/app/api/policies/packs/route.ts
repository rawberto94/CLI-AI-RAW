import { NextResponse } from 'next/server';

export async function GET() {
  // Return empty policy packs for now
  return NextResponse.json({
    success: true,
    data: [],
    message: 'No policy packs configured'
  });
}
