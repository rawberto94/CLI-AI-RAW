'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Edit, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RateCardEntry {
  id: string;
  clientName?: string;
  supplierName: string;
  role: string;
  seniority: string;
  lineOfService: string;
  country: string;
  dailyRate: number;
  currency: string;
  isBaseline?: boolean;
  baselineType?: string;
  isNegotiated?: boolean;
  msaReference?: string;
  createdAt: Date;
}

interface RateCardTableProps {
  data: RateCardEntry[];
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
  onBulkEdit?: (ids: string[]) => void;
  showClientColumn?: boolean;
  showBaselineColumn?: boolean;
  showNegotiatedColumn?: boolean;
  loading?: boolean;
}

export function RateCardTable({
  data,
  onEdit,
  onView,
  onDelete,
  onBulkEdit,
  showClientColumn = true,
  showBaselineColumn = true,
  showNegotiatedColumn = true,
  loading = false,
}: RateCardTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(data.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortColumn as keyof RateCardEntry];
    const bValue = b[sortColumn as keyof RateCardEntry];
    
    if (aValue === undefined || bValue === undefined) return 0;
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border p-4">
          <TableSkeleton rows={10} />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">No rate cards found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your filters or create a new rate card
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBulkEdit?.(selectedIds)}
          >
            Bulk Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === data.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              {showClientColumn && (
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort('clientName')}
                >
                  Client
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('supplierName')}
              >
                Supplier
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('role')}
              >
                Role
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('seniority')}
              >
                Seniority
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('lineOfService')}
              >
                Line of Service
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('country')}
              >
                Country
              </TableHead>
              <TableHead
                className="cursor-pointer text-right"
                onClick={() => handleSort('dailyRate')}
              >
                Daily Rate
              </TableHead>
              {showNegotiatedColumn && (
                <TableHead className="text-center">Negotiated</TableHead>
              )}
              {showBaselineColumn && (
                <TableHead className="text-center">Baseline Rate</TableHead>
              )}
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={(checked) =>
                      handleSelectRow(item.id, checked as boolean)
                    }
                  />
                </TableCell>
                {showClientColumn && (
                  <TableCell>
                    {item.clientName ? (
                      <span className="font-medium text-violet-600">
                        {item.clientName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Not assigned
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {item.supplierName}
                </TableCell>
                <TableCell>{item.role}</TableCell>
                <TableCell>{item.seniority}</TableCell>
                <TableCell>{item.lineOfService || '-'}</TableCell>
                <TableCell>{item.country}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.dailyRate, item.currency)}
                </TableCell>
                {showNegotiatedColumn && (
                  <TableCell className="text-center">
                    {item.isNegotiated ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 hover:bg-green-200"
                        title={item.msaReference || 'Negotiated'}
                      >
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                )}
                {showBaselineColumn && (
                  <TableCell className="text-center">
                    {item.isBaseline ? (
                      <div className="flex items-center justify-center">
                        <span className="text-green-600 text-xl" title={item.baselineType || 'Baseline Rate'}>✓</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onView && (
                        <DropdownMenuItem onClick={() => onView(item.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                      )}
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(item.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(item.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
