"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, User, Mail, Lock, CheckCircle2, AlertCircle } from "lucide-react";

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

function SignUpForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteToken = searchParams.get("invite");
  
  const [step, setStep] = useState<"account" | "organization" | "complete">("account");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    organizationSlug: "",
    createNewOrganization: !inviteToken,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    tenantName: string;
    tenantId: string;
    email: string;
  } | null>(null);
  
  // Configured providers
  const [providers, setProviders] = useState<string[]>(["credentials"]);
  
  useEffect(() => {
    // Fetch available SSO providers
    fetch("/api/auth/providers-list")
      .then(res => {
        if (!res.ok) throw new Error('Not OK');
        return res.json();
      })
      .then(data => setProviders(data.providers || ["credentials"]))
      .catch(() => setProviders(["credentials"]));
  }, []);

  // Check invite token on mount
  useState(() => {
    if (inviteToken) {
      fetch(`/api/auth/verify-invite?token=${inviteToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setInviteInfo(data);
            setFormData((prev) => ({ ...prev, email: data.email }));
          }
        })
        .catch(console.error);
    }
  });
  
  const handleSSOSignUp = async (provider: string) => {
    setSsoLoading(provider);
    try {
      // For SSO, we redirect to the provider's auth flow
      // The callback will handle user creation/linking
      await signIn(provider, { 
        callbackUrl: inviteToken ? `/?invite=${inviteToken}` : "/" 
      });
    } catch (error) {
      setError(`Failed to sign up with ${provider}`);
      setSsoLoading(null);
    }
  };
  
  const hasSSO = providers.some(p => p !== "credentials");

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleOrganizationNameChange = (name: string) => {
    setFormData({
      ...formData,
      organizationName: name,
      organizationSlug: generateSlug(name),
    });
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return false;
    }
    if (!formData.lastName.trim()) {
      setError("Last name is required");
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Valid email is required");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (validateStep1()) {
      if (inviteInfo) {
        // Skip organization step for invited users
        handleFinalSubmit();
      } else {
        setStep("organization");
      }
    }
  };

  const handleFinalSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          organizationName: formData.createNewOrganization ? formData.organizationName : undefined,
          organizationSlug: formData.createNewOrganization ? formData.organizationSlug : undefined,
          inviteToken: inviteToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      setStep("complete");
      
      // Auto sign-in after successful registration
      setTimeout(() => {
        router.push("/auth/signin?registered=true");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md p-8 card-elevated text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Account Created!</h1>
          <p className="text-muted-foreground mb-4">
            Your account has been created successfully. Redirecting to sign in...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md p-8 card-elevated">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ConTigo
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {step === "account" ? "Create Account" : "Organization Setup"}
          </h1>
          <p className="text-muted-foreground">
            {inviteInfo
              ? `You've been invited to join ${inviteInfo.tenantName}`
              : step === "account"
              ? "Start managing your contracts with AI"
              : "Set up your organization"}
          </p>
        </div>

        {/* Step indicator */}
        {!inviteInfo && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step === "account" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "account" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Account</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === "organization" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "organization" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Organization</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* SSO Buttons - only show on account step */}
        {step === "account" && hasSSO && (
          <>
            <div className="space-y-3 mb-6">
              {providers.includes("google") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignUp("google")}
                  disabled={ssoLoading !== null}
                >
                  <GoogleIcon className="w-5 h-5" />
                  {ssoLoading === "google" ? "Signing up..." : "Sign up with Google"}
                </Button>
              )}
              
              {providers.includes("microsoft-entra-id") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignUp("microsoft-entra-id")}
                  disabled={ssoLoading !== null}
                >
                  <MicrosoftIcon className="w-5 h-5" />
                  {ssoLoading === "microsoft-entra-id" ? "Signing up..." : "Sign up with Microsoft"}
                </Button>
              )}
              
              {providers.includes("github") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-3"
                  onClick={() => handleSSOSignUp("github")}
                  disabled={ssoLoading !== null}
                >
                  <GitHubIcon className="w-5 h-5" />
                  {ssoLoading === "github" ? "Signing up..." : "Sign up with GitHub"}
                </Button>
              )}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or create an account with email
                </span>
              </div>
            </div>
          </>
        )}

        {step === "account" && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  required
                  disabled={loading}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  required
                  disabled={loading}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@company.com"
                  required
                  disabled={loading || !!inviteInfo}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  required
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {inviteInfo ? (loading ? "Creating Account..." : "Create Account & Join") : "Continue"}
            </Button>
          </form>
        )}

        {step === "organization" && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <div>
              <Label htmlFor="organizationName">Organization Name</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleOrganizationNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="organizationSlug">Organization URL</Label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded-l-md border border-r-0">
                  app.example.com/
                </span>
                <Input
                  id="organizationSlug"
                  type="text"
                  value={formData.organizationSlug}
                  onChange={(e) => setFormData({ ...formData, organizationSlug: e.target.value })}
                  placeholder="acme"
                  required
                  disabled={loading}
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This will be your unique organization identifier
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("account")}
                disabled={loading}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
