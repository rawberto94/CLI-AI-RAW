"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Something went wrong");
      }
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

          {sent ? (
            <div className="text-center">
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h1>
              <p className="text-slate-500 text-sm mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
                Check your inbox and follow the instructions.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/signin"> 
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <motion.div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 shadow-lg shadow-violet-500/30"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <Mail className="h-8 w-8 text-white" />
                </motion.div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Forgot Password</h1>
                <p className="text-slate-500 text-sm">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl"
                  >
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/auth/signin" className="text-sm text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full" /></div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
