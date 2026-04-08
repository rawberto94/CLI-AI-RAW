"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { ConTigoLogo } from "../_components/AuthBranding";
import {
  GoogleIcon,
  MicrosoftIcon,
  GitHubIcon,
} from "../_components/AuthShared";
import { WelcomeTransition } from "@/components/enhanced/welcome-transition";

/* ------------------------------------------------------------------ */
/*  Feature bullets for the branding panel                             */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: FileText,
    title: "AI-Powered Analysis",
    description:
      "Extract key terms, clauses, and obligations from any contract in seconds.",
  },
  {
    icon: Sparkles,
    title: "Intelligent Search",
    description:
      "Find any clause or obligation across your entire repository with natural language.",
  },
  {
    icon: BarChart3,
    title: "Risk & Analytics",
    description:
      "Real-time dashboards, rate-card benchmarking, and renewal tracking.",
  },
];

/* ------------------------------------------------------------------ */
/*  Sign-in form                                                       */
/* ------------------------------------------------------------------ */
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [providers, setProviders] = useState<string[]>(["credentials"]);

  useEffect(() => {
    fetch("/api/auth/providers-list")
      .then((res) => {
        if (!res.ok) throw new Error("Not OK");
        return res.json();
      })
      .then((data) => setProviders(data.providers || ["credentials"]))
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
        setLoading(false);
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
    // Safety timeout: reset loading if SSO redirect doesn't happen within 10s
    const ssoTimeout = setTimeout(() => setSsoLoading(null), 10000);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      clearTimeout(ssoTimeout);
      setError(`Failed to sign in with ${provider}`);
      setSsoLoading(null);
    }
  };

  const hasSSO = providers.some((p) => p !== "credentials");

  const clearError = () => {
    if (error) setError("");
  };

  /* Welcome transition */
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
      {/* ============================================================ */}
      {/*  Left — Branding panel                                       */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] shrink-0 bg-gradient-to-b from-violet-600 via-purple-600 to-fuchsia-700 dark:from-violet-800 dark:via-purple-800 dark:to-fuchsia-900 p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
        {/* Subtle background accents */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <ConTigoLogo size="lg" />
        </div>

        {/* Centre content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center -mt-4">
          <h2 className="text-2xl xl:text-3xl font-bold text-white tracking-tight leading-tight">
            Contract Intelligence
            <br />
            Platform
          </h2>
          <p className="mt-3 text-violet-100/90 text-sm xl:text-base leading-relaxed max-w-sm">
            Manage, analyse, and optimise your contracts with AI-powered
            insights. Streamline procurement and never miss a deadline.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-violet-200/80 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-violet-200/70">
          <span>&copy; {new Date().getFullYear()} ConTigo</span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Enterprise-grade security
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Right — Form panel                                          */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white dark:bg-slate-950 relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <ConTigoLogo size="md" />
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to your{" "}
              <span className="font-medium text-violet-600 dark:text-violet-400">
                ConTigo
              </span>{" "}
              account
            </p>
          </div>

          {/* Registration banner */}
          {registered && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Account created successfully! Please sign in.
            </div>
          )}

          {/* SSO buttons */}
          {hasSSO && (
            <>
              <div className="space-y-2.5">
                {providers.includes("google") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 justify-center gap-2.5 rounded-lg text-sm font-medium"
                    onClick={() => handleSSOSignIn("google")}
                    disabled={ssoLoading !== null}
                  >
                    <GoogleIcon className="h-4 w-4" />
                    {ssoLoading === "google"
                      ? "Signing in…"
                      : "Continue with Google"}
                  </Button>
                )}
                {providers.includes("microsoft-entra-id") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 justify-center gap-2.5 rounded-lg text-sm font-medium"
                    onClick={() => handleSSOSignIn("microsoft-entra-id")}
                    disabled={ssoLoading !== null}
                  >
                    <MicrosoftIcon className="h-4 w-4" />
                    {ssoLoading === "microsoft-entra-id"
                      ? "Signing in…"
                      : "Continue with Microsoft"}
                  </Button>
                )}
                {providers.includes("github") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 justify-center gap-2.5 rounded-lg text-sm font-medium"
                    onClick={() => handleSSOSignIn("github")}
                    disabled={ssoLoading !== null}
                  >
                    <GitHubIcon className="h-4 w-4" />
                    {ssoLoading === "github"
                      ? "Signing in…"
                      : "Continue with GitHub"}
                  </Button>
                )}
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-950 px-3 text-slate-400">
                    Or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Credentials form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <Label
                htmlFor="email"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className="pl-9 h-10 rounded-lg"
                  autoComplete="email"
                  aria-describedby={error ? "signin-error" : undefined}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="pl-9 pr-9 h-10 rounded-lg"
                  autoComplete="current-password"
                  aria-describedby={error ? "signin-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                id="signin-error"
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer links */}
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              Sign up
            </Link>
          </p>

          <div className="mt-3 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-violet-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </Link>
          </div>

          {/* Dev-only hint */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-8 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-400">
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Demo mode
              </p>
              <p className="mt-1 text-slate-400">
                See <code className="font-mono text-slate-500">docs/LOCAL_E2E_TESTING.md</code> for test credentials
              </p>
            </div>
          )}

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> AES-256
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> SSO &amp; MFA
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Audit Logs
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page wrapper with Suspense                                         */
/* ------------------------------------------------------------------ */
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
