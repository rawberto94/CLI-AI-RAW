"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { BatchUploadZone } from "@/components/batch-upload-zone";
import { API_BASE_URL } from "../../lib/config";
import { tenantHeaders, getTenantId } from "../../lib/tenant";

export default function UploadPage() {
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [packs, setPacks] = useState<Array<{ id: string; name?: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [policyPack, setPolicyPack] = useState("");
  const [error, setError] = useState<string>("");
  const [tip, setTip] = useState<string>("");

  useEffect(() => {
    setTenantId(getTenantId());
  }, []);

  const checkHealth = () => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/healthz`);
        setApiHealthy(res.ok);
      } catch {
        setApiHealthy(false);
      }
    };
    fetchHealth();
  };

  const loadPacks = () => {
    const fetchPacks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/policies/packs`, {
          headers: tenantHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setPacks(Array.isArray(data.packs) ? data.packs : []);
          if (data.packs && data.packs.length > 0 && !policyPack)
            setPolicyPack(data.packs[0].id);
        }
      } catch {}
    };
    fetchPacks();
  };

  useEffect(() => {
    checkHealth();
    loadPacks();
  }, []);

  const handleUploadComplete = (
    results: Array<{ name: string; docId: string }>
  ) => {
    setError("");
    setTip(
      `Successfully uploaded ${results.length} contract${
        results.length !== 1 ? "s" : ""
      }`
    );
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setTip(
      "Upload failed to reach the backend. Verify API on http://localhost:3001/healthz and try again."
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="mb-2">
            <BackButton hrefFallback="/contracts" />
          </div>
          <CardTitle>Upload Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                API status:{" "}
                {apiHealthy == null
                  ? "—"
                  : apiHealthy
                  ? "Healthy"
                  : "Unreachable"}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Tenant:</span>
                <input
                  value={tenantId || ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setTenantId(v || undefined);
                    try {
                      localStorage.setItem("x-tenant-id", v);
                    } catch {}
                  }}
                  placeholder="demo"
                  className="w-28 px-2 py-1 border rounded text-xs"
                  title="x-tenant-id header value"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Client (optional)
                </label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Supplier (optional)
                </label>
                <input
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  placeholder="Deloitte"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Policy pack (optional)
              </label>
              <select
                value={policyPack}
                onChange={(e) => setPolicyPack(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                {packs.length === 0 && <option value="default">default</option>}
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </div>

            <BatchUploadZone
              tenantId={tenantId}
              clientId={clientId}
              supplierId={supplierId}
              policyPack={policyPack}
              onUploadComplete={handleUploadComplete}
              onError={handleUploadError}
              maxFiles={15}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
            {tip && <p className="text-xs text-muted-foreground">{tip}</p>}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  alert("Not yet implemented: SharePoint connector")
                }
              >
                Connect to SharePoint
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
