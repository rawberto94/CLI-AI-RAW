"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-fetch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingsAccessPayload {
  user?: {
    role?: string | null;
  } | null;
}

export function useAdminSettingsAccess() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      try {
        const data = await apiFetch<SettingsAccessPayload>("/api/settings");
        if (!active) return;

        const role = (data.user?.role ?? "").toLowerCase();
        setIsAdmin(role === "admin" || role === "owner");
        setError(null);
      } catch (fetchError) {
        if (!active) return;
        setIsAdmin(false);
        setError(
          fetchError instanceof ApiError
            ? fetchError.message
            : "We couldn't verify your access for this settings page.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, []);

  return { loading, isAdmin, error };
}

export function SettingsAccessLoadingState({ label }: { label: string }) {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}

interface AdminOnlySettingsStateProps {
  title: string;
  description: string;
  errorMessage?: string | null;
}

export function AdminOnlySettingsState({
  title,
  description,
  errorMessage,
}: AdminOnlySettingsStateProps) {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/settings">Back to Settings</Link>
            </Button>
            {errorMessage && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}