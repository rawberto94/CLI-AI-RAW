"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, User, Mail, Lock, CheckCircle2, AlertCircle, ArrowRight, Sparkles, Shield, Zap, Eye, EyeOff, Check } from "lucide-react";
import { AuthHeroArt, ConTigoLogo } from "../_components/AuthBranding";
import { FloatingParticles, GradientOrbs, GoogleIcon, MicrosoftIcon, GitHubIcon } from "../_components/AuthShared";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{
    tenantName: string;
    tenantId: string;
    email: string;
  } | null>(null);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const password = formData.password;
    if (!password) return { score: 0, label: "", color: "" };
    
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    
    score = Object.values(checks).filter(Boolean).length;
    
    if (score <= 2) return { score, label: "Weak", color: "bg-red-500", checks };
    if (score === 3) return { score, label: "Fair", color: "bg-amber-500", checks };
    if (score === 4) return { score, label: "Good", color: "bg-violet-400", checks };
    return { score, label: "Strong", color: "bg-violet-500", checks };
  }, [formData.password]);
  
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
  useEffect(() => {
    if (inviteToken) {
      fetch(`/api/auth/verify-invite?token=${inviteToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setInviteInfo(data);
            setFormData((prev) => ({ ...prev, email: data.email }));
          }
        })
        .catch(() => {});
    }
  }, [inviteToken]);
  
  const handleSSOSignUp = async (provider: string) => {
    setSsoLoading(provider);
    try {
      // For SSO, we redirect to the provider's auth flow
      // The callback will handle user creation/linking
      await signIn(provider, { 
        callbackUrl: inviteToken ? `/?invite=${inviteToken}` : "/" 
      });
    } catch (_error) {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-4 relative overflow-hidden">
        {/* Background effects */}
        <motion.div 
          className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-br from-violet-200/30 to-violet-200/30 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-tr from-violet-200/30 to-purple-200/30 rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          <Card className="w-full max-w-md p-8 text-center shadow-2xl shadow-violet-200/30 border border-violet-100 bg-white/90 backdrop-blur-xl rounded-2xl relative z-10">
            <motion.div 
              className="flex justify-center mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </motion.div>
            <motion.h1 
              className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-violet-600"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Account Created!
            </motion.h1>
            <motion.p 
              className="text-slate-500 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Your account has been created successfully. Redirecting to sign in...
            </motion.p>
            <motion.div 
              className="flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-500"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding with vibrant colors */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated gradient orbs */}
        <GradientOrbs />
        
        {/* Floating particles */}
        <FloatingParticles />
        
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
            className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-violet-100 to-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Create your ConTigo account
          </motion.h2>
          <motion.p 
            className="text-violet-100 text-lg leading-relaxed max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Get started in minutes. Create an account, set up your organization, and begin analyzing contracts with AI.
          </motion.p>

          <AuthHeroArt />

          {/* Feature highlights */}
          <motion.div 
            className="mt-6 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { icon: Sparkles, text: "AI-Powered Analysis", color: "from-amber-400 to-orange-400" },
              { icon: Shield, text: "Enterprise Security", color: "from-violet-400 to-purple-400" },
              { icon: Zap, text: "Instant Setup", color: "from-pink-400 to-rose-400" },
            ].map((feature, idx) => (
              <motion.div
                key={feature.text}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <div className={`p-1 rounded-md bg-gradient-to-br ${feature.color}`}>
                  <feature.icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div 
          className="text-violet-200 text-sm relative z-10 flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <span>© 2025 ConTigo. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-300" />
            <span className="text-xs">Free to start</span>
          </div>
        </motion.div>
      </div>

      {/* Right side - Signup Form with animated background */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30 relative overflow-hidden">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-100/30 via-transparent to-transparent" />
        
        {/* Subtle animated shapes */}
        <motion.div 
          className="absolute top-20 right-20 w-32 h-32 rounded-full bg-gradient-to-br from-violet-200/30 to-violet-200/30 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], x: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-40 h-40 rounded-full bg-gradient-to-tr from-violet-200/30 to-purple-200/30 blur-2xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
        
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", damping: 20 }}
          className="w-full max-w-md relative z-10"
        >
        <Card className="w-full p-6 sm:p-8 shadow-2xl shadow-violet-200/30 dark:shadow-violet-900/30 border border-slate-100/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl">
          {/* Mobile Logo */}
          <motion.div 
            className="lg:hidden flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <ConTigoLogo size="md" />
          </motion.div>

          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <motion.div 
                className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg ${
                  step === "account" 
                    ? "bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30" 
                    : "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30"
                }`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, delay: 0.2 }}
              >
                {step === "account" ? (
                  <User className="w-7 h-7 text-white" />
                ) : (
                  <Building2 className="w-7 h-7 text-white" />
                )}
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {step === "account" ? "Create Account" : "Organization Setup"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
                {inviteInfo
                  ? `You've been invited to join ${inviteInfo.tenantName}`
                  : step === "account"
                    ? "Start managing your contracts with AI"
                    : "Set up your organization"}
              </p>
            </motion.div>
          </div>

        {/* Step indicator */}
        {!inviteInfo && (
          <motion.div 
            className="flex items-center justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className={`flex items-center gap-2 ${step === "account" ? "text-violet-700" : "text-slate-400"}`}>
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === "account" 
                    ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/30" 
                    : "bg-violet-100 text-violet-600"
                }`}
                animate={step === "account" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <User className="h-4 w-4" />
              </motion.div>
              <span className="text-sm font-medium">Account</span>
            </div>
            <div className={`w-8 h-px ${step === "organization" ? "bg-violet-500" : "bg-slate-200"} transition-colors`} />
            <div className={`flex items-center gap-2 ${step === "organization" ? "text-violet-700" : "text-slate-400"}`}>
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  step === "organization" 
                    ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30" 
                    : "bg-slate-100 text-slate-500"
                }`}
                animate={step === "organization" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Building2 className="h-4 w-4" />
              </motion.div>
              <span className="text-sm font-medium">Organization</span>
            </div>
          </motion.div>
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
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  disabled={loading}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength indicator */}
              {formData.password && (
                <motion.div 
                  className="mt-2 space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${passwordStrength.color} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 2 ? "text-red-500" : 
                      passwordStrength.score === 3 ? "text-amber-500" : "text-violet-500"
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {[
                      { key: "length", label: "8+ characters" },
                      { key: "uppercase", label: "Uppercase" },
                      { key: "lowercase", label: "Lowercase" },
                      { key: "number", label: "Number" },
                    ].map((req) => (
                      <div 
                        key={req.key} 
                        className={`flex items-center gap-1 ${
                          (passwordStrength as any).checks?.[req.key] ? "text-violet-600" : "text-slate-400"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  required
                  disabled={loading}
                  className={`pl-10 pr-10 ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword 
                      ? "border-red-300 focus:border-red-500" 
                      : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? "border-violet-300 focus:border-violet-500"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <motion.p 
                  className="text-xs text-red-500 mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Passwords don&apos;t match
                </motion.p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <motion.p 
                  className="text-xs text-violet-500 mt-1 flex items-center gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Passwords match
                </motion.p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-violet-600 via-violet-600 to-purple-600 hover:from-violet-700 hover:via-purple-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 group relative overflow-hidden" 
              disabled={loading}
            >
              {/* Shimmer effect */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                animate={{ x: ["0%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {inviteInfo ? (loading ? "Creating Account..." : "Create Account & Join") : "Continue"}
                {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </span>
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
                className="hover:bg-slate-50"
              >
                Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-11 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 group relative overflow-hidden" 
                disabled={loading}
              >
                {/* Shimmer effect */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                  animate={{ x: ["0%", "200%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? "Creating..." : "Create Organization"}
                  {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </span>
              </Button>
            </div>
          </form>
        )}

        <motion.div 
          className="mt-6 text-center text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-violet-600 hover:text-violet-700 hover:underline font-semibold transition-colors underline-offset-2">
            Sign in
          </Link>
        </motion.div>

        </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
          </div>
          <span className="text-slate-500 text-sm">Loading...</span>
        </motion.div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
