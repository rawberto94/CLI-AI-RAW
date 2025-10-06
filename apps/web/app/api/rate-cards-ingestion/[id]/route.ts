import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rateCard = await prisma.rateCard.findUnique({
      where: { id: params.id }
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    const roles = await prisma.roleRate.findMany({
      where: { rateCardId: params.id },
      orderBy: { standardizedRole: 'asc' }
    });

    return NextResponse.json({ rateCard, roles });
  } catch (error) {
    console.error('Error fetching rate card details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate card details' },
      { status: 500 }
    );
  }
}
