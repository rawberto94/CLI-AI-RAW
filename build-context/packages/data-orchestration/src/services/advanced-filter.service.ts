import { PrismaClient } from '@prisma/client';

interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'notIn';
  value: any;
}

interface FilterGroup {
  logic: 'AND' | 'OR' | 'NOT';
  conditions?: FilterCondition[];
  groups?: FilterGroup[];
}

interface AdvancedFilter {
  rootGroup: FilterGroup;
}

interface FilterValidationResult {
  valid: boolean;
  errors: string[];
}

interface FilterMatchCount {
  count: number;
  executionTime: number;
}

export class AdvancedFilterService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate filter structure and conditions
   */
  validateFilter(filter: AdvancedFilter): FilterValidationResult {
    const errors: string[] = [];

    const validateGroup = (group: FilterGroup, path: string = 'root'): void => {
      if (!['AND', 'OR', 'NOT'].includes(group.logic)) {
        errors.push(`${path}: Invalid logic operator '${group.logic}'`);
      }

      if (group.logic === 'NOT' && group.groups && group.groups.length > 1) {
        errors.push(`${path}: NOT operator can only have one child group`);
      }

      if (group.conditions) {
        group.conditions.forEach((condition, idx) => {
          this.validateCondition(condition, `${path}.condition[${idx}]`, errors);
        });
      }

      if (group.groups) {
        group.groups.forEach((subGroup, idx) => {
          validateGroup(subGroup, `${path}.group[${idx}]`);
        });
      }

      if (!group.conditions?.length && !group.groups?.length) {
        errors.push(`${path}: Group must have at least one condition or sub-group`);
      }
    };

    validateGroup(filter.rootGroup);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate individual filter condition
   */
  private validateCondition(
    condition: FilterCondition,
    path: string,
    errors: string[]
  ): void {
    const validFields = [
      'role',
      'geography',
      'seniority',
      'rate',
      'currency',
      'supplier',
      'effectiveDate',
      'expirationDate',
      'contractType',
      'workModel',
    ];

    if (!validFields.includes(condition.field)) {
      errors.push(`${path}: Invalid field '${condition.field}'`);
    }

    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'notIn'];
    if (!validOperators.includes(condition.operator)) {
      errors.push(`${path}: Invalid operator '${condition.operator}'`);
    }

    if (condition.value === undefined || condition.value === null) {
      errors.push(`${path}: Value is required`);
    }

    // Validate operator-value compatibility
    if (['in', 'notIn'].includes(condition.operator) && !Array.isArray(condition.value)) {
      errors.push(`${path}: Operator '${condition.operator}' requires array value`);
    }

    if (['gt', 'gte', 'lt', 'lte'].includes(condition.operator)) {
      if (condition.field === 'rate' && typeof condition.value !== 'number') {
        errors.push(`${path}: Numeric comparison requires number value`);
      }
    }
  }

  /**
   * Calculate real-time match count for filter
   */
  async calculateMatchCount(
    tenantId: string,
    filter: AdvancedFilter
  ): Promise<FilterMatchCount> {
    const startTime = Date.now();

    const validation = this.validateFilter(filter);
    if (!validation.valid) {
      throw new Error(`Invalid filter: ${validation.errors.join(', ')}`);
    }

    const whereClause = this.buildWhereClause(filter.rootGroup, tenantId);

    const count = await this.prisma.rateCardEntry.count({
      where: whereClause,
    });

    const executionTime = Date.now() - startTime;

    return {
      count,
      executionTime,
    };
  }

  /**
   * Apply filter to query rate cards
   */
  async applyFilter(
    tenantId: string,
    filter: AdvancedFilter,
    options: {
      skip?: number;
      take?: number;
      orderBy?: any;
    } = {}
  ) {
    const validation = this.validateFilter(filter);
    if (!validation.valid) {
      throw new Error(`Invalid filter: ${validation.errors.join(', ')}`);
    }

    const whereClause = this.buildWhereClause(filter.rootGroup, tenantId);

    return this.prisma.rateCardEntry.findMany({
      where: whereClause,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy,
      include: {
        supplier: true,
      },
    });
  }

  /**
   * Build Prisma where clause from filter group
   */
  private buildWhereClause(group: FilterGroup, tenantId: string): any {
    const baseWhere: any = { tenantId };

    const groupWhere = this.buildGroupWhere(group);

    return {
      ...baseWhere,
      ...groupWhere,
    };
  }

  /**
   * Recursively build where clause for filter group
   */
  private buildGroupWhere(group: FilterGroup): any {
    const conditions: any[] = [];

    // Add conditions
    if (group.conditions) {
      group.conditions.forEach((condition) => {
        conditions.push(this.buildConditionWhere(condition));
      });
    }

    // Add sub-groups
    if (group.groups) {
      group.groups.forEach((subGroup) => {
        conditions.push(this.buildGroupWhere(subGroup));
      });
    }

    // Apply logic operator
    if (group.logic === 'AND') {
      return conditions.length === 1 ? conditions[0] : { AND: conditions };
    } else if (group.logic === 'OR') {
      return { OR: conditions };
    } else if (group.logic === 'NOT') {
      return { NOT: conditions[0] };
    }

    return {};
  }

  /**
   * Build where clause for individual condition
   */
  private buildConditionWhere(condition: FilterCondition): any {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'ne':
        return { [field]: { not: value } };
      case 'gt':
        return { [field]: { gt: value } };
      case 'gte':
        return { [field]: { gte: value } };
      case 'lt':
        return { [field]: { lt: value } };
      case 'lte':
        return { [field]: { lte: value } };
      case 'contains':
        return { [field]: { contains: value, mode: 'insensitive' } };
      case 'in':
        return { [field]: { in: value } };
      case 'notIn':
        return { [field]: { notIn: value } };
      default:
        return {};
    }
  }

  /**
   * Get filter summary for display
   */
  getFilterSummary(filter: AdvancedFilter): string {
    const summarizeGroup = (group: FilterGroup): string => {
      const parts: string[] = [];

      if (group.conditions) {
        group.conditions.forEach((condition) => {
          parts.push(this.summarizeCondition(condition));
        });
      }

      if (group.groups) {
        group.groups.forEach((subGroup) => {
          parts.push(`(${summarizeGroup(subGroup)})`);
        });
      }

      return parts.join(` ${group.logic} `);
    };

    return summarizeGroup(filter.rootGroup);
  }

  /**
   * Summarize individual condition
   */
  private summarizeCondition(condition: FilterCondition): string {
    const { field, operator, value } = condition;

    const operatorMap: Record<string, string> = {
      eq: '=',
      ne: '≠',
      gt: '>',
      gte: '≥',
      lt: '<',
      lte: '≤',
      contains: 'contains',
      in: 'in',
      notIn: 'not in',
    };

    const displayValue = Array.isArray(value) ? `[${value.join(', ')}]` : value;

    return `${field} ${operatorMap[operator]} ${displayValue}`;
  }
}
