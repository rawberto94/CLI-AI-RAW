"use client";

/**
 * Tenant Context Banner
 * 
 * Shows when a platform admin is viewing as a specific client tenant
 */

import { useState, useEffect } from "react";
import { X, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function TenantContextBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewingAsTenant, setViewingAsTenant] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    // Check URL param first
    const tenantIdFromUrl = searchParams.get("tenantId");
    const tenantNameFromStorage = sessionStorage.getItem("viewAsTenantName");
    const tenantIdFromStorage = sessionStorage.getItem("viewAsTenantId");

    if (tenantIdFromUrl && tenantNameFromStorage) {
      setViewingAsTenant({
        id: tenantIdFromUrl,
        name: tenantNameFromStorage,
      });
    } else if (tenantIdFromStorage && tenantNameFromStorage) {
      setViewingAsTenant({
        id: tenantIdFromStorage,
        name: tenantNameFromStorage,
      });
    } else {
      setViewingAsTenant(null);
    }
  }, [searchParams]);

  const handleExitViewAs = () => {
    sessionStorage.removeItem("viewAsTenantId");
    sessionStorage.removeItem("viewAsTenantName");
    router.push("/platform");
  };

  if (!viewingAsTenant) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 shadow-md">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5" />
          <span className="font-medium">
            Viewing as: <span className="font-bold">{viewingAsTenant.name}</span>
          </span>
          <span className="text-amber-100 text-sm">
            (Platform Admin Mode)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExitViewAs}
          className="text-white hover:bg-white/20 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit to Platform Admin
        </Button>
      </div>
    </div>
  );
}
