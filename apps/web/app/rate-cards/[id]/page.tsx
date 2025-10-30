'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { EnhancedRateCardEditor } from '@/components/rate-cards/EnhancedRateCardEditor';
import { AuditLogViewer } from '@/components/rate-cards/AuditLogViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, History, FileText } from 'lucide-react';

export default function RateCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [rateCard, setRateCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchRateCard();
    }
  }, [params.id]);

  const fetchRateCard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rate-cards/${params.id}`);
      const data = await response.json();
      setRateCard(data);
    } catch (error) {
      console.error('Error fetching rate card:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedData: any) => {
    try {
      const response = await fetch(`/api/rate-cards/${params.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        await fetchRateCard();
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error saving rate card:', error);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (!rateCard) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Rate card not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Rate Card Details</h1>
            <p className="text-muted-foreground">
              {rateCard.roleStandardized || rateCard.roleOriginal} - {rateCard.supplierName}
            </p>
          </div>
        </div>
        {!editMode && (
          <Button onClick={() => setEditMode(true)}>
            Edit Rate Card
          </Button>
        )}
      </div>

      {/* Client & Status Section */}
      {!editMode && (
        <Card>
          <CardHeader>
            <CardTitle>Client & Status Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="font-medium">
                  {rateCard.clientName ? (
                    <span className="text-blue-600">{rateCard.clientName}</span>
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="flex gap-1 flex-wrap">
                  {rateCard.isBaseline && (
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
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
              <div className="pt-4 border-t text-sm text-muted-foreground">
                Last edited by {rateCard.editedBy || 'Unknown'} on{' '}
                {new Date(rateCard.editedAt).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue={editMode ? 'edit' : 'details'} className="space-y-6">
        <TabsList>
          <TabsTrigger value="details" disabled={editMode}>
            <FileText className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="edit">
            Edit
          </TabsTrigger>
          <TabsTrigger value="history" disabled={editMode}>
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Rate Card Information</CardTitle>
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
                  <div className="text-sm text-muted-foreground">Daily Rate</div>
                  <div className="font-medium text-lg">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: rateCard.currency || 'USD',
                    }).format(rateCard.dailyRate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Effective Date</div>
                  <div className="font-medium">
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
    </div>
  );
}
