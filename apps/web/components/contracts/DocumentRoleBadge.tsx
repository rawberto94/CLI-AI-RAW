/**
 * Document Role Badge Component
 * 
 * Displays the document role (Primary, Supporting, Amendment, etc.)
 */

import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Files, 
  FilePlus, 
  BookOpen, 
  FileEdit, 
  Archive,
  FileCheck 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentRoleBadgeProps {
  roleId?: string | null;
  className?: string;
  showIcon?: boolean;
}

const ROLE_CONFIG = {
  primary: {
    label: 'Primary',
    icon: FileText,
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  },
  supporting: {
    label: 'Supporting',
    icon: Files,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  derivative: {
    label: 'Derivative',
    icon: FilePlus,
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  },
  reference: {
    label: 'Reference',
    icon: BookOpen,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
  amendment: {
    label: 'Amendment',
    icon: FileEdit,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  superseded: {
    label: 'Superseded',
    icon: Archive,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  template: {
    label: 'Template',
    icon: FileCheck,
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  },
};

export function DocumentRoleBadge({ 
  roleId, 
  className,
  showIcon = true 
}: DocumentRoleBadgeProps) {
  if (!roleId) {
    return null;
  }

  const config = ROLE_CONFIG[roleId as keyof typeof ROLE_CONFIG];
  
  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <Badge className={cn(config.className, 'font-medium', className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
