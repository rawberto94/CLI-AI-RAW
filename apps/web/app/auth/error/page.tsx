"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { AuthHeroArt, ConTigoLogo } from "../_components/AuthBranding";

function AuthErrorCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", damping: 20 }}
    >
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl shadow-rose-200/30 border border-slate-100/80 bg-white/90 backdrop-blur-xl rounded-2xl">
        <motion.div 
          className="lg:hidden flex justify-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <ConTigoLogo size="md" />
        </motion.div>

        <div className="text-center mb-8">
          <motion.div 
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-red-500/30"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <AlertTriangle className="h-8 w-8 text-white" />
          </motion.div>
          <motion.h1 
            className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Authentication Error
          </motion.h1>
          <motion.p 
            className="text-slate-500 text-sm sm:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            There was a problem signing you in. Please try again.
          </motion.p>
        </div>

        <motion.div 
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button 
            asChild 
            className="w-full h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-xl group"
          >
            <Link href="/auth/signin" className="flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Return to Sign In
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-11 rounded-xl hover:bg-slate-50 group">
            <Link href="/" className="flex items-center justify-center gap-2">
              <Home className="w-4 h-4" />
              Go to home
            </Link>
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );
}

export default function AuthError() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding with vibrant colors */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div 
          className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-orange-400/30 via-amber-400/20 to-yellow-400/30 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-pink-500/20 via-rose-400/20 to-red-400/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Mesh pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <motion.div 
          className="relative z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <ConTigoLogo size="lg" />
        </motion.div>

        <div className="text-white relative z-10 flex-1 flex flex-col justify-center -mt-8">
          <motion.h2 
            className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Let's get you back in
          </motion.h2>
          <motion.p 
            className="text-rose-100 text-lg leading-relaxed max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Authentication didn't complete. Try signing in again, or return to the login page.
          </motion.p>
          <AuthHeroArt />
        </div>

        <motion.div 
          className="text-rose-200 text-sm relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          © 2025 ConTigo. All rights reserved.
        </motion.div>
      </div>

      {/* Right side - Error Card with animated background */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-white to-rose-50/30 relative overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-100/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-orange-100/30 via-transparent to-transparent" />
        
        {/* Subtle animated shapes */}
        <motion.div 
          className="absolute top-20 right-20 w-32 h-32 rounded-full bg-gradient-to-br from-rose-200/30 to-red-200/30 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-orange-200/30 to-amber-200/30 blur-2xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        
        <div className="relative z-10">
          <AuthErrorCard />
        </div>
      </div>
    </div>
  );
}
