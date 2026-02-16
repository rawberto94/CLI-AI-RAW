"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, Suspense, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";

function MFAVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { update } = useSession();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/auth/mfa/verify-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: code.replace(/[\s-]/g, "") }),
        });

        const data = await res.json();

        if (!res.ok || !data.data?.success) {
          setError(data.error?.message || "Invalid verification code. Please try again.");
          setLoading(false);
          return;
        }

        // Update the NextAuth session with the signed MFA verification token
        await update({ mfaVerificationToken: data.data.mfaVerificationToken });

        // Redirect to intended destination
        router.push(callbackUrl);
      } catch {
        setError("Verification failed. Please try again.");
        setLoading(false);
      }
    },
    [code, callbackUrl, router, update]
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", damping: 20 }}
        className="w-full max-w-md"
      >
        <Card className="w-full p-6 sm:p-8 shadow-2xl shadow-violet-200/30 border border-slate-100/80 bg-white/90 backdrop-blur-xl rounded-2xl">
          <div className="flex justify-center mb-6">
            <ConTigoLogo size="md" />
          </div>

          <div className="text-center mb-8">
            <motion.div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 shadow-lg shadow-violet-500/30"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <ShieldCheck className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Two-Factor Authentication
            </h1>
            <p className="text-slate-500 text-sm">
              Enter the 6-digit code from your authenticator app to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError("");
                }}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.3em] font-mono h-14"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || code.replace(/[\s-]/g, "").length < 6}
              className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> Verify Code
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400 space-y-2">
            <p>You can also enter a backup code if you don&apos;t have your device.</p>
            <button
              type="button"
              onClick={() => router.push("/auth/signin")}
              className="text-violet-600 hover:text-violet-700 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      }
    >
      <MFAVerifyForm />
    </Suspense>
  );
}
