'use client';

import Link from 'next/link';

interface ConTigoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  href?: string;
}

/**
 * Official ConTigo Logo — 3 stacked bars + "contigo" text
 *
 * Bar colors (top→bottom): violet-700 (#6D28D9) → violet-500 (#8B5CF6) → violet-300 (#C4B5FD)
 * Text: "con" bold + "tigo" light/thin weight, all lowercase
 * No background box — bare SVG bars
 */

const ICON_SIZES = {
  sm: 28,
  md: 36,
  lg: 44,
  xl: 56,
} as const;

const TEXT_SIZES = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
} as const;

function LogoBars({ color = 'brand' }: { color?: 'brand' | 'white' }) {
  if (color === 'white') {
    return (
      <g transform="translate(4, 8)">
        <rect x="0" y="0" width="40" height="9" rx="4.5" fill="white" />
        <rect x="0" y="13" width="40" height="9" rx="4.5" fill="white" fillOpacity="0.65" />
        <rect x="0" y="26" width="40" height="9" rx="4.5" fill="white" fillOpacity="0.35" />
      </g>
    );
  }
  return (
    <g transform="translate(4, 8)">
      <rect x="0" y="0" width="40" height="9" rx="4.5" fill="#6D28D9" />
      <rect x="0" y="13" width="40" height="9" rx="4.5" fill="#8B5CF6" />
      <rect x="0" y="26" width="40" height="9" rx="4.5" fill="#C4B5FD" />
    </g>
  );
}

function LogoText({ variant = 'color', textClass }: { variant?: 'color' | 'white'; textClass: string }) {
  if (variant === 'white') {
    return (
      <span className={`${textClass} tracking-tight`}>
        <span className="font-bold text-violet-300">con</span>
        <span className="font-light text-white">tigo</span>
      </span>
    );
  }
  return (
    <span className={`${textClass} tracking-tight`}>
      <span className="font-bold text-violet-700 dark:text-violet-400">con</span>
      <span className="font-light text-slate-900 dark:text-white">tigo</span>
    </span>
  );
}

function LogoWrapper({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link href={href} className={`${className} group`} aria-label="ConTigo home">
      {children}
    </Link>
  );
}

export function ConTigoLogo({ size = 'md', showText = true, className = '', href = '/' }: ConTigoLogoProps) {
  const iconSize = ICON_SIZES[size];

  return (
    <LogoWrapper href={href} className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <LogoBars color="brand" />
      </svg>
      {showText && <LogoText textClass={TEXT_SIZES[size]} variant="color" />}
    </LogoWrapper>
  );
}

// Alias — kept for backward compatibility
export function ConTigoLogoSVG(props: ConTigoLogoProps) {
  return <ConTigoLogo {...props} />;
}

// White version for dark/gradient backgrounds
export function ConTigoLogoWhite({ size = 'md', showText = true, className = '', href = '/' }: ConTigoLogoProps) {
  const iconSize = ICON_SIZES[size];

  return (
    <LogoWrapper href={href} className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <LogoBars color="white" />
      </svg>
      {showText && <LogoText textClass={TEXT_SIZES[size]} variant="white" />}
    </LogoWrapper>
  );
}
