"use client";
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import React from 'react';

export function BackButton(props: { label?: string; hrefFallback?: string; className?: string }) {
  const router = useRouter();
  const { label = 'Back', hrefFallback, className } = props;
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else if (hrefFallback) window.location.href = hrefFallback;
        else router.push('/');
      }}
      className={className || 'inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label}
    </button>
  );
}
