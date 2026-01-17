'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BaselineEntryForm } from './BaselineEntryForm';

interface Baseline {
  id: string;
  baselineName: string;
  baselineType: string;
  roleStandardized: string;
  seniority: string | null;
  country: string | null;
  targetRateUSD: number;
  currency: string;
  approvalStatus: string;
  effectiveDate: string;
  expiryDate: string | null;
  isActive: boolean;
}

export function BaselinesList() {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [filter, setFilter] = useState({
    baselineType: '',
    approvalStatus: '',
    isActive: 'true',
  });

  useEffect(() => {
    fetchBaselines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchBaselines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.baselineType) params.append('baselineType', filter.baselineType);
      if (filter.approvalStatus) params.append('approvalStatus', filter.approvalStatus);
      if (filter.isActive) params.append('isActive', filter.isActive);

      const response = await fetch(`/api/rate-cards/baselines?${params}`);
      if (!response.ok) throw new Error('Failed to fetch baselines');

      const data = await response.json();
      setBaselines(data.baselines);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const response = await fetch(`/api/rate-cards/baselines/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: status }),
      });

      if (!response.ok) throw new Error('Failed to update approval status');

      await fetchBaselines();
    } catch {
      // Error handled silently
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      APPROVED: 'default',
      PENDING: 'secondary',
      REJECTED: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TARGET_RATE: 'Target',
      MARKET_BENCHMARK: 'Market',
      HISTORICAL_BEST: 'Historical',
      NEGOTIATED_CAP: 'Cap',
      INTERNAL_POLICY: 'Policy',
    };
    return (
      <Badge variant="outline">
        {labels[type] || type}
      </Badge>
    );
  };

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {selectedBaseline ? 'Edit Baseline' : 'Create New Baseline'}
          </h2>
          <Button
            variant="outline"
            onClick={() => {
              setShowForm(false);
              setSelectedBaseline(null);
            }}
          >
            Back to List
          </Button>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <BaselineEntryForm
            initialData={selectedBaseline}
            mode={selectedBaseline ? 'edit' : 'create'}
            onSuccess={() => {
              setShowForm(false);
              setSelectedBaseline(null);
              fetchBaselines();
            }}
            onCancel={() => {
              setShowForm(false);
              setSelectedBaseline(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Baseline Rates</h2>
        <Button onClick={() => setShowForm(true)}>
          Create Baseline
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={filter.baselineType}
              onChange={(e) => setFilter({ ...filter, baselineType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="TARGET_RATE">Target Rate</option>
              <option value="MARKET_BENCHMARK">Market Benchmark</option>
              <option value="HISTORICAL_BEST">Historical Best</option>
              <option value="NEGOTIATED_CAP">Negotiated Cap</option>
              <option value="INTERNAL_POLICY">Internal Policy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={filter.approvalStatus}
              onChange={(e) => setFilter({ ...filter, approvalStatus: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Active</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={filter.isActive}
              onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
            >
              <option value="">All</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading baselines...</div>
        ) : baselines.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No baselines found. Create your first baseline to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seniority</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Target Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baselines.map((baseline) => (
                <TableRow key={baseline.id}>
                  <TableCell className="font-medium">
                    {baseline.baselineName}
                  </TableCell>
                  <TableCell>{getTypeBadge(baseline.baselineType)}</TableCell>
                  <TableCell>{baseline.roleStandardized}</TableCell>
                  <TableCell>{baseline.seniority || '-'}</TableCell>
                  <TableCell>{baseline.country || 'Global'}</TableCell>
                  <TableCell>
                    ${Number(baseline.targetRateUSD).toLocaleString()} {baseline.currency}
                  </TableCell>
                  <TableCell>{getStatusBadge(baseline.approvalStatus)}</TableCell>
                  <TableCell>
                    {new Date(baseline.effectiveDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {baseline.approvalStatus === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(baseline.id, 'APPROVED')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(baseline.id, 'REJECTED')}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedBaseline(baseline);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
