'use client';

import Link from 'next/link';
import Image from 'next/image';

interface ConTigoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  href?: string;
}

/**
 * Official ConTigo Logo
 *
 * Uses /contigo-logo-stack.png (transparent background stacked logo).
 * Falls back to "con" + "tigo" text if image not available.
 */

const IMG_SIZES = {
  sm: { width: 28, height: 28 },
  md: { width: 36, height: 36 },
  lg: { width: 44, height: 44 },
  xl: { width: 56, height: 56 },
} as const;

const TEXT_SIZES = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
} as const;

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
  const { width, height } = IMG_SIZES[size];

  return (
    <LogoWrapper href={href} className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/contigo-logo-stack.png"
        alt="ConTigo"
        width={width}
        height={height}
        className="flex-shrink-0 object-contain"
        priority
      />
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
  const { width, height } = IMG_SIZES[size];

  return (
    <LogoWrapper href={href} className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/contigo-logo-stack.png"
        alt="ConTigo"
        width={width}
        height={height}
        className="flex-shrink-0 object-contain brightness-0 invert"
        priority
      />
      {showText && <LogoText textClass={TEXT_SIZES[size]} variant="white" />}
    </LogoWrapper>
  );
}
