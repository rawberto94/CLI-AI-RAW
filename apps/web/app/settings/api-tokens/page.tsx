"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";

interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const SCOPE_OPTIONS = [
  "contracts:read",
  "contracts:write",
  "obligations:read",
  "events:read",
  "*",
];

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["contracts:read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-tokens");
      const json = await res.json();
      if (res.ok) setTokens(json.data || []);
      else toast.error(json.error || "Failed to load tokens");
    } catch {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scopes,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to create token");
        return;
      }
      setNewToken(json.data.token);
      await load();
    } catch {
      toast.error("Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!confirm("Revoke this token? Existing consumers will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/admin/api-tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || "Failed to revoke");
        return;
      }
      toast.success("Token revoked");
      await load();
    } catch {
      toast.error("Failed to revoke");
    }
  };

  const closeDialog = () => {
    setShowDialog(false);
    setName("");
    setScopes(["contracts:read"]);
    setExpiresAt("");
    setNewToken(null);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> API Tokens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tokens authenticate consumers of <code>/api/v1/*</code>. Use{" "}
            <code>Authorization: Bearer ctg_…</code> to query contracts and obligations from
            warehouses, BI tools, or other systems.
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> New token
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active tokens</CardTitle>
          <CardDescription>Only token prefixes are shown. The full token is visible once at creation.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{t.prefix}…</code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.scopes.split(",").map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                      {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleString()}` : " · Never used"}
                      {t.expiresAt ? ` · Expires ${new Date(t.expiresAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRevoke(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newToken ? "Token created" : "Create API token"}</DialogTitle>
            <DialogDescription>
              {newToken
                ? "Copy this token now. It will not be shown again."
                : "Pick a name and scopes. The token is shown once."}
            </DialogDescription>
          </DialogHeader>

          {newToken ? (
            <div className="space-y-3">
              <div className="rounded-md border p-3 bg-amber-50 border-amber-200">
                <code className="text-xs break-all">{newToken}</code>
              </div>
              <Button variant="outline" className="w-full" onClick={() => copy(newToken)}>
                <Copy className="h-4 w-4 mr-2" /> Copy token
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Snowflake warehouse" />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_OPTIONS.map((s) => {
                    const active = scopes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setScopes((cur) =>
                            cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
                          )
                        }
                        className={`text-xs px-2 py-1 rounded border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {newToken ? (
              <Button onClick={closeDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={onCreate} disabled={creating}>
                  {creating ? "Creating…" : "Create token"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
