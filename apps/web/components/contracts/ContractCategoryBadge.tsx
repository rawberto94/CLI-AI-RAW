/**
 * Contract Category Badge Component
 * 
 * Displays contract taxonomy category with color coding
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ContractCategoryBadgeProps {
  categoryId: string;
  subtype?: string | null;
  className?: string;
  showSubtype?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  master_framework: 'Master / Framework',
  scope_work_authorization: 'Scope / Work Auth',
  performance_operations: 'Performance / Ops',
  purchase_supply: 'Purchase / Supply',
  data_security_privacy: 'Data / Security',
  confidentiality_ip: 'Confidentiality / IP',
  software_cloud: 'Software / Cloud',
  partnerships_jv: 'Partnership / JV',
  hr_employment: 'HR / Employment',
  compliance_regulatory: 'Compliance / Regulatory',
};

const CATEGORY_COLORS: Record<string, string> = {
  master_framework: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  scope_work_authorization: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  performance_operations: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  purchase_supply: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  data_security_privacy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  confidentiality_ip: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  software_cloud: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  partnerships_jv: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  hr_employment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  compliance_regulatory: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function ContractCategoryBadge({ 
  categoryId, 
  subtype, 
  className,
  showSubtype = false 
}: ContractCategoryBadgeProps) {
  const label = CATEGORY_LABELS[categoryId] || categoryId;
  const colorClass = CATEGORY_COLORS[categoryId] || CATEGORY_COLORS['compliance_regulatory'];

  return (
    <div className="flex items-center gap-1">
      <Badge className={cn(colorClass, 'font-medium', className)}>
        {label}
      </Badge>
      {showSubtype && subtype && (
        <Badge variant="outline" className="text-xs">
          {subtype}
        </Badge>
      )}
    </div>
  );
}
