'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface RateCard {
  id: string;
  supplierName: string;
  supplierTier: string;
  effectiveDate: string;
  expiryDate: string | null;
  originalCurrency: string;
  baseCurrency: string;
  status: string;
  importedAt: string;
  importedBy: string;
  source: string;
}

interface RoleRate {
  id: string;
  standardizedRole: string;
  originalRoleName: string;
  seniorityLevel: string;
  serviceLine: string;
  country: string;
  city: string | null;
  dailyRate: number;
  hourlyRate: number;
  monthlyRate: number;
  baseCurrency: string;
  confidence: number;
  dataQuality: string;
}

export default function RateCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [rateCard, setRateCard] = useState<RateCard | null>(null);
  const [roles, setRoles] = useState<RoleRate[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('all');
  const [serviceLineFilter, setServiceLineFilter] = useState('all');

  useEffect(() => {
    fetchRateCardDetails();
  }, [params.id]);

  const fetchRateCardDetails = async () => {
    try {
      const response = await fetch(`/api/rate-cards-ingestion/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch rate card details');
      const data = await response.json();
      setRateCard(data.rateCard);
      setRoles(data.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = 
      role.standardizedRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.originalRoleName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeniority = seniorityFilter === 'all' || role.seniorityLevel === seniorityFilter;
    const matchesServiceLine = serviceLineFilter === 'all' || role.serviceLine === serviceLineFilter;
    return matchesSearch && matchesSeniority && matchesServiceLine;
  });

  const uniqueSeniorities = Array.from(new Set(roles.map(r => r.seniorityLevel)));
  const uniqueServiceLines = Array.from(new Set(roles.map(r => r.serviceLine)));

  const exportToCSV = () => {
    const headers = ['Role', 'Seniority', 'Service Line', 'Location', 'Daily Rate', 'Hourly Rate', 'Monthly Rate', 'Currency'];
    const rows = filteredRoles.map(role => [
      role.standardizedRole,
      role.seniorityLevel,
      role.serviceLine,
      `${role.city ? role.city + ', ' : ''}${role.country}`,
      role.dailyRate,
      role.hourlyRate,
      role.monthlyRate,
      role.baseCurrency
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rateCard?.supplierName.replace(/\s+/g, '_')}_rate_card.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'HIGH': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'LOW': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !rateCard) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error Loading Rate Card</h3>
          <p className="text-red-600 mt-2">{error || 'Rate card not found'}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={fetchRateCardDetails}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
            <Link
              href="/rate-cards"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/rate-cards"
          className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Rate Cards
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{rateCard.supplierName}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(rateCard.status)}`}>
                {rateCard.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-gray-600">
              {rateCard.supplierTier.replace('_', ' ')} Supplier
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Effective Date</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {new Date(rateCard.effectiveDate).toLocaleDateString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Expiry Date</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {rateCard.expiryDate ? new Date(rateCard.expiryDate).toLocaleDateString() : 'Ongoing'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Currency</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {rateCard.originalCurrency} → {rateCard.baseCurrency}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Roles</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {roles.length} roles
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Role
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by role name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seniority Level
            </label>
            <select
              value={seniorityFilter}
              onChange={(e) => setSeniorityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              {uniqueSeniorities.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Line
            </label>
            <select
              value={serviceLineFilter}
              onChange={(e) => setServiceLineFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Service Lines</option>
              {uniqueServiceLines.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredRoles.length} of {roles.length} roles
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seniority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Line
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Daily Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monthly Rate
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{role.standardizedRole}</div>
                    {role.originalRoleName !== role.standardizedRole && (
                      <div className="text-xs text-gray-500">({role.originalRoleName})</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {role.seniorityLevel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {role.serviceLine}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {role.city ? `${role.city}, ` : ''}{role.country}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {role.dailyRate.toLocaleString()} {role.baseCurrency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    {role.hourlyRate.toLocaleString()} {role.baseCurrency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    {role.monthlyRate.toLocaleString()} {role.baseCurrency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`text-xs font-medium ${getQualityColor(role.dataQuality)}`}>
                      {role.dataQuality}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {(role.confidence * 100).toFixed(0)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRoles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-2">🔍</div>
            <p className="text-gray-600">No roles match your filters</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="font-medium">Source:</span> {rateCard.source}
          </div>
          <div>
            <span className="font-medium">Imported By:</span> {rateCard.importedBy}
          </div>
          <div>
            <span className="font-medium">Imported At:</span> {new Date(rateCard.importedAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Rate Card ID:</span> {rateCard.id.slice(0, 8)}...
          </div>
        </div>
      </div>
    </div>
  );
}
