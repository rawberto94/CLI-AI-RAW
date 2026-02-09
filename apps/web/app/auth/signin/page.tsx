"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarCheck2, ShieldCheck, Sparkles, Mail, Lock, ArrowRight, CheckCircle2, Zap, Eye, EyeOff, Quote, Hexagon, Binary, CircuitBoard } from "lucide-react";
import { AuthHeroArt, ConTigoLogo } from "../_components/AuthBranding";
import { FloatingParticles, GradientOrbs, GoogleIcon, MicrosoftIcon, GitHubIcon } from "../_components/AuthShared";
import { WelcomeTransition } from "@/components/enhanced/welcome-transition";

// Animated Wave Pattern
function WavePattern() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden opacity-30">
      <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <motion.path
          fill="url(#waveGradient1)"
          animate={{
            d: [
              "M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              "M0,160L48,181.3C96,203,192,245,288,261.3C384,277,480,267,576,234.7C672,203,768,149,864,138.7C960,128,1056,160,1152,176C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <motion.path
          fill="url(#waveGradient2)"
          animate={{
            d: [
              "M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,213.3C672,224,768,224,864,213.3C960,203,1056,181,1152,181.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              "M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,197.3C672,213,768,235,864,229.3C960,224,1056,192,1152,176C1248,160,1344,160,1392,160L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.5 }}
        />
        <defs>
          <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.1" />
            <stop offset="50%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.05" />
            <stop offset="50%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Stats Counter Animation
function AnimatedCounter({ value, label, icon: Icon }: { value: string; label: string; icon: React.ElementType }) {
  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
    >
      <div className="flex justify-center mb-2">
        <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <motion.div 
        className="text-2xl font-bold text-white"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 10 }}
      >
        {value}
      </motion.div>
      <div className="text-xs text-white/70">{label}</div>
    </motion.div>
  );
}

// Product Highlights Data
const highlights = [
  {
    quote: "AI-powered contract analysis that extracts key terms, dates, obligations, and risk factors in seconds.",
    label: "Intelligent Analysis",
    icon: "AI",
  },
  {
    quote: "Search across your entire contract repository with natural language — find any clause, term, or obligation instantly.",
    label: "Semantic Search",
    icon: "SS",
  },
  {
    quote: "Automated tracking for renewals, expirations, and key milestones — never miss a critical date again.",
    label: "Smart Alerts",
    icon: "SA",
  },
];

// Auto-rotating Highlight Component
function HighlightCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % highlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const highlight = highlights[currentIndex];

  return (
    <motion.div 
      className="relative mt-6 max-w-md mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
        <Quote className="w-6 h-6 text-white/40 mb-3" />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-white/90 text-sm leading-relaxed mb-4">
              {highlight.quote}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center text-white font-semibold text-sm border border-white/20">
                {highlight.icon}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium text-sm">{highlight.label}</div>
                <div className="text-violet-200 text-xs">ConTigo Platform</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        {/* Pagination dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {highlights.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to highlight ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered") === "true";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Configured providers (would be passed from server in production)
  const [providers, setProviders] = useState<string[]>(["credentials"]);
  
  useEffect(() => {
    // Fetch available providers
    fetch("/api/auth/providers-list")
      .then(res => {
        if (!res.ok) throw new Error('Not OK');
        return res.json();
      })
      .then(data => setProviders(data.providers || ["credentials"]))
      .catch(() => setProviders(["credentials"]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
      } else if (result?.ok) {
        // Show welcome transition before redirecting
        setShowWelcome(true);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleWelcomeComplete = useCallback(() => {
    router.push(callbackUrl);
  }, [router, callbackUrl]);

  const handleSSOSignIn = async (provider: string) => {
    setSsoLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setError(`Failed to sign in with ${provider}`);
      setSsoLoading(null);
    }
  };

  const hasSSO = providers.some(p => p !== "credentials");

  // Clear error when user starts typing
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  // Show welcome transition after successful login
  if (showWelcome) {
    return (
      <WelcomeTransition 
        userName={email}
        redirectUrl={callbackUrl}
        duration={3500}
        onComplete={handleWelcomeComplete}
        tagline="Your intelligent contract management platform awaits"
      />
    );
  }

  return (
    <div className="min-h-screen flex dark:bg-slate-950">
      {/* Left side - Branding with vibrant colors */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-600 via-50% to-fuchsia-600 dark:from-violet-800 dark:via-purple-800 dark:via-50% dark:to-fuchsia-800 p-16 xl:p-20 flex-col justify-between relative overflow-hidden">
        {/* Cyber grid overlay for futuristic look */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <pattern id="cyberGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cyberGrid)" />
          </svg>
          {/* Animated scan line */}
          <motion.div
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        </div>
        
        {/* Animated gradient orbs */}
        <GradientOrbs />
        
        {/* Floating particles */}
        <FloatingParticles />
        
        {/* Animated wave pattern */}
        <WavePattern />
        
        {/* Animated mesh gradient overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <motion.div 
          className="relative z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <ConTigoLogo size="lg" />
        </motion.div>
        
        <div className="text-white relative z-10 flex-1 flex flex-col justify-center items-center text-center">
          <motion.h2 
            className="text-3xl xl:text-4xl font-bold mb-3 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Contract Intelligence Platform
          </motion.h2>
          <motion.p 
            className="text-violet-100 text-base xl:text-lg leading-relaxed max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Manage, analyze, and optimize your contracts with AI-powered insights. 
            Streamline your procurement processes and never miss a deadline.
          </motion.p>

          {/* Hero Art - centered */}
          <div className="mt-8 mb-6 flex justify-center">
            <AuthHeroArt className="relative" />
          </div>

          {/* Vision stats - centered */}
          <motion.div 
            className="flex justify-center gap-8 xl:gap-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <AnimatedCounter value="100%" label="AI-Powered" icon={Sparkles} />
            <AnimatedCounter value="Zero" label="Missed Deadlines" icon={CalendarCheck2} />
            <AnimatedCounter value="24/7" label="Smart Insights" icon={Zap} />
          </motion.div>

          <motion.div 
            className="mt-8 grid grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { icon: CalendarCheck2, title: "Smart Renewals", desc: "Auto-track deadlines", color: "from-violet-400 to-purple-400" },
              { icon: ShieldCheck, title: "Risk Analysis", desc: "AI-powered insights", color: "from-amber-400 to-orange-400" },
              { icon: Sparkles, title: "AI Assistant", desc: "Ask anything", color: "from-pink-400 to-rose-400" }
            ].map((feature, idx) => (
              <motion.div 
                key={feature.title}
                className="rounded-xl p-3 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 transition-all duration-300 group cursor-default"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
                whileHover={{ y: -2 }}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <motion.div 
                    className={`rounded-lg bg-gradient-to-br ${feature.color} p-2.5 shadow-md`}
                  >
                    <feature.icon className="h-4 w-4 text-white" />
                  </motion.div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">{feature.title}</div>
                    <div className="text-violet-200/80 text-[10px] leading-tight">
                      {feature.desc}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Product Highlights */}
          <HighlightCarousel />
        </div>
        
        <motion.div 
          className="text-violet-200 text-sm relative z-10 flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <span>© 2025 ConTigo. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-violet-300">Enterprise-Grade Security</span>
          </div>
        </motion.div>
      </div>

      {/* Right side - Login Form with animated background */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-white to-purple-50/30 relative overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-100/30 via-transparent to-transparent" />
        
        {/* Futuristic hexagon pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full">
            <defs>
              <pattern id="hexPattern" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
                <path d="M28 0L56 25L56 75L28 100L0 75L0 25Z" fill="none" stroke="currentColor" strokeWidth="1" className="text-violet-900" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexPattern)" />
          </svg>
        </div>
        
        {/* Subtle animated shapes */}
        <motion.div 
          className="absolute top-20 right-20 w-32 h-32 rounded-full bg-gradient-to-br from-violet-200/30 to-pink-200/30 blur-2xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-violet-200/30 to-violet-200/30 blur-2xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
            y: [0, -20, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Floating tech icons */}
        <motion.div
          className="absolute top-1/4 left-10 text-violet-200/30"
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Hexagon className="w-8 h-8" />
        </motion.div>
        <motion.div
          className="absolute bottom-1/3 right-10 text-violet-200/30"
          animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <CircuitBoard className="w-10 h-10" />
        </motion.div>
        <motion.div
          className="absolute top-1/3 right-1/4 text-fuchsia-200/20"
          animate={{ y: [0, 8, 0], x: [0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <Binary className="w-6 h-6" />
        </motion.div>
        
        {/* Dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", damping: 20 }}
          className="w-full max-w-md relative z-10"
        >
        {/* Holographic border glow */}
        <motion.div
          className="absolute -inset-0.5 rounded-[18px] bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 opacity-0 blur-sm group-hover:opacity-20 transition-opacity duration-500"
          animate={{ 
            background: [
              "linear-gradient(0deg, #8b5cf6, #a855f7, #d946ef)",
              "linear-gradient(90deg, #8b5cf6, #a855f7, #d946ef)",
              "linear-gradient(180deg, #8b5cf6, #a855f7, #d946ef)",
              "linear-gradient(270deg, #8b5cf6, #a855f7, #d946ef)",
              "linear-gradient(360deg, #8b5cf6, #a855f7, #d946ef)",
            ]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{ opacity: 0.15 }}
        />
        <Card className="w-full p-6 sm:p-8 shadow-2xl shadow-violet-200/30 border border-slate-100/80 bg-white/90 backdrop-blur-xl rounded-2xl relative overflow-hidden group">
          {/* Inner glow line animation */}
          <motion.div 
            className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Mobile Logo */}
          <motion.div 
            className="lg:hidden flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <ConTigoLogo size="md" />
          </motion.div>

          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Futuristic icon with rings */}
              <div className="relative inline-flex items-center justify-center mb-4">
                {/* Rotating outer ring */}
                <motion.div
                  className="absolute w-20 h-20 rounded-full border-2 border-dashed border-violet-300/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                {/* Pulsing middle ring */}
                <motion.div
                  className="absolute w-[72px] h-[72px] rounded-full border border-violet-400/30"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Main icon container */}
                <motion.div 
                  className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, delay: 0.2 }}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                >
                  {/* Inner glow */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/20" />
                  <Lock className="w-7 h-7 text-white relative z-10" />
                </motion.div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                <span className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent">
                  Welcome Back
                </span>
              </h1>
              <p className="text-slate-500 text-sm sm:text-base">
                Access your secure <span className="text-violet-600 font-medium">ConTigo</span> dashboard
              </p>
            </motion.div>
          </div>

        {registered && (
          <motion.div 
            className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Account created successfully! Please sign in.
          </motion.div>
        )}

        {/* SSO Buttons */}
        {hasSSO && (
          <>
            <motion.div 
              className="space-y-3 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {providers.includes("google") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 group"
                  onClick={() => handleSSOSignIn("google")}
                  disabled={ssoLoading !== null}
                >
                  <GoogleIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{ssoLoading === "google" ? "Signing in..." : "Continue with Google"}</span>
                </Button>
              )}
              
              {providers.includes("microsoft-entra-id") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 group"
                  onClick={() => handleSSOSignIn("microsoft-entra-id")}
                  disabled={ssoLoading !== null}
                >
                  <MicrosoftIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{ssoLoading === "microsoft-entra-id" ? "Signing in..." : "Continue with Microsoft"}</span>
                </Button>
              )}
              
              {providers.includes("github") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 group"
                  onClick={() => handleSSOSignIn("github")}
                  disabled={ssoLoading !== null}
                >
                  <GitHubIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{ssoLoading === "github" ? "Signing in..." : "Continue with GitHub"}</span>
                </Button>
              )}
            </motion.div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium">
                  Or continue with email
                </span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="pl-10 h-11 rounded-xl border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all hover:border-slate-300"
                autoComplete="email"
                aria-describedby={error ? "signin-error" : undefined}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <Link href="/auth/forgot-password" className="text-xs text-violet-600 hover:text-violet-700 hover:underline underline-offset-2 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                required
                disabled={loading}
                className="pl-10 pr-10 h-11 rounded-xl border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all hover:border-slate-300"
                autoComplete="current-password"
                aria-describedby={error ? "signin-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:text-violet-500"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>

          {/* Remember me checkbox */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/20 transition-colors cursor-pointer"
            />
            <Label htmlFor="remember-me" className="text-sm text-slate-600 font-normal cursor-pointer select-none">
              Remember me for 30 days
            </Label>
          </motion.div>

          {error && (
            <motion.div 
              id="signin-error"
              role="alert"
              className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="relative group"
          >
            {/* Cyber glow effect behind button */}
            <motion.div
              className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 opacity-0 group-hover:opacity-70 blur-lg transition-all duration-500"
              animate={{
                background: [
                  "linear-gradient(90deg, #7c3aed, #9333ea, #c026d3)",
                  "linear-gradient(180deg, #7c3aed, #9333ea, #c026d3)",
                  "linear-gradient(270deg, #7c3aed, #9333ea, #c026d3)",
                  "linear-gradient(360deg, #7c3aed, #9333ea, #c026d3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <Button
              type="submit"
              className="relative w-full h-12 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 overflow-hidden border border-violet-400/20"
              disabled={loading}
            >
              {/* Animated shimmer effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full"
                animate={{ x: ["0%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              />
              {/* Scan line effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent"
                animate={{ y: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{ height: "30%" }}
              />
              {loading ? (
                <span className="flex items-center gap-2 relative z-10">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="tracking-wide">Authenticating...</span>
                </span>
              ) : (
                <motion.span 
                  className="flex items-center justify-center gap-2 relative z-10"
                  whileHover={{ scale: 1.02 }}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="tracking-wide">Enter ConTigo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.span>
              )}
            </Button>
          </motion.div>
        </form>

        <motion.div 
          className="mt-6 text-center text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors hover:underline underline-offset-2">
            Sign up
          </Link>
        </motion.div>

        <motion.div 
          className="mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.55 }}
        >
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-600 transition-colors"
          >
            <ArrowRight className="w-3 h-3 rotate-180" />
            Back to Landing Page
          </Link>
        </motion.div>

        {process.env.NODE_ENV === 'development' && (
          <motion.div 
            className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <p className="font-medium text-slate-500">Demo Accounts (dev only):</p>
            <p className="font-mono mt-1.5 text-slate-600 bg-slate-50 inline-block px-3 py-1 rounded-lg">
              admin@acme.com <span className="text-slate-400">|</span> roberto@acme.com
            </p>
            <p className="mt-1.5">Password: <span className="font-mono text-slate-600">password123</span></p>
          </motion.div>
        )}
        </Card>

        {/* Trusted By Section */}
        <motion.div 
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <p className="text-xs text-slate-400 mb-4">Enterprise contract lifecycle management</p>
          <div className="flex items-center justify-center gap-6 opacity-50">
            <div className="flex items-center gap-1.5 text-slate-400 text-sm"><CheckCircle2 className="w-3.5 h-3.5" /> AES-256</div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-400 text-sm"><CheckCircle2 className="w-3.5 h-3.5" /> SSO</div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-400 text-sm"><CheckCircle2 className="w-3.5 h-3.5" /> MFA</div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-400 text-sm"><CheckCircle2 className="w-3.5 h-3.5" /> Audit Logs</div>
          </div>
        </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
