'use client';

/**
 * Rate Comparison View Component
 * 
 * Side-by-side comparison view for selected rate cards
 * Displays rates in columns with visual indicators for differences
 * Requirements: 6.2, 6.3
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Minus,
  Award,
  Download,
  Share2,
  Save
} from 'lucide-react';
import { SaveComparisonDialog } from './SaveComparisonDialog';

interface RateCardEntry {
  id: string;
  supplierName: string;
  roleStandardized: string;
  roleOriginal: string;
  seniority: string;
  lineOfService: string;
  country: string;
  region: string;
  city?: string;
  dailyRate: number;
  dailyRateUSD: number;
  currency: string;
  effectiveDate: string;
  expiryDate?: string;
  source: string;
  isNegotiated: boolean;
  volumeCommitted?: number;
  skills?: string[];
  certifications?: string[];
}

interface RateComparisonViewProps {
  rateCardIds: string[];
  onBack: () => void;
  onSave?: (name: string) => void;
  onShare?: () => void;
  onExport?: () => void;
}

export function RateComparisonView({ 
  rateCardIds, 
  onBack, 
  onSave,
  onShare,
  onExport 
}: RateComparisonViewProps) {
  const [rateCards, setRateCards] = useState<RateCardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    fetchRateCards();
    
  }, [rateCardIds]);

  const fetchRateCards = async () => {
    setLoading(true);
    try {
      // Fetch all selected rate cards
      const promises = rateCardIds.map(id =>
        fetch(`/api/rate-cards/${id}`).then(res => res.json())
      );
      const results = await Promise.all(promises);
      setRateCards(results);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getLowestRate = () => {
    if (rateCards.length === 0) return 0;
    return Math.min(...rateCards.map(rc => rc.dailyRateUSD));
  };

  const getHighestRate = () => {
    if (rateCards.length === 0) return 0;
    return Math.max(...rateCards.map(rc => rc.dailyRateUSD));
  };

  const calculateVariance = (rate: number) => {
    const lowestRate = getLowestRate();
    if (lowestRate === 0) return 0;
    return ((rate - lowestRate) / lowestRate) * 100;
  };

  const getVarianceIndicator = (variance: number) => {
    if (variance === 0) {
      return <Award className="h-4 w-4 text-green-600" />;
    } else if (variance < 10) {
      return <TrendingUp className="h-4 w-4 text-yellow-600" />;
    } else {
      return <TrendingUp className="h-4 w-4 text-red-600" />;
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30';
    if (variance < 10) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const lowestRate = getLowestRate();
  const highestRate = getHighestRate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Dialog */}
      <SaveComparisonDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        rateCardIds={rateCardIds}
        onSave={() => {
          // Comparison saved
        }}
      />

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <CardTitle>Rate Comparison</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Comparing {rateCards.length} rate cards
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onSave && (
                <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
              {onShare && (
                <Button variant="outline" size="sm" onClick={onShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Lowest Rate</p>
              <p className="text-2xl font-bold text-green-600">
                ${lowestRate.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">USD per day</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Highest Rate</p>
              <p className="text-2xl font-bold text-red-600">
                ${highestRate.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">USD per day</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Max Variance</p>
              <p className="text-2xl font-bold text-orange-600">
                {calculateVariance(highestRate).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">from lowest</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-Side Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left p-3 font-medium text-sm bg-gray-50 dark:bg-slate-800/50">Field</th>
                  {rateCards.map((rc, index) => (
                    <th key={rc.id} className="text-left p-3 font-medium text-sm bg-gray-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        Option {index + 1}
                        {rc.dailyRateUSD === lowestRate && (
                          <Badge variant="default" className="bg-green-600">
                            <Award className="h-3 w-3 mr-1" />
                            Best
                          </Badge>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Supplier */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Supplier</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">{rc.supplierName}</td>
                  ))}
                </tr>

                {/* Role */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Role</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      <div>
                        <p>{rc.roleStandardized}</p>
                        {rc.roleOriginal !== rc.roleStandardized && (
                          <p className="text-xs text-muted-foreground">({rc.roleOriginal})</p>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Seniority */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Seniority</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      <Badge variant="outline">{rc.seniority}</Badge>
                    </td>
                  ))}
                </tr>

                {/* Daily Rate */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 bg-violet-50 dark:bg-violet-950/20">
                  <td className="p-3 font-medium text-sm">Daily Rate</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3">
                      <div>
                        <p className="font-semibold text-lg">
                          ${rc.dailyRate.toLocaleString()} {rc.currency}
                        </p>
                        {rc.currency !== 'USD' && (
                          <p className="text-sm text-muted-foreground">
                            ${rc.dailyRateUSD.toLocaleString()} USD
                          </p>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Variance from Lowest */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Variance from Best</td>
                  {rateCards.map(rc => {
                    const variance = calculateVariance(rc.dailyRateUSD);
                    return (
                      <td key={rc.id} className="p-3">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getVarianceColor(variance)}`}>
                          {getVarianceIndicator(variance)}
                          <span className="font-semibold">
                            {variance === 0 ? 'Best Rate' : `+${variance.toFixed(1)}%`}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Potential Savings */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Daily Savings vs Best</td>
                  {rateCards.map(rc => {
                    const savings = rc.dailyRateUSD - lowestRate;
                    return (
                      <td key={rc.id} className="p-3">
                        {savings === 0 ? (
                          <span className="text-green-600 font-semibold">-</span>
                        ) : (
                          <span className="text-red-600 font-semibold">
                            ${savings.toLocaleString()}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Location */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Location</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      <div>
                        <p>{rc.country}</p>
                        <p className="text-xs text-muted-foreground">{rc.region}</p>
                        {rc.city && <p className="text-xs text-muted-foreground">{rc.city}</p>}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Line of Service */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Line of Service</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">{rc.lineOfService}</td>
                  ))}
                </tr>

                {/* Effective Date */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Effective Date</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">{formatDate(rc.effectiveDate)}</td>
                  ))}
                </tr>

                {/* Expiry Date */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Expiry Date</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      {rc.expiryDate ? formatDate(rc.expiryDate) : 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Negotiated */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Negotiated</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      <Badge variant={rc.isNegotiated ? "default" : "secondary"}>
                        {rc.isNegotiated ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                  ))}
                </tr>

                {/* Volume Committed */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Volume Committed</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      {rc.volumeCommitted ? `${rc.volumeCommitted} days` : 'N/A'}
                    </td>
                  ))}
                </tr>

                {/* Source */}
                <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-sm">Source</td>
                  {rateCards.map(rc => (
                    <td key={rc.id} className="p-3 text-sm">
                      <Badge variant="outline">{rc.source}</Badge>
                    </td>
                  ))}
                </tr>

                {/* Skills */}
                {rateCards.some(rc => rc.skills && rc.skills.length > 0) && (
                  <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-medium text-sm">Skills</td>
                    {rateCards.map(rc => (
                      <td key={rc.id} className="p-3 text-sm">
                        {rc.skills && rc.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rc.skills.map((skill, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    ))}
                  </tr>
                )}

                {/* Certifications */}
                {rateCards.some(rc => rc.certifications && rc.certifications.length > 0) && (
                  <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-medium text-sm">Certifications</td>
                    {rateCards.map(rc => (
                      <td key={rc.id} className="p-3 text-sm">
                        {rc.certifications && rc.certifications.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rc.certifications.map((cert, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
