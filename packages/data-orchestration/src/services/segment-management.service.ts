
import { PrismaClient } from '@prisma/client';

interface AdvancedFilter {
  rootGroup: {
    logic: 'AND' | 'OR' | 'NOT';
    conditions?: any[];
    groups?: any[];
  };
}

interface CreateSegmentInput {
  name: string;
  description?: string;
  filters: AdvancedFilter;
  shared?: boolean;
}

interface UpdateSegmentInput {
  name?: string;
  description?: string;
  filters?: AdvancedFilter;
  shared?: boolean;
}

interface SegmentUsageStats {
  segmentId: string;
  usageCount: number;
  lastUsed: Date | null;
}

export class SegmentManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new segment
   */
  async createSegment(
    tenantId: string,
    userId: string,
    input: CreateSegmentInput
  ) {
    return this.prisma.rateCardSegment.create({
      data: {
        tenantId,
        userId,
        name: input.name,
        description: input.description,
        filters: input.filters as any,
        shared: input.shared ?? false,
        usageCount: 0,
      },
    });
  }

  /**
   * Get segment by ID
   */
  async getSegment(segmentId: string, tenantId: string) {
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    return segment;
  }

  /**
   * List segments for user
   */
  async listSegments(
    tenantId: string,
    userId: string,
    options: {
      includeShared?: boolean;
      skip?: number;
      take?: number;
    } = {}
  ) {
    const where: any = {
      tenantId,
    };

    if (options.includeShared) {
      where.OR = [{ userId }, { shared: true }];
    } else {
      where.userId = userId;
    }

    const [segments, total] = await Promise.all([
      this.prisma.rateCardSegment.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.rateCardSegment.count({ where }),
    ]);

    return {
      segments,
      total,
      hasMore: options.take ? total > (options.skip || 0) + options.take : false,
    };
  }

  /**
   * Update segment
   */
  async updateSegment(
    segmentId: string,
    tenantId: string,
    userId: string,
    input: UpdateSegmentInput
  ) {
    // Verify ownership
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
        userId,
      },
    });

    if (!segment) {
      throw new Error('Segment not found or access denied');
    }

    return this.prisma.rateCardSegment.update({
      where: { id: segmentId },
      data: {
        name: input.name,
        description: input.description,
        filters: input.filters as any,
        shared: input.shared,
      },
    });
  }

  /**
   * Delete segment
   */
  async deleteSegment(segmentId: string, tenantId: string, userId: string) {
    // Verify ownership
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
        userId,
      },
    });

    if (!segment) {
      throw new Error('Segment not found or access denied');
    }

    await this.prisma.rateCardSegment.delete({
      where: { id: segmentId },
    });

    return { success: true };
  }

  /**
   * Share segment with team
   */
  async shareSegment(segmentId: string, tenantId: string, userId: string) {
    // Verify ownership
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
        userId,
      },
    });

    if (!segment) {
      throw new Error('Segment not found or access denied');
    }

    return this.prisma.rateCardSegment.update({
      where: { id: segmentId },
      data: { shared: true },
    });
  }

  /**
   * Unshare segment
   */
  async unshareSegment(segmentId: string, tenantId: string, userId: string) {
    // Verify ownership
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
        userId,
      },
    });

    if (!segment) {
      throw new Error('Segment not found or access denied');
    }

    return this.prisma.rateCardSegment.update({
      where: { id: segmentId },
      data: { shared: false },
    });
  }

  /**
   * Track segment usage
   */
  async trackUsage(segmentId: string, tenantId: string) {
    const segment = await this.prisma.rateCardSegment.findFirst({
      where: {
        id: segmentId,
        tenantId,
      },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    await this.prisma.rateCardSegment.update({
      where: { id: segmentId },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Get segment usage statistics
   */
  async getUsageStats(tenantId: string, userId: string): Promise<SegmentUsageStats[]> {
    const segments = await this.prisma.rateCardSegment.findMany({
      where: {
        tenantId,
        OR: [{ userId }, { shared: true }],
      },
      select: {
        id: true,
        usageCount: true,
        updatedAt: true,
      },
      orderBy: { usageCount: 'desc' },
      take: 10,
    });

    return segments.map((segment) => ({
      segmentId: segment.id,
      usageCount: segment.usageCount,
      lastUsed: segment.updatedAt,
    }));
  }

  /**
   * Duplicate segment
   */
  async duplicateSegment(
    segmentId: string,
    tenantId: string,
    userId: string,
    newName?: string
  ) {
    const original = await this.getSegment(segmentId, tenantId);

    return this.prisma.rateCardSegment.create({
      data: {
        tenantId,
        userId,
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        filters: original.filters,
        shared: false,
        usageCount: 0,
      },
    });
  }

  /**
   * Get popular segments
   */
  async getPopularSegments(tenantId: string, limit: number = 5) {
    return this.prisma.rateCardSegment.findMany({
      where: {
        tenantId,
        shared: true,
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
