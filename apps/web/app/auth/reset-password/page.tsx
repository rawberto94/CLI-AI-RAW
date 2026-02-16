"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error?.message || "Password reset failed");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
        <Card className="w-full max-w-md p-8 text-center">
          <ConTigoLogo size="md" />
          <h1 className="text-2xl font-bold mt-6 mb-2">Invalid Link</h1>
          <p className="text-slate-500 mb-6">This reset link is invalid or has expired.</p>
          <Button asChild>
            <Link href="/auth/forgot-password">Request New Link</Link>
          </Button>
        </Card>
      </div>
    );
  }

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

          {success ? (
            <div className="text-center">
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Password Reset</h1>
              <p className="text-slate-500 text-sm mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Button asChild className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <motion.div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                >
                  <Lock className="h-8 w-8 text-white" />
                </motion.div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h1>
                <p className="text-slate-500 text-sm">Enter your new password below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      disabled={loading}
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Must contain uppercase, lowercase, number, and special character.
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                  {loading ? "Resetting..." : "Reset Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
