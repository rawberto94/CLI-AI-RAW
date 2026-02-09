"use client";

import { signOut } from "next-auth/react";
import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, ArrowLeft, Home } from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";

export default function SignOutPage() {
  const [loading, setLoading] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await signOut({ redirect: false });
      setSignedOut(true);
    } catch {
      // Even if error, try to redirect
      window.location.href = "/auth/signin";
    }
  }, []);

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

          {signedOut ? (
            <div className="text-center">
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <LogOut className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Signed Out</h1>
              <p className="text-slate-500 text-sm mb-6">
                You have been successfully signed out of your ConTigo account.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600">
                  <Link href="/auth/signin" className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Sign In Again
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                  <Link href="/" className="flex items-center justify-center gap-2">
                    <Home className="w-4 h-4" /> Go to Home
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 shadow-lg shadow-violet-500/30"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <LogOut className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign Out</h1>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to sign out of your ConTigo account?
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
                >
                  {loading ? "Signing out..." : "Yes, Sign Out"}
                </Button>
                <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                  <Link href="/dashboard" className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
