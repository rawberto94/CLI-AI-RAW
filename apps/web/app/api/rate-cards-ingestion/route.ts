import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rateCards = await prisma.rateCard.findMany({
      include: {
        _count: {
          select: { roles: true }
        }
      },
      orderBy: { importedAt: 'desc' }
    });

    return NextResponse.json(rateCards);
  } catch (error) {
    console.error('Error fetching rate cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate cards' },
      { status: 500 }
    );
  }
}
