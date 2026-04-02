'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { EnhancedRateCardEditor } from '@/components/rate-cards/EnhancedRateCardEditor';
import { AuditLogViewer } from '@/components/rate-cards/AuditLogViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, History, FileText, CreditCard, Loader2 } from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

export default function RateCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { dataMode } = useDataMode();
  const [rateCard, setRateCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchRateCard();
    }
    
  }, [params.id, dataMode]);

  const fetchRateCard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rate-cards/${params.id}`, {
        headers: {
          'x-data-mode': dataMode,
        },
      });
      const data = await response.json();
      setRateCard(data);
    } catch {
      // Error fetching rate card
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedData: any) => {
    try {
      const response = await fetch(`/api/rate-cards/${params.id}/edit`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-data-mode': dataMode,
        },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        await fetchRateCard();
        setEditMode(false);
      }
    } catch {
      // Error saving rate card
    }
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
        <div className="max-w-[1600px] mx-auto p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/25 mb-6">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <p className="text-slate-600 font-medium">Loading rate card...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!rateCard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-rose-50/20">
        <div className="max-w-[1600px] mx-auto p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="p-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-lg shadow-red-500/25 mb-6">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Rate Card Not Found</h2>
            <p className="text-slate-600 mb-6">The requested rate card could not be located.</p>
            <Button 
              onClick={() => router.push('/rate-cards')}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rate Cards
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-white/80"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Rate Card Details
            </h1>
            <p className="text-slate-600 mt-1">
              {rateCard.roleStandardized || rateCard.roleOriginal} - {rateCard.supplierName}
            </p>
          </div>
        </div>
        {!editMode && (
          <Button 
            onClick={() => setEditMode(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
          >
            Edit Rate Card
          </Button>
        )}
      </motion.div>

      {/* Client & Status Section */}
      {!editMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
                Client & Status Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="font-medium">
                  {rateCard.clientName ? (
                    <span className="text-violet-600">{rateCard.clientName}</span>
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="flex gap-1 flex-wrap">
                  {rateCard.isBaseline && (
                    <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                      ⭐ Baseline
                    </Badge>
                  )}
                  {rateCard.isNegotiated && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      ✓ Negotiated
                    </Badge>
                  )}
                  {!rateCard.isBaseline && !rateCard.isNegotiated && (
                    <span className="text-muted-foreground text-sm">Standard</span>
                  )}
                </div>
              </div>
              {rateCard.isBaseline && rateCard.baselineType && (
                <div>
                  <div className="text-sm text-muted-foreground">Baseline Type</div>
                  <div className="font-medium">{rateCard.baselineType}</div>
                </div>
              )}
              {rateCard.isNegotiated && rateCard.msaReference && (
                <div>
                  <div className="text-sm text-muted-foreground">MSA Reference</div>
                  <div className="font-medium">{rateCard.msaReference}</div>
                </div>
              )}
            </div>

            {rateCard.isNegotiated && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                {rateCard.negotiationDate && (
                  <div>
                    <div className="text-sm text-muted-foreground">Negotiation Date</div>
                    <div className="font-medium">
                      {new Date(rateCard.negotiationDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {rateCard.negotiatedBy && (
                  <div>
                    <div className="text-sm text-muted-foreground">Negotiated By</div>
                    <div className="font-medium">{rateCard.negotiatedBy}</div>
                  </div>
                )}
              </div>
            )}

            {rateCard.editedAt && (
              <div className="pt-4 border-t text-sm text-slate-500">
                Last edited by {rateCard.editedBy || 'Unknown'} on{' '}
                {new Date(rateCard.editedAt).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue={editMode ? 'edit' : 'details'} className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm border border-white/50 p-1">
            <TabsTrigger value="details" disabled={editMode} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="edit" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Edit
            </TabsTrigger>
            <TabsTrigger value="history" disabled={editMode} className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
                  Rate Card Information
                </CardTitle>
              </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-medium">{rateCard.supplierName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Role</div>
                  <div className="font-medium">{rateCard.roleStandardized || rateCard.roleOriginal}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Seniority</div>
                  <div className="font-medium">{rateCard.seniority}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Country</div>
                  <div className="font-medium">{rateCard.country}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Daily Rate</div>
                  <div className="font-semibold text-lg bg-gradient-to-r from-violet-600 to-violet-600 bg-clip-text text-transparent">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: rateCard.currency || 'USD',
                    }).format(rateCard.dailyRate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Effective Date</div>
                  <div className="font-medium text-slate-900">
                    {rateCard.effectiveDate
                      ? new Date(rateCard.effectiveDate).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          <EnhancedRateCardEditor
            rateCard={rateCard}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </TabsContent>

        <TabsContent value="history">
          <AuditLogViewer
            entityType="RateCardEntry"
            entityId={params.id as string}
          />
        </TabsContent>
      </Tabs>
      </motion.div>
    </div>
    </div>
  );
}
