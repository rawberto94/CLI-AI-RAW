"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

// ConTigo Logo SVG Component
function ConTigoLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: { height: 40, fontSize: 24 },
    md: { height: 56, fontSize: 32 },
    lg: { height: 72, fontSize: 40 },
    xl: { height: 96, fontSize: 52 },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 100 100" 
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="loginDocGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="loginPenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#065F5B" />
          </linearGradient>
        </defs>
        
        {/* Document body */}
        <rect x="10" y="5" width="55" height="70" rx="8" fill="url(#loginDocGradient)" />
        
        {/* Document lines */}
        <rect x="20" y="18" width="22" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="32" width="35" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="46" width="18" height="6" rx="3" fill="white" opacity="0.7" />
        
        {/* Pen */}
        <g transform="translate(55, 55) rotate(-45)">
          <rect x="-6" y="0" width="12" height="35" rx="2" fill="url(#loginPenGradient)" />
          <polygon points="-6,35 0,48 6,35" fill="url(#loginPenGradient)" />
          <rect x="-5" y="3" width="10" height="5" rx="1" fill="#065F5B" />
        </g>
      </svg>
      <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
        <span className="text-slate-800">Con</span>
        <span className="text-teal-600">Tigo</span>
      </span>
    </div>
  );
}

// SSO Provider Icons
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" fill="currentColor">
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const registered = searchParams.get("registered") === "true";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  
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
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSSOSignIn = async (provider: string) => {
    setSsoLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
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

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-400/20 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <ConTigoLogo size="lg" />
        </div>
        <div className="text-white relative z-10">
          <h2 className="text-4xl font-bold mb-4">Contract Intelligence Platform</h2>
          <p className="text-teal-100 text-lg leading-relaxed">
            Manage, analyze, and optimize your contracts with AI-powered insights. 
            Streamline your procurement processes and never miss a deadline.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">415K+</div>
              <div className="text-teal-200 text-sm">Lines of Code</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">AI</div>
              <div className="text-teal-200 text-sm">Powered Analysis</div>
            </div>
          </div>
        </div>
        <div className="text-teal-200 text-sm relative z-10">
          © 2025 ConTigo. All rights reserved.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-white">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-0 bg-white">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <ConTigoLogo size="md" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Sign in to your account to continue
            </p>
          </div>

        {registered && (
          <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
            Account created successfully! Please sign in.
          </div>
        )}

        {/* SSO Buttons */}
        {hasSSO && (
          <>
            <div className="space-y-3 mb-6">
              {providers.includes("google") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignIn("google")}
                  disabled={ssoLoading !== null}
                >
                  <GoogleIcon className="w-5 h-5" />
                  {ssoLoading === "google" ? "Signing in..." : "Continue with Google"}
                </Button>
              )}
              
              {providers.includes("microsoft-entra-id") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignIn("microsoft-entra-id")}
                  disabled={ssoLoading !== null}
                >
                  <MicrosoftIcon className="w-5 h-5" />
                  {ssoLoading === "microsoft-entra-id" ? "Signing in..." : "Continue with Microsoft"}
                </Button>
              )}
              
              {providers.includes("github") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignIn("github")}
                  disabled={ssoLoading !== null}
                >
                  <GitHubIcon className="w-5 h-5" />
                  {ssoLoading === "github" ? "Signing in..." : "Continue with GitHub"}
                </Button>
              )}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="mt-1"
              autoComplete="email"
              aria-describedby={error ? "signin-error" : undefined}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              required
              disabled={loading}
              className="mt-1"
              autoComplete="current-password"
              aria-describedby={error ? "signin-error" : undefined}
            />
          </div>

          {error && (
            <div 
              id="signin-error"
              role="alert"
              className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 animate-in slide-in-from-top-1 duration-200"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 transition-all focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-teal-600 hover:text-teal-700 hover:underline font-medium transition-colors">
            Sign up
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>Demo Accounts (dev only):</p>
            <p className="font-mono mt-1">
              admin@acme.com | roberto@acme.com
            </p>
            <p className="mt-1">Password: password123</p>
          </div>
        )}
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
