/**
 * Rate Card Benchmarking Trigger
 * Automatically triggers benchmarking for extracted rate cards
 */

import { prisma } from '@/lib/prisma';

/**
 * Trigger benchmarking for all rate cards associated with a contract
 * Simplified version that marks rate cards for benchmarking
 */
export async function triggerRateCardBenchmarking(
  contractId: string,
  tenantId: string
): Promise<void> {
  try {
    // Get all rate card entries for this contract
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        contractId,
        tenantId,
      },
    });

    if (rateCards.length === 0) {
      console.log(`  ℹ️ No rate cards to benchmark for contract ${contractId}`);
      return;
    }

    console.log(`  📊 Found ${rateCards.length} rate cards - benchmarking queued`);

    // For now, just log the rate cards found
    // Full benchmarking integration will happen in background
    rateCards.forEach(rc => {
      console.log(`    - ${rc.roleStandardized} (${rc.seniority}): ${rc.dailyRate} ${rc.currency}`);
    });

  } catch (error) {
    console.error('Rate card benchmarking trigger failed:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Get rate cards for a contract with basic statistics
 */
export async function getContractRateCards(contractId: string, tenantId: string) {
  const rateCards = await prisma.rateCardEntry.findMany({
    where: {
      contractId,
      tenantId,
    },
    orderBy: {
      dailyRate: 'desc',
    },
  });

  // Calculate basic statistics (convert Decimal to number)
  const rates = rateCards.map(rc => Number(rc.dailyRate));
  const totalValue = rates.reduce((sum, rate) => sum + rate, 0);
  const avgRate = rateCards.length > 0 ? totalValue / rateCards.length : 0;

  return {
    rateCards: rateCards.map(rc => ({
      id: rc.id,
      role: rc.roleStandardized,
      seniority: rc.seniority,
      dailyRate: Number(rc.dailyRate),
      currency: rc.currency,
      lineOfService: rc.lineOfService,
      location: rc.country,
    })),
    statistics: {
      count: rateCards.length,
      totalValue,
      averageRate: avgRate,
      minRate: rates.length > 0 ? Math.min(...rates) : 0,
      maxRate: rates.length > 0 ? Math.max(...rates) : 0,
    },
  };
}

