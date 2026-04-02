'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SupplierPortal } from '@/components/portal';
import { PageBreadcrumb } from '@/components/navigation';
import { Loader2, AlertCircle, Shield, KeyRound } from 'lucide-react';

interface TokenData {
  supplierId: string;
  tenantId: string;
  contractId?: string;
  email?: string;
  expiresAt: string;
}

export default function PortalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [isValidating, setIsValidating] = useState(!!token);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token]);

  const validateToken = async (magicToken: string) => {
    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch('/api/portal/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: magicToken }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Invalid or expired link');
        setTokenData(null);
      } else {
        setTokenData(data.data);
        // Store token data in sessionStorage for API calls
        sessionStorage.setItem('portalToken', magicToken);
        sessionStorage.setItem('portalData', JSON.stringify(data.data));
      }
    } catch (err) {
      setError('Failed to validate access link');
      console.error('Token validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // Validating state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <Shield className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Verifying Access</h2>
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Validating your secure link...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                This link may have expired or is invalid.
              </p>
              <p className="text-sm text-slate-400">
                Please contact your account manager for a new access link.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No token - show login/request access page
  if (!token && !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Supplier Portal</h1>
              <p className="text-slate-500">Access requires a secure link from your account manager</p>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
                You need a magic link to access the supplier portal. Contact your ConTigo account manager to receive an access link via email.
              </p>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <a href="/login" className="text-amber-600 hover:underline">
                    Sign in here
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-30">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <SupplierPortal 
        supplierId={tokenData?.supplierId}
        tenantId={tokenData?.tenantId}
        contractId={tokenData?.contractId}
      />
    </div>
  );
}
