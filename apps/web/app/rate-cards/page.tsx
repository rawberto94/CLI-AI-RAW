'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload, Plus } from 'lucide-react';

interface RateCard {
  id: string;
  supplierName: string;
  effectiveDate: string;
  expiryDate: string | null;
  originalCurrency: string;
  status: string;
  importedAt: string;
  _count: {
    roles: number;
  };
}

export default function RateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRateCards();
  }, []);

  const fetchRateCards = async () => {
    try {
      const response = await fetch('/api/rate-cards-ingestion');
      if (!response.ok) throw new Error('Failed to fetch rate cards');
      const data = await response.json();
      setRateCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredRateCards = rateCards.filter(card => {
    const matchesSearch = card.supplierName.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error Loading Rate Cards</h3>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={fetchRateCards}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rate Cards</h1>
          <p className="text-gray-600 mt-1">
            Manage and view all supplier rate cards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/import/rate-cards"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Excel/CSV
          </Link>
          <Link
            href="/rate-cards/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rate Card
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Supplier
            </label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by supplier name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Rate Cards</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{rateCards.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {rateCards.filter(c => c.status === 'APPROVED').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">
            {rateCards.filter(c => c.status === 'PENDING_APPROVAL').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Roles</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {rateCards.reduce((sum, card) => sum + card._count.roles, 0)}
          </div>
        </div>
      </div>

      {/* Rate Cards List */}
      {filteredRateCards.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter || statusFilter !== 'all' ? 'No matching rate cards' : 'No rate cards yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {filter || statusFilter !== 'all' 
              ? 'Try adjusting your filters'
              : 'Get started by importing your first rate card'}
          </p>
          {!filter && statusFilter === 'all' && (
            <Link
              href="/import/rate-cards"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Import Rate Card
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRateCards.map((card) => (
            <Link
              key={card.id}
              href={`/rate-cards/${card.id}`}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {card.supplierName}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(card.status)}`}>
                      {card.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Effective Date:</span>
                      <div className="font-medium text-gray-900">
                        {new Date(card.effectiveDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Expiry Date:</span>
                      <div className="font-medium text-gray-900">
                        {card.expiryDate ? new Date(card.expiryDate).toLocaleDateString() : 'Ongoing'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Currency:</span>
                      <div className="font-medium text-gray-900">{card.originalCurrency}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Roles:</span>
                      <div className="font-medium text-gray-900">{card._count.roles} roles</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Imported {new Date(card.importedAt).toLocaleString()}
                  </div>
                </div>
                <div className="ml-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
