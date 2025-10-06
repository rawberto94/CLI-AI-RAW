import { NextRequest, NextResponse } from 'next/server';
import { getRateCardsBySupplier } from '@/lib/mock-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const rateCards = getRateCardsBySupplier();
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCards = rateCards.slice(startIndex, endIndex);

    return NextResponse.json({
      items: paginatedCards,
      total: rateCards.length,
      page,
      limit,
      totalPages: Math.ceil(rateCards.length / limit)
    });
  } catch (error) {
    console.error('Error fetching rate cards:', error);
    return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // For demo purposes, just return success
    return NextResponse.json({
      id: `rate_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      status: 'created'
    });
  } catch (error) {
    console.error('Error creating rate card:', error);
    return NextResponse.json({ error: 'Failed to create rate card' }, { status: 500 });
  }
}