'use client';

import Link from 'next/link';

interface ConTigoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function ConTigoLogo({ size = 'md', showText = true, className = '' }: ConTigoLogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-10 h-10', text: 'text-xl' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl' },
  };

  const s = sizes[size];

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      {/* Stacked Bars Icon */}
      <div className={`relative ${s.icon} flex-shrink-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25 p-1.5 group-hover:scale-105 transition-transform`}>
        <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
          <g transform="translate(8, 10)">
            <rect x="0" y="0" width="32" height="8" rx="4" fill="white"/>
            <rect x="0" y="12" width="32" height="8" rx="4" fill="white" fillOpacity="0.8"/>
            <rect x="0" y="24" width="32" height="8" rx="4" fill="white" fillOpacity="0.6"/>
          </g>
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <span className={`font-bold ${s.text} tracking-tight`}>
          <span className="text-violet-600">Con</span>
          <span className="text-slate-800">Tigo</span>
        </span>
      )}
    </Link>
  );
}

// Inline SVG version for better quality
export function ConTigoLogoSVG({ size = 'md', showText = true, className = '' }: ConTigoLogoProps) {
  const sizes = {
    sm: { height: 32, fontSize: 18 },
    md: { height: 40, fontSize: 22 },
    lg: { height: 48, fontSize: 26 },
    xl: { height: 64, fontSize: 32 },
  };

  const s = sizes[size];

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      {/* SVG Stacked Bars Icon */}
      <svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 48 48" 
        className="flex-shrink-0 group-hover:scale-105 transition-transform"
      >
        <defs>
          <linearGradient id={`barGrad1_${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id={`barGrad2_${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id={`barGrad3_${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>
        </defs>
        
        {/* Three Stacked Bars */}
        <g transform="translate(8, 10)">
          <rect x="0" y="0" width="32" height="8" rx="4" fill={`url(#barGrad1_${size})`} />
          <rect x="0" y="12" width="32" height="8" rx="4" fill={`url(#barGrad2_${size})`} />
          <rect x="0" y="24" width="32" height="8" rx="4" fill={`url(#barGrad3_${size})`} />
        </g>
      </svg>

      {/* Text */}
      {showText && (
        <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
          <span className="text-violet-600">con</span>
          <span className="text-slate-800">tigo</span>
        </span>
      )}
    </Link>
  );
}

// White version for dark backgrounds
export function ConTigoLogoWhite({ size = 'md', showText = true, className = '' }: ConTigoLogoProps) {
  const sizes = {
    sm: { height: 32, fontSize: 18 },
    md: { height: 40, fontSize: 22 },
    lg: { height: 48, fontSize: 26 },
    xl: { height: 64, fontSize: 32 },
  };

  const s = sizes[size];

  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      {/* SVG Stacked Bars Icon - White */}
      <svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 48 48" 
        className="flex-shrink-0 group-hover:scale-105 transition-transform"
      >
        <g transform="translate(8, 10)">
          <rect x="0" y="0" width="32" height="8" rx="4" fill="white" />
          <rect x="0" y="12" width="32" height="8" rx="4" fill="white" fillOpacity="0.7" />
          <rect x="0" y="24" width="32" height="8" rx="4" fill="white" fillOpacity="0.5" />
        </g>
      </svg>

      {/* Text */}
      {showText && (
        <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
          <span className="text-violet-300">con</span>
          <span className="text-white">tigo</span>
        </span>
      )}
    </Link>
  );
}
