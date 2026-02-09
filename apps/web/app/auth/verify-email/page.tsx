"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.data?.verified) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error?.message || "Verification failed. The link may be expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("An error occurred during verification.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="w-full p-8 shadow-2xl shadow-violet-200/30 border border-slate-100/80 bg-white/90 backdrop-blur-xl rounded-2xl text-center">
          <div className="flex justify-center mb-6">
            <ConTigoLogo size="md" />
          </div>

          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-violet-600 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">Verifying your email...</h1>
              <p className="text-slate-500 text-sm">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Verified!</h1>
              <p className="text-slate-500 text-sm mb-6">{message}</p>
              <Button asChild className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <XCircle className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h1>
              <p className="text-slate-500 text-sm mb-6">{message}</p>
              <Button asChild className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                <Link href="/auth/signin">Go to Sign In</Link>
              </Button>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
